// Deposit refunds of a lease (owner, 4/11/2026: "add the receipt to the refund given and add a refund if I decide to
// refund more later"). Each refund has its own date, ref no. (UTR) and files; together they can't be more than the deposit.
import { ZodError } from "zod";
import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { loadLeaseDetail, refundsOf } from "@/app/api/_lib/lease-detail";
import { prisma } from "@/lib/db";
import { refundCreateSchema, refundIssues } from "@/lib/schemas/lease";

/**
 * Add a refund. A ₹0 refund records "nothing refunded" (the whole deposit kept) and only stands alone; a real refund
 * replaces such a ₹0 entry (its files move onto the new refund). Returns { refund: { id }, lease: <lease detail> }.
 */
export const POST = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, refundCreateSchema);

  const refundId = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${id} FOR UPDATE`; // one refund write at a time per lease
    const lease = await tx.lease.findUnique({ where: { id }, select: { startDate: true, securityDeposit: true } });
    if (!lease) throw notFound("Lease");
    const others = await refundsOf(id, tx);
    const zeros = others.rows.filter((r) => r.amount.toNumber() === 0);
    const real = { total: others.total, count: others.count - (body.amount > 0 ? zeros.length : 0) };
    const issues = refundIssues({
      startDate: lease.startDate,
      securityDeposit: lease.securityDeposit.toNumber(),
      otherRefunds: real.total,
      otherCount: real.count,
      amount: body.amount,
      refundDate: body.refundDate,
    });
    if (issues.length) {
      throw new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));
    }
    const refund = await tx.depositRefund.create({
      data: { leaseId: id, amount: body.amount, refundDate: body.refundDate, reference: body.reference ?? null },
      select: { id: true },
    });
    if (body.amount > 0 && zeros.length) {
      const zeroIds = zeros.map((z) => z.id);
      await tx.attachment.updateMany({ where: { depositRefundId: { in: zeroIds } }, data: { depositRefundId: refund.id } });
      await tx.depositRefund.deleteMany({ where: { id: { in: zeroIds } } });
    }
    return refund.id;
  });

  return json({ refund: { id: refundId }, lease: await loadLeaseDetail(id) }, 201);
});
