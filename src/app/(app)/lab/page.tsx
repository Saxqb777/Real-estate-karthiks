// /lab — sandbox for reviewing the 3D estate scene in every state (mock data, no database).
// Query params map to the panel controls, e.g. /lab?units=2&state=overdue&time=night&dims=1&hl=depthFt&panel=0
import type { Metadata } from "next";
import EstateLab from "@/components/estate/EstateLab";
import { parseLabParams } from "@/components/estate/lab-params";

export const metadata: Metadata = { title: "Scene lab · Pattukottai Estates" };

export default async function LabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <EstateLab initial={parseLabParams(await searchParams)} />;
}
