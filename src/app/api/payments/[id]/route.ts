import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { rentForMonth } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { paymentReferenceSchema } from "@/lib/schemas/payment";

export const GET = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      lease: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          rentChanges: { select: { effectiveFrom: true, monthlyRent: true } },
          unit: { select: { id: true, name: true } },
          tenant: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!payment) throw notFound("Payment");
  const { rentChanges, ...lease } = payment.lease;
  // the lease's rent for the month this payment is for (after any rent change)
  const monthlyRent = rentForMonth(
    { monthlyRent: lease.monthlyRent.toNumber(), rentChanges: rentChanges.map((c) => ({ effectiveFrom: c.effectiveFrom, monthlyRent: c.monthlyRent.toNumber() })) },
    payment.periodYear,
    payment.periodMonth,
  );
  return json({ ...payment, lease: { ...lease, monthlyRent } });
});

/** Add or change the bank / UPI ref no. (UTR) — the only part of a payment that can change after it is recorded. */
export const PATCH = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const { reference } = await parseBody(req, paymentReferenceSchema);
  const { count } = await prisma.payment.updateMany({ where: { id }, data: { reference } });
  if (!count) throw notFound("Payment");
  return json({ ok: true, reference });
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const { count } = await prisma.payment.deleteMany({ where: { id } });
  if (!count) throw notFound("Payment");
  return json({ ok: true });
});
