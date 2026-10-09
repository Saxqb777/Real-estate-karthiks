// Pure site-plan geometry for the 3D estate diorama (and its 2D fallback). No three.js, no DOM — unit tested.
// Every value is in FEET, in "plan" coordinates as seen on the owner's drawing:
//   x grows left → right when standing on the street looking at the plot,
//   z grows from the front edge (z = 0, on the street) to the back edge (z = depthFt).
// Oriented like the owner's annotated site plan (images/8.jpg): the RIGHT boundary is straight (x = plot.rightX); the
// LEFT boundary runs along the lane and slants from frontWidthFt (23'3" at the front) to backWidthFt (22'3" at the back).
// From the front: front yard (Unit A's entrance + stair, "Gate to Unit A" in the front wall) → Unit A → courtyard (Unit B's
// entrance + stair, "Gate to Unit B" in the lane wall) → Unit B against the back. The compound wall is a separate
// enclosure on the boundary: the ~3 ft lane-side passage on the left and a ~1.5 ft clear strip on the right and at the
// back keep every wall clear of the houses. Each house: entrance at its front-left (veranda), external stair in front of
// its front-right, and a small open backyard (notch) at its rear-right with a bathroom and a back-exit door.
import type { PlotGeometry, RentState, UnitBreakdown, UnitStatus } from "./dashboard-types";
import { SITE_PLAN_DEFAULTS, trapezoidArea } from "./calculations";
import { formatIndianNumber } from "./format";

export type SlotName = "front" | "back";
export const SLOT_NAMES: readonly SlotName[] = ["front", "back"];

/** What the scene needs to know about a unit. Build it with sceneUnitsFromBreakdown() from dashboard data. */
export interface SceneUnit {
  id: string;
  name: string;
  position: SlotName | null;
  floors: number;
  footprintWidthFt: number | null;
  footprintDepthFt: number | null;
  status: UnitStatus | "empty";
  rentState: RentState;
  tenantName?: string | null;
  monthlyRent?: number | null;
  isActive: boolean;
  /** optional extras for richer labels */
  daysOverdue?: number;
  vacantDays?: number;
  /** status "incoming": the first day of the signed lease (ISO date) — drawn as a "Moving in D/M" board */
  moveInDate?: string | null;
}

export interface Pt {
  x: number;
  z: number;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Owner's drawing (CLAUDE.md) — used whenever a field is empty. */
export const SITE_DEFAULTS = {
  ...SITE_PLAN_DEFAULTS,
  footprintWidthFt: 20,
  footprintDepthFt: 28,
  /** open yard in front of each house (front yard for Unit A, courtyard for Unit B) — holds its entrance + stair */
  yardFt: 10,
  /** the yard never gets smaller than this (the stair needs it) */
  minYardFt: 5.5,
  /** lane-side passage between the lane wall and the houses */
  passageFt: 3,
  /** clear strip between the houses and the right / back compound walls (the wall never touches a house) */
  wallClearFt: 1.5,
  floorHeightFt: 10.5,
  parapetFt: 3,
  /** rear-right backyard notch: 6.5 wide at the back × 9.5 deep, narrowing by one small step (bathroom) towards the front */
  notch: { widthFt: 6.5, depthFt: 9.5, stepDepthFt: 4 },
  /** external dog-leg staircase in front of the house's front-right corner (width along the front × depth into the yard) */
  stairs: { widthFt: 10, depthFt: 5 },
} as const;

/** Grassy land tile around the plot (diorama context, not owner data). No road: open grass in front of the gates. */
export const SITE_SURROUNDINGS = {
  sideMarginFt: 16,
  backMarginFt: 10,
  /** open grass between the front compound wall and the tile edge */
  frontMarginFt: 20,
  /** EB poles stand on the grass this far in front of the front wall */
  poleSetbackFt: 3.5,
} as const;

const MIN_EMPTY_SLOT_DEPTH = 8;
const LIMITS = { width: [4, 400], depth: [10, 1000] } as const;

/** "side" = the lane-passage wall (windows); "party" = the right wall (blank); "notch" = the backyard walls */
export type WallKind = "front" | "side" | "back" | "notch" | "party";
export interface Wall {
  a: Pt;
  b: Pt;
  /** outward unit normal */
  n: Pt;
  kind: WallKind;
  length: number;
}

export interface BuildingSlot {
  slot: SlotName;
  unit: SceneUnit | null;
  status: UnitStatus | "empty";
  /** footprint bounding rectangle (after any scaling) */
  rect: Rect;
  widthFt: number;
  depthFt: number;
  requestedWidthFt: number;
  requestedDepthFt: number;
  scaled: boolean;
  floors: number;
  /** wall height (floors × 10.5 ft), parapet on top */
  heightFt: number;
  parapetFt: number;
  /** footprint polygon, counter-clockwise, with the stepped backyard notch cut out of the rear-right corner */
  outline: Pt[];
  /** rear-right backyard: wide part (against the back) and the narrower stepped part in front of it (bathroom side) */
  notch: { wide: Rect; step: Rect };
  /** external dog-leg staircase OUTSIDE the footprint, in the yard in front of the front-right corner */
  stairs: Rect;
  /** house entrance on the front face at the front-left (facing −z, onto the yard) */
  door: { x: number; z: number; widthFt: number };
  /** back-exit door from the house into the backyard (on the notch's front wall, facing +z) */
  backExit: { x: number; z: number; widthFt: number };
  /** where the kolam is drawn (in front of the entrance) */
  kolam: { x: number; z: number; sizeFt: number };
  walls: Wall[];
  /** open yard in front of the house (front yard / courtyard), ft */
  yardFt: number;
  /** lane-side passage width (left boundary → building) at the building front */
  passageFt: number;
  /** enclosed floor area of one floor (sq ft) */
  floorAreaSqft: number;
}

export interface CompoundWall {
  a: Pt;
  b: Pt;
  kind: "wall" | "gate";
  /** "front" = Gate to Unit A in the front wall; "side" = Gate to Unit B in the lane wall at the courtyard */
  gate?: "front" | "side";
}

/**
 * Street-front furniture that doubles as data entry points in the 3D world (DESIGN.md "World objects").
 * Mount points are on the plot boundary (z = 0) unless noted; the renderer pushes each one out to the street face.
 */
export interface SiteFixtures {
  /** letter box on the corner-side pillar of the front gate (Gate to Unit A) */
  mailbox: Pt;
  /** notice board on the outer face of the lane-side (left) compound wall near the front (faces −x, the lane) */
  noticeBoard: Pt & { widthFt: number };
  /** the property-tax spot on the grass right of the plot: the tax collector's moped (TaxCollector.tsx) — the tax entry point */
  taxStamp: Pt & { on: "office" };
  /** survey stone + ranging flag just outside the back-left corner */
  plotMarker: Pt;
  /** EB poles on the grass just outside the front wall, right of the plot: [0] (by the gate) carries the lamp, the meter and the service drop */
  poles: Pt[];
  poleHeightFt: number;
}

export type DimensionKind = "plot" | "footprint" | "gap" | "height" | "area";
export interface Dimension {
  /** highlight key, e.g. "frontWidthFt", "footprintWidthFt:front", "floors:back", "areaSqft" */
  key: string;
  kind: DimensionKind;
  slot?: SlotName;
  unitId?: string;
  valueFt: number;
  label: string;
  /** measured points (y = height of the dimension line) */
  a: Vec3;
  b: Vec3;
  /** unit vector the dimension line is pushed out along, and by how much */
  dir: Vec3;
  offset: number;
  /** shown when showDimensions is on; others only appear when highlighted */
  primary: boolean;
}

export interface SiteLayout {
  plot: {
    frontWidthFt: number;
    backWidthFt: number;
    depthFt: number;
    areaSqft: number;
    /** x extent of the plot (= the larger width); the left (lane) boundary is x = 0 */
    rightX: number;
    /** front-left, front-right, back-right, back-left (counter-clockwise) */
    polygon: Pt[];
    townName: string;
  };
  /** 0–2 drawn slots (an empty slot is dropped only when there is no room for it) */
  slots: BuildingSlot[];
  courtyard: { z0: number; z1: number } | null;
  rearYard: { z0: number; z1: number };
  /** paved ground: plot from the front edge to the back of the last real building (empty when no units) */
  paved: Pt[];
  compoundWalls: CompoundWall[];
  fixtures: SiteFixtures;
  site: {
    tile: Pt[];
    /** the open grass in front of the plot: plan z from the tile's front edge (z0 < 0) to the front wall (z1 = 0) */
    meadow: { x0: number; x1: number; z0: number; z1: number };
  };
  dimensions: Dimension[];
  /** plot centre (bounding box) and a radius that contains plot + buildings, for camera framing */
  center: Pt;
  radius: number;
  maxHeightFt: number;
  warnings: string[];
  /** units that could not be placed (more units than slots) */
  unplaced: SceneUnit[];
}

// ───────────────────────────── small helpers ─────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r2 = (n: number) => Math.round(n * 100) / 100;
const isPos = (n: unknown): n is number => typeof n === "number" && isFinite(n) && n > 0;

/** 22.25 → 22'3", 76.66 → 76'8", 20 → 20'. Rounds to the nearest inch. */
export function formatFeetInches(ft: number): string {
  if (!isFinite(ft)) return "—";
  const sign = ft < 0 ? "-" : "";
  const inches = Math.round(Math.abs(ft) * 12);
  const f = Math.floor(inches / 12);
  const i = inches % 12;
  return i ? `${sign}${f}'${i}"` : `${sign}${f}'`;
}

/** Signed area (positive = counter-clockwise in x-right / z-up plan view). */
export function polygonArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
}

/**
 * Offset every edge of a simple polygon along its outward normal (negative = inwards) and re-intersect neighbours.
 * `dist` is one distance for all edges or one per edge (edge i runs from pts[i] to pts[i+1]).
 */
export function offsetPolygon(pts: Pt[], dist: number | number[]): Pt[] {
  const n = pts.length;
  const orient = polygonArea(pts) >= 0 ? 1 : -1;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    const d = { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
    const nrm = { x: d.z * orient, z: -d.x * orient };
    const k = Array.isArray(dist) ? (dist[i] ?? 0) : dist;
    return { p: { x: p.x + nrm.x * k, z: p.z + nrm.z * k }, d };
  });
  return pts.map((_, i) => {
    const l1 = lines[(i - 1 + n) % n];
    const l2 = lines[i];
    const cross = l1.d.x * l2.d.z - l1.d.z * l2.d.x;
    if (Math.abs(cross) < 1e-9) return { ...l2.p };
    const t = ((l2.p.x - l1.p.x) * l2.d.z - (l2.p.z - l1.p.z) * l2.d.x) / cross;
    return { x: l1.p.x + l1.d.x * t, z: l1.p.z + l1.d.z * t };
  });
}

// ───────────────────────────── data mapping ─────────────────────────────

/** Map dashboard units (GET /api/dashboard) to scene units. */
export function sceneUnitsFromBreakdown(units: UnitBreakdown[]): SceneUnit[] {
  return units.map((u) => {
    const incoming = u.status === "incoming";
    // an incoming unit is empty today: its board names the tenant who is moving in
    const lease = u.activeLease ?? (incoming ? u.incomingLease : null);
    const out: SceneUnit = {
      id: u.id,
      name: u.name,
      position: u.position,
      floors: u.floors,
      footprintWidthFt: u.footprintWidthFt,
      footprintDepthFt: u.footprintDepthFt,
      status: u.status,
      rentState: u.rentState,
      tenantName: lease?.tenantName ?? null,
      monthlyRent: lease?.monthlyRent ?? null,
      isActive: u.isActive,
      daysOverdue: incoming ? 0 : (u.nextPayment?.daysOverdue ?? 0),
      vacantDays: u.status === "vacant" || incoming ? currentVacantDays(u) : 0,
    };
    if (incoming) out.moveInDate = u.incomingLease?.startDate ?? null;
    return out;
  });
}

function currentVacantDays(u: UnitBreakdown): number {
  const last = u.vacantPeriods[u.vacantPeriods.length - 1];
  return last && last.ongoing !== false ? last.days : 0;
}

/** Assign units to the front/back slots: active with a position → inactive with a position → the rest in order. */
export function assignSlots(units: SceneUnit[]): { bySlot: Record<SlotName, SceneUnit | null>; unplaced: SceneUnit[]; warnings: string[] } {
  const bySlot: Record<SlotName, SceneUnit | null> = { front: null, back: null };
  const warnings: string[] = [];
  const real = units.filter((u) => u.status !== "empty");
  const placed = new Set<string>();
  const place = (u: SceneUnit, s: SlotName) => {
    bySlot[s] = u;
    placed.add(u.id);
  };
  for (const pass of [true, false]) {
    for (const u of real) {
      if (placed.has(u.id) || !u.position || u.isActive !== pass) continue;
      if (!bySlot[u.position]) place(u, u.position);
    }
  }
  const rest = [...real.filter((u) => u.isActive), ...real.filter((u) => !u.isActive)].filter((u) => !placed.has(u.id));
  const unplaced: SceneUnit[] = [];
  for (const u of rest) {
    const free = SLOT_NAMES.find((s) => !bySlot[s]);
    if (!free) {
      unplaced.push(u);
      warnings.push(`"${u.name}" is not drawn: the plot has only front and back slots.`);
      continue;
    }
    if (u.position && u.position !== free) {
      warnings.push(`"${u.name}" also claims the ${u.position} position; drawn in the ${free} slot.`);
    }
    place(u, free);
  }
  return { bySlot, unplaced, warnings };
}

// ───────────────────────────── layout ─────────────────────────────

type PlotLike = Partial<Pick<PlotGeometry, "frontWidthFt" | "backWidthFt" | "depthFt" | "areaSqft" | "townName">>;

function sanitizeDim(v: unknown, fallback: number, [lo, hi]: readonly [number, number], label: string, warnings: string[]): number {
  if (!isPos(v)) {
    if (v !== undefined && v !== null) warnings.push(`${label} is not a valid size — using ${formatFeetInches(fallback)} from the site plan.`);
    return fallback;
  }
  if (v < lo || v > hi) {
    const c = clamp(v, lo, hi);
    warnings.push(`${label} ${formatFeetInches(v)} is outside the drawable range — drawn as ${formatFeetInches(c)}.`);
    return c;
  }
  return v;
}

export function computeSiteLayout(plotIn: PlotLike, units: SceneUnit[]): SiteLayout {
  const warnings: string[] = [];
  const front = sanitizeDim(plotIn.frontWidthFt, SITE_DEFAULTS.frontWidthFt, LIMITS.width, "Front width", warnings);
  const back = sanitizeDim(plotIn.backWidthFt, SITE_DEFAULTS.backWidthFt, LIMITS.width, "Back width", warnings);
  const depth = sanitizeDim(plotIn.depthFt, SITE_DEFAULTS.depthFt, LIMITS.depth, "Depth", warnings);
  const areaSqft = isPos(plotIn.areaSqft) ? plotIn.areaSqft : trapezoidArea(front, back, depth);
  const rightX = Math.max(front, back);
  const widthAt = (z: number) => front + (back - front) * clamp(z / depth, 0, 1);
  /** x of the (slanting) lane-side boundary at plan z; the right boundary is x = rightX */
  const leftX = (z: number) => rightX - widthAt(z);
  const polygon: Pt[] = [
    { x: leftX(0), z: 0 },
    { x: rightX, z: 0 },
    { x: rightX, z: depth },
    { x: leftX(depth), z: depth },
  ];
  const D = SITE_DEFAULTS;

  // ── slots ──
  const { bySlot, unplaced, warnings: slotWarnings } = assignSlots(units);
  warnings.push(...slotWarnings);
  const want = (s: SlotName, k: "footprintWidthFt" | "footprintDepthFt") => {
    const v = bySlot[s]?.[k];
    return isPos(v) ? v : SITE_DEFAULTS[k];
  };
  const real: Record<SlotName, boolean> = { front: !!bySlot.front, back: !!bySlot.back };
  const req = { front: { w: want("front", "footprintWidthFt"), d: want("front", "footprintDepthFt") }, back: { w: want("back", "footprintWidthFt"), d: want("back", "footprintDepthFt") } };
  const d: Record<SlotName, number> = { front: req.front.d, back: req.back.d };

  // Real buildings get the room first; with no units both placeholders are fitted together. Every drawn house needs a
  // yard in front of it (front yard / courtyard) and the back house keeps a clear strip to the back wall.
  const anchors = SLOT_NAMES.filter((s) => real[s]);
  const fitSet = anchors.length ? anchors : [...SLOT_NAMES];
  const usable = depth - D.wallClearFt;
  const gapNeeded = D.minYardFt * fitSet.length;
  const fitSum = fitSet.reduce((s, k) => s + d[k], 0);
  if (fitSum + gapNeeded > usable) {
    const s = (usable - gapNeeded) / fitSum;
    for (const k of fitSet) d[k] *= s;
    const realFit = fitSet.filter((k) => real[k]);
    if (realFit.length === 2) {
      warnings.push(
        `Front + back footprint depths (${formatFeetInches(req.front.d)} + ${formatFeetInches(req.back.d)}) and their two ${formatFeetInches(D.minYardFt)} yards do not fit the ${formatFeetInches(depth)} plot — both drawn scaled.`,
      );
    } else if (realFit.length === 1) {
      const k = realFit[0];
      warnings.push(`"${bySlot[k]!.name}" footprint depth ${formatFeetInches(req[k].d)} does not fit the ${formatFeetInches(depth)} plot — drawn scaled to ${formatFeetInches(d[k])}.`);
    }
  }
  for (const k of SLOT_NAMES) {
    if (fitSet.includes(k)) continue;
    const room = usable - fitSet.reduce((s, f) => s + d[f], 0) - D.minYardFt * (fitSet.length + 1);
    d[k] = room >= MIN_EMPTY_SLOT_DEPTH ? Math.min(d[k], room) : 0;
  }
  const drawn = SLOT_NAMES.filter((s) => d[s] > 0);
  // the back house sits against the back (clear strip only); the open space in front of it is shared between the front
  // yard and the courtyard (≈ 10 ft each on the owner's plan)
  const z0: Record<SlotName, number> = { front: 0, back: 0 };
  if (d.back > 0) z0.back = usable - d.back;
  if (d.front > 0) {
    const open = (d.back > 0 ? z0.back : usable) - d.front;
    z0.front = d.back > 0 ? clamp(open / 2, Math.min(D.minYardFt, open / 2), D.yardFt) : Math.min(D.yardFt, Math.max(0, open));
    if (d.back > 0 && open - z0.front > D.yardFt) z0.front = open - D.yardFt; // a long plot: the courtyard stays 10 ft
  }

  const slots: BuildingSlot[] = drawn.map((s) => {
    const unit = bySlot[s];
    const zA = z0[s];
    const zB = zA + d[s];
    // the house sits between the lane passage and the right-wall clear strip (no wall ever touches it)
    const plotW = Math.min(widthAt(zA), widthAt(zB));
    const x1 = rightX - D.wallClearFt;
    const room = Math.max(4, Math.min(plotW - D.wallClearFt - D.passageFt, x1 - Math.max(leftX(zA), leftX(zB)) - D.passageFt));
    const w = Math.min(req[s].w, room);
    if (unit && req[s].w > plotW + 1e-9) {
      warnings.push(`"${unit.name}" footprint width ${formatFeetInches(req[s].w)} is wider than the plot (${formatFeetInches(plotW)}) — drawn scaled to fit.`);
    }
    const yardFt = s === "front" ? zA : zA - (d.front > 0 ? z0.front + d.front : 0);
    const floors = clamp(Math.round(unit?.floors ?? 1), 1, 10);
    const b = buildSlot(s, unit, { x0: x1 - w, x1, z0: zA, z1: zB }, floors, req[s], leftX, yardFt);
    // drawn a little narrower only to keep the passage + wall clearance: that is not "scaled" (labels keep the data width)
    b.scaled = req[s].w > plotW + 1e-9 || b.depthFt < req[s].d - 1e-9;
    return b;
  });

  const built = slots.filter((s) => s.unit);
  const lastZ = built.length ? Math.max(...built.map((s) => s.rect.z1)) : 0;
  const frontSlot = slots.find((s) => s.slot === "front");
  const backSlot = slots.find((s) => s.slot === "back");
  const courtyard = frontSlot && backSlot ? { z0: frontSlot.rect.z1, z1: backSlot.rect.z0 } : null;
  const paved: Pt[] = [
    { x: leftX(0), z: 0 },
    { x: rightX, z: 0 },
    { x: rightX, z: lastZ },
    { x: leftX(lastZ), z: lastZ },
  ];

  // ── surroundings ──
  const S = SITE_SURROUNDINGS;
  const tile = offsetPolygon(polygon, [S.frontMarginFt, S.sideMarginFt, S.backMarginFt, S.sideMarginFt]);
  const meadow = { x0: Math.min(tile[0].x, tile[3].x), x1: Math.max(tile[1].x, tile[2].x), z0: -S.frontMarginFt, z1: 0 };

  const compoundWalls = buildCompoundWalls(polygon, frontSlot ?? null, backSlot ?? null, courtyard, leftX);
  const fixtures = buildFixtures(polygon, compoundWalls, frontSlot ?? null, tile);
  const maxHeightFt = slots.reduce((m, s) => Math.max(m, s.heightFt + s.parapetFt), 0);
  const center = { x: rightX / 2 + leftX(depth / 2) / 2, z: depth / 2 };
  const radius = Math.max(...tile.map((p) => Math.hypot(p.x - center.x, p.z - center.z)));

  const layout: SiteLayout = {
    plot: { frontWidthFt: front, backWidthFt: back, depthFt: depth, areaSqft, rightX, polygon, townName: plotIn.townName || "Pattukottai" },
    slots,
    courtyard,
    rearYard: { z0: slots.length ? Math.max(...slots.map((s) => s.rect.z1)) : 0, z1: depth },
    paved,
    compoundWalls,
    fixtures,
    site: { tile, meadow },
    dimensions: [],
    center,
    radius,
    maxHeightFt,
    warnings,
    unplaced,
  };
  layout.dimensions = buildDimensions(layout);
  return layout;
}

function buildSlot(
  slot: SlotName,
  unit: SceneUnit | null,
  rect: Rect,
  floors: number,
  req: { w: number; d: number },
  leftX: (z: number) => number,
  yardFt: number,
): BuildingSlot {
  const { x0, x1, z0, z1 } = rect;
  const w = x1 - x0;
  const dep = z1 - z0;
  const D = SITE_DEFAULTS;
  // backyard notch at the rear-right corner, clamped so tiny footprints stay valid
  const nW = Math.min(D.notch.widthFt, w * 0.36);
  const stW = nW * 0.8; // the bathroom narrows the notch by one small step
  const nD = Math.min(D.notch.depthFt, dep * 0.36);
  const sD = Math.min(D.notch.stepDepthFt, nD * 0.45);
  const wide: Rect = { x0: x1 - nW, x1, z0: z1 - nD + sD, z1 };
  const step: Rect = { x0: x1 - stW, x1, z0: z1 - nD, z1: z1 - nD + sD };
  // counter-clockwise from the front-left corner: front → right → backyard notch → back → lane side
  const outline: Pt[] = [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: step.z0 },
    { x: step.x0, z: step.z0 },
    { x: step.x0, z: wide.z0 },
    { x: wide.x0, z: wide.z0 },
    { x: wide.x0, z: z1 },
    { x: x0, z: z1 },
  ];
  // the stair stands in the yard in front of the front-right corner
  const sw = Math.min(D.stairs.widthFt, w * 0.56);
  const sd = Math.max(0.5, Math.min(D.stairs.depthFt, yardFt - 0.6));
  const stairs: Rect = { x0: x1 - sw, x1, z0: z0 - sd, z1: z0 };
  const heightFt = floors * D.floorHeightFt;
  const entranceX = x0 + Math.min(3.2, w * 0.18);
  return {
    slot,
    unit,
    status: unit ? unit.status : "empty",
    rect,
    widthFt: w,
    depthFt: dep,
    requestedWidthFt: req.w,
    requestedDepthFt: req.d,
    scaled: w < req.w - 1e-9 || dep < req.d - 1e-9,
    floors,
    heightFt,
    parapetFt: D.parapetFt,
    outline,
    notch: { wide, step },
    stairs,
    door: { x: r2(entranceX), z: z0, widthFt: 3.2 },
    backExit: { x: r2((step.x0 + x1) / 2), z: step.z0, widthFt: Math.min(3, stW * 0.6) },
    kolam: { x: r2(entranceX), z: r2(z0 - Math.min(2, yardFt * 0.3)), sizeFt: Math.min(3.2, yardFt * 0.4) },
    walls: wallsOf(outline),
    yardFt: r2(yardFt),
    passageFt: x0 - leftX(z0),
    floorAreaSqft: r2(Math.abs(polygonArea(outline))),
  };
}

/** Classify the outline edges so the renderer knows where windows / doors / blank party walls go. */
function wallsOf(outline: Pt[]): Wall[] {
  const [p0, p1, p2, p3, p4, p5, p6, p7] = outline;
  const mk = (a: Pt, b: Pt, kind: WallKind): Wall => {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // outline is counter-clockwise → outward normal of edge (dx, dz) is (dz, -dx)
    return { a, b, n: { x: (b.z - a.z) / len, z: -(b.x - a.x) / len }, kind, length: len };
  };
  const walls = [
    mk(p0, p1, "front"),
    mk(p1, p2, "party"),
    mk(p2, p3, "notch"),
    mk(p3, p4, "notch"),
    mk(p4, p5, "notch"),
    mk(p5, p6, "notch"),
    mk(p6, p7, "back"),
    mk(p7, p0, "side"),
  ];
  return walls.filter((w) => w.length > 0.05);
}

function buildCompoundWalls(
  polygon: Pt[],
  frontSlot: BuildingSlot | null,
  backSlot: BuildingSlot | null,
  courtyard: { z0: number; z1: number } | null,
  leftX: (z: number) => number,
): CompoundWall[] {
  const [FL, FR, BR, BL] = polygon;
  const out: CompoundWall[] = [];
  // the wall runs on the boundary all round (never against a house). Gate to Unit A: left / centre of the front wall,
  // opening onto the front yard in front of Unit A's entrance (its stair is on the right)
  const width = FR.x - FL.x;
  const gw = Math.min(4, width * 0.25);
  const doorX = frontSlot ? frontSlot.door.x : FL.x + width * 0.3;
  const stairX0 = frontSlot ? frontSlot.stairs.x0 : FR.x;
  const ga = clamp(doorX - gw / 2 + 0.6, FL.x + Math.min(3, width * 0.15), Math.max(FL.x + 1, stairX0 - gw - 0.6));
  out.push({ a: FL, b: { x: r2(ga), z: 0 }, kind: "wall" });
  out.push({ a: { x: r2(ga), z: 0 }, b: { x: r2(ga + gw), z: 0 }, kind: "gate", gate: "front" });
  out.push({ a: { x: r2(ga + gw), z: 0 }, b: FR, kind: "wall" });
  out.push({ a: FR, b: BR, kind: "wall" });
  out.push({ a: BR, b: BL, kind: "wall" });
  // Gate to Unit B: in the lane wall at the courtyard (in front of Unit B's entrance)
  if (backSlot) {
    const depth = BL.z;
    const zc = courtyard && courtyard.z1 - courtyard.z0 > 4.6 ? (courtyard.z0 + courtyard.z1) / 2 : clamp(backSlot.rect.z0 - 2.5, 3, depth - 3);
    const gb = Math.min(4, courtyard ? Math.max(2, courtyard.z1 - courtyard.z0 - 0.8) : 4);
    const p = (z: number): Pt => ({ x: r2(leftX(z)), z: r2(z) });
    out.push({ a: BL, b: p(zc + gb / 2), kind: "wall" });
    out.push({ a: p(zc + gb / 2), b: p(zc - gb / 2), kind: "gate", gate: "side" });
    out.push({ a: p(zc - gb / 2), b: FL, kind: "wall" });
  } else out.push({ a: BL, b: FL, kind: "wall" });
  return out;
}

/** x of the tile edge (a → b) at plan z. */
function xAt(a: Pt, b: Pt, z: number): number {
  return Math.abs(b.z - a.z) < 1e-9 ? a.x : a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z);
}

function buildFixtures(polygon: Pt[], walls: CompoundWall[], frontSlot: BuildingSlot | null, tile: Pt[]): SiteFixtures {
  const [FL, FR, , BL] = polygon;
  const gate = walls.find((w) => w.gate === "front");
  // mailbox on Gate A's corner-side pillar
  const mailbox = gate ? { ...gate.a } : { x: FR.x - 1, z: 0 };
  // property-tax spot (owner): the tax collector's moped on the grass right of the plot, beside Unit A's front yard
  // (where a palm used to stand) — far enough forward that the default camera sees it past the stair (it is low)
  const [, tFR0, tBR0] = tile;
  const taxZ = 7;
  const taxStamp: SiteFixtures["taxStamp"] = { x: r2(Math.min(FR.x + 9.5, xAt(tFR0, tBR0, taxZ) - 5)), z: taxZ, on: "office" };
  // notice board: on the lane-side (left) compound wall a few feet in from the front, facing the lane
  const depth = BL.z - FL.z;
  const zb = Math.min(7, Math.max(2.5, depth * 0.12));
  const xb = FL.x + ((BL.x - FL.x) * (zb - FL.z)) / (depth || 1);
  const noticeBoard = { x: r2(xb), z: r2(zb), widthFt: r2(clamp(depth * 0.06, 2.4, 3.6)) };
  // poles stand on the grass just outside the front wall (no road any more), one either side of the plot (owner):
  // [0] off the front-RIGHT corner carries the lamp, the meter and the service drop; [1] off the front-LEFT
  // (lane) corner carries the line on
  const zPole = -SITE_SURROUNDINGS.poleSetbackFt;
  const [tFL, tFR, tBR, tBL] = tile;
  const tx0 = xAt(tFL, tBL, zPole);
  const tx1 = xAt(tFR, tBR, zPole);
  const p0x = Math.min(tx1 - 6, FR.x + 3.5);
  const poles = [
    { x: r2(p0x), z: r2(zPole) },
    { x: r2(Math.min(FL.x - 1.5, Math.max(tx0 + 2.5, FL.x - 3.5))), z: r2(zPole) },
  ];
  return {
    mailbox,
    noticeBoard,
    taxStamp,
    plotMarker: { x: r2(BL.x - 2.6), z: r2(BL.z + 2.6) },
    poles,
    poleHeightFt: 26,
  };
}

// ───────────────────────────── dimensions ─────────────────────────────

function buildDimensions(L: SiteLayout): Dimension[] {
  const { polygon, frontWidthFt, backWidthFt, depthFt, areaSqft } = L.plot;
  const [FL, FR, BR, BL] = polygon;
  const y = 0.35;
  const v = (p: Pt, yy = y): Vec3 => ({ x: p.x, y: yy, z: p.z });
  const dims: Dimension[] = [
    { key: "frontWidthFt", kind: "plot", valueFt: frontWidthFt, label: formatFeetInches(frontWidthFt), a: v(FL), b: v(FR), dir: { x: 0, y: 0, z: -1 }, offset: 3.4, primary: true },
    { key: "backWidthFt", kind: "plot", valueFt: backWidthFt, label: formatFeetInches(backWidthFt), a: v(BL), b: v(BR), dir: { x: 0, y: 0, z: 1 }, offset: 3.4, primary: true },
    // depth runs along the left side (the side the default camera sees), measured square to the street
    { key: "depthFt", kind: "plot", valueFt: depthFt, label: formatFeetInches(depthFt), a: v({ x: Math.min(FL.x, BL.x), z: 0 }), b: v({ x: Math.min(FL.x, BL.x), z: depthFt }), dir: { x: -1, y: 0, z: 0 }, offset: 4.5, primary: true },
  ];
  for (const s of L.slots) {
    const top = s.heightFt + s.parapetFt + 0.6;
    const { x0, x1, z0, z1 } = s.rect;
    const base = { slot: s.slot, unitId: s.unit?.id };
    const real = !!s.unit; // an empty slot's footprint is a placeholder: only drawn when its field is highlighted
    // the footprint is drawn slightly inset (passage + wall clearance) — the label keeps the unit's real width
    const shownW = s.requestedWidthFt > s.widthFt && !s.scaled ? s.requestedWidthFt : s.widthFt;
    dims.push(
      { key: `footprintWidthFt:${s.slot}`, kind: "footprint", ...base, valueFt: shownW, label: formatFeetInches(shownW), a: { x: x0, y: top, z: z1 }, b: { x: x1, y: top, z: z1 }, dir: { x: 0, y: 0, z: 1 }, offset: 1.6, primary: real },
      { key: `footprintDepthFt:${s.slot}`, kind: "footprint", ...base, valueFt: s.depthFt, label: formatFeetInches(s.depthFt), a: { x: x0, y: top, z: z0 }, b: { x: x0, y: top, z: z1 }, dir: { x: -1, y: 0, z: 0 }, offset: 1.6, primary: real },
      {
        key: `floors:${s.slot}`,
        kind: "height",
        ...base,
        valueFt: s.heightFt,
        label: `${s.floors} floor${s.floors === 1 ? "" : "s"} · ${formatFeetInches(s.heightFt)}`,
        a: { x: x0, y: 0, z: z0 },
        b: { x: x0, y: s.heightFt, z: z0 },
        dir: { x: -Math.SQRT1_2, y: 0, z: -Math.SQRT1_2 },
        offset: 2.2,
        primary: false,
      },
    );
  }
  if (L.courtyard && L.courtyard.z1 - L.courtyard.z0 > 0.5) {
    const backSlot = L.slots.find((s) => s.slot === "back")!;
    const x = (BL.x + backSlot.rect.x0) / 2 + 1.2; // in the lane-side passage
    const gap = L.courtyard.z1 - L.courtyard.z0;
    dims.push({ key: "courtyard", kind: "gap", valueFt: gap, label: formatFeetInches(gap), a: { x, y, z: L.courtyard.z0 }, b: { x, y, z: L.courtyard.z1 }, dir: { x: 1, y: 0, z: 0 }, offset: 0, primary: true });
  }
  const c = { x: (FL.x + FR.x + BR.x + BL.x) / 4, z: depthFt / 2 };
  dims.push({ key: "areaSqft", kind: "area", valueFt: areaSqft, label: `${formatIndianNumber(areaSqft)} sq ft`, a: { x: c.x, y: 0.3, z: c.z }, b: { x: c.x, y: 0.3, z: c.z }, dir: { x: 0, y: 1, z: 0 }, offset: 0, primary: false });
  return dims;
}

/**
 * Does a dimension answer a config field? Field forms: "frontWidthFt", "footprintWidthFt" (every slot),
 * "footprintWidthFt:front" or "footprintWidthFt:<unitId>", "floors:back", "position" (every footprint).
 */
export function dimensionMatches(dim: Pick<Dimension, "key" | "slot" | "unitId">, field: string | null | undefined): boolean {
  if (!field) return false;
  if (dim.key === field) return true;
  const [base, target] = field.split(":");
  const [dimBase, dimSlot] = dim.key.split(":");
  if (base === "position") return dimBase === "footprintWidthFt" || dimBase === "footprintDepthFt";
  if (base !== dimBase) return false;
  if (!target) return true;
  return target === dimSlot || (!!dim.unitId && target === dim.unitId);
}

/** Which slot (if any) a highlight field points at — used to pulse a whole building for e.g. "floors:<unitId>". */
export function highlightedSlots(layout: SiteLayout, field: string | null | undefined): SlotName[] {
  if (!field) return [];
  const [base, target] = field.split(":");
  if (!["footprintWidthFt", "footprintDepthFt", "floors", "position"].includes(base)) return [];
  return layout.slots.filter((s) => !target || target === s.slot || target === s.unit?.id).map((s) => s.slot);
}
