"use client";
// The floating laterite tile (soil strata edge), the street in front of the plot, the EB pole + street lamp,
// a milestone with the town name (from the plot data) and a rain puddle.
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { offsetPolygon, type Pt, type SiteLayout } from "@/lib/site-layout";
import type { Env } from "./env";
import { box, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { G, PAL, std } from "./materials";
import { asphaltTex, earthTex, glowTex, milestoneTex, plasterTex, strataTex, withRepeat } from "./textures";
import { FLAT, planShape, rng, type World } from "./util";

/** x of a polygon edge (a → b) at plan z. */
const xOnEdge = (a: Pt, b: Pt, z: number) => (Math.abs(b.z - a.z) < 1e-9 ? a.x : a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z));

export function tileXRange(layout: SiteLayout, z: number): [number, number] {
  const [FL, FR, BR, BL] = layout.site.tile;
  return [xOnEdge(FL, BL, z), xOnEdge(FR, BR, z)];
}

const BANDS = [
  { inset: 0, top: 0, bottom: -1.2, color: "#4e3322", bevel: 0.35, vRep: 1.2 },
  { inset: 0.5, top: -1.2, bottom: -5.6, color: "#cf6a35", bevel: 0.3, vRep: 4.4 },
  { inset: 1.4, top: -5.6, bottom: -8.6, color: "#8b3a24", bevel: 0.3, vRep: 3 },
  { inset: 3.0, top: -8.6, bottom: -12, color: "#5f5754", bevel: 0.6, vRep: 3.4 },
];

export function Tile({ layout, world }: { layout: SiteLayout; world: World }) {
  const tile = layout.site.tile;
  const key = tile.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(";") + world.cx.toFixed(2) + world.cz.toFixed(2);
  const bands = useMemo(() => {
    return BANDS.map((b, i) => {
      const pts = b.inset ? offsetPolygon(tile, -b.inset) : tile;
      const h = b.top - b.bottom;
      const geo = new THREE.ExtrudeGeometry(planShape(pts, world), {
        depth: h - b.bevel * 2,
        bevelEnabled: true,
        bevelThickness: b.bevel,
        bevelSize: b.bevel,
        bevelSegments: 2,
        curveSegments: 1,
      });
      const side = std(b.color, { map: withRepeat(strataTex(), 1 / 18, 1 / b.vRep, 0, 1 - 1 / b.vRep), rough: 0.95 });
      const cap = i === 0 ? std("#ffffff", { map: withRepeat(earthTex(), 1 / 46, 1 / 46), rough: 1 }) : side;
      return { geo, mats: [cap, side], y: b.bottom + b.bevel };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => bands.forEach((b) => b.geo.dispose()), [bands]);

  // hanging rocks under the island
  const rocks = useMemo(() => {
    const base = offsetPolygon(tile, -6);
    const xs = base.map((p) => p.x);
    const zs = base.map((p) => p.z);
    const r = rng(77);
    const out: { x: number; z: number; h: number; s: number; rot: number }[] = [];
    for (let i = 0; i < 14; i++) {
      out.push({ x: Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z: Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs)), h: 3 + r() * 9, s: 2.5 + r() * 4, rot: r() * 6 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const rockGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 5, 1), []);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = rockRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    rocks.forEach((rk, i) => {
      o.position.set(world.x(rk.x), -11.4 - rk.h / 2, world.z(rk.z));
      o.rotation.set(Math.PI, rk.rot, 0);
      o.scale.set(rk.s, rk.h, rk.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rocks, world]);

  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={b.mats} rotation={FLAT} position={[0, b.y, 0]} receiveShadow={i === 0} castShadow={i === 0} />
      ))}
      <instancedMesh ref={rockRef} args={[rockGeo, std("#6a5650", { flat: true }), rocks.length]} />
    </group>
  );
}

function quad(layout: SiteLayout, z0: number, z1: number, inset = 0): Pt[] {
  const [a0, b0] = tileXRange(layout, z0);
  const [a1, b1] = tileXRange(layout, z1);
  return [
    { x: a0 + inset, z: z0 },
    { x: b0 - inset, z: z0 },
    { x: b1 - inset, z: z1 },
    { x: a1 + inset, z: z1 },
  ];
}

export function Street({ layout, world }: { layout: SiteLayout; world: World }) {
  const st = layout.site.street;
  const key = `${st.x0},${st.x1},${world.cx},${world.cz}`;
  const geos = useMemo(() => {
    const road = new THREE.ExtrudeGeometry(planShape(quad(layout, st.road[0], st.road[1], 0.05), world), { depth: 0.2, bevelEnabled: false });
    const near = new THREE.ShapeGeometry(planShape(quad(layout, st.nearShoulder[0], st.nearShoulder[1], 0.3), world));
    const far = new THREE.ShapeGeometry(planShape(quad(layout, st.farShoulder[0], st.farShoulder[1], 0.3), world));
    const drain = new THREE.ShapeGeometry(planShape(quad(layout, st.drain[0] + 0.3, st.drain[1] - 0.3, 0.3), world));
    return { road, near, far, drain };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  // own texture instance: its offset follows the (animated) layout centre without creating new textures
  const roadTex = useMemo(() => {
    const t = asphaltTex().clone();
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => roadTex.dispose(), [roadTex]);
  const roadMats = useMemo(() => [new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }), std("#2f2f33", { rough: 0.9 })], [roadTex]);
  useEffect(() => () => roadMats[0].dispose(), [roadMats]);
  useEffect(() => {
    const w = st.road[1] - st.road[0];
    roadTex.repeat.set(1 / 32, 1 / w);
    roadTex.offset.set(0, -(st.road[0] - world.cz) / w);
  }, [roadTex, st.road, world.cz]);
  const mud = std("#8a4f33", { map: withRepeat(plasterTex(), 1 / 6, 1 / 6), rough: 1, polygonOffset: 1 });

  // drain curbs + slabs at the gates
  const [dx0, dx1] = tileXRange(layout, st.drain[0]);
  const len = dx1 - dx0 - 0.6;
  const midX = (dx0 + dx1) / 2;
  const slabs = layout.compoundWalls.filter((w) => w.kind === "gate");
  return (
    <group>
      <mesh geometry={geos.road} material={roadMats} rotation={FLAT} position={[0, 0.001, 0]} receiveShadow />
      <mesh geometry={geos.near} material={mud} rotation={FLAT} position={[0, 0.03, 0]} receiveShadow />
      <mesh geometry={geos.far} material={mud} rotation={FLAT} position={[0, 0.03, 0]} receiveShadow />
      <mesh geometry={geos.drain} material={std("#26302c", { rough: 0.25, metal: 0.2, polygonOffset: 2 })} rotation={FLAT} position={[0, 0.06, 0]} />
      {[st.drain[0] + 0.15, st.drain[1] - 0.15].map((z, i) => (
        <mesh key={i} geometry={G.box()} material={std(PAL.concrete, { rough: 0.95 })} position={[world.x(midX), 0.22, world.z(z)]} scale={[len, 0.44, 0.3]} castShadow receiveShadow />
      ))}
      {slabs.map((s, i) => (
        <mesh
          key={i}
          geometry={G.box()}
          material={std(PAL.concreteDark, { rough: 0.95 })}
          position={[world.x((s.a.x + s.b.x) / 2), 0.47, world.z((st.drain[0] + st.drain[1]) / 2)]}
          scale={[Math.abs(s.b.x - s.a.x) + 0.6, 0.16, st.drain[1] - st.drain[0] + 0.2]}
          receiveShadow
        />
      ))}
    </group>
  );
}

/** Concrete EB pole with cross-arm, insulators, a street lamp (switches on at dusk) and sagging wires. */
export function PoleAndLamp({ layout, world, env, lampLight }: { layout: SiteLayout; world: World; env: RefObject<Env>; lampLight: boolean }) {
  const st = layout.site.street;
  const zPole = (st.nearShoulder[0] + st.nearShoulder[1]) / 2 + 0.4;
  const [tx0, tx1] = tileXRange(layout, zPole);
  const poles = [layout.plot.polygon[0].x - 3.2, Math.min(tx1 - 4, layout.plot.rightX + 10)];
  const H = 26;
  const light = useRef<THREE.PointLight>(null);
  const bulbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffcf87", emissiveIntensity: 0, toneMapped: false }), []);
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex(), color: "#ffc677", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), []);
  useEffect(() => () => [bulbMat, haloMat].forEach((m) => m.dispose()), [bulbMat, haloMat]);
  useFrame(() => {
    const l = env.current.lamps;
    bulbMat.emissiveIntensity = 0.2 + l * 6;
    haloMat.opacity = l * 0.55;
    if (light.current) light.current.intensity = l * 520;
  });

  const wireY = H - 1.2;
  const wires = useMemo(() => {
    const out: [number, number, number][][] = [];
    const ends = [tx0 + 0.6, ...poles, tx1 - 0.6];
    for (const dz of [-0.9, 0, 0.9]) {
      for (let s = 0; s < ends.length - 1; s++) {
        const a = ends[s];
        const b = ends[s + 1];
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const sag = Math.sin(t * Math.PI) * (Math.abs(b - a) * 0.035);
          pts.push([world.x(a + (b - a) * t), wireY + 0.2 - sag, world.z(zPole) + dz]);
        }
        out.push(pts);
      }
    }
    // service drop to the front building
    const f = layout.slots.find((s) => s.slot === "front" && s.unit);
    if (f) {
      const a: [number, number, number] = [world.x(poles[0]), wireY - 1.5, world.z(zPole)];
      const b: [number, number, number] = [world.x(f.rect.x0 + 0.6), f.heightFt + 1, world.z(f.rect.z0 + 0.6)];
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 1.2, a[2] + (b[2] - a[2]) * t]);
      }
      out.push(pts);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx0, tx1, poles[0], poles[1], zPole, world, layout.slots]);

  const poleParts = useMemo<Part[]>(
    () =>
      poles.flatMap((x, i) => {
        const X = world.x(x);
        const Z = world.z(zPole);
        const parts: Part[] = [
          rod([X, H / 2, Z], [0.75, H, 0.75], "#b9b3aa"),
          box([X, wireY, Z], [0.3, 0.3, 3.4], "#5b5b5b"),
          ...[-0.9, 0, 0.9].map((dz) => rod([X, wireY + 0.35, Z + dz], [0.2, 0.45, 0.2], "#e8e2d6")),
        ];
        if (i === 0) parts.push(box([X, H - 5.6, Z + 2.2], [0.22, 0.22, 4.4], "#2b2b2b", [0.12, 0, 0]), box([X, H - 5.25, Z + 4.4], [0.85, 0.32, 1.7], "#2b2b2b"));
        return parts;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poles[0], poles[1], zPole, world, H, wireY],
  );
  return (
    <group>
      <Baked parts={poleParts} cast material={vcMaterial(0.8)} />
      {poles.map((x, i) => (
        <group key={i} position={[world.x(x), 0, world.z(zPole)]}>
          {i === 0 && (
            <>
              <mesh geometry={G.box()} material={bulbMat} scale={[0.62, 0.08, 1.3]} position={[0, H - 5.45, 4.4]} />
              <sprite material={haloMat} scale={[7, 7, 1]} position={[0, H - 5.7, 4.4]} />
              {lampLight && <pointLight ref={light} color="#ffc27a" distance={70} decay={1.6} position={[0, H - 6.3, 4.4]} intensity={0} />}
            </>
          )}
        </group>
      ))}
      {wires.map((pts, i) => (
        <Line key={i} points={pts} color="#141414" lineWidth={1.1} transparent opacity={0.85} />
      ))}
    </group>
  );
}

/** Yellow-capped Tamil Nadu milestone showing the plot's town name. */
export function Milestone({ layout, world }: { layout: SiteLayout; world: World }) {
  const st = layout.site.street;
  const z = (st.farShoulder[0] + st.farShoulder[1]) / 2;
  const [tx0] = tileXRange(layout, z);
  const x = tx0 + 7;
  const face = std("#ffffff", { map: milestoneTex(layout.plot.townName), rough: 0.8 });
  const body = std(PAL.white, { rough: 0.85 });
  return (
    <group position={[world.x(x), 0, world.z(z)]} rotation={[0, 0.25, 0]}>
      <mesh geometry={G.box()} material={[body, body, body, body, face, body]} scale={[1.7, 2.3, 0.7]} position={[0, 1.15, 0]} castShadow receiveShadow />
      <mesh geometry={G.cyl()} material={std("#f2c230", { rough: 0.7 })} scale={[1.7, 0.7, 1.7]} position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
    </group>
  );
}

const PUDDLE_FRAG = /* glsl */ `
  uniform vec3 uSky; uniform vec3 uTop; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float edge = 1.0 - smoothstep(0.75, 1.0, r + 0.08 * sin(atan(p.y, p.x) * 5.0));
    float rip = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 c = vec2(sin(fi * 2.4) * 0.4, cos(fi * 1.7) * 0.3);
      float t = fract(uTime * 0.35 + fi * 0.33);
      float d = length(p - c);
      rip += (1.0 - smoothstep(0.0, 0.05, abs(d - t * 0.9))) * (1.0 - t);
    }
    vec3 col = mix(uSky, uTop, 0.45 + p.y * 0.3) * 0.8 + vec3(rip * 0.35);
    gl_FragColor = vec4(col, edge * 0.92);
    #include <colorspace_fragment>
  }
`;

export function Puddle({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const st = layout.site.street;
  const z = (st.nearShoulder[0] + st.nearShoulder[1]) / 2 - 0.4;
  const x = layout.plot.rightX + 4;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSky: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: PUDDLE_FRAG,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    mat.uniforms.uSky.value.copy(env.current.skyHorizon);
    mat.uniforms.uTop.value.copy(env.current.skyTop);
    mat.uniforms.uTime.value = clock.elapsedTime;
  });
  return <mesh geometry={G.plane()} material={mat} rotation={FLAT} position={[world.x(x), 0.07, world.z(z)]} scale={[4.2, 2.4, 1]} />;
}
