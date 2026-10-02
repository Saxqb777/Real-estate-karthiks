// "/" — the game screen: the live 3D estate with the HUD (status chips, panels on click, dock, time scrubber).
// ?layout=framed previews the boxed-world layout (option B in docs/DESIGN.md); the default is the immersive world.
import type { Metadata } from "next";
import { Overview } from "@/components/overview";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { layout } = await searchParams;
  return <Overview layout={layout === "framed" ? "framed" : "immersive"} />;
}
