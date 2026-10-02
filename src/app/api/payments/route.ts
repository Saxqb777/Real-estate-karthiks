import { ApiError, handler, json, parseBody, parseQuery } from "@/lib/api";
import { sumAmounts } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { createPaymentWithInvoice } from "@/lib/invoice";
import { paymentCreateSchema, paymentListQuerySchema, paymentPeriodError } from "@/lib/schemas/payment";

const paymentInclude = {
  lease: {
    select: {
      id: true,
      unit: { select: { id: true, name: true } },
      tenant: { select: { id: true, name: true } },
    },
  },
} as const;

/** Payments, newest first (optionally for one lease), with count and total. */
export const GET = handler(async (req) => {
  const { leaseId } = parseQuery(req, paymentListQuerySchema);
  const items = await prisma.payment.findMany({
    where: { leaseId },
    orderBy: [{ paymentDate: "desc" }, { invoiceSeq: "desc" }],
    include: paymentInclude,
  });
  return json({
    items,
    count: items.length,
    total: sumAmounts(items.map((p) => ({ amount: p.amount.toNumber() }))),
  });
});

/** Record rent; the invoice number (PE-<year>-<seq>) is assigned atomically. */
export const POST = handler(async (req) => {
  const data = await parseBody(req, paymentCreateSchema);
  const payment = await prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUnique({ where: { id: data.leaseId }, select: { startDate: true, endDate: true } });
    if (!lease) throw new ApiError(404, "Lease not found", [{ field: "leaseId", message: "Lease not found" }]);
    const periodError = paymentPeriodError(lease, { month: data.periodMonth, year: data.periodYear });
    if (periodError) throw new ApiError(400, periodError, [{ field: "periodMonth", message: periodError }]);

    const { id } = await createPaymentWithInvoice(data, tx);
    return tx.payment.findUniqueOrThrow({ where: { id }, include: paymentInclude });
  });
  return json(payment, 201);
});
