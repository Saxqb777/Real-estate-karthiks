// Shared types for the game-screen HUD (src/components/hud). Nothing here computes money — every figure comes
// from DashboardData (src/lib/dashboard-types.ts), produced by src/lib/calculations.ts.

/** 3D SCENE CONTRACT v2 — mirrored here so the HUD doesn't depend on the scene module being loaded. */
export type SceneObjectKind = "unit" | "mailbox" | "noticeboard" | "pole" | "tolet" | "tenant" | "taxstamp" | "plot" | "car" | "photographer";

export interface SceneObject {
  kind: SceneObjectKind;
  unitId?: string;
  /** viewport px of the object (anchor for inspect cards) */
  screen?: { x: number; y: number };
}

/** The HUD's global period control: which cash scope the panels show. */
export type PeriodKind = "allTime" | "year" | "month";

/** What a side panel shows. "property" = left panel; the rest open on the right. */
export type PanelTarget =
  | { kind: "property" }
  | { kind: "unit"; unitId: string }
  | { kind: "mailbox" }
  | { kind: "noticeboard" }
  | { kind: "pole" }
  | { kind: "tax" }
  /** the photographer by 116/B7: interior photos of the front unit */
  | { kind: "photos" };

export type PanelKind = PanelTarget["kind"];

/** A drill-down level inside a side panel (breadcrumb: Net cash › Expenses › Maintenance › record). */
export type DrillView =
  /** one figure: its breakdown + "How is this calculated?" (data.explain[key]) */
  | { kind: "metric"; key: string }
  /** expense records of one category in a scope (optionally one unit) */
  | { kind: "category"; categoryId: string; name: string; period: PeriodKind; unitId?: string | null; color?: string }
  /** rent payments of one lease */
  | { kind: "lease"; leaseId: string; label: string }
  /** one expense record (inline edit) */
  | { kind: "expense"; id: string; label: string }
  /** one payment (receipt) */
  | { kind: "payment"; id: string; label: string }
  /** the reconciliation checks behind "Ledger balanced ✓" */
  | { kind: "checks" };

/** Where a status chip leads when clicked. */
export type ChipTarget = PanelTarget | { kind: "dock"; tab: DockTab };

export type DockTab = "income" | "spending" | "units" | "occupancy" | "growth" | "payments";
