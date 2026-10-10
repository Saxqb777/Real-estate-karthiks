"use client";
// Low-poly life on the grass round the plot (no road): passers-by taking turns across the front grass — a veshti man
// with an umbrella, a saree lady (she reads the TO-LET board when the front house is empty), a man in a lungi — each
// stopping once to look at the houses, a lady strolling through the banana garden, a mother dog with her two pups on
// the lane side, a zebu cow grazing under the palms, and the tenant of each occupied house waiting beside its gate
// (a clickable world object). Every character is ONE draw call (rig.ts). WHERE everyone is comes from street-life.ts
// (pure, tested so nobody stands in anybody — owner, 9/10/2026); movement runs on scene time → frame-rate independent
// and slowed by focus dimming.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { BuildingSlot, SiteLayout } from "@/lib/site-layout";
import type { Env } from "./env";
import { Hotspot, spotKey, useScene, type V3 } from "./Interact";
import { gateNear } from "./gate-state";
import { EDGE_CLIP, G } from "./materials";
import { bake, ball, box, cone, rod, type Part } from "./bake";
import { SKIN, personLimbs, posePerson, rigGeometry, rigMaterials, type Limb, type Outfit, type RigMaterials } from "./rig";
import { blobTex } from "./textures";
import {
  WALKERS,
  cowSpot,
  dogFamily,
  gatePoint,
  legTimeline,
  managerAt,
  managerLoop,
  motherLook,
  photographerSpot,
  pupAt,
  streetSchedule,
  tenantAt,
  tenantRoute,
  tileXRange,
  walkerAt,
  type DogFamily as Family,
  type Leg,
  type PupAct,
  type WalkerPlan,
  type WalkSpec,
} from "./street-life";
import { smoothstep, type World } from "./util";

// ───────────────────────────── shared character mesh ─────────────────────────────

export function useRig(limbs: () => Limb[], deps: unknown[], o: { clip?: boolean } = {}): { geo: THREE.BufferGeometry; rig: RigMaterials } {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => rigGeometry(limbs()), deps);
  useEffect(() => () => geo.dispose(), [geo]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rig = useMemo(() => rigMaterials({ clip: o.clip }), []);
  useEffect(() => () => rig.dispose(), [rig]);
  return { geo, rig };
}

export function RigMesh({ geo, rig, cast = true }: { geo: THREE.BufferGeometry; rig: RigMaterials; cast?: boolean }) {
  return <mesh geometry={geo} material={rig.mat} customDepthMaterial={rig.depth} castShadow={cast} />;
}

// ───────────────────────────── people on the grass ─────────────────────────────

/** How each passer-by looks — the same order as WALKERS (street-life.ts says where they walk and stop). */
const WALKER_LOOKS: { outfit: Outfit; seed: number }[] = [
  { outfit: { top: "#f4f1ea", bottom: "#f7f4ec", wrap: "veshti", umbrella: true, towel: "#c9a46b" }, seed: 4 },
  { outfit: { top: "#e0a020", bottom: "#c2185b", wrap: "saree", hair: "bun", jasmine: true }, seed: 14 },
  { outfit: { top: "#8a2f5a", bottom: "#2e8b57", wrap: "saree", hair: "plait", jasmine: true, skin: SKIN.dark }, seed: 22 },
  { outfit: { top: "#f1e3c4", bottom: "#3b5c8f", wrap: "lungi", skin: SKIN.dark }, seed: 30 },
];

function Pedestrian({
  spec,
  plan,
  outfit,
  seed,
  layout,
  world,
  env,
  onGroup,
}: {
  spec: WalkSpec;
  plan: WalkerPlan;
  outfit: Outfit;
  seed: number;
  layout: SiteLayout;
  world: World;
  env: RefObject<Env>;
  onGroup?: (g: THREE.Group | null) => void;
}) {
  const { geo, rig } = useRig(() => personLimbs(outfit), [outfit], { clip: true });
  const root = useRef<THREE.Group>(null);
  const heading = useRef<number | null>(null);
  const walked = useRef(0);
  const look = useMemo(() => ({ x: world.x(layout.center.x), z: world.z(layout.center.z) }), [layout, world]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    const s = walkerAt(plan, e.t);
    if (!s.on) {
      // off stage between turns: they come back facing the way they walk
      g.visible = false;
      heading.current = null;
      return;
    }
    g.visible = true;
    const X = world.x(s.p.x);
    const Z = world.z(s.p.z);
    g.position.set(X, 0, Z);
    const stopped = !!s.stop;
    // face the way they walk (plan (dx, dz) → world (dx, −dz)); while stopped to look, turn to the houses
    const want = stopped && s.stop?.act === "look" ? Math.atan2(look.x - X, look.z - Z) : Math.atan2(s.dx, -s.dz);
    if (heading.current === null) heading.current = want;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 6));
    g.rotation.y = heading.current;
    if (!stopped) walked.current += spec.speed * e.dt;
    const phase = (walked.current / (spec.scale * 1.6)) * Math.PI;
    posePerson(rig.u, stopped ? "idle" : "walk", stopped ? 0 : phase, e.t, seed);
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
  const plans = useMemo(() => streetSchedule(layout), [layout]);
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
      {WALKERS.slice(0, count).map((w, i) => (
        <Pedestrian
          key={i}
          spec={w}
          plan={plans[i]}
          outfit={WALKER_LOOKS[i].outfit}
          seed={WALKER_LOOKS[i].seed}
          layout={layout}
          world={world}
          env={env}
          onGroup={(g) => movers?.set(`ped${i}`, g, 1.7 * w.scale)}
        />
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
  // the gate itself (its sign sits 2.6 ft outside it: in front of Gate A, on the lane side of Gate B)
  const gx = gateAt?.x;
  const gz = gateAt?.z;
  const gs = !!gateAt?.side;
  const gate = useMemo(() => (gx === undefined || gz === undefined ? null : gatePoint({ x: gx, z: gz, side: gs })), [gx, gz, gs]);
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
      const s = tenantAt(tl, e.t, index);
      x = s.x;
      z = s.z;
      y = s.y;
      moving = s.moving;
      dx = s.dx;
      dz = s.dz;
      look = s.look;
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
    // waiting by the gate they face it; on the terrace they look out front; else the way they walk
    const want = look === "front" ? 0 : look === "gate" && gate ? Math.atan2(gate.x - x, -(gate.z - z)) : Math.atan2(dx, -dz);
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

// ───────────────────────────── the dog family ─────────────────────────────

const INK = "#16110d";

/** The mother: a big fawn Indian street dog lying sphinx-style (legs baked folded), head up on a turning neck, tail curled
 *  round to her right. Limbs: 0 body, 1 head (turns), 2 tail (sweeps). Model x = ahead, z = her right. */
function motherLimbs(): Limb[] {
  const coat = "#c78f57";
  const saddle = "#ad7643";
  const cream = "#eed6ad";
  const paw = "#e0bf8c";
  const dark = "#94612f";
  const sph = (p: V3, sc: V3, c: string, r?: V3): Part => ({ g: "sphere", p, s: sc, c, r });
  const across = Math.PI / 2; // a rod lying along x
  return [
    {
      parts: [
        sph([0.15, 0.46, 0], [2.3, 0.86, 0.94], coat),
        sph([0.1, 0.6, 0], [1.9, 0.62, 0.66], saddle),
        sph([-0.8, 0.44, 0], [1.15, 0.8, 0.98], coat),
        sph([-0.78, 0.36, 0.46], [0.95, 0.64, 0.42], coat),
        sph([-0.78, 0.36, -0.46], [0.95, 0.64, 0.42], coat),
        sph([-0.3, 0.08, 0.6], [0.36, 0.14, 0.2], paw),
        sph([-0.3, 0.08, -0.6], [0.36, 0.14, 0.2], paw),
        // forelegs stretched out in front, paws on the grass
        rod([1.15, 0.12, 0.24], [0.22, 0.9, 0.24], coat, [0, 0, across]),
        rod([1.15, 0.12, -0.24], [0.22, 0.9, 0.24], coat, [0, 0, across]),
        sph([1.66, 0.09, 0.24], [0.3, 0.16, 0.26], paw),
        sph([1.66, 0.09, -0.24], [0.3, 0.16, 0.26], paw),
        sph([0.98, 0.5, 0], [0.62, 0.66, 0.66], cream),
        sph([1.02, 0.92, 0], [0.56, 0.86, 0.52], coat, [0, 0, -0.5]),
      ],
    },
    {
      parts: [
        sph([1.36, 1.43, 0], [0.62, 0.55, 0.56], coat),
        box([1.78, 1.32, 0], [0.44, 0.26, 0.3], cream),
        box([2.01, 1.37, 0], [0.09, 0.11, 0.14], INK),
        sph([1.6, 1.5, 0.17], [0.07, 0.07, 0.07], INK),
        sph([1.6, 1.5, -0.17], [0.07, 0.07, 0.07], INK),
        cone([1.28, 1.8, 0.17], [0.22, 0.36, 0.15], dark, [0.25, 0, 0]),
        cone([1.28, 1.8, -0.17], [0.22, 0.36, 0.15], dark, [-0.25, 0, 0]),
      ],
      pivot: [1.12, 1.2, 0],
      axis: [0, 1, 0],
    },
    {
      // the tail lies curled round to her right, a pale tip
      parts: [rod([-1.575, 0.17, 0.225], [0.17, 0.66, 0.17], coat, [0, 0.568, across]), rod([-1.775, 0.11, 0.625], [0.15, 0.5, 0.15], coat, [0, 1.892, across]), sph([-1.69, 0.1, 0.86], [0.17, 0.14, 0.17], cream)],
      pivot: [-1.3, 0.2, 0],
      axis: [0, 1, 0],
    },
  ];
}

/** A pup standing (round belly, big head, floppy ears). Limbs: 0 body, 1–4 legs (front-right, front-left, hind-right,
 *  hind-left), 5 tail (wags), 6 head (nods). */
function pupLimbs(coat: string, cream: string, ears: string): () => Limb[] {
  return () => {
    const leg = (x: number, z: number): Limb => ({ parts: [box([x, 0.25, z], [0.15, 0.42, 0.15], coat), box([x + 0.03, 0.04, z], [0.18, 0.08, 0.17], cream)], pivot: [x, 0.46, z], axis: [0, 0, 1] });
    return [
      { parts: [{ g: "sphere", p: [0, 0.6, 0], s: [0.95, 0.52, 0.54], c: coat }, { g: "sphere", p: [0.3, 0.6, 0], s: [0.4, 0.42, 0.42], c: cream }] },
      leg(0.27, 0.14),
      leg(0.27, -0.14),
      leg(-0.27, 0.14),
      leg(-0.27, -0.14),
      { parts: [box([-0.54, 0.8, 0], [0.28, 0.08, 0.08], coat, [0, 0, -0.7])], pivot: [-0.45, 0.72, 0], axis: [0, 1, 0] },
      {
        parts: [
          { g: "sphere", p: [0.55, 0.96, 0], s: [0.5, 0.46, 0.48], c: coat },
          box([0.8, 0.88, 0], [0.2, 0.15, 0.19], cream),
          box([0.91, 0.91, 0], [0.05, 0.06, 0.08], INK),
          { g: "sphere", p: [0.74, 1.0, 0.11], s: 0.055, c: INK },
          { g: "sphere", p: [0.74, 1.0, -0.11], s: 0.055, c: INK },
          box([0.5, 1.05, 0.25], [0.14, 0.2, 0.06], ears, [-0.5, 0, 0]),
          box([0.5, 1.05, -0.25], [0.14, 0.2, 0.06], ears, [0.5, 0, 0]),
        ],
        pivot: [0.38, 0.8, 0],
        axis: [0, 0, 1],
      },
    ];
  };
}

/** One fawn pup like its mother, one cream pup with fawn ears. */
const PUP_LOOKS = [pupLimbs("#d09a60", "#f0dcb4", "#a46d3c"), pupLimbs("#efe2c8", "#fbf4e4", "#c48a52")];

/**
 * The dog family on the lane side (owner, 9/10/2026): the mother lies by the banana garden — breathing, her tail
 * sweeping, her head following whichever pup is up — and her two pups nap against her right flank, wake, play-bow, chase
 * each other round her and flop down again (street-life.ts dogFamily / pupAt). Not clickable.
 */
export function DogFamily({ layout, world, env, movers }: { layout: SiteLayout; world: World; env: RefObject<Env>; movers?: MoverRegistry }) {
  const fam = useMemo(() => dogFamily(layout), [layout]);
  const mother = useRig(motherLimbs, []);
  const look = useRef<number | null>(null);
  useFrame(() => {
    const A = mother.rig.u.uAng.value;
    const e = env.current;
    const T = e.t;
    const want = motherLook(fam, T);
    look.current = look.current === null ? want : look.current + (want - look.current) * (1 - Math.exp(-e.dt * 3));
    A[1] = look.current;
    const playing = pupAt(fam, 1, T).act !== "nap";
    A[2] = playing ? Math.sin(T * 5) * 0.22 : Math.sin(T * 0.7) * 0.1;
    mother.rig.u.uShift.value.set(0, Math.sin(T * 1.7) * 0.012, 0);
  });
  return (
    <group>
      <group
        name="dog-family"
        ref={(o) => movers?.set("dog", o, 1.8)}
        position={[world.x(fam.x), 0, world.z(fam.z)]}
        rotation={[0, Math.atan2(fam.fz, fam.fx), 0]}
      >
        <RigMesh geo={mother.geo} rig={mother.rig} />
      </group>
      <Pup fam={fam} index={0} world={world} env={env} movers={movers} />
      <Pup fam={fam} index={1} world={world} env={env} movers={movers} />
    </group>
  );
}

function Pup({ fam, index, world, env, movers }: { fam: Family; index: 0 | 1; world: World; env: RefObject<Env>; movers?: MoverRegistry }) {
  const { geo, rig } = useRig(PUP_LOOKS[index], [index]);
  const g = useRef<THREE.Group | null>(null);
  const heading = useRef<number | null>(null);
  const walked = useRef(0);
  useFrame(() => {
    const o = g.current;
    if (!o) return;
    const e = env.current;
    const T = e.t;
    const s = pupAt(fam, index, T);
    o.position.set(world.x(s.x), 0, world.z(s.z));
    const want = Math.atan2(s.hz, s.hx);
    if (heading.current === null) heading.current = want;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 9));
    o.rotation.y = heading.current;
    walked.current += s.speed * e.dt;
    posePup(rig.u, s.act, s.k, T + index * 1.7, walked.current);
  });
  return (
    <group
      ref={(o) => {
        g.current = o;
        movers?.set(`pup${index}`, o, 0.75);
      }}
    >
      <RigMesh geo={geo} rig={rig} />
    </group>
  );
}

/** Folded legs + lowered body while napping (blended while getting up / lying down), a play-bow, a trot or a bounding run. */
function posePup(u: RigMaterials["u"], act: PupAct, k: number, T: number, walked: number) {
  const A = u.uAng.value;
  const fold = act === "nap" ? 1 : act === "wake" ? 1 - smoothstep(0, 1, k) : act === "settle" ? smoothstep(0, 1, k) : 0;
  let y = -0.3 * fold;
  const ph = (walked / 0.45) * Math.PI;
  if (act === "trot") {
    const sw = Math.sin(ph) * 0.55;
    A[1] = A[4] = sw;
    A[2] = A[3] = -sw;
    A[5] = Math.sin(T * 10) * 0.5;
    A[6] = Math.sin(ph * 2) * 0.05;
    y += Math.abs(Math.sin(ph)) * 0.04;
  } else if (act === "run") {
    const sw = Math.sin(ph) * 0.85;
    A[1] = A[2] = sw;
    A[3] = A[4] = -sw;
    A[5] = Math.sin(T * 12) * 0.25;
    A[6] = -0.1;
    y += Math.max(0, Math.sin(ph)) * 0.12;
  } else if (act === "bow") {
    // front down, rear up, tail going like mad
    A[1] = A[2] = 1.1;
    A[3] = A[4] = 0;
    A[5] = Math.sin(T * 16) * 0.7;
    A[6] = 0.3 + Math.sin(T * 3) * 0.08;
    y = -0.12 + Math.abs(Math.sin(T * 4)) * 0.03;
  } else {
    // nap / waking / lying down: front paws out in front, hind legs tucked under, head resting, tail along the side
    A[1] = A[2] = A[3] = A[4] = 1.45 * fold;
    A[5] = 0.6 * fold + Math.sin(T * 3) * 0.3 * (1 - fold);
    A[6] = -0.25 * fold;
    y += Math.sin(T * 2.6) * 0.012 * fold;
  }
  u.uShift.value.set(0, y, 0);
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
  const { x, z } = useMemo(() => cowSpot(layout), [layout]);
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
  // a loop outside the wall: front grass → right passage → behind the back → down the lane (street-life.ts)
  const loop = useMemo(() => managerLoop(layout), [layout]);
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
    const { x, z, dx, dz, writing, walked } = managerAt(loop, e.t);
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

// ───────────────────────────── angry policeman guarding the tax collector's moped ─────────────────────────────

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
 * The policeman guarding the tax collector's moped and its cash box: legs apart, left hand on the hip, tapping his
 * lathi, slowly turning to scan the grounds with a scowl. Placed in the moped's frame (see TaxCollector.tsx).
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
 * scale): he stands at the camera and takes two pictures every 15 s — each shot FLASHES (white burst + a quick point light).
 * Clickable (kind "photographer") → his window shows the front unit's interior photos (hud/PhotosPanel).
 */
export function Photographer({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const { geo, rig } = useRig(photographerLimbs, []);
  const stand = useMemo(() => tripodParts(), []);
  const root = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);
  const spot = useMemo(() => {
    const p = photographerSpot(layout); // between the pump (D·0.2) and the banana clumps (D·0.36)
    const front = layout.slots.find((s) => s.slot === "front");
    const aim = front ? { x: (front.rect.x0 + front.rect.x1) / 2, z: (front.rect.z0 + front.rect.z1) / 2 } : { x: p.x + 10, z: p.z };
    const X = world.x(p.x);
    const Z = world.z(p.z);
    return { X, Z, yaw: Math.atan2(world.x(aim.x) - X, world.z(aim.z) - Z) };
  }, [layout, world]);
  // owner, 6/10/2026: no leaning in, no turning the stand — he just stands at the camera; every 15 s two clicks, two flashes
  const CYCLE = 15;
  const SHOTS = [1.2, 2.6]; // two clicks, two flashes (owner)
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    const t = e.t - Math.floor(e.t / CYCLE) * CYCLE;
    g.rotation.y = spot.yaw;
    posePerson(rig.u, "idle", 0, e.t, 4.1);
    // right hand to the shutter button for the click, then back down
    const press = t < 0.5 ? smoothstep(0, 0.5, t) : t < 3.2 ? 1 : t < 3.7 ? 1 - smoothstep(3.2, 3.7, t) : 0;
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
  const anchor = useMemo<V3>(() => [spot.X, 7.4, spot.Z], [spot]);
  return (
    <Hotspot spot={{ key: "photographer", kind: "photographer", anchor }}>
      <group ref={root} position={[spot.X, 0, spot.Z]}>
        <RigMesh geo={geo} rig={rig} />
        {/* generous click target: the man and his stand */}
        <mesh geometry={G.box()} position={[0, 3.2, 0.8]} scale={[3.4, 6.8, 3.6]} visible={false} userData={{ pickFirst: true }} />
        <group position={[0, 0, 1.6]}>
          <StandMesh parts={stand} />
          {/* the flash burst at the flash unit: a soft white glow (not a ball) */}
          <sprite ref={flash} position={[0.18, 5.23, 0.3]} visible={false}>
            <spriteMaterial map={FLASH_TEX} color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <pointLight ref={light} position={[0.18, 5.23, 0.8]} color="#f4f7ff" intensity={0} distance={22} decay={2} />
        </group>
      </group>
    </Hotspot>
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
