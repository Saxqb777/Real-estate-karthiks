import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { sumAmounts } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { createPaymentWithInvoice } from "@/lib/invoice";
import { yearRange } from "@/lib/schemas/expense";
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

/** Payments, newest first (optionally for one lease and/or one FY / calendar year by the day received), with count and total. */
export const GET = handler(async (req) => {
  const { leaseId, year, yearMode, from, to } = parseQuery(req, paymentListQuerySchema);
  // custom dates (inclusive) win over a year
  const yr = year !== undefined ? yearRange(year, yearMode) : null;
  const range = from && to ? { gte: from, lte: to } : yr ? { gte: yr.from, lt: yr.to } : null;
  const items = await prisma.payment.findMany({
    where: { leaseId, ...(range && { paymentDate: range }) },
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
    // Share-lock the lease so its dates can't change (PUT / move-out lock it FOR UPDATE) until this payment is saved.
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${data.leaseId} FOR SHARE`;
    const lease = await tx.lease.findUnique({ where: { id: data.leaseId }, select: { startDate: true, endDate: true } });
    if (!lease) throw fieldError(404, "leaseId", "Lease not found");
    const periodError = paymentPeriodError(lease, { month: data.periodMonth, year: data.periodYear });
    if (periodError) throw fieldError(400, "periodMonth", periodError);

    const { id } = await createPaymentWithInvoice(data, tx);
    return tx.payment.findUniqueOrThrow({ where: { id }, include: paymentInclude });
  });
  return json(payment, 201);
});
