// GET /api/offers?unitId= (highest first) ; POST /api/offers
import { handler, json, notFound, parseBody, parseQuery } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { prisma } from "@/lib/db";
import { offerCreateSchema, offerListQuerySchema } from "@/lib/schemas/offer";

const unitExists = async (id: string) => !!(await prisma.unit.findUnique({ where: { id }, select: { id: true } }));

export const GET = handler(async (req) => {
  const { unitId } = parseQuery(req, offerListQuerySchema);
  if (!(await unitExists(unitId))) throw notFound("Unit");
  const items = await prisma.offer.findMany({
    where: { unitId },
    orderBy: [{ amount: "desc" }, { offerDate: "desc" }, { createdAt: "desc" }],
  });
  return json({ items });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, offerCreateSchema);
  if (!(await unitExists(data.unitId))) throw fieldError(404, "unitId", "Unit not found");
  return json(await prisma.offer.create({ data }), 201);
});
