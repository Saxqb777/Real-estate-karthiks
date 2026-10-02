import type { Metadata } from "next";
import { InvoiceScreen } from "./InvoiceScreen";

export const metadata: Metadata = { title: "Rent receipt" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceScreen id={id} />;
}
