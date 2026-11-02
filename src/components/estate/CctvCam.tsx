"use client";
// CCTV camera (owner 2/11/2026: "replace the cctv for the camera man so remove him"): a white bullet camera on a wall
// bracket on top of the lane-wall pillar facing 116/B7's veranda — nearest the default view, nothing else clickable there —
// watching the lane, with a black lens front and a blinking red light, slowly panning across the front house. Clickable
// (kind "photographer", key unchanged) → the interior photos window. Scenery, not life: it stays with Life off.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { bake, type Part } from "./bake";
import type { Env } from "./env";
import { Hotspot, type V3 } from "./Interact";
import { G } from "./materials";
import { WALL_H } from "./PlotGround";
import { blobTex } from "./textures";
import type { World } from "./util";

const SCALE = 3.2; // cartoon scale, so it reads from the default camera
const PILLAR_TOP = WALL_H + 0.57; // a wall pillar's cap
const JOINT_Y = 0.46;
const TILT = 0.55; // looks down at the lane

const WHITE = "#f1f2f4";
const GREY = "#b9bdc4";
const BLACK = "#15161a";

/** The bracket: a plate on the pillar cap, a short stem and the ball joint. */
function mountParts(): Part[] {
  return [
    { g: "box", p: [0, 0.03, 0], s: [0.44, 0.06, 0.44], c: GREY },
    { g: "cyl", p: [0, 0.24, 0], s: [0.11, 0.4, 0.11], c: WHITE },
    { g: "sphere", p: [0, JOINT_Y, 0], s: 0.2, c: GREY },
  ];
}

/** The bullet camera (origin = the ball joint, looking along +z). */
function headParts(): Part[] {
  const along: V3 = [Math.PI / 2, 0, 0];
  return [
    { g: "box", p: [0, 0.07, 0.08], s: [0.12, 0.16, 0.2], c: WHITE }, // neck to the housing
    { g: "cyl", p: [0, 0.2, 0.34], s: [0.38, 0.95, 0.38], c: WHITE, r: along }, // housing
    { g: "cyl", p: [0, 0.2, -0.15], s: [0.34, 0.05, 0.34], c: GREY, r: along }, // back cap
    { g: "cyl", p: [0, 0.2, 0.8], s: [0.44, 0.16, 0.44], c: BLACK, r: along }, // black front
    { g: "cyl", p: [0, 0.2, 0.885], s: [0.26, 0.03, 0.26], c: "#3a64a8", r: along }, // lens glass
  ];
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.1 });
const RED = new THREE.MeshBasicMaterial({ color: "#ff3b30", toneMapped: false });
const GLOW =
  typeof document === "undefined"
    ? undefined
    : new THREE.SpriteMaterial({ map: blobTex(), color: "#ff4a3d", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

export function CctvCam({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const mount = useMemo(() => bake(mountParts()), []);
  const head = useMemo(() => bake(headParts()), []);
  useEffect(
    () => () => {
      mount.dispose();
      head.dispose();
    },
    [mount, head],
  );
  // on the lane-wall pillar facing the front house's veranda (nearest the default view, clear of the gate, the mailbox,
  // the waiting tenant and the EB pole), watching the lane
  const spot = useMemo(() => {
    const [FL, , , BL] = layout.plot.polygon;
    const D = layout.plot.depthFt;
    const laneX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
    const s = layout.slots.find((x) => x.slot === "front") ?? layout.slots[0];
    const zWant = s ? s.rect.z0 + 4 : 14;
    // the lane wall's pillars (same spacing as PlotGround: both ends + evenly spaced, round(len / 8) panels)
    let best: { x: number; z: number } = { x: laneX(zWant), z: zWant };
    let gap = Infinity;
    for (const w of layout.compoundWalls) {
      if (w.kind !== "wall" || Math.abs(w.a.x - laneX(w.a.z)) > 0.5 || Math.abs(w.b.x - laneX(w.b.z)) > 0.5) continue;
      const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
      const n = Math.max(1, Math.round(len / 8));
      for (let i = 0; i <= n; i++) {
        const q = { x: w.a.x + ((w.b.x - w.a.x) * i) / n, z: w.a.z + ((w.b.z - w.a.z) * i) / n };
        const d = Math.abs(q.z - zWant);
        if (d < gap) {
          gap = d;
          best = q;
        }
      }
    }
    // it watches the lane, turned a little to the front and tilted down — the default view (high, from the lane side)
    // looks straight into its lens and red light, so it reads as a camera
    const aim = { x: best.x - 10, z: best.z - 4 };
    const X = world.x(best.x);
    const Z = world.z(best.z);
    return { X, Z, yaw: Math.atan2(world.x(aim.x) - X, world.z(aim.z) - Z) };
  }, [layout, world]);
  const pan = useRef<THREE.Group>(null);
  const led = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = env.current.t;
    // a slow sweep: hold, turn, hold, turn back (≈ ±16°)
    const P = 12;
    const k = (t % P) / P;
    const s = k < 0.3 ? 0 : k < 0.5 ? (k - 0.3) / 0.2 : k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    const e = s * s * (3 - 2 * s);
    if (pan.current) pan.current.rotation.y = spot.yaw + (e - 0.5) * 0.56;
    if (led.current) led.current.visible = t % 1 < 0.5;
  });
  const anchor = useMemo<V3>(() => [spot.X, PILLAR_TOP + 4, spot.Z], [spot]);
  return (
    <Hotspot
      spot={{ key: "photographer", kind: "photographer", anchor }}
      hit={<mesh geometry={G.box()} position={[spot.X, PILLAR_TOP + 1.5, spot.Z]} scale={[4, 3.6, 4]} visible={false} userData={{ pickFirst: true }} />}
    >
      <group position={[spot.X, PILLAR_TOP, spot.Z]} scale={SCALE}>
        <mesh geometry={mount} material={MAT} castShadow />
        <group ref={pan} position={[0, JOINT_Y, 0]}>
          <group rotation={[TILT, 0, 0]}>
            <mesh geometry={head} material={MAT} castShadow />
            <group ref={led} position={[0.13, 0.05, 0.87]}>
              <mesh geometry={G.sphere()} material={RED} scale={0.06} />
              <sprite scale={0.36} material={GLOW} />
            </group>
          </group>
        </group>
      </group>
    </Hotspot>
  );
}
