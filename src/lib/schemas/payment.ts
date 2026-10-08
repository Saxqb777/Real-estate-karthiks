// Payment input schemas + pure rent-period helpers (shared by /api/payments, /api/leases and the UI).
import type { Payment } from "@prisma/client";
import { z } from "zod";
import "./messages";
import { sumAmounts } from "@/lib/calculations";
import { formatDate, periodLabel, todayIST } from "@/lib/dates";
import { zDate, zInt, zPositiveMoney, zText } from "@/lib/validation";
import type { Serialized } from "@/lib/types";
import { zRequired } from "@/lib/validation";

export const PAYMENT_METHODS = ["cash", "bank", "upi", "other"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export { MONTH_NAMES, periodLabel } from "@/lib/dates";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const paymentCreateSchema = z.object({
  leaseId: z.string({ message: "Choose a lease" }).trim().min(1, "Choose a lease"),
  amount: zRequired(zPositiveMoney),
  paymentDate: zRequired(
    zDate.refine((d) => d.getTime() <= todayIST().getTime(), "can't be in the future — record rent on the day it was received"),
  ),
  periodMonth: zRequired(zInt(1, 12)),
  periodYear: zRequired(zInt(2000, 2100)),
  method: z.preprocess(
    (v) => (typeof v === "string" ? blankToUndefined(v.trim().toLowerCase()) : blankToUndefined(v)),
    z.enum(PAYMENT_METHODS, { message: "must be cash, bank, upi or other" }).default("cash"),
  ),
  notes: zText(1000),
});

/** GET /api/payments?leaseId=&year=&yearMode=fy|calendar — year filters by the day the rent was RECEIVED (cash). */
export const paymentListQuerySchema = z.object({
  leaseId: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  year: z.preprocess(blankToUndefined, zInt(2000, 2100).optional()),
  yearMode: z.preprocess(blankToUndefined, z.enum(["fy", "calendar"], { message: "must be fy or calendar" }).default("fy")),
});

export type PaymentCreateInput = z.input<typeof paymentCreateSchema>;

// ---- Rent periods -------------------------------------------------------------------------------

export interface Period {
  month: number; // 1-12
  year: number;
}

type DateLike = Date | string;
const toDate = (d: DateLike) => (typeof d === "string" ? new Date(d) : d);

/** Months since year 0 — makes periods comparable with < / >. */
export const periodIndex = (p: Period) => p.year * 12 + (p.month - 1);

/** Period containing a date-only value (UTC). */
export function periodOf(d: DateLike): Period {
  const dt = toDate(d);
  return { month: dt.getUTCMonth() + 1, year: dt.getUTCFullYear() };
}

/**
 * First and last rent periods a lease may be paid for (last = null while the lease is open-ended).
 * endDate is the LAST DAY of tenancy (inclusive), so the last rent month is the month of endDate:
 * a last day of 31/5 or 1/5 both make May the last month.
 */
export function leasePeriodBounds(lease: { startDate: DateLike; endDate: DateLike | null }) {
  return {
    first: periodOf(lease.startDate),
    last: lease.endDate ? periodOf(toDate(lease.endDate)) : null,
  };
}

/** Why a rent period can't be recorded against this lease, or null when it's fine. */
export function paymentPeriodError(lease: { startDate: DateLike; endDate: DateLike | null }, p: Period): string | null {
  const { first, last } = leasePeriodBounds(lease);
  if (last && periodIndex(last) < periodIndex(first)) {
    return `This lease's last day (${formatDate(lease.endDate)}) is before its start (${formatDate(lease.startDate)}) — fix the lease dates first.`;
  }
  if (periodIndex(p) < periodIndex(first)) {
    return `Rent period ${periodLabel(p)} is before this lease started (${periodLabel(first)}). Choose ${periodLabel(first)} or later.`;
  }
  if (last && periodIndex(p) > periodIndex(last)) {
    return `Rent period ${periodLabel(p)} is after the tenant's last day of tenancy (${formatDate(lease.endDate)}) — this lease's last rent month is ${periodLabel(last)}. Choose ${periodLabel(last)} or earlier.`;
  }
  return null;
}

/** Payments whose period falls outside a lease's (possibly new) dates, oldest period first. */
export function paymentsOutsideLease<P extends { periodMonth: number; periodYear: number }>(
  lease: { startDate: DateLike; endDate: DateLike | null },
  payments: P[],
): P[] {
  return payments
    .filter((p) => paymentPeriodError(lease, { month: p.periodMonth, year: p.periodYear }) !== null)
    .sort((a, b) => a.periodYear - b.periodYear || a.periodMonth - b.periodMonth);
}

// ---- Per-lease payment summary ------------------------------------------------------------------

type AmountLike = number | { toNumber(): number };

export interface PaymentStats {
  paymentsCount: number;
  paymentsTotal: number;
  lastPaidPeriod: Period | null;
}

/** Count, total (via sumAmounts) and latest paid period of a lease's payments. */
export function summarizePayments(payments: { amount: AmountLike; periodMonth: number; periodYear: number }[]): PaymentStats {
  let last: Period | null = null;
  for (const p of payments) {
    const period = { month: p.periodMonth, year: p.periodYear };
    if (!last || periodIndex(period) > periodIndex(last)) last = period;
  }
  return {
    paymentsCount: payments.length,
    paymentsTotal: sumAmounts(payments.map((p) => ({ amount: typeof p.amount === "number" ? p.amount : p.amount.toNumber() }))),
    lastPaidPeriod: last,
  };
}

// ---- Response types (JSON as returned by the API) ------------------------------------------------

export type PaymentDTO = Serialized<Payment>;

/** GET /api/payments → PaymentListResponse; POST /api/payments → PaymentListItem */
export type PaymentListItem = PaymentDTO & {
  lease: { id: string; unit: { id: string; name: string }; tenant: { id: string; name: string } };
};
export interface PaymentListResponse {
  items: PaymentListItem[];
  count: number;
  total: number;
}

/** GET /api/payments/[id] */
export type PaymentDetail = PaymentDTO & {
  lease: {
    id: string;
    startDate: string;
    endDate: string | null;
    monthlyRent: number;
    unit: { id: string; name: string };
    tenant: { id: string; name: string; phone: string | null };
  };
};

/** GET /api/payments/[id]/invoice — everything a printable rent receipt needs. */
export interface InvoiceData {
  paymentId: string;
  invoiceNumber: string;
  /** ISO date — the receipt is dated on the payment date */
  issueDate: string;
  paymentDate: string;
  brand: { brandName: string; subtitle: string | null; ownerEmail: string | null };
  property: { unitName: string; unitType: string; address: string | null; townName: string };
  tenant: { name: string; phone: string | null; email: string | null };
  period: Period & { label: string };
  amount: number;
  amountInWords: string;
  method: PaymentMethodValue;
  notes: string | null;
  lease: { id: string; startDate: string; endDate: string | null; monthlyRent: number; securityDeposit: number };
}
