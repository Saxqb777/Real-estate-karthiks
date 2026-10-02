import { ZodError } from "zod";
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { leaseDetailInclude, leaseMoveOutSchema, leaseRuleIssues, leaseStatus } from "@/lib/schemas/lease";
import { paymentsOutsideLease, periodLabel, summarizePayments } from "@/lib/schemas/payment";

/**
 * End an open lease: set the LAST DAY of tenancy (endDate, inclusive — today at the latest), record the deposit refund
 * and switch off reminders. The tenant still counts as living there on that day; the next lease may start the day after.
 */
export const POST = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, leaseMoveOutSchema);

  const lease = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${id} FOR UPDATE`; // serialise with payment writes + other edits
    const existing = await tx.lease.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true } },
        payments: { select: { periodMonth: true, periodYear: true } },
      },
    });
    if (!existing) throw notFound("Lease");
    if (existing.endDate) {
      throw conflict(
        `${existing.tenant.name}'s lease already has a last day of tenancy (${formatDate(existing.endDate)}) — only open leases can be moved out. Edit the lease to change that date.`,
      );
    }

    const merged = {
      startDate: existing.startDate,
      endDate: body.endDate,
      securityDeposit: existing.securityDeposit.toNumber(),
      depositRefundedAmount:
        body.depositRefundedAmount !== undefined ? body.depositRefundedAmount : (existing.depositRefundedAmount?.toNumber() ?? null),
      depositRefundDate: body.depositRefundDate !== undefined ? body.depositRefundDate : existing.depositRefundDate,
    };
    const issues = leaseRuleIssues(merged).map((i) =>
      i.field === "endDate"
        ? { ...i, message: `Last day of tenancy ${formatDate(body.endDate)} can't be before the lease start ${formatDate(existing.startDate)}` }
        : i,
    );
    if (issues.length) {
      throw new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));
    }

    const outside = paymentsOutsideLease(merged, existing.payments);
    if (outside.length) {
      const labels = outside.slice(0, 3).map((p) => periodLabel({ month: p.periodMonth, year: p.periodYear }));
      const message =
        `Rent is already recorded for ${labels.join(", ")}${outside.length > 3 ? ", …" : ""}, after a last day of tenancy of ${formatDate(body.endDate)}. ` +
        `Pick a later last day, or delete those payments first.`;
      throw fieldError(409, "endDate", message);
    }

    return tx.lease.update({
      where: { id },
      data: {
        endDate: body.endDate,
        depositRefundedAmount: merged.depositRefundedAmount,
        depositRefundDate: merged.depositRefundDate,
        ...(body.moveOutNotes !== undefined && { moveOutNotes: body.moveOutNotes }),
        reminderEnabled: false,
      },
      include: leaseDetailInclude,
    });
  });

  return json({ ...lease, ...leaseStatus(lease), ...summarizePayments(lease.payments) });
});
