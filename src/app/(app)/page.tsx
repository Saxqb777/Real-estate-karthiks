// "/" — the game screen: the live 3D estate with the HUD (status chips, panels on click, dock, time scrubber).
import type { Metadata } from "next";
import { Overview } from "@/components/overview";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return <Overview />;
}
