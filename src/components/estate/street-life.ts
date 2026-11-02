// Where the people on the grass are at any moment — pure timelines in plan feet and scene seconds (People.tsx draws
// them; the revenue officer's day lives in tax-route.ts). No React / three, so a test can play the whole street and
// check that nobody stands in anybody, nobody walks through someone standing and nobody stands on a kolam.
// Owner, 9/10/2026: a passer-by stopped right beside the tenant waiting at the gate — both on the gate kolam, facing
// nowhere in particular. Since then:
//   • the passers-by on the front grass take TURNS (one at a time) on one track, and each stops once to look at the
//     houses at a spot clear of the gate, the tenant, the revenue officer and the property manager;
//   • a tenant waits BESIDE the unit's gate (never on its kolam), facing it, until it swings open.
// Owner, 9/10/2026 (later): the dog left the front — a big mother dog lies on the lane-side grass with her 2 pups
// (dogFamily / pupAt): they nap against her, wake, play and chase each other round her, then flop down again.
import { offsetPolygon, type BuildingSlot, type Pt, type SiteLayout } from "../../lib/site-layout";

/** x of a polygon edge (a → b) at plan z. */
const xOnEdge = (a: Pt, b: Pt, z: number) => (Math.abs(b.z - a.z) < 1e-9 ? a.x : a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z));

/** The island tile's left and right edge at plan z (passers-by appear from / vanish into them). */
export function tileXRange(layout: Pick<SiteLayout, "site">, z: number): [number, number] {
  const [FL, FR, BR, BL] = layout.site.tile;
  return [xOnEdge(FL, BL, z), xOnEdge(FR, BR, z)];
}

const mod = (t: number, p: number) => ((t % p) + p) % p;

// ───────────────────────────── plants (Vegetation.tsx draws them; the rover stops by them) ─────────────────────────────

export function insidePolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Where the coconut palms stand (plan ft): on the right and behind the buildings, two at the front-right corner. */
export function palmSpots(layout: Pick<SiteLayout, "plot" | "site" | "rearYard">): Pt[] {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const R = layout.plot.rightX;
  const leftX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  const M = layout.site.meadow;
  // on the right and behind the buildings: they frame the view from the front-left instead of hiding the facades;
  // two more at the front-right corner of the grass, where the cow grazes
  const spots: Pt[] = [
    { x: R + 9.2, z: M.z0 + 4.4 },
    { x: R + 13.4, z: M.z0 + 2.4 },
    // (the palm that stood at R+7, z 5 made way for the property-tax spot: now the tax collector's moped)
    { x: R + 10.5, z: 23 },
    { x: R + 7.5, z: 42 },
    { x: R + 11, z: 58 },
    { x: R + 7, z: D - 3 },
    // the row behind the back house stands well back (D + 6.9 … 7.5): the rover's lane runs between it and the hedges
    { x: (R + leftX(D)) / 2 + 6, z: D + 7.2 },
    { x: (R + leftX(D)) / 2 - 6, z: D + 6.9 },
    { x: leftX(D) - 9, z: D + 7.5 },
    { x: leftX(D - 6) - 11, z: D - 6 },
  ];
  const rear = layout.rearYard.z1 - layout.rearYard.z0;
  if (rear > 6.5) spots.push({ x: leftX(D - rear / 2) + 4.2, z: D - rear / 2 });
  const tileIn = offsetPolygon(layout.site.tile, -2.2);
  return spots.filter((p) => insidePolygon(p, tileIn));
}

/** Where the banana clumps grow (plan ft): the side garden on the lane side, one more by the cow at the front right. */
export function bananaSpots(layout: Pick<SiteLayout, "plot" | "site">): Pt[] {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const leftX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  const spots: Pt[] = [
    { x: leftX(D * 0.36) - 9.5, z: D * 0.36 },
    { x: leftX(D * 0.36 + 3) - 12.5, z: D * 0.36 + 3.5 },
    { x: leftX(D * 0.62) - 8.5, z: D * 0.62 },
    { x: layout.plot.rightX + 6.8, z: layout.site.meadow.z0 + 2.8 },
  ];
  const tileIn = offsetPolygon(layout.site.tile, -2);
  return spots.filter((p) => insidePolygon(p, tileIn));
}

// ───────────────────────────── gates, signs, kolams ─────────────────────────────

export type GateSign = { x: number; z: number; side?: boolean };

/**
 * The point just outside a unit's own gate (plan ft): its TO-LET board stands there, its kolam is drawn there and the
 * tenant goes in through that gate. Gate to Unit A in the front wall, Gate to Unit B in the lane wall.
 */
export function gateSign(layout: Pick<SiteLayout, "compoundWalls">, slot: "front" | "back"): GateSign | undefined {
  const front = layout.compoundWalls.find((w) => w.gate === "front");
  const side = layout.compoundWalls.find((w) => w.gate === "side");
  if (slot === "back" && side) return { x: (side.a.x + side.b.x) / 2 - 2.6, z: (side.a.z + side.b.z) / 2, side: true };
  return front ? { x: (front.a.x + front.b.x) / 2, z: -2.6 } : undefined;
}

/** A street kolam is a 3.4 ft square drawn 1.2 ft further out than the sign (UnitSlot's StreetKolam). */
export const KOLAM_FT = 3.4;
export function kolamCentre(sign: GateSign): Pt {
  return sign.side ? { x: sign.x - 1.2, z: sign.z } : { x: sign.x, z: sign.z - 1.2 };
}

/** The gate itself (the point it swings about) from its sign. */
export function gatePoint(sign: GateSign): { x: number; z: number; side: boolean } {
  return sign.side ? { x: sign.x + 2.6, z: sign.z, side: true } : { x: sign.x, z: 0, side: false };
}

// ───────────────────────────── passers-by ─────────────────────────────

/** The passers-by's one track across the front grass, this far in front of the front wall (ft). */
export const CROSS_Z = -4.6;
/** Seconds between one passer-by leaving the grass and the next one setting off. */
const TURN_GAP = 3;

/** Where a passer-by stops: in front of the house left / right of the gate, at the TO-LET board, or a fraction 0..1 of a loop. */
type StopAt = "left" | "right" | "board" | number;
export interface Stop {
  at: StopAt;
  dur: number;
  /** "look" turns to the houses */
  act?: "look" | "idle";
}
export type Route =
  /** walks across the front grass on the shared track, edge to edge (dir 1 = left → right) */
  | { kind: "cross"; dir: 1 | -1 }
  /** strolls a closed loop through the banana garden on the left */
  | { kind: "loop"; area: "garden" };
export interface WalkSpec {
  speed: number;
  scale: number;
  route: Route;
  stops: Stop[];
  /** scene-time offset into a loop (the crossers' turns are scheduled, see streetSchedule) */
  offset: number;
}

/**
 * The passers-by, in the order People.tsx dresses them: a veshti man with an umbrella, a saree lady (she reads the
 * TO-LET board when the front house is empty), a lady strolling through the banana garden (she stops on the far side
 * of it, off the property manager's walk down the lane), a man in a lungi.
 */
export const WALKERS: WalkSpec[] = [
  { speed: 3.4, scale: 1, route: { kind: "cross", dir: 1 }, offset: 0, stops: [{ at: "right", dur: 4.5, act: "look" }] },
  { speed: 3.0, scale: 0.96, route: { kind: "cross", dir: -1 }, offset: 0, stops: [{ at: "board", dur: 3.5, act: "look" }] },
  { speed: 2.6, scale: 0.95, route: { kind: "loop", area: "garden" }, offset: 22, stops: [{ at: 0.5, dur: 4, act: "look" }, { at: 0.62, dur: 3, act: "idle" }] },
  { speed: 2.8, scale: 1, route: { kind: "cross", dir: 1 }, offset: 0, stops: [{ at: "left", dur: 3, act: "look" }] },
];

/** x of each crossers' stop on the track: in front of the house left of the gate (clear of the waiting tenant and the
 *  property manager's corner), right of it (clear of the revenue officer at the door-number pole), the TO-LET board
 *  (empty front house only). */
export function crossSpots(layout: Pick<SiteLayout, "compoundWalls" | "slots" | "plot">): Record<"left" | "right" | "board", number | null> {
  const gate = layout.compoundWalls.find((w) => w.gate === "front");
  const R = layout.plot.rightX;
  const L = layout.plot.polygon[0].x;
  const gl = gate ? Math.min(gate.a.x, gate.b.x) : L + 3;
  const gr = gate ? Math.max(gate.a.x, gate.b.x) : L + 7;
  const front = layout.slots.find((s) => s.slot === "front");
  const empty = !!front && (front.status === "vacant" || front.status === "incoming");
  const right = Math.min(gr + 6.5, R + 2);
  // left of the gate: halfway between the property manager's front-left corner (the rover turns there) and the tenant
  // waiting by the gate, if that leaves room round both — else right of the gate (the passers-by take turns, so two of
  // them never stand there together)
  const corner = managerCorners(layout)[0];
  const sign = gateSign(layout, "front");
  const wait = sign ? tenantWaitSpot(gatePoint(sign)) : null;
  const clear = (x: number) => Math.hypot(x - corner.x, CROSS_Z - corner.z) >= 4.5 && (!wait || Math.hypot(x - wait.x, CROSS_Z - wait.z) >= 4.1);
  const mid = wait ? (corner.x + wait.x) / 2 : gl - 4.8;
  const left = clear(mid) ? mid : clear(gl - 4.8) ? gl - 4.8 : right;
  return { left, right, board: empty ? (gl + gr) / 2 : null };
}

/** The plan-space polyline a walker follows (closed for loops). */
export function routePath(route: Route, layout: Pick<SiteLayout, "site" | "plot">): Pt[] {
  if (route.kind === "cross") {
    const [x0, x1] = tileXRange(layout, CROSS_Z);
    const pts = [
      { x: x0 - 3, z: CROSS_Z },
      { x: x1 + 3, z: CROSS_Z },
    ];
    return route.dir > 0 ? pts : pts.reverse();
  }
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const lx = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  // through the side garden: up along the wall, round the banana clumps, back past the chilli mat
  return [
    { x: lx(2) - 3, z: 2 },
    { x: lx(20) - 3, z: 20 },
    { x: lx(33) - 5.5, z: 33 },
    { x: lx(Math.min(52, D * 0.68)) - 4, z: Math.min(52, D * 0.68) },
    { x: lx(Math.min(60, D * 0.78)) - 12, z: Math.min(60, D * 0.78) },
    { x: lx(40) - 14.5, z: 40 },
    { x: lx(20) - 14, z: 20 },
    { x: lx(4) - 14.5, z: 4 },
    { x: lx(1) - 9, z: 1 },
  ];
}

export interface Timeline {
  pts: Pt[];
  cum: number[];
  segs: { t0: number; t1: number; d0: number; d1: number; stop?: Stop }[];
  /** seconds on stage (walking + stops) */
  walkEnd: number;
}

export function buildTimeline(spec: WalkSpec, layout: Pick<SiteLayout, "site" | "plot" | "compoundWalls" | "slots">): Timeline {
  const loop = spec.route.kind === "loop";
  const raw = routePath(spec.route, layout);
  const pts = loop ? [...raw, raw[0]] : raw;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const span = cum[cum.length - 1];
  const spots = crossSpots(layout);
  // the crossers' stops are x positions on the straight track
  const alongX = (x: number | null) => (x === null ? null : Math.abs(x - pts[0].x));
  const stops = spec.stops
    .map((s) => {
      const d = typeof s.at === "number" ? span * s.at : loop ? null : alongX(spots[s.at]);
      return d === null ? null : { s, d };
    })
    .filter((v): v is { s: Stop; d: number } => !!v && v.d > 1 && v.d < span - 1)
    .sort((a, b) => a.d - b.d);
  const segs: Timeline["segs"] = [];
  let t = 0;
  let d = 0;
  for (const st of stops) {
    const dt = (st.d - d) / spec.speed;
    segs.push({ t0: t, t1: t + dt, d0: d, d1: st.d });
    t += dt;
    segs.push({ t0: t, t1: t + st.s.dur, d0: st.d, d1: st.d, stop: st.s });
    t += st.s.dur;
    d = st.d;
  }
  const dt = (span - d) / spec.speed;
  segs.push({ t0: t, t1: t + dt, d0: d, d1: span });
  return { pts, cum, segs, walkEnd: t + dt };
}

/** Point + direction at distance d along the polyline. */
function along(tl: Timeline, d: number): { p: Pt; dx: number; dz: number } {
  const { pts, cum } = tl;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const len = cum[i] - cum[i - 1] || 1;
  const k = Math.min(1, Math.max(0, (d - cum[i - 1]) / len));
  return { p: { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len };
}

export interface WalkerPlan {
  tl: Timeline;
  /** the walker's own cycle (s) */
  period: number;
  /** scene time at which a cycle starts */
  start: number;
}

/**
 * Every walker's timeline. The crossers share one cycle and take turns on the front grass: each sets off TURN_GAP s
 * after the previous one has left, so two of them are never on the track at the same time. Loops keep their own pace.
 */
export function streetSchedule(layout: Pick<SiteLayout, "site" | "plot" | "compoundWalls" | "slots">, specs: WalkSpec[] = WALKERS): WalkerPlan[] {
  const tls = specs.map((s) => buildTimeline(s, layout));
  let at = 0;
  const starts = specs.map((s, i) => {
    if (s.route.kind !== "cross") return 0;
    const st = at;
    at += tls[i].walkEnd + TURN_GAP;
    return st;
  });
  const shared = Math.max(at, 1);
  return specs.map((s, i) =>
    s.route.kind === "cross" ? { tl: tls[i], period: shared, start: starts[i] } : { tl: tls[i], period: tls[i].walkEnd, start: -s.offset },
  );
}

export interface WalkerState {
  /** on the grass (crossers are off stage between turns) */
  on: boolean;
  p: Pt;
  dx: number;
  dz: number;
  stop: Stop | null;
}

export function walkerAt(plan: WalkerPlan, t: number): WalkerState {
  const tt = mod(t - plan.start, plan.period);
  const { tl } = plan;
  if (tt >= tl.walkEnd) return { on: false, p: tl.pts[0], dx: 1, dz: 0, stop: null };
  const seg = tl.segs.find((s) => tt < s.t1) ?? tl.segs[tl.segs.length - 1];
  const k = seg.t1 > seg.t0 ? (tt - seg.t0) / (seg.t1 - seg.t0) : 0;
  const at = along(tl, seg.d0 + (seg.d1 - seg.d0) * k);
  return { on: true, p: at.p, dx: at.dx, dz: at.dz, stop: seg.stop ?? null };
}

// ───────────────────────────── the tenant at the gate ─────────────────────────────

/** One leg of the tenant's walk: to (x, z) in plan feet at height y, at this speed (ft/s), then a pause. */
export type Leg = { x: number; z: number; y: number; speed: number; pause?: number; look?: "front" | "gate" };

/** Seconds between the two tenants' days (index × this). */
export const TENANT_STAGGER = 23;

/** Where the tenant waits for the gate: beside it — never on its kolam — and far enough off that it stays shut. */
export function tenantWaitSpot(gate: { x: number; z: number; side: boolean }): Pt {
  // front gate: left of the gate on the street; lane gate: on the lane, towards the front (the number pole is at its back)
  return gate.side ? { x: gate.x - 2.2, z: gate.z - 3.0 } : { x: gate.x - 3.0, z: gate.z - 2.2 };
}

/**
 * The tenant's day (owner, 5/10/2026): waits beside the unit's own gate facing it, the gate swings open, walks in,
 * climbs the dog-leg stair (lower flight → U-turn landing → upper flight → arrival platform), strolls out on the terrace
 * and looks round, comes back down, walks out and the gate shuts behind. Loops on scene time.
 */
export function tenantRoute(slot: BuildingSlot, gate: { x: number; z: number; side: boolean }): Leg[] {
  const st = slot.stairs;
  const w = st.x1 - st.x0;
  const land = Math.min(2.4, w * 0.24);
  const top = Math.min(1.8, w * 0.18);
  const riser = Math.min(1.4, w * 0.14);
  const H = slot.heightFt;
  const runL = w - land;
  const runU = w - riser - top - land;
  const rise1 = (H * runL) / (runL + runU);
  const zMid = (st.z0 + st.z1) / 2;
  const lowZ = (st.z0 + zMid) / 2; // lower flight lane (towards the yard)
  const upZ = (zMid + st.z1) / 2; // upper flight lane (along the house front)
  const xLand = st.x1 - land / 2;
  const xArr = st.x0 + riser + top / 2; // the gap in the front parapet
  const r = slot.rect;
  // waiting beside the gate / just outside / just inside it
  const out = tenantWaitSpot(gate);
  const near = gate.side ? { x: gate.x - 1.6, z: gate.z } : { x: gate.x, z: gate.z - 1.6 };
  const inside = gate.side ? { x: gate.x + 2.2, z: gate.z } : { x: gate.x, z: gate.z + 2.2 };
  const foot = { x: st.x0 - 1.0, z: lowZ };
  const walk = 3.0;
  const climb = 1.7;
  const up: Leg[] = [
    { ...near, y: 0, speed: walk, pause: 1.1 }, // the gate swings open
    { ...inside, y: 0, speed: walk },
    { ...foot, y: 0, speed: walk },
    { x: st.x0 + 0.3, z: lowZ, y: 0, speed: walk },
    { x: st.x1 - land, z: lowZ, y: rise1, speed: climb },
    { x: xLand, z: lowZ, y: rise1, speed: climb },
    { x: xLand, z: upZ, y: rise1, speed: climb },
    { x: st.x1 - land - 0.1, z: upZ, y: rise1, speed: climb },
    { x: st.x0 + riser + top, z: upZ, y: H, speed: climb },
    { x: xArr, z: upZ, y: H, speed: climb },
  ];
  const terrace: Leg[] = [
    { x: xArr, z: st.z1 + 1.6, y: H, speed: walk },
    { x: (r.x0 + r.x1) / 2, z: r.z0 + (r.z1 - r.z0) * 0.35, y: H, speed: walk * 0.8, pause: 6, look: "front" },
    { x: r.x0 + 3.5, z: r.z0 + 3, y: H, speed: walk * 0.8, pause: 3.5 },
    { x: xArr, z: st.z1 + 1.6, y: H, speed: walk * 0.8 },
  ];
  // back down = the climb in reverse, then out of the gate and away (the gate shuts once they've stepped clear)
  const rev = [...up].reverse();
  // going down: stair pace until the foot, then a normal walk
  const down = rev.map((l, i) => ({ ...l, pause: undefined, speed: i === 0 || l.y > 0 || rev[i - 1].y > 0 ? climb : walk }));
  return [{ ...out, y: 0, speed: walk, pause: 14, look: "gate" }, ...up, ...terrace, ...down.slice(0, -1), { ...near, y: 0, speed: walk }, { ...out, y: 0, speed: walk }];
}

export type Timed = { a: Leg; b: Leg; t0: number; t1: number; p1: number };
export function legTimeline(legs: Leg[]): { segs: Timed[]; period: number } {
  const segs: Timed[] = [];
  let t = 0;
  for (let i = 0; i < legs.length; i++) {
    const a = legs[i];
    const b = legs[(i + 1) % legs.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y);
    const dur = len / b.speed;
    segs.push({ a, b, t0: t, t1: t + dur, p1: t + dur + (b.pause ?? 0) });
    t += dur + (b.pause ?? 0);
  }
  return { segs, period: t };
}

export interface TenantState {
  x: number;
  y: number;
  z: number;
  moving: boolean;
  dx: number;
  dz: number;
  look?: Leg["look"];
}

/** The tenant at scene time t (index = the slot's order, staggering the two tenants' days). */
export function tenantAt(tl: { segs: Timed[]; period: number }, t: number, index: number): TenantState {
  const tt = mod(t + index * TENANT_STAGGER, tl.period);
  const sg = tl.segs.find((s) => tt < s.p1) ?? tl.segs[tl.segs.length - 1];
  const k = sg.t1 > sg.t0 ? Math.min(1, Math.max(0, (tt - sg.t0) / (sg.t1 - sg.t0))) : 1;
  const moving = tt < sg.t1 && Math.hypot(sg.b.x - sg.a.x, sg.b.z - sg.a.z) > 0.01;
  return {
    x: sg.a.x + (sg.b.x - sg.a.x) * k,
    y: sg.a.y + (sg.b.y - sg.a.y) * k,
    z: sg.a.z + (sg.b.z - sg.a.z) * k,
    moving,
    dx: sg.b.x - sg.a.x,
    dz: sg.b.z - sg.a.z,
    look: moving ? undefined : sg.b.look,
  };
}

// ───────────────────────────── the dog family ─────────────────────────────

/** Where the mother dog lies (plan ft) and the way she faces (plan unit vector). */
export interface DogFamily {
  x: number;
  z: number;
  fx: number;
  fz: number;
}

/**
 * The dog family on the lane side (owner, 9/10/2026: "remove the dog from front and keep 1 big dog here and 2 babies
 * with it … on the side of the property"): the mother lies on the open grass between the banana clumps, off the side
 * gate's kolam, facing the front — inside the garden stroller's loop and clear of the property manager's walk down the
 * lane and the back tenant at Gate B.
 */
export function dogFamily(layout: Pick<SiteLayout, "plot">): DogFamily {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const z = D * 0.485;
  const f = Math.hypot(0.26, 1);
  return { x: FL.x + ((BL.x - FL.x) * z) / D - 9.4, z, fx: -0.26 / f, fz: -1 / f };
}

/** What a pup is doing: asleep against its mother, getting up / lying down, a play-bow, trotting, or running. */
export type PupAct = "nap" | "wake" | "settle" | "bow" | "trot" | "run";

/** The pups' day repeats every this many seconds of scene time. */
export const PUP_CYCLE = 54;

type V2 = [number, number];
/** A stretch of a pup's day in the mother's frame (u = ahead of her, w = to her right): stay at `at` facing `face`,
 *  move from → to, or run round her (the zoomies) from angle a0 to a1 on ZOOM. */
type PupSeg =
  | { t0: number; t1: number; act: "nap" | "wake" | "settle" | "bow"; at: V2; face: V2 | "mom" | "pup" }
  | { t0: number; t1: number; act: "trot"; from: V2; to: V2 }
  | { t0: number; t1: number; act: "run"; a0: number; a1: number };

/** The ellipse the pups chase each other round her on (centre u, half-length along u, half-width along w). */
const ZOOM = { u: 0.15, a: 2.6, b: 1.75 };
const onZoom = (a: number): V2 => [ZOOM.u + ZOOM.a * Math.cos(a), ZOOM.b * Math.sin(a)];

/** The two pups' naps against her right flank (the side facing the lane-side view). */
const NAP: [V2, V2] = [
  [-0.65, 1.0],
  [0.75, 1.0],
];

/**
 * The pups' day. Pup 1 wakes first, trots out in front of her, play-bows at her, hops aside and bows at its sibling;
 * pup 0 wakes and joins; they chase each other round their mother (pup 0 a little behind), then trot back to her side
 * and flop down to sleep again.
 */
const PUP_DAYS: [PupSeg[], PupSeg[]] = [
  [
    { t0: 0, t1: 24.5, act: "nap", at: NAP[0], face: [1, 0] },
    { t0: 24.5, t1: 25.3, act: "wake", at: NAP[0], face: [1, 0] },
    { t0: 25.3, t1: 26.5, act: "trot", from: NAP[0], to: onZoom(0.4) },
    { t0: 26.5, t1: 34, act: "run", a0: 0.4, a1: 0.4 - 10.5 },
    { t0: 34, t1: 34.6, act: "trot", from: onZoom(0.4 - 10.5), to: NAP[0] },
    { t0: 34.6, t1: 35.4, act: "settle", at: NAP[0], face: [1, 0] },
    { t0: 35.4, t1: PUP_CYCLE, act: "nap", at: NAP[0], face: [1, 0] },
  ],
  [
    { t0: 0, t1: 19, act: "nap", at: NAP[1], face: [1, 0] },
    { t0: 19, t1: 19.8, act: "wake", at: NAP[1], face: [1, 0] },
    { t0: 19.8, t1: 21, act: "trot", from: NAP[1], to: [2.9, 0.4] },
    { t0: 21, t1: 24, act: "bow", at: [2.9, 0.4], face: "mom" },
    { t0: 24, t1: 25, act: "trot", from: [2.9, 0.4], to: onZoom(-0.5) },
    { t0: 25, t1: 26.5, act: "bow", at: onZoom(-0.5), face: "pup" },
    { t0: 26.5, t1: 34, act: "run", a0: -0.5, a1: -0.5 - 10.5 },
    { t0: 34, t1: 34.6, act: "trot", from: onZoom(-11), to: NAP[1] },
    { t0: 34.6, t1: 35.4, act: "settle", at: NAP[1], face: [1, 0] },
    { t0: 35.4, t1: PUP_CYCLE, act: "nap", at: NAP[1], face: [1, 0] },
  ],
];

export interface PupState {
  /** plan ft */
  x: number;
  z: number;
  /** the way it faces (plan, unit) */
  hx: number;
  hz: number;
  act: PupAct;
  /** 0..1 through this stretch (getting up / lying down) */
  k: number;
  /** ft/s while moving, else 0 */
  speed: number;
}

/** Pup i (0 or 1) at scene time t. */
export function pupAt(fam: DogFamily, i: 0 | 1, t: number): PupState {
  const tt = mod(t, PUP_CYCLE);
  const segs = PUP_DAYS[i];
  const sg = segs.find((s) => tt < s.t1) ?? segs[segs.length - 1];
  const k = Math.min(1, Math.max(0, (tt - sg.t0) / (sg.t1 - sg.t0)));
  let at: V2;
  let face: V2;
  let speed = 0;
  if (sg.act === "trot") {
    at = [sg.from[0] + (sg.to[0] - sg.from[0]) * k, sg.from[1] + (sg.to[1] - sg.from[1]) * k];
    face = [sg.to[0] - sg.from[0], sg.to[1] - sg.from[1]];
    speed = Math.hypot(face[0], face[1]) / (sg.t1 - sg.t0);
  } else if (sg.act === "run") {
    const a = sg.a0 + (sg.a1 - sg.a0) * k;
    const dir = Math.sign(sg.a1 - sg.a0);
    at = onZoom(a);
    face = [-ZOOM.a * Math.sin(a) * dir, ZOOM.b * Math.cos(a) * dir];
    speed = (Math.abs(sg.a1 - sg.a0) * (ZOOM.a + ZOOM.b)) / 2 / (sg.t1 - sg.t0);
  } else {
    at = sg.at;
    if (sg.face === "mom") face = [-at[0], -at[1]];
    else if (sg.face === "pup") {
      const o = pupLocal(1 - i, tt);
      face = [o[0] - at[0], o[1] - at[1]];
    } else face = sg.face;
  }
  const n = Math.hypot(face[0], face[1]) || 1;
  const [u, w] = at;
  // plan = mother + u · ahead + w · right (her right = (fz, −fx))
  return {
    x: fam.x + u * fam.fx + w * fam.fz,
    z: fam.z + u * fam.fz - w * fam.fx,
    hx: (face[0] * fam.fx + face[1] * fam.fz) / n,
    hz: (face[0] * fam.fz - face[1] * fam.fx) / n,
    act: sg.act,
    k,
    speed,
  };
}

/** A pup's spot in its mother's frame (for the sibling it bows at). */
function pupLocal(i: number, tt: number): V2 {
  const sg = PUP_DAYS[i].find((s) => tt < s.t1) ?? PUP_DAYS[i][PUP_DAYS[i].length - 1];
  const k = Math.min(1, Math.max(0, (tt - sg.t0) / (sg.t1 - sg.t0)));
  if (sg.act === "trot") return [sg.from[0] + (sg.to[0] - sg.from[0]) * k, sg.from[1] + (sg.to[1] - sg.from[1]) * k];
  if (sg.act === "run") return onZoom(sg.a0 + (sg.a1 - sg.a0) * k);
  return sg.at;
}

/**
 * Where the mother looks (radians, + = to her left): at pup 1 while it's up and playing, else down at the two asleep
 * against her right flank with a slow look round now and then. Her neck turns about ±1.1 rad at most.
 */
export function motherLook(fam: DogFamily, t: number): number {
  const tt = mod(t, PUP_CYCLE);
  const up = PUP_DAYS[1].find((s) => tt < s.t1);
  if (up && up.act !== "nap") {
    const [u, w] = pupLocal(1, tt);
    return Math.max(-1.1, Math.min(1.1, Math.atan2(-w, u - 1.2)));
  }
  return -0.45 + Math.sin(t * 0.13) * 0.35;
}

// ───────────────────────────── the property manager (a rover), the cow ─────────────────────────────

export const MANAGER_SPEED = 1.5; // ft/s — the rover drives slowly (owner 2/11/2026: the property manager is a rover)
/** The rover's footprint radius (ft): it is ~2.1 ft wide. */
export const ROVER_R = 1.1;
/** How close (centre to stem, ft) the rover pulls up to the banana clump it examines. */
const PULL_UP = 1.9;
/** How far the rover keeps from the compound wall (ft) — the hedges along it reach ~3 ft out. */
const WALL_CLEAR = 4.2;

/** What the rover does at a stop: look something over with its mast camera, examine it with its arm, or visit the cow. */
export type RoverAct = "look" | "inspect" | "cow";
type Target = Pt & { y: number };
type RoverLeg =
  | { kind: "path"; s0: number; s1: number; t0: number; t1: number; d0: number }
  | { kind: "drive"; a: Pt; b: Pt; t0: number; t1: number; d0: number; target?: Target }
  | { kind: "stop"; p: Pt; dir: Pt; act: RoverAct; target?: Target; t0: number; t1: number; d0: number };

/** The corners of the rover's round before it bends round things (front-left, front-right, back-right, back-left). */
export function managerCorners(layout: Pick<SiteLayout, "plot">): Pt[] {
  const [FL, FR, BR, BL] = layout.plot.polygon;
  return [
    { x: FL.x - 6, z: FL.z - 7.3 },
    { x: FR.x + 5, z: FR.z - 7.3 },
    { x: BR.x + 5, z: BR.z + 3.8 },
    { x: BL.x - 6, z: BL.z + 3.8 },
  ];
}

/** Where the cow's head is (plan ft, at the middle of her slow sway): she faces the lane side (−x). */
export function cowHead(layout: Pick<SiteLayout, "plot" | "site">): Pt {
  const c = cowSpot(layout);
  return { x: c.x - 4.1, z: c.z - 1 };
}
/** Where the rover stops to visit the cow: in front of her head, facing her. */
function cowVisit(layout: Pick<SiteLayout, "plot" | "site">): Pt {
  const h = cowHead(layout);
  return { x: h.x - 3.9, z: h.z + 0.4 };
}

/** Everything standing on the grass that the rover must drive round: centre + radius (plan ft). */
export function roverObstacles(layout: Pick<SiteLayout, "plot" | "site" | "rearYard" | "fixtures">): { p: Pt; r: number; what: string }[] {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const lx = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  const cow = cowSpot(layout);
  const fam = dogFamily(layout);
  const m = layout.fixtures.taxStamp;
  return [
    ...palmSpots(layout).map((p) => ({ p, r: 0.9, what: "palm" })),
    ...bananaSpots(layout).map((p) => ({ p, r: 1.4, what: "banana" })),
    ...layout.fixtures.poles.map((p) => ({ p, r: 0.45, what: "pole" })),
    { p: layout.fixtures.plotMarker, r: 1.0, what: "plot marker" },
    { p: m, r: 3.4, what: "moped + policeman" },
    { p: { x: lx(D * 0.2) - 6.5, z: D * 0.2 }, r: 2.3, what: "hand pump" },
    { p: { x: lx(D * 0.5) - 3.6, z: D * 0.5 }, r: 1.2, what: "coconut husks" },
    { p: { x: lx(D * 0.12) - 8.5, z: D * 0.12 }, r: 3.4, what: "chilli mat" },
    // the mother dog lies along her facing (~4.7 ft nose to tail, ~1.5 ft across): three small circles down her body
    ...[-1.5, 0, 1.5].map((o) => ({ p: { x: fam.x + fam.fx * o, z: fam.z + fam.fz * o }, r: 0.8, what: "dogs" })),
    // the cow is ~6 ft long and sways ±1.5 ft along x
    ...[-3, 0, 3].map((o) => ({ p: { x: cow.x + o, z: cow.z }, r: 2.0, what: "cow" })),
  ];
}

/** Grid step (ft) for the rover's route planner. */
const CELL = 0.5;

/**
 * The rover's round as a polyline (≈ 0.5 ft apart) through the waypoints, bending round everything: a grid over the
 * island with every obstacle (its radius + the rover's + a margin), the wall zone (WALL_CLEAR) and the island's rim
 * blocked; A* between consecutive waypoints, a step costing more the further it strays from the straight line between
 * them (so it keeps to its usual line and only swings round what is in the way); then string-pulled (straight runs
 * wherever the line of sight is clear) and rounded off at the bends where that stays clear.
 */
function planRound(layout: Pick<SiteLayout, "plot" | "site">, way: Pt[], obstacles: { p: Pt; r: number }[], frontRun: [number, number]): { pts: Pt[]; ok: boolean } {
  const tile = layout.site.tile;
  const x0 = Math.min(...tile.map((p) => p.x));
  const z0 = Math.min(...tile.map((p) => p.z));
  const W = Math.ceil((Math.max(...tile.map((p) => p.x)) - x0) / CELL) + 1;
  const H = Math.ceil((Math.max(...tile.map((p) => p.z)) - z0) / CELL) + 1;
  const wallOut = offsetPolygon(layout.plot.polygon, WALL_CLEAR);
  const tileIn = offsetPolygon(tile, -2);
  // the passers-by's track across the front: the rover only crosses it at the two sides (the front corners' x), never
  // runs along it
  const [fx0, fx1] = frontRun;
  const onTrack = (p: Pt) => Math.abs(p.z - CROSS_Z) < ROVER_R + 0.9 && p.x > fx0 + 0.9 && p.x < fx1 - 0.9;
  const free = (p: Pt) =>
    insidePolygon(p, tileIn) && !insidePolygon(p, wallOut) && !onTrack(p) && obstacles.every((o) => Math.hypot(p.x - o.p.x, p.z - o.p.z) >= o.r + ROVER_R + 0.35);
  const blocked = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) blocked[j * W + i] = free({ x: x0 + i * CELL, z: z0 + j * CELL }) ? 0 : 1;
  const cellOf = (p: Pt) => {
    let i = Math.round((p.x - x0) / CELL);
    let j = Math.round((p.z - z0) / CELL);
    // a waypoint that sits in a blocked cell snaps to the nearest free one
    if (blocked[j * W + i])
      for (let r = 1; r < 20; r++) {
        let hit = -1;
        for (let dj = -r; dj <= r && hit < 0; dj++)
          for (let di = -r; di <= r; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii < W && jj < H && !blocked[jj * W + ii]) {
              hit = jj * W + ii;
              break;
            }
          }
        if (hit >= 0) {
          i = hit % W;
          j = Math.floor(hit / W);
          break;
        }
      }
    return j * W + i;
  };
  const ptOf = (c: number): Pt => ({ x: x0 + (c % W) * CELL, z: z0 + Math.floor(c / W) * CELL });
  let ok = true;
  const astar = (a: Pt, b: Pt): Pt[] => {
    const s = cellOf(a);
    const g = cellOf(b);
    const ax = a.x;
    const az = a.z;
    const ux = b.x - a.x;
    const uz = b.z - a.z;
    const L2 = ux * ux + uz * uz || 1;
    const dev = (p: Pt) => {
      const k = Math.min(1, Math.max(0, ((p.x - ax) * ux + (p.z - az) * uz) / L2));
      return Math.hypot(p.x - (ax + ux * k), p.z - (az + uz * k));
    };
    const gs = new Float64Array(W * H).fill(Infinity);
    const from = new Int32Array(W * H).fill(-1);
    const done = new Uint8Array(W * H);
    const gp = ptOf(g);
    const heap: [number, number][] = [];
    const push = (f: number, c: number) => {
      heap.push([f, c]);
      let i = heap.length - 1;
      while (i > 0) {
        const pi = (i - 1) >> 1;
        if (heap[pi][0] <= heap[i][0]) break;
        [heap[pi], heap[i]] = [heap[i], heap[pi]];
        i = pi;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    gs[s] = 0;
    push(0, s);
    let reached = false;
    while (heap.length) {
      const [, c] = pop();
      if (done[c]) continue;
      done[c] = 1;
      if (c === g) {
        reached = true;
        break;
      }
      const ci = c % W;
      const cj = Math.floor(c / W);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const n = nj * W + ni;
          if (blocked[n] || done[n]) continue;
          const np = ptOf(n);
          const d = dev(np);
          const ng = gs[c] + Math.hypot(di, dj) * CELL * (1 + 0.12 * d * d);
          if (ng < gs[n]) {
            gs[n] = ng;
            from[n] = c;
            push(ng + Math.hypot(np.x - gp.x, np.z - gp.z), n);
          }
        }
    }
    if (!reached) ok = false; // no way through: the leg falls back to a straight line (a test catches this)
    const out: Pt[] = [];
    for (let c = g; c >= 0; c = from[c]) {
      out.push(ptOf(c));
      if (c === s) break;
    }
    return out.reverse();
  };
  // line of sight on the grid (sampled every quarter cell)
  const sees = (a: Pt, b: Pt) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 4));
    for (let k = 1; k < n; k++) if (!free({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })) return false;
    return true;
  };
  // A* leg by leg, string-pulled
  const raw: Pt[] = [];
  way.forEach((a, i) => {
    const leg = astar(a, way[(i + 1) % way.length]);
    const pulled: Pt[] = [leg[0]];
    let k = 0;
    while (k < leg.length - 1) {
      let far = k + 1;
      for (let m = leg.length - 1; m > k + 1; m--)
        if (sees(leg[k], leg[m])) {
          far = m;
          break;
        }
      pulled.push(leg[far]);
      k = far;
    }
    raw.push(...pulled.slice(0, -1));
  });
  // densify to ≈ CELL and round the bends where the rounded line stays clear
  let pts: Pt[] = [];
  raw.forEach((a, i) => {
    const b = raw[(i + 1) % raw.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / CELL));
    for (let k = 0; k < n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  });
  for (let it = 0; it < 12; it++)
    pts = pts.map((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[(i + 1) % pts.length];
      const q = { x: p.x + ((a.x + b.x) / 2 - p.x) * 0.5, z: p.z + ((a.z + b.z) / 2 - p.z) * 0.5 };
      return free(q) ? q : p;
    });
  return { pts, ok };
}

/**
 * The property manager's round outside the wall: front grass → right side → behind the back → down the lane — a smooth
 * line that bends ROUND everything on the grass (owner 2/11/2026: "the robot rn just goes through the trees and other
 * objects … make it go around it and interact with the cow"): it starts as the four sides (lane side 6 ft out, right
 * side 5 ft out, front run 7.3 ft out, back 3.8 ft out, with a detour out to the cow), then is relaxed: every point is
 * pushed clear of the trees, poles, pump, husks, chilli mat, plot marker, moped, dogs and cow (their radius + the
 * rover's + a margin), kept ≥ WALL_CLEAR from the wall and inside the island, and smoothed.
 * Owner 2/11/2026: "not only circle around the property but also stop in some place and do more natural things like
 * he's looking around the property even the plants" — on the way it stops to look 116/B7's front over, looks up at a
 * palm by the right side, looks at the back house, pulls off the lane road to the front side of the nearest banana clump
 * and examines it with its arm, and visits the cow (stops in front of her; she lifts her head and turns to it).
 */
export function managerLoop(layout: Pick<SiteLayout, "plot" | "site" | "rearYard" | "slots" | "compoundWalls" | "fixtures">) {
  const [c0, c1, c2, c3] = managerCorners(layout);
  const visit = cowVisit(layout);
  const head = cowHead(layout);
  // the waypoints of the round, with the detour out to the cow on the front run
  const way: Pt[] = [c0, { x: visit.x - 5.5, z: c0.z }, visit, { x: visit.x + 4, z: c0.z - 1.5 }, c1, c2, c3];
  const obstacles = roverObstacles(layout);
  // the banana clump it examines: the one nearest its lane road, well clear of the dog family (the pups play round her)
  const fam = dogFamily(layout);
  const clump = bananaSpots(layout)
    .map((p) => ({ p, off: Math.abs(p.x - (c3.x + ((c0.x - c3.x) * (p.z - c3.z)) / (c0.z - c3.z || 1))) }))
    .filter((c) => c.p.z > c0.z + 2 && c.p.z < c3.z - 2 && c.off > PULL_UP + 1 && c.off < 7.5 && Math.hypot(c.p.x - fam.x, c.p.z - fam.z) > 8)
    .sort((m, n) => m.off - n.off)[0]?.p;
  const { pts, ok: planned } = planRound(layout, way, obstacles, [c0.x, c1.x]);
  const fixed = pts.reduce((bi, q, i) => (Math.hypot(q.x - visit.x, q.z - visit.z) < Math.hypot(pts[bi].x - visit.x, pts[bi].z - visit.z) ? i : bi), 0);
  // arc length
  const cum: number[] = [0];
  for (let i = 1; i <= pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i % pts.length].x - pts[i - 1].x, pts[i % pts.length].z - pts[i - 1].z));
  const total = cum[pts.length];
  const nearest = (p: Pt) => {
    let bi = 0;
    let bd = Infinity;
    pts.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    return cum[bi];
  };
  const at = (s: number): Pt => {
    const ss = mod(s, total);
    let i = cum.findIndex((c) => c > ss) - 1;
    if (i < 0) i = pts.length - 1;
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const k = (ss - cum[i]) / (cum[i + 1] - cum[i] || 1);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
  };
  const tangent = (s: number): Pt => {
    const a = at(s - 0.6);
    const b = at(s + 0.6);
    return { x: b.x - a.x, z: b.z - a.z };
  };
  // the stops, by arc length along the round
  type Stop = { s: number; dur: number; act: RoverAct; target: Target; pull?: Pt };
  const stops: Stop[] = [];
  const front = layout.slots.find((s) => s.slot === "front");
  const back = layout.slots.find((s) => s.slot === "back");
  stops.push({ s: cum[fixed], dur: 9, act: "cow", target: { ...head, y: 3.6 } });
  if (front) {
    // in front of 116/B7 (between the lane corner and the cow detour), clear of where the passers-by stop on their track
    const mid = (front.rect.x0 + front.rect.x1) / 2;
    const taken = Object.values(crossSpots(layout)).filter((x): x is number => x !== null);
    const x = [0, -2, 2, -4, 4, -6, 6].map((o) => mid + o).find((c) => taken.every((sp) => Math.abs(c - sp) >= 3.6) && c > c0.x + 3 && c < visit.x - 7);
    if (x !== undefined) stops.push({ s: nearest({ x, z: c0.z }), dur: 7, act: "look", target: { x: mid, z: front.rect.z0, y: front.heightFt * 0.6 } });
  }
  const palm = palmSpots(layout)
    .map((p) => ({ p, d: Math.hypot(...((q) => [q.x - p.x, q.z - p.z] as const)(at(nearest(p)))) }))
    .filter((c) => c.p.z > c1.z + 3 && c.p.z < c2.z - 3 && c.p.x > c1.x - 2 && c.d < 4.5)
    .sort((m, n) => m.d - n.d)[0];
  // it pulls up a little short of the palm and looks up into the crown
  if (palm) stops.push({ s: nearest(palm.p) - 2.5, dur: 7, act: "look", target: { ...palm.p, y: 22 } });
  if (back) {
    const p = { x: (back.rect.x0 + back.rect.x1) / 2, z: back.rect.z1 };
    stops.push({ s: nearest({ x: p.x, z: c2.z }), dur: 6, act: "look", target: { ...p, y: back.heightFt * 0.6 } });
  }
  if (clump) {
    // off the road to the stem's FRONT side (the default camera looks from the lane side, so behind it the stem would
    // hide the rover), PULL_UP from the stem, facing it
    const s = nearest(clump);
    const road = at(s);
    const f = tangent(s);
    const fl = Math.hypot(f.x, f.z) || 1;
    const off = Math.hypot(road.x - clump.x, road.z - clump.z) || 1;
    const wx = (road.x - clump.x) / off + (f.x / fl) * 2.2;
    const wz = (road.z - clump.z) / off + (f.z / fl) * 2.2;
    const wl = Math.hypot(wx, wz);
    const pull = { x: clump.x + (wx / wl) * PULL_UP, z: clump.z + (wz / wl) * PULL_UP };
    // it leaves the road right beside its parking spot (a straight run in from further back would clip the stems)
    stops.push({ s: nearest(pull), dur: 11, act: "inspect", target: { ...clump, y: 3.2 }, pull });
  }
  stops.sort((m, n) => m.s - n.s);
  // the timeline: drive along the round from stop to stop
  const legs: RoverLeg[] = [];
  let t = 0;
  let d = 0;
  let s = stops.length ? stops[0].s : 0;
  const s0 = s;
  for (let k = 0; k < stops.length; k++) {
    const st = stops[k];
    if (k > 0) {
      if (st.s - s < 3) continue;
      legs.push({ kind: "path", s0: s, s1: st.s, t0: t, t1: (t += (st.s - s) / MANAGER_SPEED), d0: d });
      d += st.s - s;
      s = st.s;
    }
    const here = at(s);
    if (st.pull) {
      // pull off the road to it, stop facing it, then drive back onto the road a little further on
      const out = Math.hypot(st.pull.x - here.x, st.pull.z - here.z);
      legs.push({ kind: "drive", a: here, b: st.pull, t0: t, t1: (t += out / MANAGER_SPEED), d0: d, target: st.target });
      d += out;
      legs.push({ kind: "stop", p: st.pull, dir: { x: st.target.x - st.pull.x, z: st.target.z - st.pull.z }, act: st.act, target: st.target, t0: t, t1: (t += st.dur), d0: d });
      const on = s + 3.5;
      const back = Math.hypot(at(on).x - st.pull.x, at(on).z - st.pull.z);
      legs.push({ kind: "drive", a: st.pull, b: at(on), t0: t, t1: (t += back / MANAGER_SPEED), d0: d, target: st.target });
      d += back;
      s = on;
      continue;
    }
    const dir = st.act === "cow" ? { x: st.target.x - here.x, z: st.target.z - here.z } : tangent(s);
    legs.push({ kind: "stop", p: here, dir, act: st.act, target: st.target, t0: t, t1: (t += st.dur), d0: d });
  }
  // back round to the first stop
  legs.push({ kind: "path", s0: s, s1: s0 + total, t0: t, t1: (t += (s0 + total - s) / MANAGER_SPEED), d0: d });
  d += s0 + total - s;
  return { pts, cum, total, legs, cycle: t, at, tangent, planned };
}

export interface RoverState {
  x: number;
  z: number;
  /** the way it faces (plan) */
  dx: number;
  dz: number;
  /** standing still at a stop */
  stopped: boolean;
  /** distance driven so far this round (wheels roll with it) */
  walked: number;
  act?: RoverAct;
  /** what its camera (and arm) is on, plan ft + height */
  target?: Target;
  /** seconds into / left of the current stop */
  into: number;
  left: number;
  /** pulling off the road to (or back from) the plant it examines */
  approaching?: Target;
}

export function managerAt(loop: ReturnType<typeof managerLoop>, t: number): RoverState {
  const tt = mod(t + loop.cycle * 0.35, loop.cycle); // starts on the right side, away from the front walkers
  const leg = loop.legs.find((l) => tt < l.t1) ?? loop.legs[loop.legs.length - 1];
  const into = tt - leg.t0;
  const left = leg.t1 - tt;
  const k = leg.t1 > leg.t0 ? Math.min(1, Math.max(0, into / (leg.t1 - leg.t0))) : 1;
  if (leg.kind === "path") {
    const s = leg.s0 + (leg.s1 - leg.s0) * k;
    const p = loop.at(s);
    const f = loop.tangent(s);
    return { x: p.x, z: p.z, dx: f.x, dz: f.z, stopped: false, walked: leg.d0 + (leg.s1 - leg.s0) * k, into, left };
  }
  if (leg.kind === "drive") {
    const dx = leg.b.x - leg.a.x;
    const dz = leg.b.z - leg.a.z;
    return { x: leg.a.x + dx * k, z: leg.a.z + dz * k, dx, dz, stopped: false, walked: leg.d0 + Math.hypot(dx, dz) * k, into, left, approaching: leg.target };
  }
  return { x: leg.p.x, z: leg.p.z, dx: leg.dir.x, dz: leg.dir.z, stopped: true, walked: leg.d0, act: leg.act, target: leg.target, into, left };
}

/** The zebu cow grazing on the front grass under the palms at the right (she sways ±1.5 ft along x). */
export function cowSpot(layout: Pick<SiteLayout, "plot" | "site">): Pt {
  return { x: layout.plot.rightX + 2, z: layout.site.meadow.z0 + 3 };
}
