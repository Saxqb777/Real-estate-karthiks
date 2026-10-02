"use client";
// Low-poly street life: pedestrians (veshti + umbrella, saree, a running kid, a vegetable vendor with a cart),
// a stray dog napping by the gate, and a zebu cow grazing on the far verge. Frame-rate independent (clock based).
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { tileXRange } from "./Island";
import { G, PAL, std } from "./materials";
import { smoothstep, type World } from "./util";

type V3 = [number, number, number];

function Box({ p, s, c, r, cast = false, flat = false }: { p: V3; s: V3; c: string; r?: V3; cast?: boolean; flat?: boolean }) {
  return <mesh geometry={G.box()} material={std(c, { rough: 0.85, flat })} position={p} scale={s} rotation={r} castShadow={cast} />;
}
function Ball({ p, s, c, cast = false }: { p: V3; s: number | V3; c: string; cast?: boolean }) {
  return <mesh geometry={G.sphere()} material={std(c, { rough: 0.8 })} position={p} scale={s} castShadow={cast} />;
}
function Rod({ p, s, c, r }: { p: V3; s: V3; c: string; r?: V3 }) {
  return <mesh geometry={G.cyl()} material={std(c, { rough: 0.7 })} position={p} scale={s} rotation={r} />;
}

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

/** Faces +Z; legs swing about X. Height ≈ 5.4 ft at scale 1. */
export function Person({ rig, outfit, scale = 1 }: { rig: Rig; outfit: Outfit; scale?: number }) {
  const skin = outfit.skin ?? PAL.skin;
  const long = outfit.wrap === "veshti" || outfit.wrap === "saree";
  return (
    <group scale={scale}>
      <group ref={rig.body}>
        {[rig.legL, rig.legR].map((leg, i) => (
          <group key={i} ref={leg} position={[i ? 0.2 : -0.2, 2.65, 0]}>
            <Box p={[0, -1.2, 0]} s={[0.3, 2.4, 0.3]} c={outfit.wrap === "shorts" ? skin : outfit.wrap === "lungi" ? skin : outfit.bottom} />
            {outfit.wrap === "shorts" && <Box p={[0, -0.35, 0]} s={[0.36, 0.75, 0.36]} c={outfit.bottom} />}
            <Box p={[0, -2.42, 0.12]} s={[0.3, 0.16, 0.5]} c="#2b211b" />
          </group>
        ))}
        {long && (
          <mesh geometry={G.cyl()} material={std(outfit.bottom, { rough: 0.9 })} position={[0, 1.55, 0]} scale={[1.0, 2.3, 0.78]} castShadow />
        )}
        {outfit.wrap === "lungi" && <mesh geometry={G.cyl()} material={std(outfit.bottom, { rough: 0.9 })} position={[0, 2.05, 0]} scale={[0.98, 1.3, 0.75]} castShadow />}
        <Box p={[0, 3.6, 0]} s={[0.92, 1.75, 0.5]} c={outfit.top} cast />
        {outfit.wrap === "saree" && <Box p={[0.12, 3.75, 0.05]} s={[0.35, 2.0, 0.56]} r={[0, 0, 0.5]} c={outfit.bottom} />}
        {[rig.armL, rig.armR].map((arm, i) => (
          <group key={i} ref={arm} position={[i ? 0.6 : -0.6, 4.35, 0]}>
            <Box p={[0, -0.8, 0]} s={[0.22, 1.6, 0.24]} c={i === 1 && outfit.wrap === "saree" ? outfit.bottom : skin} />
          </group>
        ))}
        <Ball p={[0, 4.92, 0]} s={0.72} c={skin} />
        <Ball p={[0, 5.05, -0.06]} s={[0.76, 0.6, 0.74]} c={PAL.hair} />
        {outfit.hair === "bun" && <Ball p={[0, 4.95, -0.42]} s={0.34} c={PAL.hair} />}
        {outfit.jasmine && <Ball p={[0, 5.12, -0.4]} s={[0.42, 0.14, 0.2]} c="#fbfbf4" cast={false} />}
        {outfit.umbrella && (
          <group position={[0.35, 0, 0.1]}>
            <Rod p={[0, 5.6, 0]} s={[0.06, 2.4, 0.06]} c="#3a2a1c" />
            <mesh geometry={G.cone()} material={std("#141414", { rough: 0.6, flat: true })} position={[0, 7.0, 0]} scale={[3.6, 0.9, 3.6]} />
          </group>
        )}
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
    if (cartWheels.current) cartWheels.current.children.forEach((w) => (w.rotation.x = s / 1.1));
  });

  return (
    <group>
      <group ref={root}>
        <Person rig={rig} outfit={spec.outfit} />
        {spec.cart && (
          <group position={[0, 0, 3.2]}>
            <Box p={[0, 2.3, 0]} s={[3.0, 0.3, 4.2]} c="#7a4a26" cast />
            <Box p={[0, 2.75, -1.95]} s={[3.0, 0.6, 0.2]} c="#6b3f22" />
            <Rod p={[-1.2, 3.05, -2.6]} s={[0.12, 1.6, 0.12]} r={[0.9, 0, 0]} c="#6b3f22" />
            <Rod p={[1.2, 3.05, -2.6]} s={[0.12, 1.6, 0.12]} r={[0.9, 0, 0]} c="#6b3f22" />
            {[
              [-0.8, -1, "#3f8a35"],
              [0.6, -0.8, "#c0392b"],
              [-0.2, 0.4, "#e67e22"],
              [0.9, 0.8, "#3f8a35"],
              [-0.9, 1.2, "#f1c40f"],
              [0.1, -0.2, "#7cae3a"],
            ].map(([x, zz, c], i) => (
              <Ball key={i} p={[x as number, 2.75, zz as number]} s={0.8} c={c as string} />
            ))}
            <group ref={cartWheels}>
              {[-1.65, 1.65].map((x) => (
                <group key={x} position={[x, 1.1, 0]}>
                  <mesh geometry={G.cyl()} material={std("#3e2414", { rough: 0.8 })} rotation={[0, 0, Math.PI / 2]} scale={[2.2, 0.2, 2.2]} castShadow />
                </group>
              ))}
            </group>
          </group>
        )}
      </group>
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
  const trot = (Math.abs(b - a) / 5.5) as number;
  const period = (nap + trot) * 2;
  const coat = "#c48a52";
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
        <Box p={[0, 1.35, 0]} s={[1.9, 0.75, 0.62]} c={coat} cast />
        <group ref={head} position={[1.05, 1.65, 0]}>
          <Box p={[0.25, 0.1, 0]} s={[0.62, 0.55, 0.5]} c={coat} />
          <Box p={[0.68, -0.02, 0]} s={[0.36, 0.28, 0.32]} c="#a8713f" />
          <Box p={[0.85, 0.02, 0]} s={[0.08, 0.1, 0.12]} c="#1a1410" cast={false} />
          <mesh geometry={G.cone()} material={std("#8f5f33")} position={[0.15, 0.48, 0.16]} scale={[0.22, 0.32, 0.18]} />
          <mesh geometry={G.cone()} material={std("#8f5f33")} position={[0.15, 0.48, -0.16]} scale={[0.22, 0.32, 0.18]} />
        </group>
        <group ref={tail} position={[-0.95, 1.55, 0]}>
          <Box p={[-0.32, 0, 0]} s={[0.7, 0.12, 0.12]} c={coat} />
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
            <Box p={[0, -0.5, 0]} s={[0.17, 1.0, 0.17]} c={coat} />
          </group>
        ))}
      </group>
    </group>
  );
}

// ───────────────────────────── zebu cow ─────────────────────────────

export function Cow({ layout, world }: { layout: SiteLayout; world: World }) {
  const g = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const st = layout.site.street;
  const z = (st.farShoulder[0] + st.farShoulder[1]) / 2 - 0.2;
  const [, x1] = tileXRange(layout, z);
  const x = Math.min(x1 - 9, layout.plot.rightX + 2);
  const white = "#ece6da";
  const shade = "#cfc6b6";
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const graze = Math.sin(t * 0.35) > -0.2;
    if (neck.current) neck.current.rotation.z += ((graze ? -0.85 : 0.05) + Math.sin(t * 3) * (graze ? 0.05 : 0) - neck.current.rotation.z) * 0.04;
    if (tail.current) tail.current.rotation.x = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 5.1) * 0.12;
    if (g.current) g.current.position.x = world.x(x) + Math.sin(t * 0.05) * 1.5;
  });
  return (
    <group ref={g} position={[world.x(x), 0, world.z(z)]} rotation={[0, -0.35, 0]}>
      <Box p={[0, 3.0, 0]} s={[4.2, 1.9, 1.55]} c={white} cast />
      <Box p={[0, 2.25, 0]} s={[3.6, 0.5, 1.3]} c={shade} />
      <Ball p={[1.45, 4.05, 0]} s={[1.1, 0.9, 0.9]} c={white} />
      {[
        [1.6, 0.5],
        [1.6, -0.5],
        [-1.6, 0.5],
        [-1.6, -0.5],
      ].map(([lx, lz], i) => (
        <group key={i}>
          <Box p={[lx, 1.1, lz]} s={[0.36, 2.2, 0.36]} c={i < 2 ? white : shade} />
          <Box p={[lx, 0.12, lz]} s={[0.4, 0.24, 0.4]} c="#3a2e26" />
        </group>
      ))}
      <group ref={neck} position={[2.0, 3.4, 0]}>
        <Box p={[0.55, 0, 0]} s={[1.2, 0.85, 0.75]} c={white} />
        <Box p={[0.3, -0.55, 0]} s={[0.9, 0.5, 0.25]} c={shade} />
        <group position={[1.35, 0.05, 0]}>
          <Box p={[0.3, 0, 0]} s={[0.95, 0.75, 0.66]} c={white} />
          <Box p={[0.82, -0.12, 0]} s={[0.3, 0.42, 0.56]} c="#d9b8a6" />
          {[0.36, -0.36].map((hz, i) => (
            <group key={hz}>
              <mesh geometry={G.cone()} material={std("#d8c7a6")} position={[0.05, 0.6, hz]} rotation={[hz > 0 ? -0.35 : 0.35, 0, 0]} scale={[0.16, 0.7, 0.16]} castShadow />
              <mesh geometry={G.cone()} material={std(i ? "#2f6fb5" : "#c2185b")} position={[0.05, 0.98, hz * 1.35]} rotation={[hz > 0 ? -0.35 : 0.35, 0, 0]} scale={[0.1, 0.26, 0.1]} />
              <Box p={[0.05, 0.12, hz * 1.55]} s={[0.25, 0.14, 0.4]} c={shade} />
            </group>
          ))}
        </group>
      </group>
      <group ref={tail} position={[-2.1, 3.6, 0]}>
        <Box p={[0, -1.1, 0]} s={[0.1, 2.2, 0.1]} c={shade} />
        <Box p={[0, -2.25, 0]} s={[0.22, 0.45, 0.22]} c="#3a2e26" />
      </group>
    </group>
  );
}
