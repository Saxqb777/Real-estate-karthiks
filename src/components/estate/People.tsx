"use client";
// Low-poly life on the grass round the plot (no road): a veshti man with an umbrella who stops at the gate, a saree
// lady who pauses to read the TO-LET board, a man in a lungi, a school kid running round the palms, a lady strolling
// through the banana garden, a stray dog napping by the gate, a zebu cow grazing under the palms, and the tenant at
// the door of each occupied house (a clickable world object). Every character is ONE draw call (rig.ts). Movement follows
// scripted timelines on scene time → frame-rate independent and slowed by focus dimming.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { BuildingSlot, Pt, SiteLayout } from "@/lib/site-layout";
import type { Env } from "./env";
import { tileXRange } from "./Island";
import { Hotspot, spotKey, useScene, type V3 } from "./Interact";
import { gateNear } from "./gate-state";
import { EDGE_CLIP, G } from "./materials";
import { bake, ball, box, cone, type Part } from "./bake";
import { SKIN, personLimbs, posePerson, rigGeometry, rigMaterials, type Gait, type Limb, type Outfit, type RigMaterials } from "./rig";
import { blobTex } from "./textures";
import { smoothstep, type World } from "./util";

// ───────────────────────────── shared character mesh ─────────────────────────────

function useRig(limbs: () => Limb[], deps: unknown[], o: { clip?: boolean } = {}): { geo: THREE.BufferGeometry; rig: RigMaterials } {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => rigGeometry(limbs()), deps);
  useEffect(() => () => geo.dispose(), [geo]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rig = useMemo(() => rigMaterials({ clip: o.clip }), []);
  useEffect(() => () => rig.dispose(), [rig]);
  return { geo, rig };
}

function RigMesh({ geo, rig, cast = true }: { geo: THREE.BufferGeometry; rig: RigMaterials; cast?: boolean }) {
  return <mesh geometry={geo} material={rig.mat} customDepthMaterial={rig.depth} castShadow={cast} />;
}

// ───────────────────────────── people on the grass ─────────────────────────────

type StopAt = "gate" | "board" | "center" | number;
interface Stop {
  /** where along the walk: a landmark (crossers) or a fraction 0..1 of the walk */
  at: StopAt;
  dur: number;
  /** what they do while stopped: "look" turns to the houses */
  act?: "look" | "idle";
}
type Route =
  /** walks across the open grass in front of the plot at this distance (ft) from the front wall, edge to edge */
  | { kind: "cross"; dist: number; dir: 1 | -1 }
  /** strolls a closed loop around the palms on the right / the banana garden on the left */
  | { kind: "loop"; area: "palms" | "garden" };
interface PedSpec {
  outfit: Outfit;
  scale: number;
  speed: number;
  gait: Gait;
  route: Route;
  /** scene-time offset into the loop */
  offset: number;
  /** seconds off-stage after each crossing (loops never leave) */
  wait: number;
  stops: Stop[];
}

// three passers-by on separate tracks across the front grass (nobody walks through anybody) and a lady strolling
// through the banana garden (the school kid round the palms was removed — owner: a policeman guards the tax hut there)
const PEDS: PedSpec[] = [
  { outfit: { top: "#f4f1ea", bottom: "#f7f4ec", wrap: "veshti", umbrella: true, towel: "#c9a46b" }, scale: 1, speed: 3.4, gait: "walk", route: { kind: "cross", dist: 5.2, dir: 1 }, offset: 4, wait: 9, stops: [{ at: "gate", dur: 4.5, act: "look" }] },
  { outfit: { top: "#e0a020", bottom: "#c2185b", wrap: "saree", hair: "bun", jasmine: true }, scale: 0.96, speed: 3.0, gait: "walk", route: { kind: "cross", dist: 6.0, dir: -1 }, offset: 14, wait: 8, stops: [{ at: "board", dur: 3.5, act: "look" }] },
  { outfit: { top: "#8a2f5a", bottom: "#2e8b57", wrap: "saree", hair: "plait", jasmine: true, skin: SKIN.dark }, scale: 0.95, speed: 2.6, gait: "walk", route: { kind: "loop", area: "garden" }, offset: 22, wait: 0, stops: [{ at: 0.22, dur: 4, act: "look" }, { at: 0.62, dur: 3, act: "idle" }] },
  { outfit: { top: "#f1e3c4", bottom: "#3b5c8f", wrap: "lungi", skin: SKIN.dark }, scale: 1, speed: 2.8, gait: "walk", route: { kind: "cross", dist: 4.6, dir: 1 }, offset: 30, wait: 12, stops: [{ at: "center", dur: 3, act: "look" }] },
];

interface Landmarks {
  gateX: number;
  boardX: number | null;
  centerX: number;
}

/** The plan-space polyline a walker follows (closed for loops). */
function routePath(route: Route, layout: SiteLayout): Pt[] {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const R = layout.plot.rightX;
  const lx = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  if (route.kind === "cross") {
    const z = -route.dist;
    const [x0, x1] = tileXRange(layout, z);
    const pts = [
      { x: x0 - 3, z },
      { x: x1 + 3, z },
    ];
    return route.dir > 0 ? pts : pts.reverse();
  }
  if (route.area === "palms") {
    // round the front-right palm, between the hedge and the right edge of the island
    return [
      { x: R + 4.5, z: 0.4 },
      { x: R + 11.5, z: -0.6 },
      { x: R + 12.6, z: 6.5 },
      { x: R + 8.5, z: 10 },
      { x: R + 4.6, z: 7 },
    ];
  }
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

interface Timeline {
  pts: Pt[];
  cum: number[];
  segs: { t0: number; t1: number; d0: number; d1: number; stop?: Stop }[];
  period: number;
  walkEnd: number;
}

function buildTimeline(spec: PedSpec, layout: SiteLayout, marks: Landmarks): Timeline {
  const loop = spec.route.kind === "loop";
  const raw = routePath(spec.route, layout);
  const pts = loop ? [...raw, raw[0]] : raw;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const span = cum[cum.length - 1];
  // landmarks are x positions on a crossing (straight along x)
  const alongX = (x: number) => Math.abs(x - pts[0].x);
  const stops = spec.stops
    .map((s) => {
      const d = typeof s.at === "number" ? span * s.at : loop ? null : s.at === "gate" ? alongX(marks.gateX) : s.at === "board" ? (marks.boardX === null ? null : alongX(marks.boardX)) : alongX(marks.centerX);
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
  t += dt;
  return { pts, cum, segs, period: t + (loop ? 0 : spec.wait), walkEnd: t };
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

function Pedestrian({ spec, layout, world, env, marks, onGroup }: { spec: PedSpec; layout: SiteLayout; world: World; env: RefObject<Env>; marks: Landmarks; onGroup?: (g: THREE.Group | null) => void }) {
  const { geo, rig } = useRig(() => personLimbs(spec.outfit), [spec], { clip: true });
  const root = useRef<THREE.Group>(null);
  const tl = useMemo(() => buildTimeline(spec, layout, marks), [spec, layout, marks]);
  const heading = useRef<number | null>(null);
  const walked = useRef(0);
  const look = useMemo(() => ({ x: world.x(layout.center.x), z: world.z(layout.center.z) }), [layout, world]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    const tt = (((e.t + spec.offset) % tl.period) + tl.period) % tl.period;
    if (tt >= tl.walkEnd) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const seg = tl.segs.find((s) => tt < s.t1) ?? tl.segs[tl.segs.length - 1];
    const k = seg.t1 > seg.t0 ? (tt - seg.t0) / (seg.t1 - seg.t0) : 0;
    const at = along(tl, seg.d0 + (seg.d1 - seg.d0) * k);
    const X = world.x(at.p.x);
    const Z = world.z(at.p.z);
    g.position.set(X, 0, Z);
    const stopped = !!seg.stop;
    // face the way they walk (plan (dx, dz) → world (dx, −dz)); while stopped to look, turn to the houses
    const want = stopped && seg.stop?.act === "look" ? Math.atan2(look.x - X, look.z - Z) : Math.atan2(at.dx, -at.dz);
    if (heading.current === null) heading.current = want;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 6));
    g.rotation.y = heading.current;
    if (!stopped) walked.current += spec.speed * e.dt;
    const stride = spec.gait === "run" ? 2.2 : 1.6;
    const phase = (walked.current / (spec.scale * stride)) * Math.PI;
    posePerson(rig.u, stopped ? "idle" : spec.gait, stopped ? 0 : phase, e.t, spec.offset);
  });

  return (
    <group
      ref={(g) => {
        root.current = g;
        onGroup?.(g);
      }}
      scale={spec.scale}
    >
      <RigMesh geo={geo} rig={rig} />
    </group>
  );
}

export interface MoverRegistry {
  set: (key: string, g: THREE.Group | null, radius: number) => void;
}

export function Pedestrians({ layout, world, env, count, movers }: { layout: SiteLayout; world: World; env: RefObject<Env>; count: number; movers?: MoverRegistry }) {
  const marks = useMemo<Landmarks>(() => {
    const porch = layout.compoundWalls.find((w) => w.gate === "front") ?? layout.compoundWalls.find((w) => w.kind === "gate");
    const gateX = porch ? (porch.a.x + porch.b.x) / 2 : layout.plot.rightX / 2;
    const vacant = layout.slots.find((s) => s.status === "vacant" || s.status === "incoming");
    // the back house's board stands at Gate B on the lane side, off the walkers' tracks: they only stop for the front one
    const boardGate = vacant && vacant.slot === "front" ? porch : null;
    return { gateX, boardX: boardGate ? (boardGate.a.x + boardGate.b.x) / 2 : null, centerX: (layout.plot.polygon[0].x + layout.plot.rightX) / 2 };
  }, [layout]);
  // passers-by appear from / vanish into the island's cut edges
  useEffect(() => {
    const [x0, x1] = tileXRange(layout, layout.site.meadow.z0 / 2);
    EDGE_CLIP[0].constant = -world.x(x0 + 0.2);
    EDGE_CLIP[1].constant = world.x(x1 - 0.2);
    return () => {
      EDGE_CLIP[0].constant = 1e4;
      EDGE_CLIP[1].constant = 1e4;
    };
  }, [layout, world]);
  return (
    <group>
      {PEDS.slice(0, count).map((p, i) => (
        <Pedestrian key={i} spec={p} layout={layout} world={world} env={env} marks={marks} onGroup={(g) => movers?.set(`ped${i}`, g, 1.7 * p.scale)} />
      ))}
    </group>
  );
}

// ───────────────────────────── tenant at the door ─────────────────────────────

const TENANT_OUTFITS: Outfit[] = [
  { top: "#c8693f", bottom: "#2e5e4e", wrap: "saree", hair: "bun", jasmine: true },
  { top: "#f4f1ea", bottom: "#f7f4ec", wrap: "veshti", towel: "#d9b26a", skin: SKIN.dark },
];

/** One leg of the tenant's walk: to (x, z) in plan feet at height y, at this speed (ft/s), then a pause. */
type Leg = { x: number; z: number; y: number; speed: number; pause?: number; look?: "front" };

/**
 * The tenant's day (owner, 5/10/2026): waits outside the unit's own gate, the gate swings open, walks in, climbs the
 * dog-leg stair (lower flight → U-turn landing → upper flight → arrival platform), strolls out on the terrace and looks
 * round, comes back down, walks out and the gate shuts behind. Loops on scene time.
 */
function tenantRoute(slot: BuildingSlot, gate: { x: number; z: number; side: boolean }): Leg[] {
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
  // outside / just outside / just inside the gate
  const out = gate.side ? { x: gate.x - 4, z: gate.z + 0.6 } : { x: gate.x + 0.9, z: gate.z - 4 };
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
  return [{ ...out, y: 0, speed: walk, pause: 14 }, ...up, ...terrace, ...down.slice(0, -1), { ...near, y: 0, speed: walk }, { ...out, y: 0, speed: walk }];
}

type Timed = { a: Leg; b: Leg; t0: number; t1: number; p1: number };
function legTimeline(legs: Leg[]): { segs: Timed[]; period: number } {
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

/**
 * The tenant of an occupied house (clickable → "tenant", waves when hovered while standing). Starts outside the unit's
 * own gate (Gate to Unit A in the front wall, Gate to Unit B in the lane wall) and goes up to the terrace and back.
 */
export function TenantFigure({ slot, world, env, index, gateAt }: { slot: BuildingSlot; world: World; env: RefObject<Env>; index: number; gateAt?: { x: number; z: number; side?: boolean } }) {
  const api = useScene();
  const hovered = !!slot.unit && api.hovered === spotKey("tenant", slot.unit.id);
  const outfit = TENANT_OUTFITS[index % TENANT_OUTFITS.length];
  const { geo, rig } = useRig(() => personLimbs(outfit), [outfit]);
  const root = useRef<THREE.Group>(null);
  const anchor = useMemo<V3>(() => [0, 7.2, 0], []);
  const side = !!gateAt?.side;
  // the gate itself (signAt sits 2.6 ft outside it: in front of Gate A, on the lane side of Gate B)
  const gate = useMemo(() => (gateAt ? (side ? { x: gateAt.x + 2.6, z: gateAt.z, side } : { x: gateAt.x, z: 0, side }) : null), [gateAt, side]);
  const tl = useMemo(() => (gate ? legTimeline(tenantRoute(slot, gate)) : null), [slot, gate]);
  const heading = useRef<number | null>(null);
  const walked = useRef(0);
  const lastPick = useRef(0);
  useEffect(() => () => {
    if (gate) gateNear[gate.side ? "side" : "front"] = false;
  }, [gate]);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    let x = slot.door.x + 1.4;
    let z = slot.door.z - 1.4;
    let y = 0;
    let dx = 0;
    let dz = -1;
    let moving = false;
    let look: Leg["look"];
    if (tl) {
      const tt = (((e.t + index * 23) % tl.period) + tl.period) % tl.period;
      const sg = tl.segs.find((s) => tt < s.p1) ?? tl.segs[tl.segs.length - 1];
      const k = sg.t1 > sg.t0 ? Math.min(1, Math.max(0, (tt - sg.t0) / (sg.t1 - sg.t0))) : 1;
      x = sg.a.x + (sg.b.x - sg.a.x) * k;
      z = sg.a.z + (sg.b.z - sg.a.z) * k;
      y = sg.a.y + (sg.b.y - sg.a.y) * k;
      moving = tt < sg.t1 && Math.hypot(sg.b.x - sg.a.x, sg.b.z - sg.a.z) > 0.01;
      dx = sg.b.x - sg.a.x;
      dz = sg.b.z - sg.a.z;
      if (!moving) look = sg.b.look;
      if (gate) gateNear[gate.side ? "side" : "front"] = Math.hypot(x - gate.x, z - gate.z) < 2.4;
      // a moving click target: re-pick now and then so hover follows them
      if (state.clock.elapsedTime - lastPick.current > 0.15) {
        lastPick.current = state.clock.elapsedTime;
        state.events.update?.();
      }
    }
    const X = world.x(x);
    const Z = world.z(z);
    g.position.set(X, y, Z);
    const want = look === "front" ? 0 : Math.atan2(dx, -dz);
    if (heading.current === null) heading.current = want;
    if (moving || look) {
      let dh = want - heading.current;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      heading.current += dh * (1 - Math.exp(-e.dt * 6));
    }
    g.rotation.y = heading.current;
    if (moving) walked.current += 2.4 * e.dt;
    posePerson(rig.u, moving ? "walk" : hovered ? "wave" : "idle", (walked.current / 1.6) * Math.PI, e.t, index * 2.3);
    anchor[0] = X;
    anchor[1] = y + 7.2;
    anchor[2] = Z;
  });
  const unitId = slot.unit?.id;
  if (!unitId) return null;
  return (
    <Hotspot spot={{ key: spotKey("tenant", unitId), kind: "tenant", unitId, anchor }}>
      <group ref={root}>
        <RigMesh geo={geo} rig={rig} />
        <mesh geometry={G.box()} position={[0, 3, 0]} scale={[2.6, 6.4, 2.6]} visible={false} userData={{ pickFirst: true }} />
      </group>
    </Hotspot>
  );
}

// ───────────────────────────── stray dog ─────────────────────────────

const COAT = "#c48a52";
function dogLimbs(): Limb[] {
  const leg = (x: number, z: number): Limb => ({ parts: [box([x, 0.55, z], [0.17, 1.0, 0.17], COAT), box([x + 0.04, 0.06, z], [0.22, 0.1, 0.2], "#8f5f33")], pivot: [x, 1.05, z], axis: [0, 0, 1] });
  return [
    { parts: [box([0, 1.35, 0], [1.9, 0.75, 0.62], COAT), box([0.2, 1.12, 0], [1.2, 0.3, 0.5], "#e2b98a")] },
    leg(0.7, 0.2),
    leg(0.7, -0.2),
    leg(-0.7, 0.2),
    leg(-0.7, -0.2),
    { parts: [box([-1.27, 1.55, 0], [0.7, 0.12, 0.12], COAT)], pivot: [-0.95, 1.55, 0], axis: [0, 1, 0] },
    {
      parts: [
        box([1.3, 1.75, 0], [0.62, 0.55, 0.5], COAT),
        box([1.73, 1.63, 0], [0.36, 0.28, 0.32], "#a8713f"),
        box([1.9, 1.67, 0], [0.08, 0.1, 0.12], "#1a1410"),
        cone([1.2, 2.13, 0.16], [0.22, 0.32, 0.18], "#8f5f33"),
        cone([1.2, 2.13, -0.16], [0.22, 0.32, 0.18], "#8f5f33"),
      ],
      pivot: [1.05, 1.65, 0],
      axis: [0, 0, 1],
    },
  ];
}

export function Dog({ layout, world, env, movers }: { layout: SiteLayout; world: World; env: RefObject<Env>; movers?: MoverRegistry }) {
  const { geo, rig } = useRig(dogLimbs, []);
  const g = useRef<THREE.Group>(null);
  const z = -5.2; // on the grass in front of the wall, between the gate kolam and the walkers' tracks
  const gate = layout.compoundWalls.find((w) => w.kind === "gate");
  const a = gate ? (gate.a.x + gate.b.x) / 2 - 1.5 : layout.plot.polygon[0].x + 2;
  const b = layout.plot.rightX + 1.2;
  const nap = 16;
  const trot = Math.abs(b - a) / 5.5;
  const period = (nap + trot) * 2;
  useFrame(() => {
    const e = env.current;
    const t = e.t % period;
    let x: number;
    let moving = false;
    let dir = 1;
    if (t < nap) x = a;
    else if (t < nap + trot) {
      x = a + (b - a) * smoothstep(0, 1, (t - nap) / trot);
      moving = true;
    } else if (t < nap * 2 + trot) {
      x = b;
      dir = -1;
    } else {
      x = b + (a - b) * smoothstep(0, 1, (t - nap * 2 - trot) / trot);
      moving = true;
      dir = -1;
    }
    if (!g.current) return;
    g.current.position.set(world.x(x), 0, world.z(z));
    g.current.rotation.y = moving ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? 0.4 : Math.PI - 0.4;
    const A = rig.u.uAng.value;
    const T = e.t;
    if (moving) {
      for (let i = 1; i <= 4; i++) A[i] = Math.sin(T * 12 + (i % 2) * Math.PI + (i > 2 ? Math.PI / 2 : 0)) * 0.6;
      A[5] = Math.sin(T * 14) * 0.5;
      A[6] = Math.sin(T * 12) * 0.05;
      rig.u.uShift.value.set(0, Math.abs(Math.sin(T * 12)) * 0.08, 0);
    } else {
      // lying down: legs folded under, slow breathing, an occasional head lift
      A[1] = A[2] = 1.45;
      A[3] = A[4] = -1.45;
      A[5] = 0.15 + Math.sin(T * 0.6) * 0.1;
      A[6] = -0.5 + Math.max(0, Math.sin(T * 0.21)) ** 8 * 0.6;
      rig.u.uShift.value.set(0, -0.78 + Math.sin(T * 2.2) * 0.02, 0);
    }
  });
  return (
    <group
      ref={(o) => {
        g.current = o;
        movers?.set("dog", o, 1.9);
      }}
    >
      <RigMesh geo={geo} rig={rig} />
    </group>
  );
}

// ───────────────────────────── zebu cow ─────────────────────────────

const WHITE = "#ece6da";
const SHADE = "#cfc6b6";
function cowLimbs(): Limb[] {
  return [
    {
      parts: [
        box([0, 3.0, 0], [4.2, 1.9, 1.55], WHITE),
        box([0, 2.25, 0], [3.6, 0.5, 1.3], SHADE),
        ball([1.45, 4.05, 0], [1.1, 0.9, 0.9], WHITE),
        ...(
          [
            [1.6, 0.5],
            [1.6, -0.5],
            [-1.6, 0.5],
            [-1.6, -0.5],
          ] as const
        ).flatMap(([x, z], i) => [box([x, 1.1, z], [0.36, 2.2, 0.36], i < 2 ? WHITE : SHADE), box([x, 0.12, z], [0.4, 0.24, 0.4], "#3a2e26")]),
      ],
    },
    {
      parts: [
        box([2.55, 3.4, 0], [1.2, 0.85, 0.75], WHITE),
        box([2.3, 2.85, 0], [0.9, 0.5, 0.25], SHADE),
        box([3.65, 3.45, 0], [0.95, 0.75, 0.66], WHITE),
        box([4.17, 3.33, 0], [0.3, 0.42, 0.56], "#d9b8a6"),
        ...[0.36, -0.36].flatMap((hz, i) => [
          cone([3.4, 4.05, hz], [0.16, 0.7, 0.16], "#d8c7a6", [hz > 0 ? -0.35 : 0.35, 0, 0]),
          cone([3.4, 4.43, hz * 1.35], [0.1, 0.26, 0.1], i ? "#2f6fb5" : "#c2185b", [hz > 0 ? -0.35 : 0.35, 0, 0]),
          box([3.4, 3.57, hz * 1.55], [0.25, 0.14, 0.4], SHADE),
        ]),
      ],
      pivot: [2.0, 3.4, 0],
      axis: [0, 0, 1],
    },
    { parts: [box([-2.1, 2.5, 0], [0.1, 2.2, 0.1], SHADE), box([-2.1, 1.35, 0], [0.22, 0.45, 0.22], "#3a2e26")], pivot: [-2.1, 3.6, 0], axis: [1, 0, 0] },
  ];
}

export function Cow({ layout, world, env, movers }: { layout: SiteLayout; world: World; env: RefObject<Env>; movers?: MoverRegistry }) {
  const { geo, rig } = useRig(cowLimbs, []);
  const g = useRef<THREE.Group>(null);
  // grazing on the front grass under the palms at the right, clear of the walkers' tracks
  const z = layout.site.meadow.z0 + 3;
  const x = layout.plot.rightX + 2;
  const neck = useRef(0);
  useFrame(() => {
    const e = env.current;
    const t = e.t + 3.7;
    const graze = Math.sin(t * 0.35) > -0.2;
    neck.current += ((graze ? -0.85 : 0.05) + Math.sin(t * 3) * (graze ? 0.05 : 0) - neck.current) * (1 - Math.exp(-e.dt * 2.4));
    rig.u.uAng.value[1] = neck.current;
    rig.u.uAng.value[2] = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 5.1) * 0.12;
    if (g.current) g.current.position.x = world.x(x) + Math.sin(t * 0.05) * 1.5;
  });
  return (
    <group
      ref={(o) => {
        g.current = o;
        movers?.set("cow", o, 3.6);
      }}
      position={[world.x(x), 0, world.z(z)]}
      rotation={[0, Math.PI - 0.25, 0]}
    >
      <RigMesh geo={geo} rig={rig} />
    </group>
  );
}

// ───────────────────────────── crows on the wire ─────────────────────────────

const CROW: Part[] = [
  box([0, 0.55, 0], [0.9, 0.5, 0.42], "#1d1d24", [0, 0, 0.25]),
  ball([0.5, 0.86, 0], 0.4, "#2a2a32"),
  cone([0.8, 0.84, 0], [0.12, 0.34, 0.12], "#3a3a3a", [0, 0, -Math.PI / 2]),
  box([-0.62, 0.45, 0], [0.7, 0.14, 0.3], "#1d1d24", [0, 0, 0.45]),
  box([0, 0.15, 0.1], [0.05, 0.3, 0.05], "#444"),
  box([0, 0.15, -0.1], [0.05, 0.3, 0.05], "#444"),
];

/** Three crows perched on the street wire: they hop, turn and bob their heads now and then. */
export function WireCrows({ points, env }: { points: V3[]; env: RefObject<Env> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = rigGeometry([{ parts: CROW }]);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = env.current.t;
    points.forEach((p, i) => {
      const hop = Math.max(0, Math.sin(t * 0.9 + i * 2.1)) ** 24;
      const turn = Math.sin(t * 0.13 + i * 1.7) > 0.3 ? Math.PI : 0;
      o.position.set(p[0], p[1] + hop * 0.8, p[2]);
      o.rotation.set(0, turn + Math.sin(t * 0.5 + i) * 0.2, Math.sin(t * 2.3 + i * 4) * 0.06);
      o.scale.setScalar(1.15);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, points.length)]} castShadow frustumCulled={false} />;
}

// ───────────────────────────── contact shadows for characters ─────────────────────────────

/** Registry of moving characters + one instanced draw call of soft blob shadows under them. */
export function useMovers(): { registry: MoverRegistry; list: RefObject<Map<string, { g: THREE.Group; r: number }>> } {
  const list = useRef(new Map<string, { g: THREE.Group; r: number }>());
  const registry = useMemo<MoverRegistry>(
    () => ({
      set: (key, g, r) => {
        if (g) list.current.set(key, { g, r });
        else list.current.delete(key);
      },
    }),
    [],
  );
  return { registry, list };
}

export function BlobShadows({ list, max }: { list: RefObject<Map<string, { g: THREE.Group; r: number }>>; max: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTex(), color: "#000000", transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    let i = 0;
    for (const { g, r } of list.current.values()) {
      if (i >= max) break;
      o.position.set(g.position.x, 0.08, g.position.z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.scale.setScalar(g.visible ? r * (g.scale.x || 1) : 0);
      o.updateMatrix();
      m.setMatrixAt(i++, o.matrix);
    }
    for (; i < max; i++) {
      o.scale.setScalar(0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[G.plane(), mat, Math.max(1, max)]} frustumCulled={false} renderOrder={1} />;
}

// ───────────────────────────── property manager (the to-do list) ─────────────────────────────

/** White shirt, white trousers, black shoes, a maroon register in the left hand and a pen in the right. */
function officerLimbs(): Limb[] {
  const white = "#f3f1ea";
  const limbs = personLimbs({ top: white, bottom: "#ebe8df", wrap: "pants", skin: SKIN.mid, hair: "short" });
  // long white sleeves; black shoes
  for (const l of limbs) for (const pt of l.parts) if (pt.c === "#2b211b") pt.c = "#121212";
  for (const i of [P_ARM_L, P_ARM_R]) {
    const arm = limbs[i].parts[0];
    arm.c = white;
  }
  limbs[0].parts.push(box([0.25, 3.9, 0.27], [0.24, 0.32, 0.04], "#1d4f91")); // ID card
  limbs[P_ARM_L].parts.push(box([-0.55, 2.75, 0.38], [0.2, 1.25, 0.95], "#8c1f24"), box([-0.44, 2.75, 0.38], [0.04, 1.16, 0.88], "#f4efe0")); // register
  limbs[P_ARM_R].parts.push(box([0.61, 2.6, 0.2], [0.06, 0.06, 0.48], "#1f3fa8")); // pen
  return limbs;
}
const P_ARM_L = 3;
const P_ARM_R = 4;

/**
 * The property manager: walks a slow loop round the outside of the compound at all times, stopping at each corner to
 * write in his register. Clicking him opens the to-dos (the old notice board's job). His anchor moves with him.
 * Pointer hover is re-tested a few times a second while he walks, so he lights up when he walks under a still cursor
 * (R3F only raycasts on pointer events otherwise).
 */
export function PropertyOfficer({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const { geo, rig } = useRig(officerLimbs, []);
  const root = useRef<THREE.Group>(null);
  const anchor = useMemo<V3>(() => [0, 7.4, 0], []);
  // a loop outside the wall: front grass → right passage → behind the back → down the lane, clear of the gates' boards
  const loop = useMemo(() => {
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
    return { segs, total: segs.reduce((n, sg) => n + sg.len, 0) };
  }, [layout]);
  const SPEED = 2.1; // ft/s
  const WRITE = 4; // s at each corner
  const cycle = loop.total / SPEED + WRITE * loop.segs.length;
  const heading = useRef<number | null>(null);
  const lastPick = useRef(0);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    if (state.clock.elapsedTime - lastPick.current > 0.12) {
      lastPick.current = state.clock.elapsedTime;
      state.events.update?.();
    }
    const e = env.current;
    let t = (((e.t + cycle * 0.35) % cycle) + cycle) % cycle; // starts on the right side, away from the front walkers
    let x = 0;
    let z = 0;
    let dx = 1;
    let dz = 0;
    let writing = false;
    let walked = 0;
    for (const sg of loop.segs) {
      const walkT = sg.len / SPEED;
      if (t < WRITE) {
        writing = true;
        x = sg.a.x;
        z = sg.a.z;
        dx = sg.b.x - sg.a.x;
        dz = sg.b.z - sg.a.z;
        break;
      }
      t -= WRITE;
      if (t < walkT) {
        const k = t / walkT;
        x = sg.a.x + (sg.b.x - sg.a.x) * k;
        z = sg.a.z + (sg.b.z - sg.a.z) * k;
        dx = sg.b.x - sg.a.x;
        dz = sg.b.z - sg.a.z;
        walked += t * SPEED;
        break;
      }
      t -= walkT;
      walked += sg.len;
    }
    const X = world.x(x);
    const Z = world.z(z);
    g.position.set(X, 0, Z);
    const want = Math.atan2(dx, -dz);
    if (heading.current === null) heading.current = want;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 5));
    g.rotation.y = heading.current;
    // walking: the register stays up in the left hand; at the corners he writes in it
    posePerson(rig.u, writing ? "idle" : "walk", (walked / 1.6) * Math.PI, e.t, 1.7);
    const a = rig.u.uAng.value;
    a[P_ARM_L] = -0.95;
    if (writing) a[P_ARM_R] = -0.85 + Math.sin(e.t * 9) * 0.05;
    anchor[0] = X;
    anchor[2] = Z;
  });
  return (
    <Hotspot spot={{ key: "noticeboard", kind: "noticeboard", anchor }}>
      <group ref={root}>
        <RigMesh geo={geo} rig={rig} />
        <mesh geometry={G.box()} position={[0, 3.3, 0]} scale={[3.6, 7, 3.6]} visible={false} />
      </group>
    </Hotspot>
  );
}

// ───────────────────────────── angry policeman guarding the tax office ─────────────────────────────

/** Tamil Nadu police constable: khaki uniform, red-band peaked cap, brown belt with brass buckle, black boots, a thick
 *  moustache under angry brows, a bamboo lathi in the right hand. */
function policeLimbs(): Limb[] {
  const khaki = "#a98d55";
  const limbs = personLimbs({ top: khaki, bottom: "#9c8250", wrap: "pants", skin: SKIN.mid, hair: "short" });
  for (const l of limbs) for (const pt of l.parts) if (pt.c === "#2b211b") pt.c = "#0f0f0f";
  for (const i of [P_ARM_L, P_ARM_R]) limbs[i].parts[0].c = khaki;
  limbs[0].parts.push(
    // peaked cap: khaki crown, red band, black visor
    { g: "cyl", p: [0, 5.38, 0], s: [0.86, 0.34, 0.86], c: "#b39662" },
    { g: "cyl", p: [0, 5.26, 0], s: [0.8, 0.14, 0.8], c: "#b3262b" },
    box([0, 5.16, 0.36], [0.62, 0.05, 0.3], "#111111"),
    box([0, 5.27, 0.41], [0.16, 0.12, 0.03], "#d9b24a"), // cap badge
    // angry face: brows angled down to the nose, thick moustache
    box([-0.15, 5.04, 0.36], [0.24, 0.06, 0.04], "#141110", [0, 0, -0.42]),
    box([0.15, 5.04, 0.36], [0.24, 0.06, 0.04], "#141110", [0, 0, 0.42]),
    box([0, 4.8, 0.37], [0.42, 0.09, 0.05], "#141110"),
    // belt with brass buckle, shoulder flaps, name badge and whistle cord
    box([0, 2.78, 0], [1.0, 0.2, 0.58], "#5a3a1e"),
    box([0, 2.78, 0.3], [0.2, 0.16, 0.03], "#d9b24a"),
    box([-0.42, 4.38, 0], [0.26, 0.06, 0.5], "#8a7244"),
    box([0.42, 4.38, 0], [0.26, 0.06, 0.5], "#8a7244"),
    box([-0.24, 3.95, 0.27], [0.24, 0.07, 0.03], "#1d1d1d"),
    box([0.25, 3.85, 0.27], [0.03, 0.4, 0.03], "#d8d8d8"),
  );
  // lathi (bamboo baton) held in the right hand, pointing down and forward
  limbs[P_ARM_R].parts.push({ g: "cyl", p: [0.66, 2.1, 0.45], s: [0.1, 2.8, 0.1], c: "#8a6a3a", r: [0.55, 0, 0] });
  return limbs;
}

/**
 * The policeman guarding the tax office: stands by the porch, legs apart, left hand on the hip, tapping his lathi,
 * slowly turning to scan the grounds with a scowl. Placed in the hut's local frame (see TaxStamp in Fixtures.tsx).
 */
export function PoliceGuard({ env, position, rotationY = 0 }: { env: RefObject<Env>; position: V3; rotationY?: number }) {
  const { geo, rig } = useRig(policeLimbs, []);
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = env.current;
    const t = e.t;
    const a = rig.u.uAng.value;
    a[1] = 0.1; // legs apart
    a[2] = -0.1;
    a[P_ARM_L] = 0.35; // hand on the hip
    a[P_ARM_R] = -0.45 + Math.max(0, Math.sin(t * 2.6)) * 0.22; // tapping the lathi
    rig.u.uShift.value.set(0, Math.sin(t * 1.4) * 0.015, 0);
    rig.u.uLean.value = -0.03; // chest out
    if (root.current) root.current.rotation.y = rotationY + Math.sin(t * 0.32) * 0.5; // scanning the grounds
  });
  return (
    <group ref={root} position={position} scale={1.08}>
      <RigMesh geo={geo} rig={rig} />
    </group>
  );
}

// ───────────────────────────── photographer by the hand pump ─────────────────────────────

/** A man in a blue shirt and dark trousers with a camera strap. */
function photographerLimbs(): Limb[] {
  const limbs = personLimbs({ top: "#3f6fa8", bottom: "#2c2f38", wrap: "pants", skin: SKIN.mid, hair: "short" });
  limbs[0].parts.push(box([0, 3.7, 0.28], [0.5, 0.08, 0.02], "#2a2a2a")); // strap across the chest
  return limbs;
}

/** A black camera with a lens and a flash unit on a three-legged stand (stand origin = the floor under the head). */
function tripodParts(): Part[] {
  const black = "#151515";
  const metal = "#6d6f73";
  const H = 4.35; // head height
  const parts: Part[] = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const fx = Math.sin(ang) * 1.05;
    const fz = Math.cos(ang) * 1.05;
    const len = Math.hypot(fx, H - 0.1, fz);
    // a leg from the head down to its foot: tilt about the axis perpendicular to its direction
    parts.push({ g: "cyl", p: [fx / 2, H / 2, fz / 2], s: [0.09, len, 0.09], c: metal, r: [Math.atan2(-fz, H), 0, Math.atan2(fx, H)] });
  }
  parts.push({ g: "cyl", p: [0, H - 0.6, 0], s: [0.12, 1.2, 0.12], c: metal }); // centre column
  parts.push({ g: "box", p: [0, H + 0.08, 0], s: [0.36, 0.16, 0.36], c: black }); // head
  parts.push({ g: "box", p: [0, H + 0.45, 0], s: [0.82, 0.55, 0.48], c: black }); // camera body
  parts.push({ g: "cyl", p: [0, H + 0.43, 0.45], s: [0.38, 0.5, 0.38], c: "#202020", r: [Math.PI / 2, 0, 0] }); // lens
  parts.push({ g: "cyl", p: [0, H + 0.43, 0.71], s: [0.3, 0.03, 0.3], c: "#3a5a8a", r: [Math.PI / 2, 0, 0] }); // glass
  parts.push({ g: "box", p: [0.18, H + 0.88, 0.05], s: [0.36, 0.32, 0.3], c: black }); // flash unit
  parts.push({ g: "box", p: [0.18, H + 0.88, 0.21], s: [0.3, 0.2, 0.03], c: "#e9e9e9" }); // flash window
  parts.push({ g: "box", p: [-0.15, H + 0.65, -0.26], s: [0.4, 0.3, 0.05], c: "#2b3b4a" }); // screen at the back
  return parts;
}

/**
 * Owner, 6/10/2026: a photographer on the grass beside the hand pump, by 116/B7 (the front unit), clear of the garden
 * walker's loop and the property manager's path. Camera on a TRIPOD (reads better than a hand-held one at this cartoon
 * scale): he stands at the camera and takes one picture every 15 s — the shot FLASHES (white burst + a quick point light).
 */
export function Photographer({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const { geo, rig } = useRig(photographerLimbs, []);
  const stand = useMemo(() => tripodParts(), []);
  const root = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);
  const spot = useMemo(() => {
    const [FL, , , BL] = layout.plot.polygon;
    const D = layout.plot.depthFt;
    const lx = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
    const z = D * 0.26; // between the pump (D·0.2) and the banana clumps (D·0.36)
    const p = { x: lx(z) - 10, z };
    const front = layout.slots.find((s) => s.slot === "front");
    const aim = front ? { x: (front.rect.x0 + front.rect.x1) / 2, z: (front.rect.z0 + front.rect.z1) / 2 } : { x: p.x + 10, z: p.z };
    const X = world.x(p.x);
    const Z = world.z(p.z);
    return { X, Z, yaw: Math.atan2(world.x(aim.x) - X, world.z(aim.z) - Z) };
  }, [layout, world]);
  // owner, 6/10/2026: no leaning in, no turning the stand — he just stands at the camera and takes a picture every 15 s
  const CYCLE = 15;
  const SHOTS = [1.2];
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    const t = e.t - Math.floor(e.t / CYCLE) * CYCLE;
    g.rotation.y = spot.yaw;
    posePerson(rig.u, "idle", 0, e.t, 4.1);
    // right hand to the shutter button for the click, then back down
    const press = t < 0.5 ? smoothstep(0, 0.5, t) : t < 1.8 ? 1 : t < 2.3 ? 1 - smoothstep(1.8, 2.3, t) : 0;
    const a = rig.u.uAng.value;
    a[P_ARM_R] = a[P_ARM_R] * (1 - press) - 1.1 * press;
    let f = 0;
    for (const s of SHOTS) {
      const d = t - s;
      if (d >= 0 && d < 0.35) f = Math.max(f, Math.exp(-d * 18));
    }
    if (flash.current) {
      flash.current.visible = f > 0.02;
      flash.current.scale.setScalar(0.6 + f * 2.2);
      flash.current.material.opacity = f;
    }
    if (light.current) light.current.intensity = f * 60;
  });
  return (
    <group ref={root} position={[spot.X, 0, spot.Z]}>
      <RigMesh geo={geo} rig={rig} />
      <group position={[0, 0, 1.6]}>
        <StandMesh parts={stand} />
        {/* the flash burst at the flash unit: a soft white glow (not a ball) */}
        <sprite ref={flash} position={[0.18, 5.23, 0.3]} visible={false}>
          <spriteMaterial map={FLASH_TEX} color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <pointLight ref={light} position={[0.18, 5.23, 0.8]} color="#f4f7ff" intensity={0} distance={22} decay={2} />
      </group>
    </group>
  );
}

function StandMesh({ parts }: { parts: Part[] }) {
  const geo = useMemo(() => bake(parts), [parts]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={STAND_MAT} castShadow />;
}
/** Soft round glow for the camera flash (white core fading out). */
const FLASH_TEX = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.45, "rgba(220,235,255,0.35)");
  grad.addColorStop(1, "rgba(220,235,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
const STAND_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
