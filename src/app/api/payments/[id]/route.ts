import { handler, json, notFound, param } from "@/lib/api";
import { prisma } from "@/lib/db";

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
          unit: { select: { id: true, name: true } },
          tenant: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!payment) throw notFound("Payment");
  return json(payment);
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const { count } = await prisma.payment.deleteMany({ where: { id } });
  if (!count) throw notFound("Payment");
  return json({ ok: true });
});
