// GET/PUT/DELETE /api/offers/[id] (GET + PUT are extras beyond the contract, for editing an offer in place)
import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { offerUpdateSchema } from "@/lib/schemas/offer";

export const GET = handler(async (_req, ctx) => {
  const offer = await prisma.offer.findUnique({ where: { id: await param(ctx, "id") } });
  if (!offer) throw notFound("Offer");
  return json(offer);
});

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const data = await parseBody(req, offerUpdateSchema);
  if (!(await prisma.offer.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Offer");
  return json(await prisma.offer.update({ where: { id }, data }));
});

export const DELETE = handler(async (_req, ctx) => {
  const { count } = await prisma.offer.deleteMany({ where: { id: await param(ctx, "id") } });
  if (!count) throw notFound("Offer");
  return json({ ok: true });
});
