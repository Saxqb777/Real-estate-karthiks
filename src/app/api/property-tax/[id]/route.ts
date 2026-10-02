// GET/PUT/DELETE /api/property-tax/[id] — PUT also marks Paid / Due; the linked expense follows (src/lib/property-tax.ts).
import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deletePropertyTax, propertyTaxInclude, updatePropertyTax } from "@/lib/property-tax";
import { propertyTaxUpdateSchema } from "@/lib/schemas/property-tax";

export const GET = handler(async (_req, ctx) => {
  const tax = await prisma.propertyTax.findUnique({ where: { id: await param(ctx, "id") }, include: propertyTaxInclude });
  if (!tax) throw notFound("Property tax record");
  return json(tax);
});

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const data = await parseBody(req, propertyTaxUpdateSchema);
  return json(await updatePropertyTax(id, data));
});

export const DELETE = handler(async (_req, ctx) => {
  await deletePropertyTax(await param(ctx, "id"));
  return json({ ok: true });
});
