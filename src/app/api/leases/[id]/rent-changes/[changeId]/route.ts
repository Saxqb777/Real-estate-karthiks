import { handler, json, notFound, param } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leaseDetailInclude, leaseRent, leaseStatus } from "@/lib/schemas/lease";
import { summarizePayments } from "@/lib/schemas/payment";

/** Remove a rent change (entered by mistake): those months go back to the rent before it. Returns the lease detail. */
export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const changeId = await param(ctx, "changeId");
  const { count } = await prisma.leaseRentChange.deleteMany({ where: { id: changeId, leaseId: id } });
  if (!count) throw notFound("Rent change");
  const lease = await prisma.lease.findUniqueOrThrow({ where: { id }, include: leaseDetailInclude });
  return json({ ...lease, ...leaseRent(lease), ...leaseStatus(lease), ...summarizePayments(lease.payments) });
});
