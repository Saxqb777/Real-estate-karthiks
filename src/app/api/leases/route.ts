import { Prisma } from "@prisma/client";
import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { prisma } from "@/lib/db";
import { todayIST } from "@/lib/dates";
import { compareLeases, leaseConflictMessage, leaseCreateSchema, leaseListQuerySchema, leaseStatus } from "@/lib/schemas/lease";
import { summarizePayments } from "@/lib/schemas/payment";

/**
 * Leases (active first, then newest) with unit, tenant, payment stats, isActive and state (incoming / current / ended).
 * status=active → not ended (open-ended or the last day of tenancy is today or later); status=past → ended.
 */
export const GET = handler(async (req) => {
  const q = parseQuery(req, leaseListQuerySchema);
  const today = todayIST();
  const leases = await prisma.lease.findMany({
    where: {
      unitId: q.unitId,
      tenantId: q.tenantId,
      ...(q.status === "active" && { OR: [{ endDate: null }, { endDate: { gte: today } }] }),
      ...(q.status === "past" && { endDate: { lt: today } }),
    },
    include: {
      unit: { select: { id: true, name: true, position: true } },
      tenant: { select: { id: true, name: true, phone: true } },
      payments: { select: { amount: true, periodMonth: true, periodYear: true } },
    },
  });
  const items = leases
    .map(({ payments, ...l }) => ({ ...l, ...leaseStatus(l, today), ...summarizePayments(payments) }))
    .sort((a, b) => compareLeases(a, b, today));
  return json({ items });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, leaseCreateSchema);
  const lease = await prisma.$transaction(async (tx) => {
    // Serialise lease writes per unit so two concurrent saves can't both pass the overlap check.
    await tx.$queryRaw`SELECT 1 FROM unit WHERE id = ${data.unitId} FOR UPDATE`;
    const [unit, tenant] = await Promise.all([
      tx.unit.findUnique({
        where: { id: data.unitId },
        include: { leases: { select: { startDate: true, endDate: true, tenant: { select: { name: true } } } } },
      }),
      tx.tenant.findUnique({ where: { id: data.tenantId }, select: { id: true } }),
    ]);
    if (!unit) throw fieldError(404, "unitId", "Unit not found");
    if (!unit.isActive) {
      throw fieldError(409, "unitId", `${unit.name} is marked inactive — reactivate it before adding a lease`);
    }
    if (!tenant) throw fieldError(404, "tenantId", "Tenant not found");
    const clash = leaseConflictMessage(data, unit.leases, unit.name);
    if (clash) throw fieldError(409, "startDate", clash);

    return tx.lease.create({
      data: data satisfies Prisma.LeaseUncheckedCreateInput,
      include: {
        unit: { select: { id: true, name: true, position: true } },
        tenant: { select: { id: true, name: true, phone: true } },
      },
    });
  });
  return json({ ...lease, ...leaseStatus(lease), ...summarizePayments([]) }, 201);
});
