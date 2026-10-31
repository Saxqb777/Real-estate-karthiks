// "/" — the game screen. The live 3D estate with its HUD lives in the app shell (AppShell → Overview), so it stays
// mounted behind Data / Config and moving between pages never reloads it (owner, 31/10/2026). This page adds nothing.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return null;
}
