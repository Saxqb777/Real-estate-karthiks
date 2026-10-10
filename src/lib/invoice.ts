// Rent receipts: invoice numbering (PE-<year>-<seq>) and the invoice payload. Server-only (uses Prisma).
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { amountInWords } from "@/lib/amount-words";
import { receiptMonthFor, rentForMonth } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { periodLabel, type InvoiceData } from "@/lib/schemas/payment";

export type { InvoiceData };

/** "PE-2026-0007" — year of the payment date + global invoice sequence (padded to 4, grows beyond 9999). */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `PE-${year}-${String(seq).padStart(4, "0")}`;
}

export type NewPayment = Omit<Prisma.PaymentUncheckedCreateInput, "invoiceNumber" | "invoiceSeq" | "paymentDate"> & {
  paymentDate: Date;
};

/**
 * Create a payment and give it its invoice number atomically: insert with a unique placeholder,
 * read the autoincremented invoiceSeq, then write the real number. Pass `tx` to join an outer transaction.
 */
export async function createPaymentWithInvoice(data: NewPayment, tx?: Prisma.TransactionClient) {
  const run = async (db: Prisma.TransactionClient) => {
    const { id, invoiceSeq } = await db.payment.create({
      data: { ...data, invoiceNumber: `PENDING-${randomUUID()}` },
      select: { id: true, invoiceSeq: true },
    });
    return db.payment.update({
      where: { id },
      data: { invoiceNumber: formatInvoiceNumber(data.paymentDate.getUTCFullYear(), invoiceSeq) },
    });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

/** Everything a printable rent receipt needs, or null when the payment doesn't exist. */
export async function buildInvoice(paymentId: string): Promise<InvoiceData | null> {
  const [payment, settings, plot] = await Promise.all([
    prisma.payment.findUnique({
      where: { id: paymentId },
      include: { lease: { include: { unit: true, tenant: true, rentChanges: { select: { effectiveFrom: true, monthlyRent: true } } } } },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.plot.findUnique({ where: { id: 1 } }),
  ]);
  if (!payment) return null;
  const { lease } = payment;
  const amount = payment.amount.toNumber();
  const period = { month: payment.periodMonth, year: payment.periodYear };
  // the rent for the month this receipt is for (after any rent change)
  const monthRent = rentForMonth(
    { monthlyRent: lease.monthlyRent.toNumber(), rentChanges: lease.rentChanges.map((c) => ({ effectiveFrom: c.effectiveFrom, monthlyRent: c.monthlyRent.toNumber() })) },
    period.year,
    period.month,
  );
  const samePeriod = await prisma.payment.findMany({
    where: { leaseId: payment.leaseId, periodYear: payment.periodYear, periodMonth: payment.periodMonth },
    select: { id: true, amount: true, paymentDate: true, periodYear: true, periodMonth: true, invoiceSeq: true },
  });
  const month = receiptMonthFor(
    monthRent,
    { id: payment.id, amount, paymentDate: payment.paymentDate, periodYear: payment.periodYear, periodMonth: payment.periodMonth, invoiceSeq: payment.invoiceSeq },
    samePeriod.map((p) => ({ ...p, amount: p.amount.toNumber() })),
  );

  return {
    paymentId: payment.id,
    invoiceNumber: payment.invoiceNumber,
    issueDate: payment.paymentDate.toISOString(),
    paymentDate: payment.paymentDate.toISOString(),
    brand: {
      brandName: settings?.brandName ?? "Pattukottai Estates",
      subtitle: settings?.subtitle ?? null,
      ownerEmail: settings?.ownerEmail ?? null,
    },
    property: {
      unitName: lease.unit.name,
      unitType: lease.unit.type,
      address: lease.unit.address,
      townName: plot?.townName ?? "Pattukottai",
    },
    tenant: { name: lease.tenant.name, phone: lease.tenant.phone, email: lease.tenant.email },
    period: { ...period, label: periodLabel(period) },
    amount,
    amountInWords: amountInWords(amount),
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    lease: {
      id: lease.id,
      startDate: lease.startDate.toISOString(),
      endDate: lease.endDate?.toISOString() ?? null,
      monthlyRent: monthRent,
      securityDeposit: lease.securityDeposit.toNumber(),
    },
    month: { rent: month.rent, paidBefore: month.paidBefore, balance: month.balance },
  };
}
