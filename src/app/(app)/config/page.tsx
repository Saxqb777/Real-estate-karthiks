import type { Metadata } from "next";
import { ConfigScreen } from "./ConfigScreen";

export const metadata: Metadata = { title: "Config" };

export default function ConfigPage() {
  return <ConfigScreen />;
}
