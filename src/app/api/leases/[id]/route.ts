import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { prisma } from "@/lib/db";
import {
  leaseConflictMessage,
  leaseDeleteBlockedMessage,
  leaseDetailInclude,
  leaseRuleIssues,
  leaseStatus,
  leaseUpdateSchema,
} from "@/lib/schemas/lease";
import { paymentsOutsideLease, periodLabel, summarizePayments } from "@/lib/schemas/payment";

async function leaseDetail(id: string) {
  const lease = await prisma.lease.findUnique({ where: { id }, include: leaseDetailInclude });
  if (!lease) throw notFound("Lease");
  return { ...lease, ...leaseStatus(lease), ...summarizePayments(lease.payments) };
}

/** Lease with full unit, tenant and payments (newest period first). */
export const GET = handler(async (_req, ctx) => json(await leaseDetail(await param(ctx, "id"))));

/** Partial update; re-applies every create rule to the merged lease (excluding itself from overlap checks). */
export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, leaseUpdateSchema);

  await prisma.$transaction(async (tx) => {
    // Lock the lease first: payment writes take a share lock on it, so no payment can slip in outside the new dates.
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.lease.findUnique({
      where: { id },
      include: { payments: { select: { periodMonth: true, periodYear: true } } },
    });
    if (!existing) throw notFound("Lease");

    const merged = {
      unitId: body.unitId ?? existing.unitId,
      startDate: body.startDate ?? existing.startDate,
      endDate: body.endDate !== undefined ? body.endDate : existing.endDate,
      securityDeposit: body.securityDeposit ?? existing.securityDeposit.toNumber(),
      depositRefundedAmount:
        body.depositRefundedAmount !== undefined ? body.depositRefundedAmount : (existing.depositRefundedAmount?.toNumber() ?? null),
      depositRefundDate: body.depositRefundDate !== undefined ? body.depositRefundDate : existing.depositRefundDate,
    };
    const issues = leaseRuleIssues(merged);
    if (issues.length) {
      throw new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));
    }

    const unitChanged = merged.unitId !== existing.unitId;
    const startChanged = merged.startDate.getTime() !== existing.startDate.getTime();
    const endChanged = (merged.endDate?.getTime() ?? null) !== (existing.endDate?.getTime() ?? null);

    if (unitChanged || startChanged || endChanged) {
      const unitIds = [...new Set([merged.unitId, existing.unitId])].sort();
      await tx.$queryRaw`SELECT 1 FROM unit WHERE id IN (${Prisma.join(unitIds)}) ORDER BY id FOR UPDATE`;
      const unit = await tx.unit.findUnique({
        where: { id: merged.unitId },
        include: {
          leases: {
            where: { id: { not: id } },
            select: { startDate: true, endDate: true, tenant: { select: { name: true } } },
          },
        },
      });
      if (!unit) throw fieldError(404, "unitId", "Unit not found");
      // Editing an old lease on a since-deactivated unit is fine; moving a lease onto an inactive unit is not.
      if (unitChanged && !unit.isActive) {
        throw fieldError(409, "unitId", `${unit.name} is marked inactive — reactivate it before moving a lease onto it`);
      }
      if (endChanged && merged.endDate === null && !unit.isActive) {
        throw fieldError(409, "endDate", `${unit.name} is marked inactive — reactivate it before re-opening this lease`);
      }
      const clash = leaseConflictMessage(merged, unit.leases, unit.name);
      if (clash) throw fieldError(409, unitChanged ? "unitId" : startChanged ? "startDate" : "endDate", clash);
    }

    if (body.tenantId && body.tenantId !== existing.tenantId) {
      if (!(await tx.tenant.findUnique({ where: { id: body.tenantId }, select: { id: true } }))) {
        throw fieldError(404, "tenantId", "Tenant not found");
      }
    }

    if (startChanged || endChanged) {
      const outside = paymentsOutsideLease(merged, existing.payments);
      if (outside.length) {
        const labels = outside.slice(0, 3).map((p) => periodLabel({ month: p.periodMonth, year: p.periodYear }));
        throw fieldError(
          409,
          startChanged ? "startDate" : "endDate",
          `Can't change the dates: ${outside.length} recorded payment${outside.length === 1 ? "" : "s"} ` +
            `(${labels.join(", ")}${outside.length > 3 ? ", …" : ""}) would fall outside this lease. Delete or re-record those payments first.`,
        );
      }
    }

    // Ending a lease switches off rent reminders unless the caller says otherwise.
    const justEnded = existing.endDate === null && merged.endDate !== null && body.reminderEnabled === undefined;
    await tx.lease.update({ where: { id }, data: { ...body, ...(justEnded && { reminderEnabled: false }) } });
  });

  return json(await leaseDetail(id));
});

/** Remove a lease entered by mistake. Refused while it has payments (they'd vanish with it — and their invoices). */
export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM lease WHERE id = ${id} FOR UPDATE`; // no payment can be added mid-check
    const lease = await tx.lease.findUnique({
      where: { id },
      select: { tenant: { select: { name: true } }, unit: { select: { name: true } }, _count: { select: { payments: true } } },
    });
    if (!lease) throw notFound("Lease");
    const blocked = leaseDeleteBlockedMessage(lease.tenant.name, lease.unit.name, lease._count.payments);
    if (blocked) throw conflict(blocked);
    await tx.lease.delete({ where: { id } });
  });
  return json({ ok: true });
});
