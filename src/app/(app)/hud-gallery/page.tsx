// /hud-gallery — review page for the game-screen HUD building blocks (src/components/hud), with live dashboard data.
// Query params pick a stage and pre-open states for screenshots — see HudGallery.tsx.
import type { Metadata } from "next";
import HudGallery, { type GalleryParams } from "@/components/hud/HudGallery";

export const metadata: Metadata = { title: "HUD gallery · Pattukottai Estates" };

export default async function HudGalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initial: GalleryParams = {};
  for (const k of ["stage", "left", "right", "tab", "world", "card", "hover", "radial", "key", "drill", "period", "asof"] as const) {
    const v = sp[k];
    if (typeof v === "string") initial[k] = v;
  }
  return <HudGallery initial={initial} />;
}
