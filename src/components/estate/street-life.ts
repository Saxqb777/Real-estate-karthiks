// Where the people on the grass are at any moment — pure timelines in plan feet and scene seconds (People.tsx draws
// them; the revenue officer's day lives in tax-route.ts). No React / three, so a test can play the whole street and
// check that nobody stands in anybody, nobody walks through someone standing and nobody stands on a kolam.
// Owner, 9/10/2026: a passer-by stopped right beside the tenant waiting at the gate — both on the gate kolam, facing
// nowhere in particular. Since then:
//   • the passers-by on the front grass take TURNS (one at a time) on one track, and each stops once to look at the
//     houses at a spot clear of the gate, the tenant, the revenue officer and the dog;
//   • a tenant waits BESIDE the unit's gate (never on its kolam), facing it, until it swings open;
//   • the stray dog naps by the front-left corner (it no longer trots across everybody's path).
import type { BuildingSlot, Pt, SiteLayout } from "../../lib/site-layout";

/** x of a polygon edge (a → b) at plan z. */
const xOnEdge = (a: Pt, b: Pt, z: number) => (Math.abs(b.z - a.z) < 1e-9 ? a.x : a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z));

/** The island tile's left and right edge at plan z (passers-by appear from / vanish into them). */
export function tileXRange(layout: Pick<SiteLayout, "site">, z: number): [number, number] {
  const [FL, FR, BR, BL] = layout.site.tile;
  return [xOnEdge(FL, BL, z), xOnEdge(FR, BR, z)];
}

const mod = (t: number, p: number) => ((t % p) + p) % p;

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
 *  dog), right of it (clear of the revenue officer at the door-number pole), the TO-LET board (empty front house only). */
export function crossSpots(layout: Pick<SiteLayout, "compoundWalls" | "slots" | "plot">): Record<"left" | "right" | "board", number | null> {
  const gate = layout.compoundWalls.find((w) => w.gate === "front");
  const R = layout.plot.rightX;
  const L = layout.plot.polygon[0].x;
  const gl = gate ? Math.min(gate.a.x, gate.b.x) : L + 3;
  const gr = gate ? Math.max(gate.a.x, gate.b.x) : L + 7;
  const front = layout.slots.find((s) => s.slot === "front");
  const empty = !!front && (front.status === "vacant" || front.status === "incoming");
  const right = Math.min(gr + 6.5, R + 2);
  // left of the gate: halfway between the napping dog and the tenant waiting by the gate, if that leaves room round
  // both — else right of the gate (the passers-by take turns, so two of them never stand there together)
  const dog = dogSpot(layout);
  const sign = gateSign(layout, "front");
  const wait = sign ? tenantWaitSpot(gatePoint(sign)) : null;
  const clear = (x: number) => Math.hypot(x - dog.x, CROSS_Z - dog.z) >= 4.6 && (!wait || Math.hypot(x - wait.x, CROSS_Z - wait.z) >= 4.1);
  const mid = wait ? (dog.x + wait.x) / 2 : gl - 4.8;
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

// ───────────────────────────── the stray dog, the property manager, the photographer, the cow ─────────────────────────────

/** The stray dog naps on the grass off the front-left corner, by the wall and clear of everyone's path. */
export function dogSpot(layout: Pick<SiteLayout, "plot">): Pt {
  const FL = layout.plot.polygon[0];
  return { x: FL.x - 2.4, z: FL.z - 1.2 };
}

export const MANAGER_SPEED = 2.1; // ft/s
export const MANAGER_WRITE = 4; // s at each corner

/** The property manager's round outside the wall: front grass → right passage → behind the back → down the lane. */
export function managerLoop(layout: Pick<SiteLayout, "plot">) {
  const [FL, FR, BR, BL] = layout.plot.polygon;
  const pts: Pt[] = [
    { x: FL.x - 5, z: FL.z - 6.5 },
    { x: FR.x + 3, z: FR.z - 6.5 },
    { x: BR.x + 3, z: BR.z + 3.8 },
    { x: BL.x - 5, z: BL.z + 3.8 },
  ];
  const segs = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return { a, b, len: Math.hypot(b.x - a.x, b.z - a.z) };
  });
  const total = segs.reduce((n, sg) => n + sg.len, 0);
  return { segs, total, cycle: total / MANAGER_SPEED + MANAGER_WRITE * segs.length };
}

export function managerAt(loop: ReturnType<typeof managerLoop>, t: number): { x: number; z: number; dx: number; dz: number; writing: boolean; walked: number } {
  let tt = mod(t + loop.cycle * 0.35, loop.cycle); // starts on the right side, away from the front walkers
  let walked = 0;
  for (const sg of loop.segs) {
    const walkT = sg.len / MANAGER_SPEED;
    const dx = sg.b.x - sg.a.x;
    const dz = sg.b.z - sg.a.z;
    if (tt < MANAGER_WRITE) return { x: sg.a.x, z: sg.a.z, dx, dz, writing: true, walked };
    tt -= MANAGER_WRITE;
    if (tt < walkT) {
      const k = tt / walkT;
      return { x: sg.a.x + dx * k, z: sg.a.z + dz * k, dx, dz, writing: false, walked: walked + tt * MANAGER_SPEED };
    }
    tt -= walkT;
    walked += sg.len;
  }
  const last = loop.segs[0];
  return { x: last.a.x, z: last.a.z, dx: last.b.x - last.a.x, dz: last.b.z - last.a.z, writing: true, walked };
}

/** The photographer and his tripod on the grass beside the hand pump, out on the lane side of the front house. */
export function photographerSpot(layout: Pick<SiteLayout, "plot">): Pt {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const z = D * 0.26;
  return { x: FL.x + ((BL.x - FL.x) * z) / D - 10, z };
}

/** The zebu cow grazing on the front grass under the palms at the right (she sways ±1.5 ft along x). */
export function cowSpot(layout: Pick<SiteLayout, "plot" | "site">): Pt {
  return { x: layout.plot.rightX + 2, z: layout.site.meadow.z0 + 3 };
}
