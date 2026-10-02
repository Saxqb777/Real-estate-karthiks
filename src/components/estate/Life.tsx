"use client";
// Street life on the road in front of the plot: auto-rickshaws, a TVS moped with milk cans, a cyclist, a hatchback
// and a town bus driving on the left (India), overtaking slower traffic, headlights at night. Plus the people,
// animals, birds and drifting petals (People.tsx / SkyLife.tsx). Everything is clock-based → frame-rate independent.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import type { Tier } from "./Effects";
import type { Env } from "./env";
import { tileXRange } from "./Island";
import { G, PAL, VEHICLE_CLIP, std } from "./materials";
import { Cow, Dog, Pedestrians } from "./People";
import { Birds, Petals } from "./SkyLife";
import { glowTex } from "./textures";
import { FLAT, damp, type World } from "./util";

type V3 = [number, number, number];
type Kind = "auto" | "moped" | "bicycle" | "car" | "bus";

interface VehicleSpec {
  kind: Kind;
  dir: 1 | -1;
  speed: number;
  period: number;
  offset: number;
  len: number;
  width: number;
  /** lateral offset inside the lane (+ = towards the kerb) */
  edge: number;
}

const VEHICLES: VehicleSpec[] = [
  { kind: "auto", dir: 1, speed: 17, period: 14, offset: 0, len: 8.6, width: 4.3, edge: 0.6 },
  { kind: "moped", dir: -1, speed: 21, period: 17, offset: 6, len: 6, width: 2.2, edge: 1.8 },
  { kind: "bus", dir: -1, speed: 18, period: 46, offset: 31, len: 31, width: 7.8, edge: 0 },
  { kind: "car", dir: 1, speed: 26, period: 29, offset: 18, len: 12, width: 5.2, edge: 0 },
  { kind: "bicycle", dir: 1, speed: 10.5, period: 23, offset: 9, len: 5.6, width: 2, edge: 2.6 },
  { kind: "auto", dir: -1, speed: 15.5, period: 21, offset: 13, len: 8.6, width: 4.3, edge: 0.6 },
];

function Box({ p, s, c, r, m, cast = false }: { p: V3; s: V3; c?: string; r?: V3; m?: THREE.Material; cast?: boolean }) {
  return <mesh geometry={G.box()} material={m ?? std(c!, { rough: 0.6, clip: true })} position={p} scale={s} rotation={r} castShadow={cast} />;
}
function Ball({ p, s, c, m }: { p: V3; s: number | V3; c?: string; m?: THREE.Material }) {
  return <mesh geometry={G.sphere()} material={m ?? std(c!, { rough: 0.6, clip: true })} position={p} scale={s} />;
}

interface Lights {
  head: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  pool: THREE.MeshBasicMaterial;
}

/** A wheel spinning about its axle (local Z of the vehicle); registers its spinner for the traffic loop. */
function Wheel({ p, r, w, reg }: { p: V3; r: number; w: number; reg: (o: THREE.Object3D | null) => void }) {
  return (
    <group position={p} rotation={[Math.PI / 2, 0, 0]}>
      <group ref={reg}>
        <mesh geometry={G.cyl()} material={std("#1b1b1d", { rough: 0.9, clip: true })} scale={[r * 2, w, r * 2]} />
        <mesh geometry={G.box()} material={std("#9a9a9a", { rough: 0.4, metal: 0.5, clip: true })} scale={[r * 1.5, w + 0.04, r * 0.28]} />
      </group>
    </group>
  );
}

function Rider({ p, shirt, wrap, lean = 0 }: { p: V3; shirt: string; wrap: string; lean?: number }) {
  return (
    <group position={p} rotation={[0, 0, -lean]}>
      <Box p={[0, 1.0, 0]} s={[0.6, 1.5, 0.9]} c={shirt} />
      <Ball p={[0.05, 2.05, 0]} s={0.66} c={PAL.skin} />
      <Ball p={[-0.03, 2.18, 0]} s={[0.7, 0.5, 0.68]} c={PAL.hair} />
      <Box p={[0.55, 1.25, 0.32]} s={[1.0, 0.22, 0.22]} r={[0, 0, -0.5]} c={PAL.skin} />
      <Box p={[0.55, 1.25, -0.32]} s={[1.0, 0.22, 0.22]} r={[0, 0, -0.5]} c={PAL.skin} />
      <Box p={[0.45, 0.2, 0.25]} s={[1.0, 0.36, 0.32]} c={wrap} />
      <Box p={[0.45, 0.2, -0.25]} s={[1.0, 0.36, 0.32]} c={wrap} />
    </group>
  );
}

function Auto({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  const yellow = "#f2c230";
  const black = "#1d1d1f";
  return (
    <group>
      <Box p={[0.2, 1.05, 0]} s={[7.4, 0.4, 3.9]} c="#2a2a2a" />
      <Box p={[-0.7, 2.05, 0]} s={[5.4, 1.6, 4.1]} c={yellow} cast />
      <Box p={[2.95, 2.35, 0]} s={[2.0, 2.2, 2.5]} c={yellow} />
      <Box p={[-0.7, 2.95, 0]} s={[5.42, 0.24, 4.12]} c="#2e8b57" />
      <Box p={[3.7, 3.7, 0]} s={[0.12, 1.4, 2.2]} m={std("#8fb6c9", { rough: 0.15, metal: 0.3, clip: true })} />
      <Box p={[0.3, 5.15, 0]} s={[7.0, 0.3, 4.3]} c={black} cast />
      <mesh geometry={G.cyl()} material={std(black, { rough: 0.7, clip: true })} position={[0.3, 5.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[6.9, 4.3, 1.1]} />
      <Box p={[-3.3, 4.0, 0]} s={[0.2, 2.3, 4.1]} c={black} />
      {[
        [3.55, 1.2],
        [3.55, -1.2],
        [-3.2, 2.0],
        [-3.2, -2.0],
      ].map(([x, z], i) => (
        <Box key={i} p={[x, 4.05, z]} s={[0.14, 2.1, 0.14]} c={black} />
      ))}
      <Box p={[-1.9, 3.5, 0]} s={[0.5, 1.5, 3.7]} c="#6b2a1a" />
      <Box p={[1.9, 3.55, 0]} s={[0.8, 1.3, 0.75]} c="#b59a68" />
      <Ball p={[1.95, 4.5, 0]} s={0.66} c={PAL.skin} />
      <Ball p={[4.0, 2.75, 0]} s={0.42} m={L.head} />
      <Box p={[-3.45, 1.9, 1.6]} s={[0.1, 0.3, 0.5]} m={L.tail} />
      <Box p={[-3.45, 1.9, -1.6]} s={[0.1, 0.3, 0.5]} m={L.tail} />
      <Wheel p={[3.0, 0.72, 0]} r={0.72} w={0.5} reg={reg} />
      <Wheel p={[-2.3, 0.72, 1.75]} r={0.72} w={0.5} reg={reg} />
      <Wheel p={[-2.3, 0.72, -1.75]} r={0.72} w={0.5} reg={reg} />
    </group>
  );
}

function Moped({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  const frame = "#5b1a1a";
  return (
    <group>
      <Wheel p={[2.0, 0.9, 0]} r={0.9} w={0.3} reg={reg} />
      <Wheel p={[-2.0, 0.9, 0]} r={0.9} w={0.3} reg={reg} />
      <Box p={[0, 1.6, 0]} s={[3.4, 0.25, 0.3]} r={[0, 0, 0.12]} c={frame} />
      <Box p={[1.8, 2.4, 0]} s={[0.2, 2.0, 0.2]} r={[0, 0, -0.3]} c="#444" />
      <Box p={[2.15, 3.35, 0]} s={[0.2, 0.2, 2.0]} c="#333" />
      <Box p={[0.4, 2.15, 0]} s={[1.3, 0.7, 0.6]} c={frame} cast />
      <Box p={[-0.6, 2.55, 0]} s={[1.6, 0.3, 0.75]} c="#1c1c1c" />
      <Box p={[-1.9, 2.5, 0]} s={[1.3, 0.15, 1.2]} c="#444" />
      {[0.45, -0.45].map((z) => (
        <mesh key={z} geometry={G.cyl()} material={std("#c9ccd1", { rough: 0.25, metal: 0.8, clip: true })} position={[-1.9, 3.25, z]} scale={[0.75, 1.3, 0.75]} />
      ))}
      <Ball p={[2.35, 3.05, 0]} s={0.36} m={L.head} />
      <Box p={[-2.6, 2.2, 0]} s={[0.1, 0.22, 0.3]} m={L.tail} />
      <Rider p={[-0.5, 2.55, 0]} shirt="#f4f1ea" wrap="#2f6fb5" lean={0.12} />
    </group>
  );
}

function Bicycle({ reg, pedals }: { reg: (o: THREE.Object3D | null) => void; pedals: RefObject<THREE.Group | null> }) {
  const frame = "#1f4f8a";
  return (
    <group>
      <Wheel p={[1.75, 1.1, 0]} r={1.1} w={0.12} reg={reg} />
      <Wheel p={[-1.75, 1.1, 0]} r={1.1} w={0.12} reg={reg} />
      <Box p={[0, 1.9, 0]} s={[3.2, 0.14, 0.14]} c={frame} cast />
      <Box p={[-0.6, 1.5, 0]} s={[0.14, 1.6, 0.14]} r={[0, 0, 0.35]} c={frame} />
      <Box p={[1.45, 2.1, 0]} s={[0.14, 1.9, 0.14]} r={[0, 0, -0.3]} c={frame} />
      <Box p={[1.75, 3.05, 0]} s={[0.12, 0.12, 1.6]} c="#333" />
      <Box p={[-0.9, 2.6, 0]} s={[0.8, 0.18, 0.4]} c="#1c1c1c" />
      <group position={[-0.6, 2.7, 0]} rotation={[0, 0, -0.25]}>
        <Box p={[0, 1.0, 0]} s={[0.6, 1.5, 0.85]} c="#e0a020" />
        <Ball p={[0.1, 2.05, 0]} s={0.64} c={PAL.skinDark} />
        <Ball p={[0.02, 2.2, 0]} s={[0.68, 0.48, 0.66]} c={PAL.hair} />
        <Box p={[0.8, 1.15, 0.3]} s={[1.6, 0.2, 0.2]} r={[0, 0, -0.35]} c={PAL.skinDark} />
        <Box p={[0.8, 1.15, -0.3]} s={[1.6, 0.2, 0.2]} r={[0, 0, -0.35]} c={PAL.skinDark} />
      </group>
      <group ref={pedals} position={[-0.3, 2.65, 0]}>
        {[0.28, -0.28].map((z, i) => (
          <group key={z} rotation={[0, 0, i * Math.PI]}>
            <Box p={[0.35, -0.75, z]} s={[0.26, 1.6, 0.26]} r={[0, 0, 0.45]} c="#24324a" />
          </group>
        ))}
      </group>
    </group>
  );
}

function Car({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  const body = "#f2f2ef";
  const glass = std("#26323d", { rough: 0.15, metal: 0.4, clip: true });
  return (
    <group>
      <Box p={[0, 1.75, 0]} s={[11.4, 1.9, 5.0]} c={body} cast />
      <Box p={[-0.8, 3.45, 0]} s={[6.4, 1.6, 4.6]} c={body} cast />
      <Box p={[-0.8, 3.45, 0]} s={[6.0, 1.25, 4.68]} m={glass} />
      <Box p={[2.55, 3.35, 0]} s={[0.12, 1.2, 4.3]} r={[0, 0, 0.55]} m={glass} />
      <Box p={[0, 0.95, 0]} s={[11.6, 0.5, 5.1]} c="#3a3a3a" />
      <Ball p={[5.65, 2.1, 1.7]} s={[0.25, 0.4, 0.8]} m={L.head} />
      <Ball p={[5.65, 2.1, -1.7]} s={[0.25, 0.4, 0.8]} m={L.head} />
      <Box p={[-5.72, 2.2, 1.8]} s={[0.1, 0.4, 0.8]} m={L.tail} />
      <Box p={[-5.72, 2.2, -1.8]} s={[0.1, 0.4, 0.8]} m={L.tail} />
      {[
        [3.6, 2.3],
        [3.6, -2.3],
        [-3.6, 2.3],
        [-3.6, -2.3],
      ].map(([x, z], i) => (
        <Wheel key={i} p={[x, 0.95, z]} r={0.95} w={0.6} reg={reg} />
      ))}
    </group>
  );
}

function Bus({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  const cream = "#f1ead8";
  const red = "#b3262b";
  const glass = std("#26323d", { rough: 0.15, metal: 0.4, clip: true });
  return (
    <group>
      <Box p={[0, 4.4, 0]} s={[30, 7.0, 7.6]} c={cream} cast />
      <Box p={[0, 2.2, 0]} s={[30.05, 1.5, 7.65]} c={red} />
      <Box p={[0, 5.4, 0]} s={[27, 2.3, 7.7]} m={glass} />
      <Box p={[0, 8.0, 0]} s={[29.6, 0.3, 7.3]} c="#d9d2bf" />
      <Box p={[15.03, 5.0, 0]} s={[0.1, 3.4, 6.6]} m={glass} />
      <Box p={[15.05, 7.25, 0]} s={[0.12, 0.8, 5.0]} c="#141414" />
      <Box p={[0, 3.1, 0]} s={[30.06, 0.25, 7.66]} c="#e0a020" />
      <Ball p={[15.1, 2.3, 2.9]} s={[0.25, 0.6, 0.9]} m={L.head} />
      <Ball p={[15.1, 2.3, -2.9]} s={[0.25, 0.6, 0.9]} m={L.head} />
      <Box p={[-15.05, 2.4, 3.0]} s={[0.1, 0.6, 0.8]} m={L.tail} />
      <Box p={[-15.05, 2.4, -3.0]} s={[0.1, 0.6, 0.8]} m={L.tail} />
      {[
        [10.5, 3.3],
        [10.5, -3.3],
        [-9, 3.3],
        [-9, -3.3],
      ].map(([x, z], i) => (
        <Wheel key={i} p={[x, 1.5, z]} r={1.5} w={0.9} reg={reg} />
      ))}
    </group>
  );
}

interface VState {
  group: THREE.Group | null;
  wheels: THREE.Object3D[];
  pedals: RefObject<THREE.Group | null>;
  shift: number;
}

function Traffic({ layout, world, env, count }: { layout: SiteLayout; world: World; env: RefObject<Env>; count: number }) {
  const st = layout.site.street;
  const laneW = (st.road[1] - st.road[0]) / 2;
  const nearLane = st.road[1] - laneW / 2; // heading +x keeps left → lane nearer the plot
  const farLane = st.road[0] + laneW / 2;
  const specs = VEHICLES.slice(0, count);
  const lights = useMemo<Lights>(
    () => ({
      head: new THREE.MeshStandardMaterial({ color: "#fff7e0", emissive: "#fff1c9", emissiveIntensity: 0.3, toneMapped: false, clippingPlanes: VEHICLE_CLIP }),
      tail: new THREE.MeshStandardMaterial({ color: "#7a1010", emissive: "#ff2a2a", emissiveIntensity: 0.2, toneMapped: false, clippingPlanes: VEHICLE_CLIP }),
      pool: new THREE.MeshBasicMaterial({ map: glowTex(), color: "#ffe2a6", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, clippingPlanes: VEHICLE_CLIP }),
    }),
    [],
  );
  useEffect(() => () => Object.values(lights).forEach((m) => m.dispose()), [lights]);
  const states = useRef<VState[]>(specs.map(() => ({ group: null, wheels: [], pedals: { current: null }, shift: 0 })));
  if (states.current.length !== specs.length) states.current = specs.map(() => ({ group: null, wheels: [], pedals: { current: null }, shift: 0 }));

  useEffect(() => {
    // clip traffic at the tile's cut edges (left/right) so vehicles emerge from the edge
    const zc = (nearLane + farLane) / 2;
    const [x0, x1] = tileXRange(layout, zc);
    VEHICLE_CLIP[0].constant = -world.x(x0 + 0.2);
    VEHICLE_CLIP[1].constant = world.x(x1 - 0.2);
  }, [layout, world, nearLane, farLane]);

  useFrame(({ clock }, dt) => {
    const e = env.current;
    lights.head.emissiveIntensity = 0.3 + e.lamps * 5.5;
    lights.tail.emissiveIntensity = 0.2 + e.lamps * 3.5;
    lights.pool.opacity = e.lamps * 0.42;
    const t = clock.elapsedTime;
    const pos = specs.map((sp) => {
      const z = sp.dir > 0 ? nearLane : farLane;
      const [x0, x1] = tileXRange(layout, z);
      const span = x1 - x0 + sp.len;
      const s = ((t + sp.offset) % sp.period) * sp.speed;
      const x = sp.dir > 0 ? x0 - sp.len / 2 + s : x1 + sp.len / 2 - s;
      return { s, x, z, x0, x1, span, visible: s <= span };
    });
    specs.forEach((sp, i) => {
      const st8 = states.current[i];
      const g = st8.group;
      const p = pos[i];
      if (!g) return;
      g.visible = p.visible;
      if (!p.visible) return;
      // overtake: move towards the centre line if a slower vehicle is just ahead in the same lane
      let want = 0;
      specs.forEach((o, j) => {
        if (j === i || o.dir !== sp.dir || !pos[j].visible || o.speed >= sp.speed) return;
        const ahead = (pos[j].x - p.x) * sp.dir;
        if (ahead > -((o.len + sp.len) / 2 + 1) && ahead < (o.len + sp.len) / 2 + 9) want = (o.width + sp.width) / 2 + 0.8;
      });
      st8.shift = damp(st8.shift, want, 3, Math.min(dt, 0.05));
      const lateral = (sp.edge - st8.shift) * sp.dir; // + = towards the kerb on the vehicle's left
      g.position.set(world.x(p.x), 0.2, world.z(p.z + lateral));
      g.rotation.y = sp.dir > 0 ? 0 : Math.PI;
      const r = sp.kind === "bus" ? 1.5 : sp.kind === "bicycle" ? 1.1 : sp.kind === "car" ? 0.95 : sp.kind === "moped" ? 0.9 : 0.72;
      for (const w of st8.wheels) w.rotation.y = -p.s / r;
      if (st8.pedals.current) st8.pedals.current.rotation.z = -p.s / 1.6;
    });
  });

  return (
    <group>
      {specs.map((sp, i) => {
        const st8 = states.current[i];
        const reg = (o: THREE.Object3D | null) => {
          if (o && !st8.wheels.includes(o)) st8.wheels.push(o);
        };
        let model: ReactNode;
        switch (sp.kind) {
          case "auto":
            model = <Auto L={lights} reg={reg} />;
            break;
          case "moped":
            model = <Moped L={lights} reg={reg} />;
            break;
          case "bicycle":
            model = <Bicycle reg={reg} pedals={st8.pedals} />;
            break;
          case "car":
            model = <Car L={lights} reg={reg} />;
            break;
          case "bus":
            model = <Bus L={lights} reg={reg} />;
        }
        return (
          <group key={i} ref={(g) => void (st8.group = g)} visible={false}>
            {model}
            {sp.kind !== "bicycle" && <mesh geometry={G.plane()} material={lights.pool} rotation={FLAT} position={[sp.len / 2 + 5.5, 0.05, 0]} scale={[12, 7, 1]} />}
          </group>
        );
      })}
    </group>
  );
}

export function Life({ layout, world, env, enabled, tier, mobile }: { layout: SiteLayout; world: World; env: RefObject<Env>; enabled: boolean; tier: Tier; mobile: boolean }) {
  if (!enabled) return null;
  const n = tier === "high" && !mobile ? { veh: 6, ped: 5, birds: true, petals: 36 } : tier === "low" ? { veh: 2, ped: 2, birds: false, petals: 0 } : { veh: 4, ped: 3, birds: true, petals: 18 };
  return (
    <group>
      <Traffic layout={layout} world={world} env={env} count={n.veh} />
      <Pedestrians layout={layout} world={world} count={n.ped} />
      <Dog layout={layout} world={world} />
      <Cow layout={layout} world={world} />
      {n.birds && <Birds layout={layout} env={env} />}
      {n.petals > 0 && <Petals layout={layout} world={world} count={n.petals} />}
    </group>
  );
}
