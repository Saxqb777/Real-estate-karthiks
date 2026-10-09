// Public contract of the 3D estate scene (SCENE CONTRACT v2). The HUD / overview import these types; the scene
// implements them in EstateScene.tsx. Pure types — safe to import from server or client code.

/** Every interactive object in the world (DESIGN.md "World objects = data entry points"). */
export type SceneObjectKind = "unit" | "mailbox" | "noticeboard" | "pole" | "tolet" | "tenant" | "taxstamp" | "plot" | "car" | "photographer";

export const SCENE_OBJECT_KINDS: readonly SceneObjectKind[] = ["unit", "mailbox", "noticeboard", "pole", "tolet", "tenant", "taxstamp", "plot", "car", "photographer"];

/** Screen position in VIEWPORT pixels (same space as MouseEvent.clientX / clientY). */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface SceneObject {
  kind: SceneObjectKind;
  /** set for "unit", "tolet" and "tenant" (the unit they belong to) */
  unitId?: string;
  /** viewport px of the object's anchor (top centre) — use it to anchor inspect cards / leader lines */
  screen?: ScreenPoint;
}

/** Pixels of the scene box covered by HUD panels; the camera frames the plot inside the free area that is left. */
export interface SceneInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Live lookup of an object's anchor on screen (viewport px), or null when it is not in the world / off screen. */
export type ObjectScreenFn = (kind: SceneObjectKind, unitId?: string) => ScreenPoint | null;

/** What each world object opens (DESIGN.md table) — used for tooltips and the "?" help overlay. */
export const SCENE_OBJECT_INFO: Record<SceneObjectKind, { name: string; opens: string }> = {
  unit: { name: "House", opens: "Unit card" },
  mailbox: { name: "Mailbox", opens: "Payments & invoices" },
  noticeboard: { name: "Property manager", opens: "To-dos" },
  pole: { name: "EB pole & meter", opens: "Electricity (TNPDCL)" },
  tolet: { name: "TO-LET board", opens: "New lease" },
  tenant: { name: "Tenant", opens: "Tenant profile" },
  taxstamp: { name: "Revenue officer", opens: "Property tax" },
  plot: { name: "Plot marker", opens: "Plot dimensions" },
  car: { name: "Car", opens: "Leave the estate (sign out)" },
  photographer: { name: "Photographer", opens: "Interior photos of 116/B7" },
};
