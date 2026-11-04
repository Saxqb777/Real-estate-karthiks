// One deposit refund: change it (amount, date, ref no.) or delete it (with its files).
import { ZodError } from "zod";
import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { loadLeaseDetail, refundsOf } from "@/app/api/_lib/lease-detail";
import { fileKeysOf } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { removeFiles } from "@/lib/files";
import { refundIssues, refundUpdateSchema } from "@/lib/schemas/lease";

/** Change a refund. All refunds together still can't be more than the deposit. Returns the lease detail. */
export const PATCH = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const refundId = await param(ctx, "refundId");
  const body = await parseBody(req, refundUpdateSchema);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${id} FOR UPDATE`;
    const refund = await tx.depositRefund.findFirst({
      where: { id: refundId, leaseId: id },
      include: { lease: { select: { startDate: true, securityDeposit: true } } },
    });
    if (!refund) throw notFound("Refund");
    const others = await refundsOf(id, tx, refundId);
    const amount = body.amount ?? refund.amount.toNumber();
    const issues = refundIssues({
      startDate: refund.lease.startDate,
      securityDeposit: refund.lease.securityDeposit.toNumber(),
      otherRefunds: others.total,
      otherCount: others.count,
      amount,
      refundDate: body.refundDate ?? refund.refundDate,
    });
    if (issues.length) {
      throw new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));
    }
    await tx.depositRefund.update({
      where: { id: refundId },
      data: {
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.refundDate !== undefined && { refundDate: body.refundDate }),
        ...(body.reference !== undefined && { reference: body.reference }),
      },
    });
  });

  return json(await loadLeaseDetail(id));
});

/** Delete a refund (entered by mistake) and its files. Returns the lease detail. */
export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const refundId = await param(ctx, "refundId");
  const files = await fileKeysOf({ depositRefundId: refundId });
  const { count } = await prisma.depositRefund.deleteMany({ where: { id: refundId, leaseId: id } });
  if (!count) throw notFound("Refund");
  await removeFiles(files);
  return json(await loadLeaseDetail(id));
});
