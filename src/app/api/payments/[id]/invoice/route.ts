import { handler, json, notFound, param } from "@/lib/api";
import { buildInvoice } from "@/lib/invoice";

/** Printable rent-receipt data (see InvoiceData in src/lib/invoice.ts). */
export const GET = handler(async (_req, ctx) => {
  const invoice = await buildInvoice(await param(ctx, "id"));
  if (!invoice) throw notFound("Payment");
  return json(invoice);
});
