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
import { Baked } from "./Baked";
import { Cow, Dog, Pedestrians } from "./People";
import { ball, box, rod, type Part } from "./bake";
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

// Vehicle bodies are baked (bake.ts) into one vertex-coloured, edge-clipped mesh each; wheels spin separately and
// the head / tail lamps keep their own emissive materials so they can switch on at dusk.
const VMAT = () => std("#ffffff", { vertexColors: true, rough: 0.55, clip: true });

function Body({ parts, cast = true }: { parts: Part[]; cast?: boolean }) {
  return <Baked parts={parts} cast={cast} material={VMAT()} />;
}
function Lamp({ p, s, m, round }: { p: V3; s: V3; m: THREE.Material; round?: boolean }) {
  return <mesh geometry={round ? G.sphere() : G.box()} material={m} position={p} scale={s} />;
}

interface Lights {
  head: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  pool: THREE.MeshBasicMaterial;
}

const wheelParts = (r: number, w: number): Part[] => [rod([0, 0, 0], [r * 2, w, r * 2], "#1b1b1d"), box([0, 0, 0], [r * 1.5, w + 0.04, r * 0.28], "#9a9a9a")];
const WHEELS = new Map<string, Part[]>();
const wheelOf = (r: number, w: number) => {
  const k = `${r}|${w}`;
  if (!WHEELS.has(k)) WHEELS.set(k, wheelParts(r, w));
  return WHEELS.get(k)!;
};

/** A wheel spinning about its axle (local Z of the vehicle); registers its spinner for the traffic loop. */
function Wheel({ p, r, w, reg }: { p: V3; r: number; w: number; reg: (o: THREE.Object3D | null) => void }) {
  return (
    <group position={p} rotation={[Math.PI / 2, 0, 0]}>
      <group ref={reg}>
        <Body parts={wheelOf(r, w)} cast={false} />
      </group>
    </group>
  );
}

const rider = (p: V3, shirt: string, wrap: string, skin: string, lean: number): Part[] => {
  const [x, y, z] = p;
  return [
    box([x, y + 1.0, z], [0.6, 1.5, 0.9], shirt, [0, 0, -lean]),
    ball([x + 0.05, y + 2.05, z], 0.66, skin),
    ball([x - 0.03, y + 2.18, z], [0.7, 0.5, 0.68], PAL.hair),
    box([x + 0.55, y + 1.25, z + 0.32], [1.0, 0.22, 0.22], skin, [0, 0, -0.5]),
    box([x + 0.55, y + 1.25, z - 0.32], [1.0, 0.22, 0.22], skin, [0, 0, -0.5]),
    box([x + 0.45, y + 0.2, z + 0.25], [1.0, 0.36, 0.32], wrap),
    box([x + 0.45, y + 0.2, z - 0.25], [1.0, 0.36, 0.32], wrap),
  ];
};

const YEL = "#f2c230";
const BLK = "#1d1d1f";
const AUTO: Part[] = [
  box([0.2, 1.05, 0], [7.4, 0.4, 3.9], "#2a2a2a"),
  box([-0.7, 2.05, 0], [5.4, 1.6, 4.1], YEL),
  box([2.95, 2.35, 0], [2.0, 2.2, 2.5], YEL),
  box([-0.7, 2.95, 0], [5.42, 0.24, 4.12], "#2e8b57"),
  box([3.7, 3.7, 0], [0.12, 1.4, 2.2], "#7fa3b5"),
  box([0.3, 5.15, 0], [7.0, 0.3, 4.3], BLK),
  rod([0.3, 5.3, 0], [6.9, 4.3, 1.1], BLK, [Math.PI / 2, 0, 0]),
  box([-3.3, 4.0, 0], [0.2, 2.3, 4.1], BLK),
  ...(
    [
      [3.55, 1.2],
      [3.55, -1.2],
      [-3.2, 2.0],
      [-3.2, -2.0],
    ] as const
  ).map(([x, z]) => box([x, 4.05, z], [0.14, 2.1, 0.14], BLK)),
  box([-1.9, 3.5, 0], [0.5, 1.5, 3.7], "#6b2a1a"),
  box([1.9, 3.55, 0], [0.8, 1.3, 0.75], "#b59a68"),
  ball([1.95, 4.5, 0], 0.66, PAL.skin),
  ball([1.9, 4.65, 0], [0.7, 0.45, 0.68], PAL.hair),
];

function Auto({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  return (
    <group>
      <Body parts={AUTO} />
      <Lamp p={[4.0, 2.75, 0]} s={[0.42, 0.42, 0.42]} m={L.head} round />
      <Lamp p={[-3.45, 1.9, 1.6]} s={[0.1, 0.3, 0.5]} m={L.tail} />
      <Lamp p={[-3.45, 1.9, -1.6]} s={[0.1, 0.3, 0.5]} m={L.tail} />
      <Wheel p={[3.0, 0.72, 0]} r={0.72} w={0.5} reg={reg} />
      <Wheel p={[-2.3, 0.72, 1.75]} r={0.72} w={0.5} reg={reg} />
      <Wheel p={[-2.3, 0.72, -1.75]} r={0.72} w={0.5} reg={reg} />
    </group>
  );
}

const FRAME = "#5b1a1a";
const MOPED: Part[] = [
  box([0, 1.6, 0], [3.4, 0.25, 0.3], FRAME, [0, 0, 0.12]),
  box([1.8, 2.4, 0], [0.2, 2.0, 0.2], "#444", [0, 0, -0.3]),
  box([2.15, 3.35, 0], [0.2, 0.2, 2.0], "#333"),
  box([0.4, 2.15, 0], [1.3, 0.7, 0.6], FRAME),
  box([-0.6, 2.55, 0], [1.6, 0.3, 0.75], "#1c1c1c"),
  box([-1.9, 2.5, 0], [1.3, 0.15, 1.2], "#444"),
  rod([-1.9, 3.25, 0.45], [0.75, 1.3, 0.75], "#c9ccd1"),
  rod([-1.9, 3.25, -0.45], [0.75, 1.3, 0.75], "#c9ccd1"),
  ...rider([-0.5, 2.55, 0], "#f4f1ea", "#2f6fb5", PAL.skin, 0.12),
];

function Moped({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  return (
    <group>
      <Body parts={MOPED} />
      <Lamp p={[2.35, 3.05, 0]} s={[0.36, 0.36, 0.36]} m={L.head} round />
      <Lamp p={[-2.6, 2.2, 0]} s={[0.1, 0.22, 0.3]} m={L.tail} />
      <Wheel p={[2.0, 0.9, 0]} r={0.9} w={0.3} reg={reg} />
      <Wheel p={[-2.0, 0.9, 0]} r={0.9} w={0.3} reg={reg} />
    </group>
  );
}

const BFRAME = "#1f4f8a";
const BICYCLE: Part[] = [
  box([0, 1.9, 0], [3.2, 0.14, 0.14], BFRAME),
  box([-0.6, 1.5, 0], [0.14, 1.6, 0.14], BFRAME, [0, 0, 0.35]),
  box([1.45, 2.1, 0], [0.14, 1.9, 0.14], BFRAME, [0, 0, -0.3]),
  box([1.75, 3.05, 0], [0.12, 0.12, 1.6], "#333"),
  box([-0.9, 2.6, 0], [0.8, 0.18, 0.4], "#1c1c1c"),
  box([-0.6, 3.7, 0], [0.6, 1.5, 0.85], "#e0a020", [0, 0, -0.25]),
  ball([-0.35, 4.72, 0], 0.64, PAL.skinDark),
  ball([-0.43, 4.86, 0], [0.68, 0.48, 0.66], PAL.hair),
  box([0.4, 3.75, 0.3], [1.6, 0.2, 0.2], PAL.skinDark, [0, 0, -0.6]),
  box([0.4, 3.75, -0.3], [1.6, 0.2, 0.2], PAL.skinDark, [0, 0, -0.6]),
];
const PEDAL_LEG: Part[] = [box([0.35, -0.75, 0], [0.26, 1.6, 0.26], "#24324a", [0, 0, 0.45])];

function Bicycle({ reg, pedals }: { reg: (o: THREE.Object3D | null) => void; pedals: RefObject<THREE.Group | null> }) {
  return (
    <group>
      <Body parts={BICYCLE} />
      <Wheel p={[1.75, 1.1, 0]} r={1.1} w={0.12} reg={reg} />
      <Wheel p={[-1.75, 1.1, 0]} r={1.1} w={0.12} reg={reg} />
      <group ref={pedals} position={[-0.3, 2.65, 0]}>
        {[0.28, -0.28].map((z, i) => (
          <group key={z} position={[0, 0, z]} rotation={[0, 0, i * Math.PI]}>
            <Body parts={PEDAL_LEG} cast={false} />
          </group>
        ))}
      </group>
    </group>
  );
}

const CAR_BODY = "#f2f2ef";
const GLASS = "#26323d";
const CAR: Part[] = [
  box([0, 1.75, 0], [11.4, 1.9, 5.0], CAR_BODY),
  box([-0.8, 3.45, 0], [6.4, 1.6, 4.6], CAR_BODY),
  box([-0.8, 3.45, 0], [6.0, 1.25, 4.68], GLASS),
  box([2.55, 3.35, 0], [0.12, 1.2, 4.3], GLASS, [0, 0, 0.55]),
  box([0, 0.95, 0], [11.6, 0.5, 5.1], "#3a3a3a"),
];

function Car({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  return (
    <group>
      <Body parts={CAR} />
      <Lamp p={[5.65, 2.1, 1.7]} s={[0.25, 0.4, 0.8]} m={L.head} round />
      <Lamp p={[5.65, 2.1, -1.7]} s={[0.25, 0.4, 0.8]} m={L.head} round />
      <Lamp p={[-5.72, 2.2, 1.8]} s={[0.1, 0.4, 0.8]} m={L.tail} />
      <Lamp p={[-5.72, 2.2, -1.8]} s={[0.1, 0.4, 0.8]} m={L.tail} />
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

const BUS: Part[] = [
  box([0, 4.4, 0], [30, 7.0, 7.6], "#f1ead8"),
  box([0, 2.2, 0], [30.05, 1.5, 7.65], "#b3262b"),
  box([0, 5.4, 0], [27, 2.3, 7.7], GLASS),
  box([0, 8.0, 0], [29.6, 0.3, 7.3], "#d9d2bf"),
  box([15.03, 5.0, 0], [0.1, 3.4, 6.6], GLASS),
  box([15.05, 7.25, 0], [0.12, 0.8, 5.0], "#141414"),
  box([0, 3.1, 0], [30.06, 0.25, 7.66], "#e0a020"),
];

function Bus({ L, reg }: { L: Lights; reg: (o: THREE.Object3D | null) => void }) {
  return (
    <group>
      <Body parts={BUS} />
      <Lamp p={[15.1, 2.3, 2.9]} s={[0.25, 0.6, 0.9]} m={L.head} round />
      <Lamp p={[15.1, 2.3, -2.9]} s={[0.25, 0.6, 0.9]} m={L.head} round />
      <Lamp p={[-15.05, 2.4, 3.0]} s={[0.1, 0.6, 0.8]} m={L.tail} />
      <Lamp p={[-15.05, 2.4, -3.0]} s={[0.1, 0.6, 0.8]} m={L.tail} />
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
