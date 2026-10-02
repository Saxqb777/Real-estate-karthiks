import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { tenantCreateSchema } from "@/lib/schemas/tenant";

/** Tenants A–Z with lease count and their current (active) lease, if any. */
export const GET = handler(async () => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { leases: true } },
      leases: {
        where: { endDate: null },
        orderBy: { startDate: "desc" },
        select: { id: true, startDate: true, monthlyRent: true, unit: { select: { id: true, name: true } } },
      },
    },
  });
  const items = tenants.map(({ _count, leases, ...t }) => {
    const active = leases[0];
    return {
      ...t,
      leasesCount: _count.leases,
      activeLease: active
        ? {
            id: active.id,
            unitId: active.unit.id,
            unitName: active.unit.name,
            startDate: active.startDate,
            monthlyRent: active.monthlyRent,
          }
        : null,
    };
  });
  return json({ items });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, tenantCreateSchema);
  const tenant = await prisma.tenant.create({ data });
  return json({ ...tenant, leasesCount: 0, activeLease: null }, 201); // same shape as list items
});
