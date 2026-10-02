// Lease input schemas + pure lease rules (shared by /api/leases and the UI).
// A lease covers [startDate, endDate): endDate is the move-out day; null endDate = active, open-ended.
import type { Lease, Payment, Prisma, Tenant, Unit } from "@prisma/client";
import { z } from "zod";
import "./messages";
import { formatDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { zBool, zDate, zDateOrNull, zMoney, zPositiveMoney, zText } from "@/lib/validation";
import type { PaymentStats } from "./payment";
import type { Serialized } from "@/lib/types";
import { zRequired } from "@/lib/validation";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const zRef = (msg: string) => z.string({ message: msg }).trim().min(1, msg);
/** Optional money that may be "" / null → null. */
const zMoneyOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : v), zMoney.nullable());

// endDate null = active lease (see schema.prisma), so a move-out / refund date is a past event, never a plan.
const notFuture = (d: Date | null) => d === null || d.getTime() <= todayIST().getTime();
const END_IN_FUTURE = "can't be in the future — leave it empty while the tenant still lives there, and record the move-out when they leave";
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
  depositRefundedAmount?: number | null;
  depositRefundDate?: DateLike | null;
}

/** Field-level problems with a lease's own values (dates order, deposit refund). */
export function leaseRuleIssues(l: LeaseRuleInput): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  if (l.endDate && ms(l.endDate) < ms(l.startDate)) {
    issues.push({
      field: "endDate",
      message: `End date ${formatDate(l.endDate)} can't be before the start date ${formatDate(l.startDate)}`,
    });
  }
  if (l.depositRefundedAmount != null && l.depositRefundedAmount > l.securityDeposit) {
    issues.push({
      field: "depositRefundedAmount",
      message: `Refunded deposit (${inr(l.depositRefundedAmount)}) can't be more than the security deposit (${inr(l.securityDeposit)})`,
    });
  }
  if (l.depositRefundDate && ms(l.depositRefundDate) < ms(l.startDate)) {
    issues.push({
      field: "depositRefundDate",
      message: `Deposit refund date ${formatDate(l.depositRefundDate)} can't be before the lease start ${formatDate(l.startDate)}`,
    });
  }
  return issues;
}

export interface LeaseSpan {
  startDate: DateLike;
  endDate: DateLike | null;
}

/** [start, end) intervals; null end = open-ended. */
export function leasesOverlap(a: LeaseSpan, b: LeaseSpan): boolean {
  const aEnd = a.endDate ? ms(a.endDate) : Infinity;
  const bEnd = b.endDate ? ms(b.endDate) : Infinity;
  return ms(a.startDate) < bEnd && ms(b.startDate) < aEnd;
}

/** "1/1/2025 – 31/12/2025" or "from 1/1/2025, still active" */
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
      return `${unitName} already has an active lease (${active.tenant.name}, ${leaseSpanLabel(active)}). Record that tenant's move-out before adding another active lease.`;
    }
  }
  const hit = sorted.find((o) => leasesOverlap(candidate, o));
  if (!hit) return null;
  return `These dates overlap ${hit.tenant.name}'s lease on ${unitName} (${leaseSpanLabel(hit)}). Leases on the same unit can't overlap — a new lease may start on the previous lease's move-out date.`;
}

/** Why a lease can't be deleted (it has recorded rent), or null. */
export function leaseDeleteBlockedMessage(tenantName: string, unitName: string, paymentsCount: number): string | null {
  if (!paymentsCount) return null;
  const n = `${paymentsCount} rent payment${paymentsCount === 1 ? "" : "s"}`;
  const them = paymentsCount === 1 ? "that payment" : "those payments";
  return `${tenantName}'s lease on ${unitName} has ${n} recorded, so it's kept for your records. If it was entered by mistake, delete ${them} first.`;
}

/** Sort order for lease lists: active first, then newest start date first. */
export function compareLeases(a: LeaseSpan, b: LeaseSpan): number {
  return Number(a.endDate !== null) - Number(b.endDate !== null) || ms(b.startDate) - ms(a.startDate);
}

// ---- Schemas ------------------------------------------------------------------------------------

const leaseFields = {
  unitId: zRef("Choose a unit"),
  tenantId: zRef("Choose a tenant"),
  startDate: zRequired(zDate),
  endDate: zEndDate,
  monthlyRent: zRequired(zPositiveMoney),
  securityDeposit: zMoney,
  depositRefundedAmount: zMoneyOrNull,
  depositRefundDate: zRefundDate,
  reminderEnabled: zBool,
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
  })
  .superRefine(addRuleIssues);

/** PUT /api/leases/[id] — partial; cross-field rules are re-checked on the merged lease by the route. */
export const leaseUpdateSchema = z.object(leaseFields).partial();

/** POST /api/leases/[id]/move-out */
export const leaseMoveOutSchema = z.object({
  endDate: zRequired(zDate.refine(notFuture, END_IN_FUTURE), "is required (the move-out date)"),
  depositRefundedAmount: zMoneyOrNull.optional(),
  depositRefundDate: zRefundDate.optional(),
  moveOutNotes: zText(2000).optional(),
});

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

/** Prisma include for lease detail responses (GET / PUT / move-out): full unit + tenant, payments newest period first. */
export const leaseDetailInclude = {
  unit: true,
  tenant: true,
  payments: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { paymentDate: "desc" }] },
} satisfies Prisma.LeaseInclude;

export type LeaseCreateInput = z.input<typeof leaseCreateSchema>;
export type LeaseUpdateInput = z.input<typeof leaseUpdateSchema>;
export type LeaseMoveOutInput = z.input<typeof leaseMoveOutSchema>;

// ---- Response types (JSON as returned by the API) ------------------------------------------------

export type LeaseDTO = Serialized<Lease>;
/** Derived fields on every lease response. paymentsTotal uses sumAmounts(). */
export type LeaseStats = PaymentStats & { isActive: boolean };

/** GET /api/leases → { items: LeaseListItem[] }; POST /api/leases → LeaseListItem */
export type LeaseListItem = LeaseDTO &
  LeaseStats & {
    unit: { id: string; name: string; position: "front" | "back" | null };
    tenant: { id: string; name: string; phone: string | null };
  };

/** GET / PUT /api/leases/[id] and POST /api/leases/[id]/move-out */
export type LeaseDetail = LeaseDTO &
  LeaseStats & { unit: Serialized<Unit>; tenant: Serialized<Tenant>; payments: Serialized<Payment>[] };
