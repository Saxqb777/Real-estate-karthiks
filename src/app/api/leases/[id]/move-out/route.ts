import { ZodError } from "zod";
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { loadLeaseDetail, refundsOf } from "@/app/api/_lib/lease-detail";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { leaseMoveOutSchema, leaseRuleIssues, refundIssues } from "@/lib/schemas/lease";
import { paymentsOutsideLease, periodLabel } from "@/lib/schemas/payment";

const zodIssues = (issues: { field: string; message: string }[]) =>
  new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));

/**
 * End an open lease: set the LAST DAY of tenancy (endDate, inclusive — today at the latest), record the deposit refund
 * given then (one DepositRefund — ₹0 = nothing refunded; more refunds can be added later) and switch off reminders.
 * The tenant still counts as living there on that day; the next lease may start the day after.
 * The response is the lease detail + `refundId` (the refund just recorded, so its files can be attached), or null.
 */
export const POST = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, leaseMoveOutSchema);

  const refundId = await prisma.$transaction(async (tx) => {
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

    const merged = { startDate: existing.startDate, endDate: body.endDate, securityDeposit: existing.securityDeposit.toNumber() };
    const issues = leaseRuleIssues(merged).map((i) =>
      i.field === "endDate"
        ? { ...i, message: `Last day of tenancy ${formatDate(body.endDate)} can't be before the lease start ${formatDate(existing.startDate)}` }
        : i,
    );
    // the refund given at move-out (if one was entered): ₹0 alone = nothing refunded; ₹0 after earlier refunds = none
    const before = await refundsOf(id, tx);
    const amount = body.refundAmount ?? null;
    const record = amount !== null && !(amount === 0 && before.count > 0);
    const refundDate = body.refundDate ?? body.endDate;
    if (record) {
      for (const i of refundIssues({
        startDate: existing.startDate,
        securityDeposit: merged.securityDeposit,
        otherRefunds: before.total,
        otherCount: before.count,
        amount,
        refundDate,
      })) {
        issues.push({ field: i.field === "amount" ? "refundAmount" : "refundDate", message: i.message });
      }
    }
    if (issues.length) throw zodIssues(issues);

    const outside = paymentsOutsideLease(merged, existing.payments);
    if (outside.length) {
      const labels = outside.slice(0, 3).map((p) => periodLabel({ month: p.periodMonth, year: p.periodYear }));
      const message =
        `Rent is already recorded for ${labels.join(", ")}${outside.length > 3 ? ", …" : ""}, after a last day of tenancy of ${formatDate(body.endDate)}. ` +
        `Pick a later last day, or delete those payments first.`;
      throw fieldError(409, "endDate", message);
    }

    await tx.lease.update({
      where: { id },
      data: {
        endDate: body.endDate,
        ...(body.moveOutNotes !== undefined && { moveOutNotes: body.moveOutNotes }),
        reminderEnabled: false,
      },
    });
    if (!record) return null;
    const refund = await tx.depositRefund.create({
      data: { leaseId: id, amount: amount!, refundDate, reference: body.refundReference ?? null },
      select: { id: true },
    });
    return refund.id;
  });

  return json({ ...(await loadLeaseDetail(id)), refundId });
});
