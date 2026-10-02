"use client";
// Low-poly street life on the shoulders: a veshti man with an umbrella who stops at the gate, a saree lady who pauses to
// read the TO-LET board, a school kid who runs and stops and runs, a vegetable vendor pushing his cart (he stops in
// front of the plot and rings the bell), a stray dog napping by the gate, a zebu cow grazing, and the tenant at the
// door of each occupied house (a clickable world object). Every character is ONE draw call (rig.ts). Movement follows
// scripted timelines on scene time → frame-rate independent and slowed by focus dimming.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { BuildingSlot, SiteLayout } from "@/lib/site-layout";
import type { Env } from "./env";
import { tileXRange } from "./Island";
import { Hotspot, spotKey, useScene, type V3 } from "./Interact";
import { G } from "./materials";
import { ball, box, cone, rod, type Part } from "./bake";
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

// ───────────────────────────── pedestrians ─────────────────────────────

type StopAt = "gate" | "board" | "center" | number;
interface Stop {
  /** where along the walk: a landmark or a fraction 0..1 of the walk */
  at: StopAt;
  dur: number;
  /** what they do while stopped */
  act?: "look" | "ring" | "idle";
}
interface PedSpec {
  outfit: Outfit;
  scale: number;
  speed: number;
  gait: Gait;
  dir: 1 | -1;
  lane: "near" | "far";
  /** scene-time offset into the loop */
  offset: number;
  /** seconds off-stage after each walk */
  wait: number;
  stops: Stop[];
  cart?: boolean;
}

const PEDS: PedSpec[] = [
  { outfit: { top: "#f4f1ea", bottom: "#f7f4ec", wrap: "veshti", umbrella: true, towel: "#c9a46b" }, scale: 1, speed: 3.4, gait: "walk", dir: 1, lane: "near", offset: 4, wait: 9, stops: [{ at: "gate", dur: 4.5, act: "look" }] },
  { outfit: { top: "#f1e3c4", bottom: "#3b5c8f", wrap: "lungi", skin: SKIN.dark }, scale: 1, speed: 2.3, gait: "push", dir: -1, lane: "near", offset: 30, wait: 16, cart: true, stops: [{ at: "center", dur: 7, act: "ring" }] },
  { outfit: { top: "#e0a020", bottom: "#c2185b", wrap: "saree", hair: "bun", jasmine: true }, scale: 0.96, speed: 3.0, gait: "walk", dir: -1, lane: "near", offset: 14, wait: 8, stops: [{ at: "board", dur: 3.5, act: "look" }] },
  { outfit: { top: "#f4f1ea", bottom: "#24324a", wrap: "shorts", skin: SKIN.dark, hair: "short" }, scale: 0.62, speed: 8.5, gait: "run", dir: 1, lane: "far", offset: 6, wait: 12, stops: [{ at: 0.32, dur: 1.6, act: "look" }, { at: 0.66, dur: 1.1, act: "idle" }] },
  { outfit: { top: "#8a2f5a", bottom: "#2e8b57", wrap: "saree", hair: "plait", jasmine: true, skin: SKIN.dark }, scale: 0.95, speed: 2.9, gait: "walk", dir: 1, lane: "far", offset: 22, wait: 10, stops: [] },
];

/** Vegetable cart in front of the vendor (+Z), as extra rig limbs: 5 = cart, 6 = wheels (axle), 7 = bell. */
function cartLimbs(): Limb[] {
  const Z = 3.3;
  const cart: Part[] = [
    box([0, 2.3, Z], [3.0, 0.3, 4.2], "#7a4a26"),
    box([0, 2.75, Z - 1.95], [3.0, 0.6, 0.2], "#6b3f22"),
    box([0, 2.75, Z + 1.95], [3.0, 0.6, 0.2], "#6b3f22"),
    rod([-1.2, 3.05, Z - 2.6], [0.12, 1.6, 0.12], "#6b3f22", [0.9, 0, 0]),
    rod([1.2, 3.05, Z - 2.6], [0.12, 1.6, 0.12], "#6b3f22", [0.9, 0, 0]),
    box([0, 3.55, Z - 3.15], [2.6, 0.14, 0.14], "#6b3f22"),
    ...(
      [
        [-0.8, -1, "#3f8a35"],
        [0.6, -0.8, "#c0392b"],
        [-0.2, 0.4, "#e67e22"],
        [0.9, 0.8, "#3f8a35"],
        [-0.9, 1.2, "#f1c40f"],
        [0.1, -0.2, "#7cae3a"],
        [0.8, 1.6, "#8e44ad"],
        [-0.7, -1.6, "#c0392b"],
      ] as const
    ).map(([x, z, c]) => ball([x, 2.78, Z + z], 0.8, c)),
    // shade umbrella on a pole
    rod([1.25, 4.4, Z + 1.7], [0.08, 4.2, 0.08], "#5a4632"),
    cone([1.25, 6.7, Z + 1.7], [4.2, 1.0, 4.2], "#2f6fb5"),
  ];
  const wheels: Part[] = [-1.65, 1.65].flatMap((x) => [rod([x, 1.1, Z], [2.2, 0.2, 2.2], "#3e2414", [0, 0, Math.PI / 2]), box([x * 1.06, 1.1, Z], [0.06, 1.8, 0.25], "#9a7b52")]);
  const bell: Part[] = [cone([0.9, 3.25, Z - 3.15], [0.36, 0.34, 0.36], "#d4a72c"), ball([0.9, 3.06, Z - 3.15], 0.1, "#8a6a1c")];
  return [
    { parts: cart },
    { parts: wheels, pivot: [0, 1.1, Z], axis: [1, 0, 0] },
    { parts: bell, pivot: [0.9, 3.5, Z - 3.15], axis: [0, 0, 1] },
  ];
}

interface Landmarks {
  gateX: number;
  boardX: number | null;
  centerX: number;
}

interface Timeline {
  segs: { t0: number; t1: number; x0: number; x1: number; stop?: Stop }[];
  period: number;
  walkEnd: number;
}

function buildTimeline(spec: PedSpec, x0: number, x1: number, marks: Landmarks): Timeline {
  const span = x1 - x0;
  const start = spec.dir > 0 ? x0 : x1;
  const along = (x: number) => (x - start) * spec.dir; // distance walked when at plan x
  const stops = spec.stops
    .map((s) => {
      const x = s.at === "gate" ? marks.gateX : s.at === "board" ? marks.boardX : s.at === "center" ? marks.centerX : start + spec.dir * span * s.at;
      return x === null ? null : { s, d: along(x) };
    })
    .filter((v): v is { s: Stop; d: number } => !!v && v.d > 1 && v.d < span - 1)
    .sort((a, b) => a.d - b.d);
  const segs: Timeline["segs"] = [];
  let t = 0;
  let d = 0;
  for (const st of stops) {
    const dt = (st.d - d) / spec.speed;
    segs.push({ t0: t, t1: t + dt, x0: d, x1: st.d });
    t += dt;
    segs.push({ t0: t, t1: t + st.s.dur, x0: st.d, x1: st.d, stop: st.s });
    t += st.s.dur;
    d = st.d;
  }
  const dt = (span - d) / spec.speed;
  segs.push({ t0: t, t1: t + dt, x0: d, x1: span });
  t += dt;
  return { segs, period: t + spec.wait, walkEnd: t };
}

function Pedestrian({ spec, layout, world, env, marks, onGroup }: { spec: PedSpec; layout: SiteLayout; world: World; env: RefObject<Env>; marks: Landmarks; onGroup?: (g: THREE.Group | null) => void }) {
  const { geo, rig } = useRig(() => [...personLimbs(spec.outfit), ...(spec.cart ? cartLimbs() : [])], [spec], { clip: true });
  const root = useRef<THREE.Group>(null);
  const st = layout.site.street;
  const z = spec.lane === "near" ? (st.nearShoulder[0] + st.nearShoulder[1]) / 2 - 0.9 : (st.farShoulder[0] + st.farShoulder[1]) / 2 + 0.4;
  const [tx0, tx1] = tileXRange(layout, z);
  const tl = useMemo(() => buildTimeline(spec, tx0 - 3, tx1 + 3, marks), [spec, tx0, tx1, marks]);
  const heading = useRef(spec.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const walked = useRef(0);

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
    const d = seg.x0 + (seg.x1 - seg.x0) * k;
    const x = spec.dir > 0 ? tx0 - 3 + d : tx1 + 3 - d;
    g.position.set(world.x(x), 0, world.z(z));
    const stopped = !!seg.stop;
    // turn to look at the house (world −Z) while stopped, otherwise face the way they walk
    const want = stopped && seg.stop?.act === "look" ? Math.PI : spec.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 6));
    g.rotation.y = heading.current;
    if (!stopped) walked.current += spec.speed * e.dt;
    const stride = spec.gait === "run" ? 2.2 : 1.6;
    const phase = (walked.current / (spec.scale * stride)) * Math.PI;
    posePerson(rig.u, stopped ? (spec.cart ? "push" : "idle") : spec.gait, stopped ? 0 : phase, e.t, spec.offset);
    if (spec.cart) {
      rig.u.uAng.value[6] = walked.current / 1.1;
      const ringing = stopped && seg.stop?.act === "ring" && Math.sin(e.t * 1.4) > 0.2;
      rig.u.uAng.value[7] = ringing ? Math.sin(e.t * 22) * 0.55 : rig.u.uAng.value[7] * 0.85;
    }
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
    const porch = layout.compoundWalls.find((w) => w.gate === "porch") ?? layout.compoundWalls.find((w) => w.kind === "gate");
    const gateX = porch ? (porch.a.x + porch.b.x) / 2 : layout.plot.rightX / 2;
    const vacant = layout.slots.find((s) => s.status === "vacant" || s.status === "incoming");
    const boardGate = vacant ? (vacant.slot === "front" ? porch : (layout.compoundWalls.find((w) => w.gate === "passage" || w.gate === "main") ?? porch)) : null;
    return { gateX, boardX: boardGate ? (boardGate.a.x + boardGate.b.x) / 2 : null, centerX: (layout.plot.polygon[0].x + layout.plot.rightX) / 2 };
  }, [layout]);
  return (
    <group>
      {PEDS.slice(0, count).map((p, i) => (
        <Pedestrian key={i} spec={p} layout={layout} world={world} env={env} marks={marks} onGroup={(g) => movers?.set(`ped${i}`, g, p.cart ? 3.2 : 1.7 * p.scale)} />
      ))}
    </group>
  );
}

// ───────────────────────────── tenant at the door ─────────────────────────────

const TENANT_OUTFITS: Outfit[] = [
  { top: "#c8693f", bottom: "#2e5e4e", wrap: "saree", hair: "bun", jasmine: true },
  { top: "#f4f1ea", bottom: "#f7f4ec", wrap: "veshti", towel: "#d9b26a", skin: SKIN.dark },
];

/**
 * The tenant of an occupied house, standing by the door (the front house) or up on the roof terrace by the stair
 * head (a back house hides its door behind the front one). Clickable → "tenant". Waves when hovered.
 */
export function TenantFigure({ slot, world, env, index }: { slot: BuildingSlot; world: World; env: RefObject<Env>; index: number }) {
  const api = useScene();
  const hovered = !!slot.unit && api.hovered === spotKey("tenant", slot.unit.id);
  const outfit = TENANT_OUTFITS[index % TENANT_OUTFITS.length];
  const { geo, rig } = useRig(() => personLimbs(outfit), [outfit]);
  const onRoof = slot.slot === "back" && slot.rect.z0 > 1;
  const pos = useMemo<V3>(() => {
    if (onRoof) {
      const s = slot.stairs;
      return [world.x(s.x0 - 2.2), slot.heightFt + 0.1, world.z(s.z1 + 1.6)];
    }
    const { wide } = slot.notch;
    return [world.x(Math.min(wide.x1 - 1.2, slot.door.x + 1.5)), 0.6, world.z(Math.max(wide.z0 + 1.3, slot.door.z - 1.6))];
  }, [onRoof, slot, world]);
  const anchor = useMemo<V3>(() => [pos[0], pos[1] + 7.2, pos[2]], [pos]);
  const unitId = slot.unit?.id;
  useFrame(() => {
    const e = env.current;
    posePerson(rig.u, hovered ? "wave" : "idle", 0, e.t, index * 2.3);
  });
  if (!unitId) return null;
  return (
    <Hotspot
      spot={{ key: spotKey("tenant", unitId), kind: "tenant", unitId, anchor }}
      hit={<mesh geometry={G.box()} position={[pos[0], pos[1] + 3, pos[2]]} scale={[2.6, 6.4, 2.6]} visible={false} />}
    >
      {/* faces the street (world +Z) */}
      <group position={pos} rotation={[0, onRoof ? -0.5 : -0.25, 0]}>
        <RigMesh geo={geo} rig={rig} />
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
  const st = layout.site.street;
  const z = (st.nearShoulder[0] + st.nearShoulder[1]) / 2 + 1.0;
  const gate = layout.compoundWalls.find((w) => w.kind === "gate");
  const a = gate ? (gate.a.x + gate.b.x) / 2 - 1.5 : layout.plot.polygon[0].x + 2;
  const b = layout.plot.rightX + 5;
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
  const st = layout.site.street;
  const z = (st.farShoulder[0] + st.farShoulder[1]) / 2 - 0.2;
  const [, x1] = tileXRange(layout, z);
  const x = Math.min(x1 - 9, layout.plot.rightX + 2);
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
      rotation={[0, -0.35, 0]}
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
