// GET /api/offers?unitId= (highest first) ; POST /api/offers
import { handler, json, notFound, parseBody, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/db";
import { offerCreateSchema, offerListQuerySchema } from "@/lib/schemas/offer";

async function assertUnitExists(id: string) {
  if (!(await prisma.unit.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Unit");
}

export const GET = handler(async (req) => {
  const { unitId } = parseQuery(req, offerListQuerySchema);
  await assertUnitExists(unitId);
  const items = await prisma.offer.findMany({
    where: { unitId },
    orderBy: [{ amount: "desc" }, { offerDate: "desc" }, { createdAt: "desc" }],
  });
  return json({ items });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, offerCreateSchema);
  await assertUnitExists(data.unitId);
  return json(await prisma.offer.create({ data }), 201);
});
