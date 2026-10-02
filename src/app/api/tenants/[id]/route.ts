import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { sumAmounts } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { compareLeases } from "@/lib/schemas/lease";
import { summarizePayments } from "@/lib/schemas/payment";
import { tenantUpdateSchema } from "@/lib/schemas/tenant";

/** Tenant profile: all leases (active first) with payment stats, plus totals. */
export const GET = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      leases: {
        include: {
          unit: { select: { id: true, name: true, position: true } },
          payments: { select: { amount: true, periodMonth: true, periodYear: true } },
        },
      },
    },
  });
  if (!tenant) throw notFound("Tenant");

  const leases = tenant.leases
    .map(({ payments, ...l }) => ({ ...l, isActive: l.endDate === null, ...summarizePayments(payments) }))
    .sort(compareLeases);
  const active = leases.find((l) => l.isActive);
  return json({
    ...tenant,
    leases,
    leasesCount: leases.length,
    activeLease: active
      ? { id: active.id, unitId: active.unit.id, unitName: active.unit.name, startDate: active.startDate, monthlyRent: active.monthlyRent }
      : null,
    paymentsTotal: sumAmounts(leases.map((l) => ({ amount: l.paymentsTotal }))),
  });
});

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const data = await parseBody(req, tenantUpdateSchema);
  if (!(await prisma.tenant.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Tenant");
  return json(await prisma.tenant.update({ where: { id }, data }));
});

/** Tenants with lease history are kept for the records — deleting them is refused. */
export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { leases: { orderBy: { startDate: "desc" }, include: { unit: { select: { name: true } } } } },
  });
  if (!tenant) throw notFound("Tenant");
  if (tenant.leases.length) {
    const n = tenant.leases.length;
    const latest = tenant.leases[0];
    throw conflict(
      `Can't delete ${tenant.name}: they have ${n} lease${n === 1 ? "" : "s"} on record ` +
        `(latest: ${latest.unit.name}, from ${formatDate(latest.startDate)}). Tenants with lease history are kept for your records.`,
    );
  }
  await prisma.tenant.delete({ where: { id } });
  return json({ ok: true });
});
