"use client";
// The property manager is a ROVER (owner 2/11/2026: "can we replace the property manager to this space robot", with a
// picture of a Mars exploration rover): a small six-wheeled rover — rocker-bogie legs, a gold body under a solar-cell
// deck, a white camera mast with its camera bar, a gold dish antenna, a thin radio rod and a folded instrument arm at
// the front. It drives the manager's slow round outside the compound wall (street-life.ts managerLoop / managerAt);
// at each corner it stops, turns in place and looks the house over with its mast camera. Clickable → the to-dos.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { bake, type Part, type V3 } from "./bake";
import type { Env } from "./env";
import { Hotspot } from "./Interact";
import { G } from "./materials";
import { managerAt, managerLoop } from "./street-life";
import type { World } from "./util";

/** Model units → feet: the solar deck spans ±1 unit, so the rover is ~2.1 ft wide and its mast ~3 ft tall. */
const SCALE = 1.05;
const WHEEL_R = 0.26;
const TRACK = 0.86; // wheel centres, ±x
const WHEEL_Z = [0.92, 0, -0.9];

const GOLD = "#b8914f";
const BRONZE = "#7a5a34";
const SILVER = "#c9ccd0";
const WHITE = "#ece8df";
const DARK = "#2a2a2e";

/** A box from a to b (thickness t) — legs, rods and arm segments. */
function seg(a: V3, b: V3, t: number, c: string): Part {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  return { g: "box", p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [t, t, L], c, r: [Math.atan2(-d[1], d[2]), Math.asin(d[0] / L), 0] };
}

/** Everything that doesn't move: body, legs, deck frame, mast, radio rod, folded arm. */
function chassisParts(): Part[] {
  const parts: Part[] = [
    // the warm box: gold foil with a bronze belly and dark seams
    { g: "box", p: [0, 0.88, 0.05], s: [1.18, 0.46, 1.5], c: GOLD },
    { g: "box", p: [0, 0.62, 0.05], s: [1.0, 0.12, 1.34], c: BRONZE },
    { g: "box", p: [0, 0.9, 0.81], s: [1.0, 0.32, 0.04], c: DARK },
    { g: "box", p: [0.3, 0.88, -0.71], s: [0.4, 0.3, 0.04], c: BRONZE },
    // deck frame under the cells
    { g: "box", p: [0, 1.14, 0], s: [1.96, 0.05, 1.86], c: SILVER },
    // camera mast (front-left of the deck): collar, white tube, elbow
    { g: "cyl", p: [-0.34, 1.24, 0.6], s: [0.24, 0.14, 0.24], c: SILVER },
    { g: "cyl", p: [-0.34, 1.95, 0.6], s: [0.14, 1.4, 0.14], c: WHITE },
    { g: "cyl", p: [-0.34, 2.68, 0.6], s: [0.2, 0.16, 0.2], c: WHITE },
    // thin radio rod (rear right) with its tip
    { g: "cyl", p: [0.62, 1.62, -0.7], s: [0.05, 0.9, 0.05], c: SILVER },
    { g: "cyl", p: [0.62, 2.1, -0.7], s: [0.08, 0.08, 0.08], c: DARK },
    // the dish's stand
    { g: "cyl", p: [0.42, 1.3, -0.3], s: [0.14, 0.26, 0.14], c: SILVER },
    // the instrument arm's shoulder (the arm itself moves: ArmParts)
    { g: "sphere", p: [-0.36, 0.78, 0.86], s: 0.13, c: SILVER },
  ];
  // rocker-bogie legs on both sides: body pivot → front wheel and → bogie pivot → middle + rear wheels
  for (const sx of [-1, 1]) {
    const x = sx * (TRACK - 0.06);
    const pivot: V3 = [sx * 0.66, 0.84, 0.2];
    const bogie: V3 = [x, 0.56, -0.45];
    parts.push(seg(pivot, [x, 0.72, 0.5], 0.07, SILVER));
    parts.push(seg([x, 0.72, 0.5], [x, WHEEL_R, WHEEL_Z[0]], 0.07, SILVER));
    parts.push(seg(pivot, bogie, 0.07, SILVER));
    parts.push(seg(bogie, [x, WHEEL_R, WHEEL_Z[1]], 0.06, SILVER));
    parts.push(seg(bogie, [x, WHEEL_R, WHEEL_Z[2]], 0.06, SILVER));
    parts.push({ g: "sphere", p: bogie, s: 0.1, c: DARK });
  }
  return parts;
}

/** Arm pieces, each along its own +z from its joint: upper arm, forearm, the instrument turret at the wrist. */
const UPPER = 0.66;
const FORE = 0.5;
const upperParts = (): Part[] => [{ g: "box", p: [0, 0, UPPER / 2], s: [0.08, 0.08, UPPER], c: WHITE }];
const foreParts = (): Part[] => [
  { g: "sphere", p: [0, 0, 0], s: 0.1, c: SILVER },
  { g: "box", p: [0, 0, FORE / 2], s: [0.07, 0.07, FORE], c: "#8d9a7c" },
  { g: "box", p: [0, -0.02, FORE + 0.06], s: [0.2, 0.18, 0.18], c: DARK },
  { g: "cyl", p: [0, -0.06, FORE + 0.19], s: [0.08, 0.12, 0.08], c: SILVER, r: [Math.PI / 2, 0, 0] },
  { g: "cyl", p: [0.07, -0.13, FORE + 0.06], s: [0.06, 0.1, 0.06], c: "#b8914f" },
];
/** Folded across the front (driving) ↔ reaching forward and down (examining a plant): shoulder yaw / pitch, elbow yaw / pitch. */
const ARM_FOLD = { sy: 1.12, sp: 0.44, ey: 2.1, ep: -0.55 };
const ARM_REACH = { sy: 0.34, sp: 0.38, ey: 0, ep: 0.45 };
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** One wheel (axle along x): dark tyre with cleats, a silver hub and an orange rim stripe, like the picture. */
function wheelParts(): Part[] {
  const ax: V3 = [0, 0, Math.PI / 2];
  const parts: Part[] = [
    { g: "cyl", p: [0, 0, 0], s: [WHEEL_R * 2, 0.22, WHEEL_R * 2], c: "#3a3532", r: ax },
    { g: "cyl", p: [0.115, 0, 0], s: [WHEEL_R * 1.5, 0.02, WHEEL_R * 1.5], c: "#a0552e", r: ax },
    { g: "cyl", p: [0.12, 0, 0], s: [WHEEL_R * 0.9, 0.03, WHEEL_R * 0.9], c: SILVER, r: ax },
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push({ g: "box", p: [0, Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R], s: [0.23, 0.035, 0.05], c: "#1f1c1a", r: [a, 0, 0] });
  }
  return parts;
}

/** The camera bar on top of the mast (origin = the pan joint). */
function headParts(): Part[] {
  return [
    { g: "box", p: [0, 0.1, 0], s: [0.16, 0.2, 0.16], c: WHITE },
    { g: "box", p: [0, 0.26, 0.02], s: [0.74, 0.16, 0.2], c: WHITE },
    { g: "box", p: [0, 0.35, 0.02], s: [0.6, 0.03, 0.16], c: SILVER },
    // two colour cameras at the ends, two navigation cameras in the middle
    ...[-0.29, 0.29].map((x): Part => ({ g: "box", p: [x, 0.26, 0.125], s: [0.13, 0.11, 0.03], c: "#141416" })),
    ...[-0.09, 0.09].map((x): Part => ({ g: "box", p: [x, 0.26, 0.125], s: [0.08, 0.07, 0.03], c: "#141416" })),
    ...[-0.29, 0.29].map((x): Part => ({ g: "cyl", p: [x, 0.26, 0.14], s: [0.07, 0.01, 0.07], c: "#38598c", r: [Math.PI / 2, 0, 0] })),
  ];
}

/** The gold dish antenna (origin = its gimbal, facing +y). */
function dishParts(): Part[] {
  return [
    { g: "box", p: [0, 0.06, 0], s: [0.12, 0.12, 0.12], c: SILVER },
    { g: "cyl", p: [0, 0.16, 0], s: [0.56, 0.07, 0.56], c: "#c9a45e" },
    { g: "cyl", p: [0, 0.2, 0], s: [0.46, 0.015, 0.46], c: "#d9b878" },
  ];
}

/** Solar cells: blue-black squares in a thin silver grid. */
const CELL_TEX = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#9aa1ab";
  g.fillRect(0, 0, 256, 256);
  const n = 8;
  const cell = 256 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const grad = g.createLinearGradient(i * cell, j * cell, (i + 1) * cell, (j + 1) * cell);
      grad.addColorStop(0, "#1c2436");
      grad.addColorStop(1, "#111725");
      g.fillStyle = grad;
      g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
})();
const CELL_MAT = new THREE.MeshStandardMaterial({ map: CELL_TEX, roughness: 0.32, metalness: 0.35 });
const BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.28 });

/** The deck: a centre panel plus two side wings that flare out a little, all cells (local +z = front). */
const DECK: { p: V3; s: V3; r: V3 }[] = [
  { p: [0, 1.18, 0], s: [1.2, 0.04, 1.84], r: [0, 0, 0] },
  { p: [-0.79, 1.17, -0.08], s: [0.42, 0.04, 1.62], r: [0, 0, 0.05] },
  { p: [0.79, 1.17, -0.08], s: [0.42, 0.04, 1.62], r: [0, 0, -0.05] },
];

export function Rover({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const chassis = useMemo(() => bake(chassisParts()), []);
  const wheel = useMemo(() => bake(wheelParts()), []);
  const head = useMemo(() => bake(headParts()), []);
  const dish = useMemo(() => bake(dishParts()), []);
  const upper = useMemo(() => bake(upperParts()), []);
  const fore = useMemo(() => bake(foreParts()), []);
  useEffect(() => () => [chassis, wheel, head, dish, upper, fore].forEach((g) => g.dispose()), [chassis, wheel, head, dish, upper, fore]);
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  const reach = useRef(0);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const pan = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const hga = useRef<THREE.Group>(null);
  const anchor = useMemo<V3>(() => [0, 5, 0], []);
  // the manager's round outside the wall: front grass → right side → behind the back → down the lane
  const loop = useMemo(() => managerLoop(layout), [layout]);
  const heading = useRef<number | null>(null);
  const look = useRef(0);
  const lookUp = useRef(0.12);
  const lastPick = useRef(0);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    // re-test the pointer a few times a second, so it lights up when it drives under a still cursor
    if (state.clock.elapsedTime - lastPick.current > 0.12) {
      lastPick.current = state.clock.elapsedTime;
      state.events.update?.();
    }
    const e = env.current;
    const s = managerAt(loop, e.t);
    const { x, z, dx, dz, stopped, walked } = s;
    const X = world.x(x);
    const Z = world.z(z);
    g.position.set(X, 0, Z);
    // turns in place at the corners (heading eases towards the next side)
    const want = Math.atan2(dx, -dz);
    if (heading.current === null) heading.current = want;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 2.2));
    g.rotation.y = heading.current;
    // wheels roll with the distance driven
    const roll = walked / (WHEEL_R * SCALE);
    for (const w of wheels.current) if (w) w.rotation.x = roll;
    // a slight jiggle over the grass while driving
    if (body.current) {
      body.current.position.y = stopped ? 0 : Math.abs(Math.sin(walked * 2.3)) * 0.018;
      body.current.rotation.z = stopped ? 0 : Math.sin(walked * 1.7) * 0.012;
    }
    // the mast camera: scans the way ahead while driving; at a stop it turns to what it stopped for — the house front,
    // up into the palm's crown, the back house, the banana plant — and pans / nods over it
    let yaw = Math.sin(e.t * 0.35) * 0.35;
    let pitch = 0.12;
    if (s.target && s.into > 0.6) {
      const tx = world.x(s.target.x) - X;
      const tz = world.z(s.target.z) - Z;
      const rel = Math.atan2(tx, tz) - heading.current;
      const scan = s.act === "look" ? Math.sin(s.into * 0.7) * 0.28 : 0;
      yaw = Math.atan2(Math.sin(rel), Math.cos(rel)) + scan;
      pitch = Math.max(-1.15, Math.min(0.7, Math.atan2(2.9 - s.target.y, Math.hypot(tx, tz)))) + (s.act === "look" ? Math.sin(s.into * 0.45) * 0.08 : 0);
    } else if (stopped) yaw = 0;
    look.current += (yaw - look.current) * (1 - Math.exp(-e.dt * 1.6));
    lookUp.current += (pitch - lookUp.current) * (1 - Math.exp(-e.dt * 1.4));
    if (pan.current) pan.current.rotation.y = look.current;
    if (tilt.current) tilt.current.rotation.x = lookUp.current;
    // the arm: unfolds towards the plant once the rover faces it, taps it gently, folds away before it drives on
    const want2 = s.act === "inspect" ? Math.min(smooth(1.8, 3.6, s.into), smooth(0.6, 2.6, s.left)) : 0;
    reach.current += (want2 - reach.current) * (1 - Math.exp(-e.dt * 6));
    const r = reach.current;
    const tap = s.act === "inspect" ? Math.max(0, Math.sin(s.into * 2.2)) * 0.08 * r : 0;
    if (shoulder.current) shoulder.current.rotation.set(ARM_FOLD.sp + (ARM_REACH.sp - ARM_FOLD.sp) * r, ARM_FOLD.sy + (ARM_REACH.sy - ARM_FOLD.sy) * r, 0, "YXZ");
    if (elbow.current) elbow.current.rotation.set(ARM_FOLD.ep + (ARM_REACH.ep - ARM_FOLD.ep) * r + tap, ARM_FOLD.ey + (ARM_REACH.ey - ARM_FOLD.ey) * r, 0, "YXZ");
    if (hga.current) hga.current.rotation.set(-0.5, e.t * 0.05, 0);
    anchor[0] = X;
    anchor[2] = Z;
  });
  return (
    <Hotspot spot={{ key: "noticeboard", kind: "noticeboard", anchor }}>
      <group ref={root}>
        <group scale={SCALE}>
          <group ref={body}>
            <mesh geometry={chassis} material={BODY_MAT} castShadow />
            {DECK.map((d, i) => (
              <mesh key={i} geometry={G.box()} material={CELL_MAT} position={d.p} scale={d.s} rotation={d.r} castShadow />
            ))}
            <group ref={pan} position={[-0.34, 2.76, 0.6]}>
              <group ref={tilt}>
                <mesh geometry={head} material={BODY_MAT} castShadow />
              </group>
            </group>
            <group ref={shoulder} position={[-0.36, 0.78, 0.86]}>
              <mesh geometry={upper} material={BODY_MAT} castShadow />
              <group ref={elbow} position={[0, 0, UPPER]}>
                <mesh geometry={fore} material={BODY_MAT} castShadow />
              </group>
            </group>
            <group position={[0.42, 1.43, -0.3]}>
              <group ref={hga}>
                <mesh geometry={dish} material={BODY_MAT} castShadow />
              </group>
            </group>
          </group>
          {WHEEL_Z.flatMap((wz, j) =>
            [-1, 1].map((sx) => (
              <group
                key={`${j}${sx}`}
                position={[sx * TRACK, WHEEL_R, wz]}
                rotation={[0, sx < 0 ? Math.PI : 0, 0]}
                ref={(el) => {
                  wheels.current[j * 2 + (sx < 0 ? 0 : 1)] = el;
                }}
              >
                <mesh geometry={wheel} material={BODY_MAT} castShadow />
              </group>
            )),
          )}
        </group>
        {/* generous click target round the rover */}
        <mesh geometry={G.box()} position={[0, 1.8, 0]} scale={[3.4, 3.8, 3.6]} visible={false} userData={{ pickFirst: true }} />
      </group>
    </Hotspot>
  );
}
