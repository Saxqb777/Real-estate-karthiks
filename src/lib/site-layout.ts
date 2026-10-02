// Pure site-plan geometry for the 3D estate diorama (and its 2D fallback). No three.js, no DOM — unit tested.
// Every value is in FEET, in "plan" coordinates as seen on the owner's drawing:
//   x grows left → right when standing on the street looking at the plot,
//   z grows from the front edge (z = 0, on the street) to the back edge (z = depthFt).
// The right boundary is straight (x = plot.rightX); the left boundary slants from frontWidthFt to backWidthFt.
// Both buildings sit flush to the right boundary with the side passage on the left (see CLAUDE.md "Site plan").
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
  courtyardFt: 10,
  minCourtyardFt: 4,
  floorHeightFt: 10.5,
  parapetFt: 3,
  /** stepped front-right notch: 6.5 wide × 9.5 deep, narrowing by one small step to the stair width */
  notch: { widthFt: 6.5, depthFt: 9.5, stepDepthFt: 2 },
  /** external staircase straight behind the notch, against the right boundary (width across × run along z) */
  stairs: { widthFt: 5, runFt: 7 },
} as const;

/** Street + land tile around the plot (diorama context, not owner data). */
export const SITE_SURROUNDINGS = {
  sideMarginFt: 16,
  backMarginFt: 10,
  /** from the front boundary outwards: drain, near shoulder, road, far shoulder, verge */
  drainFt: 1.75,
  nearShoulderFt: 4.5,
  roadFt: 16,
  farShoulderFt: 5.5,
  vergeFt: 2.25,
} as const;

const MIN_EMPTY_SLOT_DEPTH = 8;
const LIMITS = { width: [4, 400], depth: [10, 1000] } as const;

export type WallKind = "front" | "left" | "back" | "porch" | "stair" | "party";
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
  /** footprint polygon, counter-clockwise, with the stepped notch + stair well cut out of the front-right corner */
  outline: Pt[];
  /** porch notch: wide part (front) and the narrower stepped part behind it */
  notch: { wide: Rect; step: Rect };
  /** open external staircase well, behind the notch, flush right */
  stairs: Rect;
  /** main door on the notch's left wall, facing +x into the porch */
  door: { x: number; z: number; widthFt: number };
  /** where the kolam is drawn (porch floor in front of the door) */
  kolam: { x: number; z: number; sizeFt: number };
  walls: Wall[];
  /** side passage width (left boundary → building) at the building front */
  passageFt: number;
  /** enclosed floor area of one floor (sq ft) */
  floorAreaSqft: number;
}

export interface CompoundWall {
  a: Pt;
  b: Pt;
  kind: "wall" | "gate";
  /** which gate: the side-passage gate leads to the back unit, the porch gate to the front unit */
  gate?: "passage" | "porch" | "main";
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
    /** x of the straight right boundary (= the larger width) */
    rightX: number;
    /** front-left, front-right, back-right, back-left (counter-clockwise) */
    polygon: Pt[];
    townName: string;
  };
  /** 0–2 drawn slots (an empty slot is dropped only when there is no room for it) */
  slots: BuildingSlot[];
  courtyard: { z0: number; z1: number } | null;
  rearYard: { z0: number; z1: number };
  /** paved ground: plot from the front edge to the back of the last building */
  paved: Pt[];
  compoundWalls: CompoundWall[];
  site: {
    tile: Pt[];
    street: { x0: number; x1: number; drain: [number, number]; nearShoulder: [number, number]; road: [number, number]; farShoulder: [number, number] };
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
  return units.map((u) => ({
    id: u.id,
    name: u.name,
    position: u.position,
    floors: u.floors,
    footprintWidthFt: u.footprintWidthFt,
    footprintDepthFt: u.footprintDepthFt,
    status: u.status,
    rentState: u.rentState,
    tenantName: u.activeLease?.tenantName ?? null,
    monthlyRent: u.activeLease?.monthlyRent ?? null,
    isActive: u.isActive,
    daysOverdue: u.nextPayment?.daysOverdue ?? 0,
    vacantDays: u.status === "vacant" ? currentVacantDays(u) : 0,
  }));
}

function currentVacantDays(u: UnitBreakdown): number {
  const last = u.vacantPeriods[u.vacantPeriods.length - 1];
  return last ? last.days : 0;
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
  const leftX = (z: number) => rightX - widthAt(z);
  const polygon: Pt[] = [
    { x: leftX(0), z: 0 },
    { x: rightX, z: 0 },
    { x: rightX, z: depth },
    { x: leftX(depth), z: depth },
  ];

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

  // Real buildings get the room first; with no units both placeholders are fitted together.
  const anchors = SLOT_NAMES.filter((s) => real[s]);
  const fitSet = anchors.length ? anchors : [...SLOT_NAMES];
  const gapNeeded = fitSet.length === 2 ? SITE_DEFAULTS.minCourtyardFt : 0;
  const fitSum = fitSet.reduce((s, k) => s + d[k], 0);
  if (fitSum + gapNeeded > depth) {
    const s = (depth - gapNeeded) / fitSum;
    for (const k of fitSet) {
      d[k] *= s;
      if (real[k]) warnings.push(`"${bySlot[k]!.name}" footprint depth ${formatFeetInches(req[k].d)} does not fit the ${formatFeetInches(depth)} plot — drawn scaled to ${formatFeetInches(d[k])}.`);
    }
  }
  for (const k of SLOT_NAMES) {
    if (fitSet.includes(k)) continue;
    const room = depth - fitSet.reduce((s, f) => s + d[f], 0) - SITE_DEFAULTS.minCourtyardFt;
    d[k] = room >= MIN_EMPTY_SLOT_DEPTH ? Math.min(d[k], room) : 0;
  }
  const drawn = SLOT_NAMES.filter((s) => d[s] > 0);
  const both = drawn.length === 2;
  const courtyardFt = both ? Math.min(SITE_DEFAULTS.courtyardFt, depth - d.front - d.back) : 0;
  const z0: Record<SlotName, number> = {
    front: 0,
    back: d.front > 0 ? d.front + courtyardFt : Math.max(0, depth - d.back - SITE_DEFAULTS.courtyardFt),
  };

  const slots: BuildingSlot[] = drawn.map((s) => {
    const unit = bySlot[s];
    const zA = z0[s];
    const zB = zA + d[s];
    const room = Math.min(widthAt(zA), widthAt(zB));
    const w = Math.min(req[s].w, room);
    if (unit && w < req[s].w - 1e-9) {
      warnings.push(`"${unit.name}" footprint width ${formatFeetInches(req[s].w)} is wider than the plot (${formatFeetInches(room)}) — drawn scaled to fit.`);
    }
    const floors = clamp(Math.round(unit?.floors ?? 1), 1, 10);
    return buildSlot(s, unit, { x0: rightX - w, x1: rightX, z0: zA, z1: zB }, floors, req[s], leftX);
  });

  const lastZ = slots.length ? Math.max(...slots.map((s) => s.rect.z1)) : 0;
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
  const frontMargin = S.drainFt + S.nearShoulderFt + S.roadFt + S.farShoulderFt + S.vergeFt;
  const tile = offsetPolygon(polygon, [frontMargin, S.sideMarginFt, S.backMarginFt, S.sideMarginFt]);
  let zc = 0;
  const band = (w: number): [number, number] => {
    const r: [number, number] = [zc - w, zc];
    zc -= w;
    return r;
  };
  const street = {
    x0: Math.min(tile[0].x, tile[3].x),
    x1: Math.max(tile[1].x, tile[2].x),
    drain: band(S.drainFt),
    nearShoulder: band(S.nearShoulderFt),
    road: band(S.roadFt),
    farShoulder: band(S.farShoulderFt),
  };

  const compoundWalls = buildCompoundWalls(polygon, frontSlot ?? null, leftX);
  const maxHeightFt = slots.reduce((m, s) => Math.max(m, s.heightFt + s.parapetFt), 0);
  const center = { x: rightX / 2 + leftX(depth / 2) / 2, z: depth / 2 };
  const radius = Math.max(...tile.map((p) => Math.hypot(p.x - center.x, p.z - center.z)));

  const layout: SiteLayout = {
    plot: { frontWidthFt: front, backWidthFt: back, depthFt: depth, areaSqft, rightX, polygon, townName: plotIn.townName || "Pattukottai" },
    slots,
    courtyard,
    rearYard: { z0: lastZ, z1: depth },
    paved,
    compoundWalls,
    site: { tile, street },
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
): BuildingSlot {
  const { x0, x1, z0, z1 } = rect;
  const w = x1 - x0;
  const dep = z1 - z0;
  const D = SITE_DEFAULTS;
  // notch + stair well, clamped so tiny footprints stay valid
  const nW = Math.min(D.notch.widthFt, w * 0.36);
  const stW = Math.min(D.stairs.widthFt, nW * 0.78);
  const nD = Math.min(D.notch.depthFt, dep * 0.36);
  const sD = Math.min(D.notch.stepDepthFt, nD * 0.25);
  const stD = Math.min(D.stairs.runFt, dep * 0.26);
  const wide: Rect = { x0: x1 - nW, x1, z0, z1: z0 + nD - sD };
  const step: Rect = { x0: x1 - stW, x1, z0: z0 + nD - sD, z1: z0 + nD };
  const stairs: Rect = { x0: x1 - stW, x1, z0: z0 + nD, z1: z0 + nD + stD };
  const outline: Pt[] = [
    { x: x0, z: z0 },
    { x: wide.x0, z: z0 },
    { x: wide.x0, z: wide.z1 },
    { x: stairs.x0, z: wide.z1 },
    { x: stairs.x0, z: stairs.z1 },
    { x: x1, z: stairs.z1 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ];
  const heightFt = floors * D.floorHeightFt;
  const porchDepth = wide.z1 - z0;
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
    door: { x: wide.x0, z: z0 + porchDepth * 0.55, widthFt: Math.min(3.5, porchDepth * 0.5) },
    kolam: { x: wide.x0 + nW * 0.55, z: z0 + porchDepth * 0.42, sizeFt: Math.min(nW * 0.62, porchDepth * 0.62) },
    walls: wallsOf(outline),
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
    mk(p1, p2, "porch"),
    mk(p2, p3, "porch"),
    mk(p3, p4, "stair"),
    mk(p4, p5, "stair"),
    mk(p5, p6, "party"),
    mk(p6, p7, "back"),
    mk(p7, p0, "left"),
  ];
  return walls.filter((w) => w.length > 0.05);
}

function buildCompoundWalls(polygon: Pt[], frontSlot: BuildingSlot | null, leftX: (z: number) => number): CompoundWall[] {
  const [FL, FR, BR, BL] = polygon;
  const out: CompoundWall[] = [];
  const realFront = frontSlot && frontSlot.unit && frontSlot.rect.z0 < 0.01;
  if (realFront) {
    // the front building stands on the boundary: a passage gate on the left, a porch gate across the notch
    const bx0 = frontSlot.rect.x0;
    const passage = bx0 - FL.x;
    if (passage > 1.2) out.push({ a: FL, b: { x: bx0, z: 0 }, kind: "gate", gate: "passage" });
    else if (passage > 0.05) out.push({ a: FL, b: { x: bx0, z: 0 }, kind: "wall" });
    const nx = frontSlot.notch.wide.x0;
    const gw = Math.min(4, (FR.x - nx) * 0.7);
    out.push({ a: { x: nx, z: 0 }, b: { x: FR.x - gw, z: 0 }, kind: "wall" });
    out.push({ a: { x: FR.x - gw, z: 0 }, b: FR, kind: "gate", gate: "porch" });
  } else {
    // open front: wall with a main gate near the left (driveway side)
    const gx0 = FL.x + 0.8;
    const gw = Math.min(8, (FR.x - FL.x) * 0.4);
    out.push({ a: FL, b: { x: gx0, z: 0 }, kind: "wall" });
    out.push({ a: { x: gx0, z: 0 }, b: { x: gx0 + gw, z: 0 }, kind: "gate", gate: "main" });
    out.push({ a: { x: gx0 + gw, z: 0 }, b: FR, kind: "wall" });
  }
  out.push({ a: FR, b: BR, kind: "wall" });
  out.push({ a: BR, b: BL, kind: "wall" });
  out.push({ a: BL, b: { x: leftX(0), z: 0 }, kind: "wall" });
  return out;
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
    dims.push(
      { key: `footprintWidthFt:${s.slot}`, kind: "footprint", ...base, valueFt: s.widthFt, label: formatFeetInches(s.widthFt), a: { x: x0, y: top, z: z1 }, b: { x: x1, y: top, z: z1 }, dir: { x: 0, y: 0, z: 1 }, offset: 1.6, primary: true },
      { key: `footprintDepthFt:${s.slot}`, kind: "footprint", ...base, valueFt: s.depthFt, label: formatFeetInches(s.depthFt), a: { x: x0, y: top, z: z0 }, b: { x: x0, y: top, z: z1 }, dir: { x: -1, y: 0, z: 0 }, offset: 1.6, primary: true },
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
    const x = (BL.x + backSlot.rect.x0) / 2 + 1.2;
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
