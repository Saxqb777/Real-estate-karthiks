// GET/POST /api/units — list ordered front, back, then unpositioned (oldest first); optional ?active=true|false.
import { conflict, handler, json, parseBody, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  UNIT_POSITION_LOCK,
  positionTakenMessage,
  unitCreateSchema,
  unitListQuerySchema,
  type UnitCounts,
} from "@/lib/schemas/unit";

export const GET = handler(async (req) => {
  const { active } = parseQuery(req, unitListQuerySchema);
  const units = await prisma.unit.findMany({
    where: active === undefined ? undefined : { isActive: active },
    // Postgres sorts the Position enum in declaration order: front, back.
    orderBy: [{ position: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: {
      _count: { select: { offers: true, leases: true, expenses: true, propertyTax: true } },
      offers: { orderBy: { amount: "desc" }, take: 1, select: { amount: true } },
      leases: { where: { endDate: null }, orderBy: { startDate: "desc" }, take: 1, include: { tenant: true } },
    },
  });
  return json({
    items: units.map(({ offers, leases, ...unit }) => ({
      ...unit,
      bestOffer: offers[0]?.amount ?? null,
      activeLease: leases[0] ?? null,
    })),
  });
});

const NO_COUNTS: UnitCounts = { offers: 0, leases: 0, expenses: 0, propertyTax: 0 };

export const POST = handler(async (req) => {
  const data = await parseBody(req, unitCreateSchema);
  const unit = await prisma.$transaction(async (tx) => {
    if (data.position && data.isActive) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${UNIT_POSITION_LOCK}::bigint)`;
      const holder = await tx.unit.findFirst({
        where: { position: data.position, isActive: true },
        select: { name: true },
      });
      if (holder) throw conflict(positionTakenMessage(data.position, holder.name));
    }
    return tx.unit.create({ data });
  });
  // Same shape as GET /api/units/[id] (a new unit has no offers or leases yet).
  return json({ ...unit, _count: NO_COUNTS, bestOffer: null, activeLease: null, offers: [] }, 201);
});
