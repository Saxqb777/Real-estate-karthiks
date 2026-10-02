"use client";
// Low-poly street life: pedestrians (veshti + umbrella, saree with jasmine, a running kid, a vegetable vendor with
// a cart), a stray dog napping by the gate, and a zebu cow with painted horns grazing on the far verge.
// Each rigid part is baked into one vertex-coloured mesh (bake.ts) → a handful of draw calls per character.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { ball, box, cone, rod, type Part } from "./bake";
import { Baked } from "./Baked";
import { tileXRange } from "./Island";
import { PAL } from "./materials";
import { smoothstep, type World } from "./util";

// ───────────────────────────── person rig ─────────────────────────────

export interface Rig {
  body: RefObject<THREE.Group | null>;
  legL: RefObject<THREE.Group | null>;
  legR: RefObject<THREE.Group | null>;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
}
function useRig(): Rig {
  return { body: useRef(null), legL: useRef(null), legR: useRef(null), armL: useRef(null), armR: useRef(null) };
}

export interface Outfit {
  top: string;
  bottom: string;
  /** "veshti" / "saree" = long wrap hiding the legs; "shorts" = kid; "lungi" = knee length */
  wrap: "veshti" | "saree" | "shorts" | "lungi";
  skin?: string;
  hair?: "short" | "bun";
  umbrella?: boolean;
  jasmine?: boolean;
}

function personParts(o: Outfit) {
  const skin = o.skin ?? PAL.skin;
  const long = o.wrap === "veshti" || o.wrap === "saree";
  const leg: Part[] = [box([0, -1.2, 0], [0.3, 2.4, 0.3], o.wrap === "shorts" || o.wrap === "lungi" ? skin : o.bottom), box([0, -2.42, 0.12], [0.3, 0.16, 0.5], "#2b211b")];
  if (o.wrap === "shorts") leg.push(box([0, -0.35, 0], [0.36, 0.75, 0.36], o.bottom));
  const body: Part[] = [box([0, 3.6, 0], [0.92, 1.75, 0.5], o.top), ball([0, 4.92, 0], 0.72, skin), ball([0, 5.05, -0.06], [0.76, 0.6, 0.74], PAL.hair)];
  if (long) body.push(rod([0, 1.55, 0], [1.0, 2.3, 0.78], o.bottom));
  if (o.wrap === "lungi") body.push(rod([0, 2.05, 0], [0.98, 1.3, 0.75], o.bottom));
  if (o.wrap === "saree") body.push(box([0.12, 3.75, 0.05], [0.35, 2.0, 0.56], o.bottom, [0, 0, 0.5]));
  if (o.hair === "bun") body.push(ball([0, 4.95, -0.42], 0.34, PAL.hair));
  if (o.jasmine) body.push(ball([0, 5.12, -0.4], [0.42, 0.14, 0.2], "#fbfbf4"));
  if (o.umbrella) body.push(rod([0.35, 5.6, 0.1], [0.06, 2.4, 0.06], "#3a2a1c"), cone([0.35, 7.0, 0.1], [3.6, 0.9, 3.6], "#141414"));
  const arm = (c: string): Part[] => [box([0, -0.8, 0], [0.22, 1.6, 0.24], c)];
  return { leg, body, armL: arm(skin), armR: arm(o.wrap === "saree" ? o.bottom : skin) };
}

/** Faces +Z; legs swing about X. Height ≈ 5.4 ft at scale 1. */
export function Person({ rig, outfit, scale = 1 }: { rig: Rig; outfit: Outfit; scale?: number }) {
  const parts = useMemo(() => personParts(outfit), [outfit]);
  return (
    <group scale={scale}>
      <group ref={rig.body}>
        {[rig.legL, rig.legR].map((leg, i) => (
          <group key={i} ref={leg} position={[i ? 0.2 : -0.2, 2.65, 0]}>
            <Baked parts={parts.leg} />
          </group>
        ))}
        <Baked parts={parts.body} cast />
        <group ref={rig.armL} position={[-0.6, 4.35, 0]}>
          <Baked parts={parts.armL} />
        </group>
        <group ref={rig.armR} position={[0.6, 4.35, 0]}>
          <Baked parts={parts.armR} />
        </group>
      </group>
    </group>
  );
}

/** Walk cycle: phase in radians, amplitude by gait. */
function poseWalk(rig: Rig, phase: number, amp: number, bob: number, armsForward = false) {
  const sw = Math.sin(phase) * amp;
  if (rig.legL.current) rig.legL.current.rotation.x = sw;
  if (rig.legR.current) rig.legR.current.rotation.x = -sw;
  if (rig.armL.current) rig.armL.current.rotation.x = armsForward ? -1.2 : -sw * 0.8;
  if (rig.armR.current) rig.armR.current.rotation.x = armsForward ? -1.2 : sw * 0.8;
  if (rig.body.current) rig.body.current.position.y = Math.abs(Math.cos(phase)) * bob;
}

// ───────────────────────────── pedestrians ─────────────────────────────

interface PedSpec {
  outfit: Outfit;
  scale: number;
  speed: number;
  dir: 1 | -1;
  lane: "near" | "far";
  offset: number;
  wait: number;
  stopAtGate?: boolean;
  amp?: number;
  cart?: boolean;
}

const PEDS: PedSpec[] = [
  { outfit: { top: "#f4f1ea", bottom: "#f7f4ec", wrap: "veshti", umbrella: true }, scale: 1, speed: 3.4, dir: 1, lane: "near", offset: 0, wait: 9, stopAtGate: true },
  { outfit: { top: "#e0a020", bottom: "#c2185b", wrap: "saree", hair: "bun", jasmine: true }, scale: 0.96, speed: 3.1, dir: -1, lane: "near", offset: 11, wait: 7 },
  { outfit: { top: "#2f6fb5", bottom: "#24324a", wrap: "shorts", skin: PAL.skinDark }, scale: 0.62, speed: 7.5, dir: 1, lane: "far", offset: 5, wait: 14, amp: 0.9 },
  { outfit: { top: "#f1e3c4", bottom: "#3b5c8f", wrap: "lungi", skin: PAL.skinDark }, scale: 1, speed: 2.4, dir: -1, lane: "far", offset: 19, wait: 12, cart: true },
  { outfit: { top: "#8a2f5a", bottom: "#2e8b57", wrap: "saree", hair: "bun", jasmine: true, skin: PAL.skinDark }, scale: 0.95, speed: 2.9, dir: 1, lane: "far", offset: 27, wait: 10 },
];

const CART: Part[] = [
  box([0, 2.3, 0], [3.0, 0.3, 4.2], "#7a4a26"),
  box([0, 2.75, -1.95], [3.0, 0.6, 0.2], "#6b3f22"),
  rod([-1.2, 3.05, -2.6], [0.12, 1.6, 0.12], "#6b3f22", [0.9, 0, 0]),
  rod([1.2, 3.05, -2.6], [0.12, 1.6, 0.12], "#6b3f22", [0.9, 0, 0]),
  ...(
    [
      [-0.8, -1, "#3f8a35"],
      [0.6, -0.8, "#c0392b"],
      [-0.2, 0.4, "#e67e22"],
      [0.9, 0.8, "#3f8a35"],
      [-0.9, 1.2, "#f1c40f"],
      [0.1, -0.2, "#7cae3a"],
    ] as const
  ).map(([x, z, c]) => ball([x, 2.75, z], 0.8, c)),
];
const CART_WHEELS: Part[] = [-1.65, 1.65].flatMap((x) => [rod([x, 0, 0], [2.2, 0.2, 2.2], "#3e2414", [0, 0, Math.PI / 2]), box([x * 1.06, 0, 0], [0.06, 1.8, 0.25], "#9a7b52")]);

function Pedestrian({ spec, layout, world }: { spec: PedSpec; layout: SiteLayout; world: World }) {
  const rig = useRig();
  const root = useRef<THREE.Group>(null);
  const cartWheels = useRef<THREE.Group>(null);
  const st = layout.site.street;
  const z = spec.lane === "near" ? (st.nearShoulder[0] + st.nearShoulder[1]) / 2 - 0.6 : (st.farShoulder[0] + st.farShoulder[1]) / 2 + 0.4;
  const [x0, x1] = tileXRange(layout, z);
  const gate = layout.compoundWalls.find((w) => w.kind === "gate");
  const gateX = gate ? (gate.a.x + gate.b.x) / 2 : (x0 + x1) / 2;
  const pause = spec.stopAtGate ? 4.5 : 0;
  const span = x1 - x0 - 2;
  const walkT = span / spec.speed;
  const period = walkT + pause + spec.wait;
  const gateS = spec.dir > 0 ? gateX - (x0 + 1) : x1 - 1 - gateX;

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const tt = (clock.elapsedTime + spec.offset) % period;
    let s: number;
    let stopped = false;
    if (tt < gateS / spec.speed || !spec.stopAtGate) s = tt * spec.speed;
    else if (tt < gateS / spec.speed + pause) {
      s = gateS;
      stopped = true;
    } else s = (tt - pause) * spec.speed;
    if (s > span) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const x = spec.dir > 0 ? x0 + 1 + s : x1 - 1 - s;
    const k = smoothstep(0, 2.5, Math.min(s, span - s));
    g.position.set(world.x(x), 0, world.z(z));
    g.scale.setScalar(spec.scale * Math.max(0.001, k));
    const heading = stopped ? Math.PI : spec.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.y += (heading - g.rotation.y) * 0.15;
    if (stopped) poseWalk(rig, 0, 0, 0);
    else poseWalk(rig, (s / (spec.scale * 1.6)) * Math.PI, spec.amp ?? 0.42, spec.amp ? 0.25 : 0.1, !!spec.cart);
    if (cartWheels.current) cartWheels.current.rotation.x = s / 1.1;
  });

  return (
    <group ref={root}>
      <Person rig={rig} outfit={spec.outfit} />
      {spec.cart && (
        <group position={[0, 0, 3.2]}>
          <Baked parts={CART} cast />
          <group ref={cartWheels} position={[0, 1.1, 0]}>
            <Baked parts={CART_WHEELS} />
          </group>
        </group>
      )}
    </group>
  );
}

export function Pedestrians({ layout, world, count }: { layout: SiteLayout; world: World; count: number }) {
  return (
    <group>
      {PEDS.slice(0, count).map((p, i) => (
        <Pedestrian key={i} spec={p} layout={layout} world={world} />
      ))}
    </group>
  );
}

// ───────────────────────────── stray dog ─────────────────────────────

const COAT = "#c48a52";
const DOG_BODY: Part[] = [box([0, 1.35, 0], [1.9, 0.75, 0.62], COAT)];
const DOG_HEAD: Part[] = [
  box([0.25, 0.1, 0], [0.62, 0.55, 0.5], COAT),
  box([0.68, -0.02, 0], [0.36, 0.28, 0.32], "#a8713f"),
  box([0.85, 0.02, 0], [0.08, 0.1, 0.12], "#1a1410"),
  cone([0.15, 0.48, 0.16], [0.22, 0.32, 0.18], "#8f5f33"),
  cone([0.15, 0.48, -0.16], [0.22, 0.32, 0.18], "#8f5f33"),
];
const DOG_TAIL: Part[] = [box([-0.32, 0, 0], [0.7, 0.12, 0.12], COAT)];
const DOG_LEG: Part[] = [box([0, -0.5, 0], [0.17, 1.0, 0.17], COAT)];

export function Dog({ layout, world }: { layout: SiteLayout; world: World }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const st = layout.site.street;
  const z = (st.nearShoulder[0] + st.nearShoulder[1]) / 2 + 0.9;
  const gate = layout.compoundWalls.find((w) => w.kind === "gate");
  const a = gate ? (gate.a.x + gate.b.x) / 2 - 1.5 : layout.plot.polygon[0].x + 2;
  const b = layout.plot.rightX + 5;
  const nap = 16;
  const trot = Math.abs(b - a) / 5.5;
  const period = (nap + trot) * 2;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % period;
    let x: number;
    let moving = false;
    let dir = 1;
    if (t < nap) x = a;
    else if (t < nap + trot) {
      x = a + (b - a) * ((t - nap) / trot);
      moving = true;
    } else if (t < nap * 2 + trot) {
      x = b;
      dir = -1;
    } else {
      x = b + (a - b) * ((t - nap * 2 - trot) / trot);
      moving = true;
      dir = -1;
    }
    if (!g.current || !body.current || !legs.current || !tail.current || !head.current) return;
    g.current.position.set(world.x(x), 0, world.z(z));
    g.current.rotation.y = moving ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? 0.4 : Math.PI - 0.4;
    const T = clock.elapsedTime;
    if (moving) {
      body.current.position.y = 0;
      body.current.scale.y = 1;
      legs.current.visible = true;
      legs.current.children.forEach((l, i) => (l.rotation.z = Math.sin(T * 12 + (i % 2) * Math.PI + (i > 1 ? Math.PI / 2 : 0)) * 0.6));
      tail.current.rotation.z = 0.9 + Math.sin(T * 14) * 0.35;
      head.current.rotation.z = 0;
    } else {
      body.current.position.y = -0.62;
      body.current.scale.y = 1 + Math.sin(T * 2.2) * 0.04;
      legs.current.visible = false;
      tail.current.rotation.z = 0.2;
      head.current.rotation.z = -0.35;
    }
  });
  return (
    <group ref={g}>
      <group ref={body}>
        <Baked parts={DOG_BODY} cast />
        <group ref={head} position={[1.05, 1.65, 0]}>
          <Baked parts={DOG_HEAD} />
        </group>
        <group ref={tail} position={[-0.95, 1.55, 0]}>
          <Baked parts={DOG_TAIL} />
        </group>
      </group>
      <group ref={legs}>
        {[
          [0.7, 0.2],
          [0.7, -0.2],
          [-0.7, 0.2],
          [-0.7, -0.2],
        ].map(([x, zz], i) => (
          <group key={i} position={[x, 1.05, zz]}>
            <Baked parts={DOG_LEG} />
          </group>
        ))}
      </group>
    </group>
  );
}

// ───────────────────────────── zebu cow ─────────────────────────────

const WHITE = "#ece6da";
const SHADE = "#cfc6b6";
const COW_BODY: Part[] = [
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
];
const COW_HEAD: Part[] = [
  box([0.55, 0, 0], [1.2, 0.85, 0.75], WHITE),
  box([0.3, -0.55, 0], [0.9, 0.5, 0.25], SHADE),
  box([1.65, 0.05, 0], [0.95, 0.75, 0.66], WHITE),
  box([2.17, -0.07, 0], [0.3, 0.42, 0.56], "#d9b8a6"),
  ...[0.36, -0.36].flatMap((hz, i) => [
    cone([1.4, 0.65, hz], [0.16, 0.7, 0.16], "#d8c7a6", [hz > 0 ? -0.35 : 0.35, 0, 0]),
    cone([1.4, 1.03, hz * 1.35], [0.1, 0.26, 0.1], i ? "#2f6fb5" : "#c2185b", [hz > 0 ? -0.35 : 0.35, 0, 0]),
    box([1.4, 0.17, hz * 1.55], [0.25, 0.14, 0.4], SHADE),
  ]),
];
const COW_TAIL: Part[] = [box([0, -1.1, 0], [0.1, 2.2, 0.1], SHADE), box([0, -2.25, 0], [0.22, 0.45, 0.22], "#3a2e26")];

export function Cow({ layout, world }: { layout: SiteLayout; world: World }) {
  const g = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const st = layout.site.street;
  const z = (st.farShoulder[0] + st.farShoulder[1]) / 2 - 0.2;
  const [, x1] = tileXRange(layout, z);
  const x = Math.min(x1 - 9, layout.plot.rightX + 2);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + 3.7;
    const graze = Math.sin(t * 0.35) > -0.2;
    if (neck.current) neck.current.rotation.z += ((graze ? -0.85 : 0.05) + Math.sin(t * 3) * (graze ? 0.05 : 0) - neck.current.rotation.z) * 0.04;
    if (tail.current) tail.current.rotation.x = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 5.1) * 0.12;
    if (g.current) g.current.position.x = world.x(x) + Math.sin(t * 0.05) * 1.5;
  });
  return (
    <group ref={g} position={[world.x(x), 0, world.z(z)]} rotation={[0, -0.35, 0]}>
      <Baked parts={COW_BODY} cast />
      <group ref={neck} position={[2.0, 3.4, 0]}>
        <Baked parts={COW_HEAD} />
      </group>
      <group ref={tail} position={[-2.1, 3.6, 0]}>
        <Baked parts={COW_TAIL} />
      </group>
    </group>
  );
}
