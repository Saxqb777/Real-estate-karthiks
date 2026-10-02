import { ZodError } from "zod";
import { ApiError, conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { leaseDetailInclude, leaseMoveOutSchema, leaseRuleIssues } from "@/lib/schemas/lease";
import { paymentsOutsideLease, periodLabel, summarizePayments } from "@/lib/schemas/payment";

/** End an active lease: set the move-out date, record the deposit refund and switch off reminders. */
export const POST = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, leaseMoveOutSchema);

  const lease = await prisma.$transaction(async (tx) => {
    const existing = await tx.lease.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true } },
        payments: { select: { periodMonth: true, periodYear: true } },
      },
    });
    if (!existing) throw notFound("Lease");
    if (existing.endDate) {
      throw conflict(`${existing.tenant.name}'s lease already ended on ${formatDate(existing.endDate)} — only active leases can be moved out`);
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
      i.field === "endDate" ? { ...i, message: `Move-out date ${formatDate(body.endDate)} can't be before the lease start ${formatDate(existing.startDate)}` } : i,
    );
    if (issues.length) {
      throw new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));
    }

    const outside = paymentsOutsideLease(merged, existing.payments);
    if (outside.length) {
      const labels = outside.slice(0, 3).map((p) => periodLabel({ month: p.periodMonth, year: p.periodYear }));
      const message =
        `Rent is already recorded for ${labels.join(", ")}${outside.length > 3 ? ", …" : ""}, after a move-out on ${formatDate(body.endDate)}. ` +
        `Pick a later move-out date, or delete those payments first.`;
      throw new ApiError(409, message, [{ field: "endDate", message }]);
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

  return json({ ...lease, isActive: false, ...summarizePayments(lease.payments) });
});
