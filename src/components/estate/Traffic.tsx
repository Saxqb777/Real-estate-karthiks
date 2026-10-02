"use client";
// Street traffic: auto-rickshaws, a TVS moped with milk cans, a cyclist, a hatchback and a town bus, driving on the
// left (India). A small lane simulation keeps them honest: each vehicle stays in its own lane, follows the one ahead
// with a safe gap (so nothing ever drives through another vehicle), and narrow vehicles slip past slow ones only
// when the lane is wide enough — never into the oncoming lane. Sub-stepped on scene time → frame-rate independent.
// Draw calls: one baked body per vehicle; all wheels, lamps, light pools, pedals and contact shadows are instanced.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import type { Env } from "./env";
import { tileXRange } from "./Island";
import { G, PAL, VEHICLE_CLIP, std } from "./materials";
import { Baked } from "./Baked";
import { ball, bake, box, rod, type Part } from "./bake";
import { blobTex, glowTex } from "./textures";
import { SPECS, stepTraffic, type Car, type Kind } from "./traffic-sim";
import { rng, type World } from "./util";

type V3 = [number, number, number];

// ───────────────────────────── models (baked parts, local +X = forward) ─────────────────────────────

interface Lamp {
  p: V3;
  s: V3;
}
interface Model {
  body: Part[];
  wheels: { p: V3; r: number; w: number }[];
  head: Lamp[];
  tail: Lamp[];
  pedals?: V3;
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
const GLASS = "#26323d";

const MODELS: Record<Kind, Model> = {
  auto: {
    body: [
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
      box([-3.42, 2.6, 0], [0.06, 0.7, 2.4], "#f4f1ea"), // painted rear panel
    ],
    wheels: [
      { p: [3.0, 0.72, 0], r: 0.72, w: 0.5 },
      { p: [-2.3, 0.72, 1.75], r: 0.72, w: 0.5 },
      { p: [-2.3, 0.72, -1.75], r: 0.72, w: 0.5 },
    ],
    head: [{ p: [4.0, 2.75, 0], s: [0.42, 0.42, 0.42] }],
    tail: [
      { p: [-3.45, 1.9, 1.6], s: [0.1, 0.3, 0.5] },
      { p: [-3.45, 1.9, -1.6], s: [0.1, 0.3, 0.5] },
    ],
  },
  moped: {
    body: [
      box([0, 1.6, 0], [3.4, 0.25, 0.3], "#5b1a1a", [0, 0, 0.12]),
      box([1.8, 2.4, 0], [0.2, 2.0, 0.2], "#444", [0, 0, -0.3]),
      box([2.15, 3.35, 0], [0.2, 0.2, 2.0], "#333"),
      box([0.4, 2.15, 0], [1.3, 0.7, 0.6], "#5b1a1a"),
      box([-0.6, 2.55, 0], [1.6, 0.3, 0.75], "#1c1c1c"),
      box([-1.9, 2.5, 0], [1.3, 0.15, 1.2], "#444"),
      rod([-1.9, 3.25, 0.45], [0.75, 1.3, 0.75], "#c9ccd1"),
      rod([-1.9, 3.25, -0.45], [0.75, 1.3, 0.75], "#c9ccd1"),
      ...rider([-0.5, 2.55, 0], "#f4f1ea", "#2f6fb5", PAL.skin, 0.12),
    ],
    wheels: [
      { p: [2.0, 0.9, 0], r: 0.9, w: 0.3 },
      { p: [-2.0, 0.9, 0], r: 0.9, w: 0.3 },
    ],
    head: [{ p: [2.35, 3.05, 0], s: [0.36, 0.36, 0.36] }],
    tail: [{ p: [-2.6, 2.2, 0], s: [0.1, 0.22, 0.3] }],
  },
  bicycle: {
    body: [
      box([0, 1.9, 0], [3.2, 0.14, 0.14], "#1f4f8a"),
      box([-0.6, 1.5, 0], [0.14, 1.6, 0.14], "#1f4f8a", [0, 0, 0.35]),
      box([1.45, 2.1, 0], [0.14, 1.9, 0.14], "#1f4f8a", [0, 0, -0.3]),
      box([1.75, 3.05, 0], [0.12, 0.12, 1.6], "#333"),
      box([-0.9, 2.6, 0], [0.8, 0.18, 0.4], "#1c1c1c"),
      box([-0.6, 3.7, 0], [0.6, 1.5, 0.85], "#e0a020", [0, 0, -0.25]),
      ball([-0.35, 4.72, 0], 0.64, PAL.skinDark),
      ball([-0.43, 4.86, 0], [0.68, 0.48, 0.66], PAL.hair),
      box([0.4, 3.75, 0.3], [1.6, 0.2, 0.2], PAL.skinDark, [0, 0, -0.6]),
      box([0.4, 3.75, -0.3], [1.6, 0.2, 0.2], PAL.skinDark, [0, 0, -0.6]),
      box([-2.1, 2.3, 0], [1.0, 0.1, 0.7], "#555"), // carrier
      box([-2.1, 2.75, 0], [0.9, 0.8, 0.8], "#c9a46b"), // tied bundle
    ],
    wheels: [
      { p: [1.75, 1.1, 0], r: 1.1, w: 0.12 },
      { p: [-1.75, 1.1, 0], r: 1.1, w: 0.12 },
    ],
    head: [],
    tail: [],
    pedals: [-0.3, 2.65, 0],
  },
  car: {
    body: [
      box([0, 1.75, 0], [11.4, 1.9, 5.0], "#f2f2ef"),
      box([-0.8, 3.45, 0], [6.4, 1.6, 4.6], "#f2f2ef"),
      box([-0.8, 3.45, 0], [6.0, 1.25, 4.68], GLASS),
      box([2.55, 3.35, 0], [0.12, 1.2, 4.3], GLASS, [0, 0, 0.55]),
      box([0, 0.95, 0], [11.6, 0.5, 5.1], "#3a3a3a"),
      box([5.72, 1.4, 0], [0.1, 0.5, 2.2], "#1f1f1f"), // grille
    ],
    wheels: [
      { p: [3.6, 0.95, 2.3], r: 0.95, w: 0.6 },
      { p: [3.6, 0.95, -2.3], r: 0.95, w: 0.6 },
      { p: [-3.6, 0.95, 2.3], r: 0.95, w: 0.6 },
      { p: [-3.6, 0.95, -2.3], r: 0.95, w: 0.6 },
    ],
    head: [
      { p: [5.65, 2.1, 1.7], s: [0.25, 0.4, 0.8] },
      { p: [5.65, 2.1, -1.7], s: [0.25, 0.4, 0.8] },
    ],
    tail: [
      { p: [-5.72, 2.2, 1.8], s: [0.1, 0.4, 0.8] },
      { p: [-5.72, 2.2, -1.8], s: [0.1, 0.4, 0.8] },
    ],
  },
  bus: {
    body: [
      box([0, 4.4, 0], [30, 7.0, 7.4], "#f1ead8"),
      box([0, 2.2, 0], [30.05, 1.5, 7.45], "#b3262b"),
      box([0, 5.4, 0], [27, 2.3, 7.5], GLASS),
      box([0, 8.0, 0], [29.6, 0.3, 7.1], "#d9d2bf"),
      box([15.03, 5.0, 0], [0.1, 3.4, 6.4], GLASS),
      box([15.05, 7.25, 0], [0.12, 0.8, 5.0], "#141414"),
      box([0, 3.1, 0], [30.06, 0.25, 7.46], "#e0a020"),
      box([0, 8.4, 0], [8, 0.5, 4], "#c9c1ae"), // roof luggage rack
    ],
    wheels: [
      { p: [10.5, 1.5, 3.2], r: 1.5, w: 0.9 },
      { p: [10.5, 1.5, -3.2], r: 1.5, w: 0.9 },
      { p: [-9, 1.5, 3.2], r: 1.5, w: 0.9 },
      { p: [-9, 1.5, -3.2], r: 1.5, w: 0.9 },
    ],
    head: [
      { p: [15.1, 2.3, 2.8], s: [0.25, 0.6, 0.9] },
      { p: [15.1, 2.3, -2.8], s: [0.25, 0.6, 0.9] },
    ],
    tail: [
      { p: [-15.05, 2.4, 2.9], s: [0.1, 0.6, 0.8] },
      { p: [-15.05, 2.4, -2.9], s: [0.1, 0.6, 0.8] },
    ],
  },
};

// ───────────────────────────── rendering ─────────────────────────────

const WHEEL_GEO = () => {
  const g = bake([rod([0, 0, 0], [1, 1, 1], "#1b1b1d"), box([0, 0, 0], [0.75, 1.04, 0.14], "#9a9a9a")]);
  return g;
};
const PEDAL_GEO = () => bake([box([0.35, -0.75, 0], [0.26, 1.6, 0.26], "#24324a", [0, 0, 0.45])]);

export function Traffic({ layout, world, env, count }: { layout: SiteLayout; world: World; env: RefObject<Env>; count: number }) {
  const st = layout.site.street;
  const laneW = (st.road[1] - st.road[0]) / 2;
  const specs = useMemo(() => SPECS.slice(0, count), [count]);

  const cars = useRef<Car[]>([]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  // (re)build + pre-warm the simulation so the street is already busy on load
  const lanes = useMemo(() => {
    const near = tileXRange(layout, st.road[1] - laneW / 2);
    const far = tileXRange(layout, st.road[0] + laneW / 2);
    const range: Record<1 | -1, [number, number]> = { 1: near, [-1]: far };
    const span: Record<1 | -1, number> = { 1: near[1] - near[0], [-1]: far[1] - far[0] };
    return { range, span };
  }, [layout, st.road, laneW]);
  if (cars.current.length !== specs.length) {
    cars.current = specs.map((spec, i) => {
      const rand = rng(900 + i * 31);
      return { spec, active: false, s: 0, v: 0, lat: spec.lat, wait: rand() * 6, mood: 1, rand };
    });
    stepTraffic(cars.current, lanes.span, laneW, 45);
  }

  const wheelGeo = useMemo(WHEEL_GEO, []);
  const pedalGeo = useMemo(PEDAL_GEO, []);
  useEffect(
    () => () => {
      wheelGeo.dispose();
      pedalGeo.dispose();
    },
    [wheelGeo, pedalGeo],
  );
  const mats = useMemo(
    () => ({
      body: std("#ffffff", { vertexColors: true, rough: 0.55, clip: true }),
      wheel: std("#ffffff", { vertexColors: true, rough: 0.7, clip: true }),
      head: new THREE.MeshStandardMaterial({ color: "#fff7e0", emissive: "#fff1c9", emissiveIntensity: 0.3, toneMapped: false, clippingPlanes: VEHICLE_CLIP }),
      tail: new THREE.MeshStandardMaterial({ color: "#7a1010", emissive: "#ff2a2a", emissiveIntensity: 0.2, toneMapped: false, clippingPlanes: VEHICLE_CLIP }),
      pool: new THREE.MeshBasicMaterial({ map: glowTex(), color: "#ffe2a6", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, clippingPlanes: VEHICLE_CLIP }),
      blob: new THREE.MeshBasicMaterial({ map: blobTex(), color: "#000000", transparent: true, opacity: 0.32, depthWrite: false, clippingPlanes: VEHICLE_CLIP, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    }),
    [],
  );
  useEffect(() => () => [mats.head, mats.tail, mats.pool, mats.blob].forEach((m) => m.dispose()), [mats]);

  const counts = useMemo(() => {
    let wheels = 0;
    let head = 0;
    let tail = 0;
    let pedals = 0;
    for (const s of specs) {
      const m = MODELS[s.kind];
      wheels += m.wheels.length;
      head += m.head.length;
      tail += m.tail.length;
      if (m.pedals) pedals += 2;
    }
    return { wheels, head, tail, pedals, pools: specs.filter((s) => MODELS[s.kind].head.length).length };
  }, [specs]);

  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const tailRef = useRef<THREE.InstancedMesh>(null);
  const poolRef = useRef<THREE.InstancedMesh>(null);
  const pedalRef = useRef<THREE.InstancedMesh>(null);
  const blobRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    // clip traffic at the tile's cut edges (left/right) so vehicles emerge from the edge
    const zc = (st.road[0] + st.road[1]) / 2;
    const [x0, x1] = tileXRange(layout, zc);
    VEHICLE_CLIP[0].constant = -world.x(x0 + 0.2);
    VEHICLE_CLIP[1].constant = world.x(x1 - 0.2);
  }, [layout, world, st.road]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), l: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), zero: new THREE.Matrix4().makeScale(0, 0, 0) }), []);
  const dist = useRef<number[]>([]);

  useFrame(() => {
    const e = env.current;
    mats.head.emissiveIntensity = 0.3 + e.lamps * 5.5;
    mats.tail.emissiveIntensity = 0.2 + e.lamps * 3.5;
    mats.pool.opacity = e.lamps * 0.42;
    stepTraffic(cars.current, lanes.span, laneW, e.dt);
    const { m, l, q, e: eu, p, s, zero } = tmp;
    let wi = 0;
    let hi = 0;
    let ti = 0;
    let pi = 0;
    let di = 0;
    let bi = 0;
    cars.current.forEach((c, i) => {
      const g = groups.current[i];
      const model = MODELS[c.spec.kind];
      dist.current[i] = (dist.current[i] ?? 0) + c.v * e.dt;
      if (!g) return;
      g.visible = c.active;
      const dir = c.spec.dir;
      const [x0, x1] = lanes.range[dir];
      const kerb = dir > 0 ? st.road[1] : st.road[0];
      const z = kerb - dir * (c.lat + c.spec.width / 2);
      const x = dir > 0 ? x0 - c.spec.len / 2 + c.s : x1 + c.spec.len / 2 - c.s;
      g.position.set(world.x(x), 0.2, world.z(z));
      g.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
      g.updateMatrix();
      const base = c.active ? g.matrix : zero;
      for (const w of model.wheels) {
        eu.set(Math.PI / 2, -dist.current[i] / w.r, 0, "XYZ");
        l.compose(p.set(...w.p), q.setFromEuler(eu), s.set(w.r * 2, w.w, w.r * 2));
        wheelRef.current?.setMatrixAt(wi++, m.multiplyMatrices(base, l));
      }
      for (const h of model.head) {
        l.compose(p.set(...h.p), q.identity(), s.set(...h.s));
        headRef.current?.setMatrixAt(hi++, m.multiplyMatrices(base, l));
      }
      for (const t of model.tail) {
        l.compose(p.set(...t.p), q.identity(), s.set(...t.s));
        tailRef.current?.setMatrixAt(ti++, m.multiplyMatrices(base, l));
      }
      if (model.head.length) {
        eu.set(-Math.PI / 2, 0, 0);
        l.compose(p.set(c.spec.len / 2 + 5.5, -0.15, 0), q.setFromEuler(eu), s.set(12, 7, 1));
        poolRef.current?.setMatrixAt(pi++, m.multiplyMatrices(base, l));
      }
      if (model.pedals) {
        for (const k of [0, 1]) {
          eu.set(0, 0, -dist.current[i] / 1.6 + k * Math.PI);
          l.compose(p.set(model.pedals[0], model.pedals[1], model.pedals[2] + (k ? -0.28 : 0.28)), q.setFromEuler(eu), s.set(1, 1, 1));
          pedalRef.current?.setMatrixAt(di++, m.multiplyMatrices(base, l));
        }
      }
      eu.set(-Math.PI / 2, 0, 0);
      l.compose(p.set(0, -0.12, 0), q.setFromEuler(eu), s.set(c.spec.len * 1.08, c.spec.width * 1.25, 1));
      blobRef.current?.setMatrixAt(bi++, m.multiplyMatrices(base, l));
    });
    for (const r of [wheelRef, headRef, tailRef, poolRef, pedalRef, blobRef]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {specs.map((sp, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false} matrixAutoUpdate={false}>
          <Baked parts={MODELS[sp.kind].body} cast material={mats.body} />
        </group>
      ))}
      <instancedMesh ref={wheelRef} args={[wheelGeo, mats.wheel, Math.max(1, counts.wheels)]} frustumCulled={false} />
      <instancedMesh ref={headRef} args={[G.sphere(), mats.head, Math.max(1, counts.head)]} frustumCulled={false} />
      <instancedMesh ref={tailRef} args={[G.box(), mats.tail, Math.max(1, counts.tail)]} frustumCulled={false} />
      <instancedMesh ref={pedalRef} args={[pedalGeo, mats.wheel, Math.max(1, counts.pedals)]} frustumCulled={false} />
      <instancedMesh ref={blobRef} args={[G.plane(), mats.blob, Math.max(1, specs.length)]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={poolRef} args={[G.plane(), mats.pool, Math.max(1, counts.pools)]} frustumCulled={false} />
    </group>
  );
}
