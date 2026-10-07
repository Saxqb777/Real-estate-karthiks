import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { prisma } from "@/lib/db";
import { dateOnly, periodLabel } from "@/lib/dates";
import { leaseDetailInclude, leaseRent, leaseStatus, rentChangeCreateSchema } from "@/lib/schemas/lease";
import { summarizePayments } from "@/lib/schemas/payment";

const monthNo = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();

/**
 * Add a rent change: from `fromMonth` ("2026-10") every month of the lease expects `monthlyRent`. Months before keep
 * their old rent. A second change for the same month replaces the first. Returns the lease detail.
 */
export const POST = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, rentChangeCreateSchema);
  const [y, m] = body.fromMonth.split("-").map(Number);
  const effectiveFrom = dateOnly(y, m, 1);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${id} FOR UPDATE`;
    const lease = await tx.lease.findUnique({ where: { id }, select: { startDate: true, endDate: true } });
    if (!lease) throw notFound("Lease");
    const label = periodLabel({ month: m, year: y });
    if (monthNo(effectiveFrom) <= monthNo(lease.startDate)) {
      throw fieldError(409, "fromMonth", `${label} is the lease's first month — edit the lease's rent instead, or pick a later month`);
    }
    if (lease.endDate && monthNo(effectiveFrom) > monthNo(lease.endDate)) {
      throw fieldError(409, "fromMonth", `${label} is after this lease's last month`);
    }
    await tx.leaseRentChange.upsert({
      where: { leaseId_effectiveFrom: { leaseId: id, effectiveFrom } },
      create: { leaseId: id, effectiveFrom, monthlyRent: body.monthlyRent },
      update: { monthlyRent: body.monthlyRent },
    });
  });

  const lease = await prisma.lease.findUniqueOrThrow({ where: { id }, include: leaseDetailInclude });
  return json({ ...lease, ...leaseRent(lease), ...leaseStatus(lease), ...summarizePayments(lease.payments) }, 201);
});
