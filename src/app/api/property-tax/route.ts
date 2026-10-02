// GET /api/property-tax?unitId=&year= (newest year first) ; POST /api/property-tax (Paid → creates the linked expense)
import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createPropertyTax, propertyTaxInclude } from "@/lib/property-tax";
import { propertyTaxCreateSchema, propertyTaxListQuerySchema } from "@/lib/schemas/property-tax";

export const GET = handler(async (req) => {
  const { unitId, year } = parseQuery(req, propertyTaxListQuerySchema);
  const items = await prisma.propertyTax.findMany({
    where: { ...(unitId !== undefined && { unitId }), ...(year !== undefined && { year }) },
    include: propertyTaxInclude,
    orderBy: [{ year: "desc" }, { unit: { name: "asc" } }, { createdAt: "asc" }],
  });
  return json({ items });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, propertyTaxCreateSchema);
  return json(await createPropertyTax(data), 201);
});
