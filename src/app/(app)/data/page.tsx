import type { Metadata } from "next";
import { DataScreen } from "./DataScreen";

export const metadata: Metadata = { title: "Data" };

export default function DataPage() {
  return <DataScreen />;
}
