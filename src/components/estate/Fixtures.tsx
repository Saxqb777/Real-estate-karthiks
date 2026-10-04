"use client";
// Street-front furniture that doubles as data entry points (DESIGN.md "World objects = data entry points"):
//   mailbox on the main-gate pillar → payments · notice board on the lane wall → to-dos ·
//   EB pole + meter (on the grass by the gate) → electricity · tax stamp on the gate pillar → property tax · survey stone + flag → plot.
// Positions come from layout.fixtures (src/lib/site-layout.ts, unit tested). Each is a <Hotspot>.
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { gustAt, type Env } from "./env";
import { Hotspot, type V3 } from "./Interact";
import { box, cone, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { G, std } from "./materials";
import { WireCrows } from "./People";
import { bambooLatticeTex, bambooMatTex, glowTex, officeBoardTex, taxStampTex } from "./textures";
import { PropertyOfficer } from "./People";
import type { World } from "./util";

const PILLAR = 0.95;

/** Optional data cues shown on the objects themselves (all optional; the world looks lived-in without them). */
export interface WorldCues {
  /** open to-dos → notes pinned on the notice board (max 6) */
  todos?: number;
  /** rent waiting to be recorded → a letter sticking out of the mailbox */
  mail?: boolean;
  /** property tax this year: "paid" ✓ / "due" in red on the stamp */
  tax?: "paid" | "due";
}

function useTamilFont(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const fam = getComputedStyle(document.body).getPropertyValue("--font-tamil").trim();
    if (!fam || !document.fonts?.load) return;
    document.fonts
      .load(`700 30px ${fam}`, "அறிவிப்பு")
      .then((faces) => alive && setOk(faces.length > 0))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}
export { useTamilFont };

export function Fixtures({ layout, world, env, cues, lampLight, crows }: { layout: SiteLayout; world: World; env: RefObject<Env>; cues?: WorldCues; lampLight: boolean; crows: boolean }) {
  const tamil = useTamilFont();
  return (
    <group>
      <PoleAndMeter layout={layout} world={world} env={env} lampLight={lampLight} crows={crows} />
      <Mailbox layout={layout} world={world} mail={!!cues?.mail} />
      {/* the to-dos live with the property officer who walks round the compound (People.tsx) */}
      <PropertyOfficer layout={layout} world={world} env={env} />
      <TaxStamp layout={layout} world={world} state={cues?.tax ?? "plain"} tamil={tamil} />
      <PlotMarker layout={layout} world={world} env={env} />
    </group>
  );
}

// ───────────────────────────── mailbox ─────────────────────────────

function Mailbox({ layout, world, mail }: { layout: SiteLayout; world: World; mail: boolean }) {
  const m = layout.fixtures.mailbox;
  const X = world.x(m.x);
  const Z = world.z(m.z - PILLAR / 2 - 0.42);
  const parts = useMemo<Part[]>(() => {
    const red = "#b3262b";
    const p: Part[] = [
      box([0, 3.35, 0], [1.4, 1.75, 0.8], red),
      box([0, 4.32, -0.05], [1.55, 0.22, 1.0], "#8e1c20", [0.22, 0, 0]),
      box([0, 3.9, 0.41], [0.9, 0.09, 0.03], "#1a1a1a"), // letter slot
      box([0, 3.35, 0.41], [1.2, 0.26, 0.02], "#f4f1ea"), // painted band
      box([0.42, 2.85, 0.41], [0.14, 0.14, 0.04], "#d4a72c"), // lock
      box([0, 2.42, -0.2], [0.7, 0.16, 0.5], "#4a4a4a"), // bracket
    ];
    if (mail) p.push(box([-0.12, 4.02, 0.44], [0.62, 0.36, 0.04], "#fbf6e8", [0, 0, 0.12]));
    return p;
  }, [mail]);
  const anchor = useMemo<V3>(() => [X, 4.9, Z], [X, Z]);
  return (
    <Hotspot spot={{ key: "mailbox", kind: "mailbox", anchor }} hit={<mesh geometry={G.box()} position={[X, 3.3, Z]} scale={[2.6, 3.4, 2.0]} visible={false} />}>
      <group position={[X, 0, Z]}>
        <Baked parts={parts} cast material={vcMaterial(0.45)} />
      </group>
    </Hotspot>
  );
}

// ───────────────────────────── property-tax office (bamboo village hut) ─────────────────────────────

/**
 * A mini bamboo village office on the grass right of the plot (owner's sample photo): split-bamboo mat walls framed by
 * battens, a bamboo door, a big woven-lattice window, a lattice gable under a dried coconut-leaf thatched roof, a
 * "PROPERTY TAX OFFICE" board over the door with the round tax seal (paid ✓ / due / plain), a bench outside.
 * Clicking it opens property tax.
 */
function TaxStamp({ layout, world, state, tamil }: { layout: SiteLayout; world: World; state: "paid" | "due" | "plain"; tamil: boolean }) {
  const t = layout.fixtures.taxStamp;
  const X = world.x(t.x);
  const Z = world.z(t.z);
  const W = 7.5; // across the front (x)
  const D = 6; // deep (z)
  const H = 6.4; // wall height
  const B = 0.25; // stone footing
  const top = B + H;
  const eave = 1.1;
  const run = W / 2 + eave;
  const rise = 3.2;
  const gableH = (rise * (W / 2)) / run;
  const fz = D / 2; // the front faces the plot's front (plan −z) = world +z
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: taxStampTex(state, tamil), roughness: 0.45, metalness: 0.25, transparent: true }), [state, tamil]);
  useEffect(() => () => face.dispose(), [face]);
  const disc = useMemo(() => new THREE.CircleGeometry(0.5, 28), []);
  useEffect(() => () => disc.dispose(), [disc]);
  const boardMat = useMemo(() => {
    const tex = officeBoardTex();
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.35, roughness: 0.7 });
  }, []);
  useEffect(() => () => boardMat.dispose(), [boardMat]);
  const mat = useMemo(() => {
    const m = bambooMatTex().clone();
    m.repeat.set(2.5, 2);
    m.needsUpdate = true;
    const l = bambooLatticeTex().clone(); // gable: UVs in feet
    l.repeat.set(0.9, 0.9);
    l.needsUpdate = true;
    const lw = bambooLatticeTex().clone(); // window: UVs 0..1 over ~3 × 2.3 ft
    lw.repeat.set(2.7, 2.1);
    lw.needsUpdate = true;
    return {
      wall: new THREE.MeshStandardMaterial({ map: m, roughness: 0.9 }),
      lattice: new THREE.MeshStandardMaterial({ map: l, roughness: 0.9, side: THREE.DoubleSide }),
      window: new THREE.MeshStandardMaterial({ map: lw, roughness: 0.9 }),
      dispose() {
        m.dispose();
        l.dispose();
        lw.dispose();
        this.window.dispose();
        this.wall.dispose();
        this.lattice.dispose();
      },
    };
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  // gable triangles (front + back), lattice infill; UVs in feet so the weave keeps its size
  const gable = useMemo(() => {
    const sh = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, gableH)]);
    return new THREE.ShapeGeometry(sh);
  }, [gableH]);
  useEffect(() => () => gable.dispose(), [gable]);
  const frame = "#8f7440";
  const parts = useMemo<Part[]>(
    () => [
      box([0, B / 2, 0], [W + 0.4, B, D + 0.4], "#8d7f6c"), // stone footing
      // corner posts + battens framing the mat panels
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([(sx * W) / 2, B + H / 2, (sz * D) / 2], [0.32, H, 0.32], frame))),
      box([0, B + H - 0.1, fz + 0.04], [W, 0.22, 0.12], frame),
      box([0, B + 2.4, fz + 0.04], [W, 0.16, 0.1], frame),
      // bamboo door (left) with cane battens
      box([-1.9, B + 2.85, fz + 0.06], [2.2, 5.7, 0.1], "#c2a466"),
      ...[-0.6, 0.3].map((dy) => box([-1.9, B + 2.85 + dy * 3, fz + 0.12], [2.2, 0.12, 0.06], frame)),
      box([-1.9, B + 2.85, fz + 0.12], [0.1, 5.6, 0.06], frame),
      // window frame round the lattice (right)
      box([1.55, B + 2.55, fz + 0.08], [3.2, 0.16, 0.1], frame),
      box([1.55, B + 4.95, fz + 0.08], [3.2, 0.16, 0.1], frame),
      box([0.0, B + 3.75, fz + 0.08], [0.16, 2.55, 0.1], frame),
      box([3.1, B + 3.75, fz + 0.08], [0.16, 2.55, 0.1], frame),
      // ridge pole
      // bench outside
      box([2.0, 1.05, fz + 1.5], [3.0, 0.16, 0.9], "#7a5233"),
      ...[-1.2, 1.2].map((dx) => box([2.0 + dx, 0.7, fz + 1.5], [0.16, 0.7, 0.8], "#5c3c22")),
    ],
    [B, H, W, D, fz],
  );
  const slope = Math.atan2(rise, run);
  // dried coconut-leaf thatch (owner: leaf, not bamboo): overlapping courses of plaited fronds down each slope, every
  // course ending in a ragged row of hanging leaf blades, and a row of leaves folded over the ridge
  const leafRoof = useMemo<Part[]>(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tones = ["#a48a52", "#8e7744", "#b39b62", "#7c6a3c", "#9a8a4e", "#857f45"];
    const tone = () => tones[Math.floor(rnd() * tones.length)];
    const out: Part[] = [];
    const L = Math.hypot(run, rise);
    const courses = 5;
    const depth = D + 1.0;
    for (const sx of [-1, 1]) {
      const rz = -sx * slope;
      for (let k = 0; k < courses; k++) {
        const t0 = k / courses;
        const t1 = (k + 1) / courses + 0.06;
        const tm = (t0 + t1) / 2;
        // a point at fraction t down the slope (0 = ridge, 1 = eave), lifted a little so lower courses lap over
        const at = (t: number, lift: number): [number, number] => [sx * run * t, top + rise * (1 - t) + 0.2 + lift];
        const [cx, cy] = at(tm, 0.06 * (courses - k));
        out.push(box([cx, cy, 0], [L * (t1 - t0) + 0.1, 0.16, depth], tone(), [0, 0, rz]));
        // ragged leaf blades hanging off the course's lower edge
        const [ex, ey] = at(t1, 0.06 * (courses - k) - 0.05);
        const n = 26;
        for (let i = 0; i < n; i++) {
          const z = -depth / 2 + ((i + 0.5) / n) * depth + (rnd() - 0.5) * 0.18;
          const bl = 0.55 + rnd() * (k === courses - 1 ? 0.9 : 0.45);
          const droop = slope + 0.25 + rnd() * 0.35;
          out.push(box([ex + sx * Math.cos(droop) * bl * 0.4, ey - Math.sin(droop) * bl * 0.4, z], [bl, 0.035, 0.2], tone(), [rnd() * 0.25 - 0.12, (rnd() - 0.5) * 0.25, -sx * droop]));
        }
      }
    }
    // leaves folded over the ridge
    const n = 22;
    for (let i = 0; i < n; i++) {
      const z = -(D + 1.1) / 2 + ((i + 0.5) / n) * (D + 1.1);
      for (const sx of [-1, 1]) out.push(box([sx * 0.35, top + rise + 0.32, z], [0.95, 0.05, 0.26], tone(), [0, (rnd() - 0.5) * 0.3, -sx * (slope + 0.15)]));
    }
    // ragged ends along the front and back rakes
    for (const zf of [-1, 1])
      for (const sx of [-1, 1])
        for (let i = 0; i < 9; i++) {
          const t = (i + 0.5) / 9;
          out.push(box([sx * run * t, top + rise * (1 - t) + 0.05, zf * ((D + 1.0) / 2 + 0.12)], [0.2, 0.55 + rnd() * 0.35, 0.04], tone(), [zf * 0.35, 0, -sx * slope * 0.3]));
        }
    return out;
  }, [run, rise, top, slope, D]);
  const anchor = useMemo<V3>(() => [X, top + rise + 2.6, Z], [X, Z, top, rise]);
  return (
    <Hotspot spot={{ key: "taxstamp", kind: "taxstamp", anchor }}>
      {/* turned to face south-west (towards the front-left, owner) */}
      <group position={[X, 0, Z]} rotation={[0, -Math.PI / 4, 0]}>
        <mesh geometry={G.box()} position={[0, 4.8, 0]} scale={[W + 2, 9.6, D + 2]} visible={false} />
        {/* mat walls */}
        <mesh geometry={G.box()} material={mat.wall} position={[0, B + H / 2, 0]} scale={[W, H, D]} castShadow receiveShadow />
        <Baked parts={parts} cast material={vcMaterial(0.9)} />
        {/* woven lattice window + gables front and back */}
        <mesh geometry={G.plane()} material={mat.window} position={[1.55, B + 3.75, fz + 0.07]} scale={[2.95, 2.3, 1]} />
        <mesh geometry={gable} material={mat.lattice} position={[0, top, fz - 0.05]} />
        <mesh geometry={gable} material={mat.lattice} position={[0, top, -fz + 0.05]} rotation={[0, Math.PI, 0]} />
        {/* dried coconut-leaf thatch */}
        <Baked parts={leafRoof} cast receive material={vcMaterial(1)} />
        {/* name board over the door + the round tax seal beside it */}
        <mesh geometry={G.plane()} material={boardMat} position={[-0.3, top + 0.25, fz + 0.2]} scale={[4.6, 1.0, 1]} />
        <mesh geometry={disc} material={face} position={[2.75, top + 0.25, fz + 0.21]} scale={1.05} />
      </group>
    </Hotspot>
  );
}

// ───────────────────────────── survey stone + ranging flag ─────────────────────────────

function PlotMarker({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const p = layout.fixtures.plotMarker;
  const X = world.x(p.x);
  const Z = world.z(p.z);
  const parts = useMemo<Part[]>(() => {
    const out: Part[] = [
      box([0, 0.85, 0], [0.85, 1.7, 0.85], "#ece6da"),
      box([0, 1.78, 0], [0.9, 0.18, 0.9], "#b3262b"),
      box([0, 0.1, 0], [1.4, 0.2, 1.4], "#9a8f80"),
    ];
    // ranging rod: red / white bands
    for (let i = 0; i < 7; i++) out.push(rod([0.75, 0.5 + i + 0.5, 0.3], [0.14, 1.0, 0.14], i % 2 ? "#f4f1ea" : "#c22d2d"));
    return out;
  }, []);
  const flag = useRef<THREE.Mesh>(null);
  const flagGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1.6, -0.35, 0, 0, -0.75, 0], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => flagGeo.dispose(), [flagGeo]);
  useFrame(() => {
    const f = flag.current;
    if (!f) return;
    const e = env.current;
    const g = gustAt(e, X, Z);
    // flag streams downwind and flutters harder in a gust
    f.rotation.y = -Math.atan2(e.windDir[1], e.windDir[0]) + Math.sin(e.t * (6 + g * 8)) * (0.12 + g * 0.18);
  });
  const anchor = useMemo<V3>(() => [X + 0.75, 8.6, Z + 0.3], [X, Z]);
  return (
    <Hotspot spot={{ key: "plot", kind: "plot", anchor }} hit={<mesh geometry={G.box()} position={[X + 0.4, 3.8, Z + 0.2]} scale={[2.6, 7.8, 2.6]} visible={false} />}>
      <group position={[X, 0, Z]}>
        <Baked parts={parts} cast material={vcMaterial(0.8)} />
        <mesh ref={flag} geometry={flagGeo} material={std("#ffb547", { side: THREE.DoubleSide, rough: 0.8 })} position={[0.75, 7.45, 0.3]} />
      </group>
    </Hotspot>
  );
}

// ───────────────────────────── EB poles, meter, lamp, wires ─────────────────────────────

function PoleAndMeter({ layout, world, env, lampLight, crows }: { layout: SiteLayout; world: World; env: RefObject<Env>; lampLight: boolean; crows: boolean }) {
  const fx = layout.fixtures;
  const H = fx.poleHeightFt;
  const [p0, p1] = fx.poles;
  const zPole = p0.z;
  const tile = layout.site.tile;
  const xOn = (a: { x: number; z: number }, b: { x: number; z: number }, z: number) => (Math.abs(b.z - a.z) < 1e-9 ? a.x : a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z));
  const tx0 = xOn(tile[0], tile[3], zPole);
  const tx1 = xOn(tile[1], tile[2], zPole);
  const light = useRef<THREE.PointLight>(null);
  const bulbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffcf87", emissiveIntensity: 0, toneMapped: false }), []);
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex(), color: "#ffc677", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), []);
  const dialMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9f2e6", emissive: "#9fe0c0", emissiveIntensity: 0, roughness: 0.3 }), []);
  useEffect(() => () => [bulbMat, haloMat, dialMat].forEach((m) => m.dispose()), [bulbMat, haloMat, dialMat]);
  useFrame(() => {
    const l = env.current.lamps;
    bulbMat.emissiveIntensity = 0.2 + l * 6;
    haloMat.opacity = l * 0.55;
    dialMat.emissiveIntensity = 0.15 + l * 0.8;
    if (light.current) light.current.intensity = l * 560;
  });

  const wireY = H - 1.2;
  const wires = useMemo(() => {
    const out: V3[][] = [];
    const ends = [tx0 + 0.6, p0.x, p1.x, tx1 - 0.6].sort((a, b) => a - b);
    for (const dz of [-0.9, 0, 0.9]) {
      for (let s = 0; s < ends.length - 1; s++) {
        const a = ends[s];
        const b = ends[s + 1];
        const pts: V3[] = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const sag = Math.sin(t * Math.PI) * (Math.abs(b - a) * 0.035);
          pts.push([world.x(a + (b - a) * t), wireY + 0.2 - sag, world.z(zPole) + dz]);
        }
        out.push(pts);
      }
    }
    // service drop to the front building's front-right corner (the poles stand right of the plot)
    const f = layout.slots.find((s) => s.slot === "front" && s.unit);
    if (f) {
      const a: V3 = [world.x(p0.x), wireY - 1.5, world.z(zPole)];
      // anchored on the outside of the front wall just under the roof (not over the parapet onto the terrace)
      const b: V3 = [world.x(f.rect.x1 - 0.9), f.heightFt - 1.3, world.z(f.rect.z0 - 0.15)];
      const pts: V3[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 1.2, a[2] + (b[2] - a[2]) * t]);
      }
      out.push(pts);
    }
    // meter cable down the pole
    out.push([
      [world.x(p0.x) + 0.42, wireY - 1.6, world.z(zPole) + 0.35],
      [world.x(p0.x) + 0.42, 8.2, world.z(zPole) + 0.45],
    ]);
    return out;
  }, [tx0, tx1, p0.x, p1.x, zPole, world, wireY, layout.slots]);

  const wireSegments = useMemo(() => wires.flatMap((pts) => pts.slice(1).flatMap((p, i) => [pts[i], p])), [wires]);

  // crows sit on the middle wire between the two poles
  const crowSpots = useMemo<V3[]>(() => {
    const a = p0.x;
    const b = p1.x;
    return [0.28, 0.36, 0.62].map((t) => [world.x(a + (b - a) * t), wireY + 0.2 - Math.sin(t * Math.PI) * (Math.abs(b - a) * 0.035) + 0.05, world.z(zPole)]);
  }, [p0.x, p1.x, wireY, world, zPole]);

  const poleParts = (x: number, lamp: boolean): Part[] => {
    const X = world.x(x);
    const Z = world.z(zPole);
    const parts: Part[] = [
      rod([X, H / 2, Z], [0.75, H, 0.75], "#b9b3aa"),
      rod([X, 0.5, Z], [1.0, 1.0, 1.0], "#8f877b"),
      box([X, wireY, Z], [0.3, 0.3, 3.4], "#5b5b5b"),
      ...[-0.9, 0, 0.9].map((dz) => rod([X, wireY + 0.35, Z + dz], [0.2, 0.45, 0.2], "#e8e2d6")),
    ];
    if (lamp) {
      parts.push(box([X, H - 5.6, Z + 2.2], [0.22, 0.22, 4.4], "#2b2b2b", [0.12, 0, 0]), box([X, H - 5.25, Z + 4.4], [0.85, 0.32, 1.7], "#2b2b2b"));
      // TNPDCL meter box on the street face + a cut-out fuse box
      parts.push(box([X, 7.2, Z + 0.62], [1.15, 1.55, 0.5], "#8d9196"), box([X, 8.1, Z + 0.66], [1.25, 0.14, 0.62], "#6c7075"), box([X, 5.6, Z + 0.55], [0.8, 0.7, 0.36], "#7a7e83"));
      parts.push(cone([X, 9.6, Z + 0.42], [0.3, 0.5, 0.3], "#2b2b2b"));
    }
    return parts;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pole0 = useMemo(() => poleParts(p0.x, true), [p0.x, zPole, world, H, wireY]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pole1 = useMemo(() => poleParts(p1.x, false), [p1.x, zPole, world, H, wireY]);
  const X0 = world.x(p0.x);
  const Z0 = world.z(zPole);
  const anchor = useMemo<V3>(() => [X0, 10.2, Z0 + 0.6], [X0, Z0]);
  return (
    <group>
      <Hotspot spot={{ key: "pole", kind: "pole", anchor }} hit={<mesh geometry={G.box()} position={[X0, H / 2, Z0 + 0.4]} scale={[2.4, H, 2.4]} visible={false} />}>
        <Baked parts={pole0} cast material={vcMaterial(0.75)} />
        <mesh geometry={G.cyl()} material={dialMat} position={[X0, 7.3, Z0 + 0.88]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 0.04, 0.5]} />
      </Hotspot>
      <Baked parts={pole1} cast material={vcMaterial(0.75)} />
      <group position={[X0, 0, Z0]}>
        <mesh geometry={G.box()} material={bulbMat} scale={[0.62, 0.08, 1.3]} position={[0, H - 5.45, 4.4]} />
        <sprite material={haloMat} scale={[7, 7, 1]} position={[0, H - 5.7, 4.4]} />
        {lampLight && <pointLight ref={light} color="#ffc27a" distance={75} decay={1.6} position={[0, H - 6.3, 4.4]} intensity={0} />}
      </group>
      {/* every wire in one draw call: polylines → segment pairs */}
      <Line points={wireSegments} segments color="#141414" lineWidth={1.1} transparent opacity={0.85} />
      {crows && <WireCrows points={crowSpots} env={env} />}
    </group>
  );
}
