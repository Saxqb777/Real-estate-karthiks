// GET/PUT/DELETE /api/units/[id]
import type { Prisma } from "@prisma/client";
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  UNIT_POSITION_LOCK,
  positionTakenMessage,
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
    const existing = await tx.unit.findUnique({ where: { id }, select: { position: true, isActive: true } });
    if (!existing) throw notFound("Unit");
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
