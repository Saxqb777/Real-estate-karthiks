// Lease input schemas + pure lease rules (shared by /api/leases and the UI).
// endDate is the LAST DAY of tenancy (inclusive): a lease covers every day from startDate through endDate, and the
// next lease on the unit may start the day after. null endDate = open-ended. UI label: "Last day of tenancy".
// State on a date: start after it → "incoming"; last day before it → "ended"; otherwise "current" (= active).
import type { Lease, Payment, Prisma, Tenant, Unit } from "@prisma/client";
import { z } from "zod";
import "./messages";
import { rentOn } from "@/lib/calculations";
import type { LeaseState } from "@/lib/dashboard-types";
import { addDays, formatDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { zBool, zDate, zDateOrNull, zInt, zMoney, zPositiveMoney, zReference, zText } from "@/lib/validation";
import type { PaymentStats } from "./payment";
import type { Serialized } from "@/lib/types";
import { zRequired } from "@/lib/validation";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const zRef = (msg: string) => z.string({ message: msg }).trim().min(1, msg);
/** Optional money that may be "" / null → null. */
const zMoneyOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : v), zMoney.nullable());

// The last day of tenancy / refund date is recorded when it happens (today at the latest), never planned ahead.
const notFuture = (d: Date | null) => d === null || d.getTime() <= todayIST().getTime();
const END_IN_FUTURE =
  "can't be in the future — leave it empty while the tenant still lives there, and record the last day of tenancy when they leave";
const REFUND_IN_FUTURE = "can't be in the future — record the refund once it's paid";
const zEndDate = zDateOrNull.refine(notFuture, END_IN_FUTURE);
const zRefundDate = zDateOrNull.refine(notFuture, REFUND_IN_FUTURE);

// ---- Rules (pure; also usable client-side for instant feedback) ---------------------------------

type DateLike = Date | string;
const ms = (d: DateLike) => (typeof d === "string" ? new Date(d) : d).getTime();
const inr = (n: number) => formatINR(n, !Number.isInteger(n));

export interface LeaseRuleInput {
  startDate: DateLike;
  endDate: DateLike | null;
  securityDeposit: number;
  /** Σ deposit refunds already given (the deposit can't drop below it) */
  refundedTotal?: number;
  agreementEndDate?: DateLike | null;
}

/** Field-level problems with a lease's own values (dates order, deposit vs refunds). */
export function leaseRuleIssues(l: LeaseRuleInput): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  if (l.endDate && ms(l.endDate) < ms(l.startDate)) {
    issues.push({
      field: "endDate",
      message: `Last day of tenancy ${formatDate(l.endDate)} can't be before the start date ${formatDate(l.startDate)}`,
    });
  }
  if (l.refundedTotal && l.refundedTotal > l.securityDeposit) {
    issues.push({
      field: "securityDeposit",
      message: `The deposit can't be less than what has already been refunded (${inr(l.refundedTotal)})`,
    });
  }
  if (l.agreementEndDate && ms(l.agreementEndDate) < ms(l.startDate)) {
    issues.push({
      field: "agreementEndDate",
      message: `Agreement end ${formatDate(l.agreementEndDate)} can't be before the start date ${formatDate(l.startDate)}`,
    });
  }
  return issues;
}

export interface RefundRuleInput {
  /** the lease's start and security deposit */
  startDate: DateLike;
  securityDeposit: number;
  /** Σ the lease's OTHER refunds (not the one being added / changed) */
  otherRefunds: number;
  /** how many other refunds there are */
  otherCount: number;
  amount: number | null;
  refundDate: DateLike | null;
}

/**
 * Problems with one deposit refund (owner, 4/11/2026: a lease can have several). All refunds together can't be more than
 * the deposit; a refund can't be dated before the lease started; ₹0 means "nothing refunded" and only stands alone.
 */
export function refundIssues(r: RefundRuleInput): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  if (r.amount != null) {
    const total = round2(r.otherRefunds + r.amount);
    if (total > r.securityDeposit) {
      const left = round2(Math.max(0, r.securityDeposit - r.otherRefunds));
      issues.push({
        field: "amount",
        message: r.otherCount
          ? `Only ${inr(left)} of the ${inr(r.securityDeposit)} deposit is left to refund`
          : `A refund can't be more than the deposit (${inr(r.securityDeposit)})`,
      });
    } else if (r.amount === 0 && r.otherCount > 0) {
      issues.push({ field: "amount", message: "Enter the amount refunded" });
    }
  }
  if (r.refundDate && ms(r.refundDate) < ms(r.startDate)) {
    issues.push({
      field: "refundDate",
      message: `The refund can't be dated before the lease started (${formatDate(r.startDate)})`,
    });
  }
  return issues;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface LeaseSpan {
  startDate: DateLike;
  endDate: DateLike | null;
}

/** Inclusive [start, last day] intervals share at least one day; null end = open-ended. */
export function leasesOverlap(a: LeaseSpan, b: LeaseSpan): boolean {
  const aEnd = a.endDate ? ms(a.endDate) : Infinity;
  const bEnd = b.endDate ? ms(b.endDate) : Infinity;
  return ms(a.startDate) <= bEnd && ms(b.startDate) <= aEnd;
}

/** incoming / current / ended on `today` (IST by default). */
export function leaseStateOf(l: LeaseSpan, today: Date = todayIST()): LeaseState {
  if (ms(l.startDate) > today.getTime()) return "incoming";
  if (l.endDate && ms(l.endDate) < today.getTime()) return "ended";
  return "current";
}

/** Active = not ended yet (open-ended, or today is on/before the last day of tenancy). Includes incoming leases. */
export const isLeaseActive = (l: LeaseSpan, today: Date = todayIST()) => leaseStateOf(l, today) !== "ended";

/** "1/1/2025 – 31/12/2025" (start – last day) or "from 1/1/2025, still active" */
export const leaseSpanLabel = (l: LeaseSpan) =>
  l.endDate ? `${formatDate(l.startDate)} – ${formatDate(l.endDate)}` : `from ${formatDate(l.startDate)}, still active`;

/**
 * Message naming the first lease (of the same unit, excluding the one being edited) that `candidate`
 * collides with, or null. A unit can hold only one active lease, and no two leases may overlap.
 */
export function leaseConflictMessage(
  candidate: LeaseSpan,
  others: (LeaseSpan & { tenant: { name: string } })[],
  unitName: string,
): string | null {
  const sorted = [...others].sort((a, b) => ms(a.startDate) - ms(b.startDate));
  if (!candidate.endDate) {
    const active = sorted.find((o) => !o.endDate);
    if (active) {
      return `${unitName} already has an open lease (${active.tenant.name}, ${leaseSpanLabel(active)}). Record that tenant's last day of tenancy before adding another open lease.`;
    }
  }
  const hit = sorted.find((o) => leasesOverlap(candidate, o));
  if (!hit) return null;
  const after = hit.endDate ? ` — the next lease can start on ${formatDate(addDays(new Date(ms(hit.endDate)), 1))}, the day after their last day` : "";
  return `These dates overlap ${hit.tenant.name}'s lease on ${unitName} (${leaseSpanLabel(hit)}). Leases on the same unit can't share a day${after}.`;
}

/** Why a lease can't be deleted (it has recorded rent), or null. */
export function leaseDeleteBlockedMessage(tenantName: string, unitName: string, paymentsCount: number): string | null {
  if (!paymentsCount) return null;
  const n = `${paymentsCount} rent payment${paymentsCount === 1 ? "" : "s"}`;
  const them = paymentsCount === 1 ? "that payment" : "those payments";
  return `${tenantName}'s lease on ${unitName} has ${n} recorded, so it's kept for your records. If it was entered by mistake, delete ${them} first.`;
}

/** Sort order for lease lists: active (not ended) first, then newest start date first. */
export function compareLeases(a: LeaseSpan, b: LeaseSpan, today: Date = todayIST()): number {
  return Number(!isLeaseActive(a, today)) - Number(!isLeaseActive(b, today)) || ms(b.startDate) - ms(a.startDate);
}

// ---- Schemas ------------------------------------------------------------------------------------

export const RENT_TIMINGS = ["advance", "arrears"] as const;

const leaseFields = {
  unitId: zRef("Choose a unit"),
  tenantId: zRef("Choose a tenant"),
  startDate: zRequired(zDate),
  endDate: zEndDate,
  monthlyRent: zRequired(zPositiveMoney),
  /** "advance" = a month's rent is due in that month; "arrears" = in the following month (after living it) */
  rentTiming: z.enum(RENT_TIMINGS, { message: "must be in advance or after the month" }),
  /** day of the month rent is due for this lease; empty = the Settings default */
  rentDueDay: z.preprocess((v) => (v === "" || v === undefined ? null : v), zInt(1, 31).nullable()),
  securityDeposit: zMoney,
  /** bank / UPI ref no. (UTR) of the deposit transfer */
  depositReference: zReference,
  reminderEnabled: zBool,
  /** the current rental agreement's end (can be in the future — e.g. an 11-month agreement); empty = not recorded */
  agreementEndDate: zDateOrNull,
  moveOutNotes: zText(2000),
};

const addRuleIssues = (l: LeaseRuleInput, ctx: z.RefinementCtx) => {
  for (const i of leaseRuleIssues(l)) ctx.addIssue({ code: "custom", path: [i.field], message: i.message });
};

/** POST /api/leases */
export const leaseCreateSchema = z
  .object({
    ...leaseFields,
    securityDeposit: zMoney.default(0),
    reminderEnabled: zBool.optional(),
    rentTiming: z.enum(RENT_TIMINGS, { message: "must be in advance or after the month" }).default("advance"),
  })
  .superRefine(addRuleIssues);

/** PUT /api/leases/[id] — partial; cross-field rules are re-checked on the merged lease by the route. */
export const leaseUpdateSchema = z.object(leaseFields).partial();

/** POST /api/leases/[id]/move-out — the last day, and (optionally) the deposit refunded then (₹0 = nothing refunded). */
export const leaseMoveOutSchema = z.object({
  endDate: zRequired(zDate.refine(notFuture, END_IN_FUTURE), "is required (the last day of tenancy)"),
  refundAmount: zMoneyOrNull.optional(),
  refundDate: zRefundDate.optional(),
  /** bank / UPI ref no. (UTR) of the refund transfer */
  refundReference: zReference.optional(),
  moveOutNotes: zText(2000).optional(),
});

/** POST /api/leases/[id]/refunds — one deposit refund (owner, 4/11/2026: refunds can be added later, each with files). */
export const refundCreateSchema = z.object({
  amount: zRequired(zMoney, "Enter the amount refunded"),
  refundDate: zRequired(zDate.refine(notFuture, REFUND_IN_FUTURE), "Choose the day it was refunded"),
  /** bank / UPI ref no. (UTR) of the refund transfer */
  reference: zReference,
});
/** PATCH /api/leases/[id]/refunds/[refundId] — partial */
export const refundUpdateSchema = refundCreateSchema.partial();
export type RefundCreateInput = z.input<typeof refundCreateSchema>;

export const LEASE_STATUSES = ["active", "past", "all"] as const;

/** GET /api/leases */
export const leaseListQuerySchema = z.object({
  status: z.preprocess(
    blankToUndefined,
    z.enum(LEASE_STATUSES, { message: "must be active, past or all" }).default("all"),
  ),
  unitId: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  tenantId: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
});

/** POST /api/leases/[id]/rent-changes — the new rent and the first month it applies to ("2026-10"). */
export const rentChangeCreateSchema = z.object({
  monthlyRent: zRequired(zPositiveMoney),
  fromMonth: z.string({ message: "Choose the month the new rent starts" }).trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose the month the new rent starts"),
});
export type RentChangeCreateInput = z.input<typeof rentChangeCreateSchema>;

/** Rent changes oldest first (Prisma include). */
export const rentChangesInclude = { orderBy: { effectiveFrom: "asc" } } satisfies Prisma.Lease$rentChangesArgs;

type Money = number | { toNumber(): number };
const money = (m: Money) => (typeof m === "number" ? m : m.toNumber());

/** A lease's rent on `today` (after any rent change), its starting rent and its rent changes — for API responses. */
export function leaseRent(
  l: { monthlyRent: Money; rentChanges?: { id: string; effectiveFrom: Date; monthlyRent: Money }[] },
  today: Date = todayIST(),
): { monthlyRent: number; startingRent: number; rentChanges: RentChangeDTO[] } {
  const changes = (l.rentChanges ?? [])
    .map((c) => ({ id: c.id, effectiveFrom: c.effectiveFrom, monthlyRent: money(c.monthlyRent) }))
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  const startingRent = money(l.monthlyRent);
  return {
    monthlyRent: rentOn({ monthlyRent: startingRent, rentChanges: changes }, today),
    startingRent,
    rentChanges: changes.map((c) => ({ ...c, effectiveFrom: c.effectiveFrom.toISOString() })),
  };
}

/** Deposit refunds oldest first, with how many files each has (Prisma include). */
export const depositRefundsInclude = {
  orderBy: [{ refundDate: "asc" }, { createdAt: "asc" }],
  include: { _count: { select: { attachments: true } } },
} satisfies Prisma.Lease$depositRefundsArgs;

/** Prisma include for lease detail responses (GET / PUT / move-out): full unit + tenant, payments newest period first. */
export const leaseDetailInclude = {
  unit: true,
  tenant: true,
  rentChanges: rentChangesInclude,
  depositRefunds: depositRefundsInclude,
  payments: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { paymentDate: "desc" }] },
} satisfies Prisma.LeaseInclude;

export type LeaseCreateInput = z.input<typeof leaseCreateSchema>;
export type LeaseUpdateInput = z.input<typeof leaseUpdateSchema>;
export type LeaseMoveOutInput = z.input<typeof leaseMoveOutSchema>;

// ---- Response types (JSON as returned by the API) ------------------------------------------------

/** One rent change: from effectiveFrom's month (ISO, the 1st) the lease expects monthlyRent. */
export interface RentChangeDTO {
  id: string;
  effectiveFrom: string;
  monthlyRent: number;
}

/** monthlyRent = the rent in effect today; startingRent = the rent the lease began with (what the lease form edits). */
export type LeaseDTO = Omit<Serialized<Lease>, LegacyRefundFields> & { startingRent?: number; rentChanges?: RentChangeDTO[] };
/** the old one-refund columns (kept in the DB, never used — refunds live in depositRefunds) */
type LegacyRefundFields = "depositRefundedAmount" | "depositRefundDate";
/** Derived fields on every lease response. paymentsTotal uses sumAmounts(). isActive = state !== "ended". */
export type LeaseStats = PaymentStats & { isActive: boolean; state: LeaseState };

/** isActive + state of a lease today (for API responses). */
export const leaseStatus = (l: LeaseSpan, today: Date = todayIST()) => {
  const state = leaseStateOf(l, today);
  return { isActive: state !== "ended", state };
};

/** GET /api/leases → { items: LeaseListItem[] }; POST /api/leases → LeaseListItem */
export type LeaseListItem = LeaseDTO &
  LeaseStats & {
    unit: { id: string; name: string; position: "front" | "back" | null };
    tenant: { id: string; name: string; phone: string | null };
  };

/** One deposit refund (amount 0 = nothing refunded — the whole deposit kept). */
export interface DepositRefundDTO {
  id: string;
  amount: number;
  refundDate: string;
  reference: string | null;
  createdAt: string;
  _count: { attachments: number };
}

/** GET / PUT /api/leases/[id] and POST /api/leases/[id]/move-out */
export type LeaseDetail = LeaseDTO &
  LeaseStats & {
    unit: Serialized<Unit>;
    tenant: Serialized<Tenant>;
    payments: Serialized<Payment>[];
    depositRefunds: DepositRefundDTO[];
  };
