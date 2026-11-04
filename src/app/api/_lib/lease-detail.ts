// The lease detail response shared by every lease route (GET / PUT, move-out, rent changes, deposit refunds).
import type { Prisma } from "@prisma/client";
import { notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leaseDetailInclude, leaseRent, leaseStatus } from "@/lib/schemas/lease";
import { summarizePayments } from "@/lib/schemas/payment";

type FullLease = Prisma.LeaseGetPayload<{ include: typeof leaseDetailInclude }>;

/** A lease row without the old one-refund columns (refunds live in depositRefunds since 4/11/2026). */
export function withoutLegacyRefund<T extends { depositRefundedAmount?: unknown; depositRefundDate?: unknown }>(
  lease: T,
): Omit<T, "depositRefundedAmount" | "depositRefundDate"> {
  const copy = { ...lease };
  delete copy.depositRefundedAmount;
  delete copy.depositRefundDate;
  return copy;
}

/** Lease detail JSON: unit, tenant, payments, rent changes, deposit refunds + rent today, state and payment totals. */
export function leaseDetailJson(lease: FullLease) {
  return { ...withoutLegacyRefund(lease), ...leaseRent(lease), ...leaseStatus(lease), ...summarizePayments(lease.payments) };
}

/** Load one lease's detail JSON (404 when it doesn't exist). */
export async function loadLeaseDetail(id: string, db: Prisma.TransactionClient = prisma) {
  const lease = await db.lease.findUnique({ where: { id }, include: leaseDetailInclude });
  if (!lease) throw notFound("Lease");
  return leaseDetailJson(lease);
}

/** Σ a lease's deposit refunds so far, and how many there are. */
export async function refundsOf(leaseId: string, db: Prisma.TransactionClient, exceptId?: string) {
  const rows = await db.depositRefund.findMany({
    where: { leaseId, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true, amount: true },
  });
  const total = Math.round(rows.reduce((s, r) => s + r.amount.toNumber(), 0) * 100) / 100;
  return { total, count: rows.length, rows };
}
