// GET/PUT/DELETE /api/units/[id]
import type { Prisma } from "@prisma/client";
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  UNIT_POSITION_LOCK,
  positionTakenMessage,
  unitDeactivateBlockedMessage,
  unitDeleteBlockedMessage,
  unitUpdateSchema,
} from "@/lib/schemas/unit";

const detailInclude = {
  _count: { select: { offers: true, leases: true, expenses: true, propertyTax: true } },
  offers: { orderBy: [{ amount: "desc" }, { offerDate: "desc" }, { createdAt: "desc" }] },
  leases: { where: { endDate: null }, orderBy: { startDate: "desc" }, take: 1, include: { tenant: true } },
} satisfies Prisma.UnitInclude;

/** Unit + _count + offers (highest first) + bestOffer + activeLease (with tenant). */
async function loadDetail(id: string) {
  const unit = await prisma.unit.findUnique({ where: { id }, include: detailInclude });
  if (!unit) throw notFound("Unit");
  const { leases, ...rest } = unit;
  return { ...rest, bestOffer: rest.offers[0]?.amount ?? null, activeLease: leases[0] ?? null };
}

export const GET = handler(async (_req, ctx) => json(await loadDetail(await param(ctx, "id"))));

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const data = await parseBody(req, unitUpdateSchema);
  await prisma.$transaction(async (tx) => {
    // Deactivating: take the unit row lock lease writes take, so no lease can start between the check and the update.
    if (data.isActive === false) await tx.$queryRaw`SELECT 1 FROM unit WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.unit.findUnique({ where: { id }, select: { name: true, position: true, isActive: true } });
    if (!existing) throw notFound("Unit");
    if (data.isActive === false && existing.isActive) {
      // An inactive unit can't hold a running lease (POST /api/leases refuses inactive units for the same reason).
      const active = await tx.lease.findFirst({ where: { unitId: id, endDate: null }, select: { tenant: { select: { name: true } } } });
      if (active) throw conflict(unitDeactivateBlockedMessage(existing.name, active.tenant.name));
    }
    const position = data.position !== undefined ? data.position : existing.position;
    const isActive = data.isActive ?? existing.isActive;
    if (position && isActive && (data.position !== undefined || data.isActive !== undefined)) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${UNIT_POSITION_LOCK}::bigint)`;
      const holder = await tx.unit.findFirst({
        where: { position, isActive: true, id: { not: id } },
        select: { name: true },
      });
      if (holder) throw conflict(positionTakenMessage(position, holder.name));
    }
    await tx.unit.update({ where: { id }, data });
  });
  return json(await loadDetail(id));
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  await prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id },
      select: { name: true, _count: { select: { leases: true, expenses: true, propertyTax: true } } },
    });
    if (!unit) throw notFound("Unit");
    const blocked = unitDeleteBlockedMessage(unit.name, unit._count);
    if (blocked) throw conflict(blocked);
    await tx.unit.delete({ where: { id } }); // offers cascade; action items are unlinked (SetNull)
  });
  return json({ ok: true });
});
