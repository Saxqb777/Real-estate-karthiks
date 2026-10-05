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
import { ball, box, cone, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { LandCruiser } from "./LandCruiser";
import { G, std } from "./materials";
import { WireCrows } from "./People";
import { bambooLatticeTex, bambooMatTex, glowTex, kolamTex } from "./textures";
import { PoliceGuard, PropertyOfficer } from "./People";
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
  return (
    <group>
      <PoleAndMeter layout={layout} world={world} env={env} lampLight={lampLight} crows={crows} />
      <Mailbox layout={layout} world={world} mail={!!cues?.mail} />
      {/* the to-dos live with the property officer who walks round the compound (People.tsx) */}
      <PropertyOfficer layout={layout} world={world} env={env} />
      <TaxStamp layout={layout} world={world} env={env} />
      <ParkedCar layout={layout} world={world} />
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

/** Deterministic pseudo-random sequence (so the thatch looks the same on every load). */
function seeded(seed: number) {
  let v = seed;
  return () => (v = (v * 16807) % 2147483647) / 2147483647;
}

/**
 * Overlapping courses of dried coconut-leaf thatch on one roof plane, each course ending in a ragged row of hanging
 * blades. The plane runs from `hi` (ridge / wall top) down to `lo` along local +a, `width` wide across it.
 * `axis` "x": the slope runs along x (sx = ±1), "z": along +z (a lean-to porch).
 */
function thatchPlane(o: { axis: "x" | "z"; sx?: number; hi: [number, number]; lo: [number, number]; width: number; courses: number; blades: number; rnd: () => number; tones: string[] }): Part[] {
  const out: Part[] = [];
  const [h0, y0] = o.hi;
  const [h1, y1] = o.lo;
  const run = Math.abs(h1 - h0);
  const drop = y0 - y1;
  const ang = Math.atan2(drop, run);
  const L = Math.hypot(run, drop);
  const tone = () => o.tones[Math.floor(o.rnd() * o.tones.length)];
  const sx = o.sx ?? 1;
  const at = (t: number, lift: number): [number, number] => [h0 + (h1 - h0) * t, y0 - drop * t + lift];
  for (let k = 0; k < o.courses; k++) {
    const t0 = k / o.courses;
    const t1 = (k + 1) / o.courses + 0.16;
    const lift = 0.22 + 0.07 * (o.courses - k);
    const [ch, cy] = at((t0 + t1) / 2, lift);
    const seg = L * (t1 - t0) + 0.12;
    // dark base layer for the course, then loose leaf strips laid over it so it reads as layered fronds, not planks
    const base = o.rnd() < 0.5 ? "#6a5a32" : "#73633a";
    if (o.axis === "x") out.push(box([ch, cy, 0], [seg, 0.17, o.width], base, [0, 0, -sx * ang]));
    else out.push(box([0, cy, ch], [o.width, 0.17, seg], base, [ang, 0, 0]));
    for (const f of [0.3, 0.72]) {
      const [sh, sy] = at(t0 + (t1 - t0) * f, lift + 0.1);
      const sl = seg * 0.75;
      for (let i = 0; i < o.blades; i++) {
        const w = -o.width / 2 + ((i + 0.5 + (f > 0.5 ? 0.5 : 0)) / o.blades) * o.width;
        const jy = (o.rnd() - 0.5) * 0.3;
        if (o.axis === "x") out.push(box([sh, sy + o.rnd() * 0.04, w], [sl * (0.8 + o.rnd() * 0.4), 0.04, 0.26], tone(), [o.rnd() * 0.1, jy, -sx * ang]));
        else out.push(box([w, sy + o.rnd() * 0.04, sh], [0.26, 0.04, sl * (0.8 + o.rnd() * 0.4)], tone(), [ang, jy, o.rnd() * 0.1]));
      }
    }
    const [eh, ey] = at(t1, lift - 0.06);
    for (let i = 0; i < o.blades; i++) {
      const w = -o.width / 2 + ((i + 0.5) / o.blades) * o.width + (o.rnd() - 0.5) * 0.2;
      const bl = 0.5 + o.rnd() * (k === o.courses - 1 ? 1.0 : 0.5);
      const droop = ang + 0.3 + o.rnd() * 0.4;
      const dh = Math.cos(droop) * bl * 0.42 * Math.sign(h1 - h0 || 1);
      const dy = -Math.sin(droop) * bl * 0.42;
      if (o.axis === "x") out.push(box([eh + dh, ey + dy, w], [bl, 0.035, 0.2], tone(), [o.rnd() * 0.24 - 0.12, (o.rnd() - 0.5) * 0.3, -sx * droop]));
      else out.push(box([w, ey + dy, eh + dh], [0.2, 0.035, bl], tone(), [droop, (o.rnd() - 0.5) * 0.3, o.rnd() * 0.24 - 0.12]));
    }
  }
  return out;
}

/** A bamboo pole with darker nodes every ~1.3 ft. */
function bamboo(x: number, y0: number, y1: number, z: number, r = 0.2): Part[] {
  const out: Part[] = [rod([x, (y0 + y1) / 2, z], [r * 2, y1 - y0, r * 2], "#b9a061")];
  for (let y = y0 + 0.9; y < y1 - 0.2; y += 1.3) out.push(rod([x, y, z], [r * 2 + 0.07, 0.09, r * 2 + 0.07], "#7f6a37"));
  return out;
}

/**
 * The property-tax office: a little bamboo village office on the grass right of the plot (owner's sample photo),
 * turned to face south-west. Raised mud floor, round bamboo frame with nodes, split-bamboo mat walls, a plank door,
 * a woven lattice window and gable that glow warm at night, a deep dried-coconut-leaf thatch with crossed ridge sticks,
 * a leaf-roofed front porch on bamboo posts with the clerk's desk (stacked files, brass bell, stool), a clay water pot,
 * a hanging lantern that lights the porch after dusk, a bicycle against the side wall, firewood and coconuts at the
 * back, and a kolam at the step. Clicking it opens property tax.
 */
function TaxStamp({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const t = layout.fixtures.taxStamp;
  const X = world.x(t.x);
  const Z = world.z(t.z);
  const W = 7.5; // across the front (x)
  const D = 6; // deep (z)
  const H = 6.2; // wall height
  const B = 0.7; // raised mud floor
  const top = B + H;
  const eave = 1.2;
  const run = W / 2 + eave;
  const rise = 3.4;
  const gableH = (rise * (W / 2)) / run;
  const fz = D / 2; // front wall (local +z)
  const PD = 3.4; // porch depth
  const porchLo = top - 1.5;
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
    const k = kolamTex();
    return {
      wall: new THREE.MeshStandardMaterial({ map: m, roughness: 0.9, color: "#fff4dc" }),
      lattice: new THREE.MeshStandardMaterial({ map: l, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 }),
      window: new THREE.MeshStandardMaterial({ map: lw, roughness: 0.9, alphaTest: 0.5 }),
      // the room behind the weave: dark by day, warm lamplight after dusk
      inside: new THREE.MeshStandardMaterial({ color: "#2a2116", emissive: new THREE.Color("#ffae4a"), emissiveIntensity: 0, roughness: 1, side: THREE.DoubleSide }),
      bulb: new THREE.MeshStandardMaterial({ color: "#fff1cf", emissive: new THREE.Color("#ffc067"), emissiveIntensity: 0.2, toneMapped: false }),
      halo: new THREE.SpriteMaterial({ map: glowTex(), color: "#ffc677", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
      kolam: new THREE.MeshStandardMaterial({ map: k, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }),
      tyre: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.8 }),
      dispose() {
        m.dispose();
        l.dispose();
        lw.dispose();
        for (const x of [this.wall, this.lattice, this.window, this.inside, this.bulb, this.halo, this.kolam, this.tyre]) x.dispose();
      },
    };
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const gable = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, gableH)])), [gableH]);
  useEffect(() => () => gable.dispose(), [gable]);
  const wheel = useMemo(() => new THREE.TorusGeometry(1.05, 0.07, 6, 24), []);
  useEffect(() => () => wheel.dispose(), [wheel]);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const l = env.current.lamps;
    mat.bulb.emissiveIntensity = 0.3 + l * 7;
    mat.halo.opacity = l * 0.7;
    mat.inside.emissiveIntensity = l * 1.6;
    if (light.current) light.current.intensity = l * 190;
  });

  const frame = "#8f7440";
  const parts = useMemo<Part[]>(() => {
    const rnd = seeded(11);
    const p: Part[] = [
      // raised mud floor (thinnai) running out under the porch, smeared lighter on top, a step in front
      box([0, B / 2, PD / 2], [W + 1.4, B, D + PD + 0.6], "#93714b"),
      box([0, B - 0.02, PD / 2], [W + 1.3, 0.06, D + PD + 0.5], "#b8946a"),
      box([0, B / 4, fz + PD + 0.75], [3.0, B / 2, 0.9], "#93714b"),
      // wall plate and mid rail battens (front + sides)
      box([0, top - 0.12, fz + 0.06], [W + 0.2, 0.24, 0.14], frame),
      box([0, B + 2.3, fz + 0.06], [W, 0.15, 0.1], frame),
      ...[-1, 1].map((sx) => box([sx * (W / 2 + 0.06), B + 2.3, 0], [0.1, 0.15, D], frame)),
      // plank door, slightly ajar, with a cross brace and an iron latch
      box([-1.9, B + 2.85, fz + 0.06], [2.2, 5.6, 0.12], "#7b5a35"),
      ...[-1.7, -1.3, -0.9, -2.1, -2.5].map((x) => box([x - 0.2, B + 2.85, fz + 0.13], [0.04, 5.5, 0.03], "#5f4428")),
      box([-1.9, B + 2.85, fz + 0.15], [0.12, 4.8, 0.04], "#5f4428", [0, 0, 0.42]),
      box([-0.95, B + 2.9, fz + 0.17], [0.1, 0.3, 0.06], "#2b2b2b"),
      // window frame round the lattice (right)
      box([1.55, B + 2.55, fz + 0.08], [3.2, 0.16, 0.1], frame),
      box([1.55, B + 4.95, fz + 0.08], [3.2, 0.16, 0.1], frame),
      box([0.0, B + 3.75, fz + 0.08], [0.16, 2.55, 0.1], frame),
      box([3.1, B + 3.75, fz + 0.08], [0.16, 2.55, 0.1], frame),
      // corner and porch bamboo posts with nodes
      ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => bamboo((sx * W) / 2, B, top + 0.2, (sz * D) / 2, 0.22))),
      ...[-1, 1].flatMap((sx) => bamboo(sx * (W / 2 + 0.2), B, porchLo + 0.1, fz + PD - 0.2, 0.18)),
      box([0, porchLo - 0.05, fz + PD - 0.2], [W + 0.8, 0.22, 0.22], "#a68c50"), // porch beam
      // crossed ridge sticks at both gable peaks + the ridge pole
      ...[-1, 1].flatMap((zf) => [-1, 1].map((sx) => box([sx * 0.38, top + rise + 0.55, zf * (D / 2 + 0.55)], [0.14, 2.1, 0.14], "#7d6532", [0, 0, sx * 0.55]))),
      rod([0, top + rise + 0.15, 0], [0.32, D + 1.4, 0.32], "#8a7038", [Math.PI / 2, 0, 0]),
      // clerk's desk under the porch: table, stacked files with red tape, brass bell, a ledger open, stool
      box([1.7, B + 2.45, fz + 1.6], [2.6, 0.14, 1.3], "#6e4a2a"),
      ...[-1, 1].flatMap((a) => [-1, 1].map((b) => box([1.7 + a * 1.15, B + 1.2, fz + 1.6 + b * 0.5], [0.12, 2.4, 0.12], "#563820"))),
      box([1.0, B + 2.7, fz + 1.55], [0.85, 0.36, 0.62], "#c7b48a"),
      box([1.0, B + 2.93, fz + 1.55], [0.82, 0.12, 0.6], "#b13a2e"),
      box([1.05, B + 3.08, fz + 1.5], [0.8, 0.18, 0.58], "#d9c9a2"),
      box([2.2, B + 2.56, fz + 1.75], [0.95, 0.06, 0.7], "#f1e8d2"), // open ledger
      box([2.2, B + 2.6, fz + 1.75], [0.03, 0.04, 0.7], "#8c6b3a"),
      rod([2.95, B + 2.62, fz + 1.35], [0.22, 0.12, 0.22], "#c99a2e"), // brass bell
      rod([2.95, B + 2.75, fz + 1.35], [0.07, 0.14, 0.07], "#a87f22"),
      box([1.7, B + 1.15, fz + 2.65], [1.0, 0.12, 0.9], "#6e4a2a"), // stool
      ...[-1, 1].flatMap((a) => [-1, 1].map((b) => box([1.7 + a * 0.4, B + 0.55, fz + 2.65 + b * 0.35], [0.1, 1.1, 0.1], "#563820"))),
      // clay water pot (kudam) on a ring stand by the door, a tumbler on its mouth
      rod([-3.3, B + 0.18, fz + 0.9], [0.9, 0.36, 0.9], "#5c4a36"),
      ball([-3.3, B + 0.95, fz + 0.9], [1.25, 1.15, 1.25], "#b5582e"),
      rod([-3.3, B + 1.6, fz + 0.9], [0.5, 0.22, 0.5], "#a04c27"),
      rod([-3.3, B + 1.78, fz + 0.9], [0.24, 0.16, 0.24], "#c9c9c9"),
      // firewood stack and coconuts against the back wall
      ...Array.from({ length: 9 }, (_, i) => rod([-2.2 + (i % 3) * 0.55 + (Math.floor(i / 3) % 2) * 0.27, 0.32 + Math.floor(i / 3) * 0.48, -fz - 0.65], [0.46, 2.4, 0.46], i % 2 ? "#6d4d2c" : "#7e5a33", [Math.PI / 2, 0, 0])),
      ...[0, 1, 2].map((i) => ball([1.2 + i * 0.75, 0.42, -fz - 0.8 + (i % 2) * 0.3], 0.82, "#6b4a24")),
      // a small rope line under the side eave with a drying towel
      box([W / 2 + 0.7, top - 0.9, 0], [0.04, 0.04, D], "#c9b48a"),
      box([W / 2 + 0.72, top - 1.5, -0.8], [0.04, 1.1, 1.0], "#3f7fbf"),
    ];
    // lantern hook
    p.push(box([-0.5, porchLo - 0.35, fz + PD - 0.2], [0.05, 0.5, 0.05], "#2b2b2b"), box([-0.5, porchLo - 0.85, fz + PD - 0.2], [0.42, 0.08, 0.42], "#2b2b2b"), box([-0.5, porchLo - 1.45, fz + PD - 0.2], [0.42, 0.08, 0.42], "#2b2b2b"));
    // dried coconut-leaf thatch: main roof (both slopes), the porch lean-to, leaves folded over the ridge, ragged rakes
    const tones = ["#a48a52", "#8e7744", "#b39b62", "#7c6a3c", "#9a8a4e", "#857f45", "#6f6235"];
    for (const sx of [-1, 1]) p.push(...thatchPlane({ axis: "x", sx, hi: [0, top + rise], lo: [sx * run, top], width: D + 1.6, courses: 6, blades: 30, rnd, tones }));
    p.push(...thatchPlane({ axis: "z", hi: [fz, top - 0.15], lo: [fz + PD + 0.4, porchLo], width: W + 1.2, courses: 3, blades: 30, rnd, tones }));
    for (let i = 0; i < 26; i++) {
      const z = -(D + 1.6) / 2 + ((i + 0.5) / 26) * (D + 1.6);
      for (const sx of [-1, 1]) p.push(box([sx * 0.38, top + rise + 0.42, z], [1.05, 0.05, 0.26], tones[Math.floor(rnd() * tones.length)], [0, (rnd() - 0.5) * 0.3, -sx * (Math.atan2(rise, run) + 0.18)]));
    }
    for (const zf of [-1, 1])
      for (const sx of [-1, 1])
        for (let i = 0; i < 11; i++) {
          const tt = (i + 0.5) / 11;
          p.push(box([sx * run * tt, top + rise * (1 - tt) + 0.1, zf * ((D + 1.6) / 2 + 0.12)], [0.2, 0.6 + rnd() * 0.4, 0.04], tones[Math.floor(rnd() * tones.length)], [zf * 0.35, 0, -sx * 0.25]));
        }
    return p;
  }, [B, W, D, fz, top, run, rise, PD, porchLo]);
  const anchor = useMemo<V3>(() => [X, top + rise + 3.0, Z], [X, Z, top, rise]);
  return (
    <Hotspot spot={{ key: "taxstamp", kind: "taxstamp", anchor }}>
      {/* turned to face south-west (towards the front-left, owner) */}
      <group position={[X, 0, Z]} rotation={[0, -Math.PI / 4, 0]}>
        <mesh geometry={G.box()} position={[0, 5, PD / 2]} scale={[W + 2.4, 10, D + PD + 2]} visible={false} />
        {/* mat walls */}
        <mesh geometry={G.box()} material={mat.wall} position={[0, B + H / 2, 0]} scale={[W, H, D]} castShadow receiveShadow />
        <Baked parts={parts} cast receive material={vcMaterial(0.95)} />
        {/* woven lattice window + gables, with the lamp-lit room glowing through the gaps at night */}
        <mesh geometry={G.plane()} material={mat.inside} position={[1.55, B + 3.75, fz + 0.03]} scale={[2.95, 2.3, 1]} />
        <mesh geometry={G.plane()} material={mat.window} position={[1.55, B + 3.75, fz + 0.08]} scale={[2.95, 2.3, 1]} />
        <mesh geometry={gable} material={mat.inside} position={[0, top, fz - 0.15]} />
        <mesh geometry={gable} material={mat.lattice} position={[0, top, fz - 0.02]} />
        <mesh geometry={gable} material={mat.lattice} position={[0, top, -fz + 0.02]} rotation={[0, Math.PI, 0]} />
        {/* hanging hurricane lantern under the porch: lights the hut after dusk */}
        <mesh geometry={G.sphere()} material={mat.bulb} position={[-0.5, porchLo - 1.15, fz + PD - 0.2]} scale={[0.36, 0.5, 0.36]} />
        <sprite material={mat.halo} position={[-0.5, porchLo - 1.15, fz + PD - 0.2]} scale={4.2} />
        <pointLight ref={light} position={[-0.5, porchLo - 1.3, fz + PD + 0.4]} color="#ffb257" intensity={0} distance={22} decay={1.6} />
        {/* bicycle leaning against the right side wall */}
        <group position={[W / 2 + 0.55, B * 0, 0.4]} rotation={[0, Math.PI / 2, -0.12]}>
          {[-1.25, 1.25].map((dz) => (
            <mesh key={dz} geometry={wheel} material={mat.tyre} position={[dz, 1.1, 0]} castShadow />
          ))}
          <mesh geometry={G.box()} material={mat.tyre} position={[0, 1.55, 0]} rotation={[0, 0, 0.0]} scale={[2.4, 0.08, 0.08]} />
          <mesh geometry={G.box()} material={mat.tyre} position={[-0.35, 1.35, 0]} rotation={[0, 0, 0.9]} scale={[1.2, 0.08, 0.08]} />
          <mesh geometry={G.box()} material={mat.tyre} position={[1.15, 1.75, 0]} rotation={[0, 0, -0.3]} scale={[0.08, 1.4, 0.08]} />
          <mesh geometry={G.box()} material={mat.tyre} position={[1.25, 2.45, 0]} scale={[0.08, 0.08, 1.1]} />
          <mesh geometry={G.box()} material={mat.tyre} position={[-0.75, 2.05, 0]} scale={[0.55, 0.12, 0.3]} />
        </group>
        {/* an angry policeman guards the office, by the porch on the right */}
        <PoliceGuard env={env} position={[2.3, 0, fz + PD + 2.5]} />
        {/* kolam at the step */}
        <mesh geometry={G.plane()} material={mat.kolam} position={[0, 0.03, fz + PD + 2.0]} rotation={[-Math.PI / 2, 0, 0]} scale={2.6} />
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
    f.rotation.y = -Math.atan2(e.windDir[1], e.windDir[0]) + Math.sin(e.t * 9.4) * (0.12 + g * 0.18);
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

/** The owner's white Land Cruiser, parked on the open grass at the front-left of the island, nose to the ENE (owner).
 *  The walkers crossing the front grass keep to the strip between it and the front wall. */
function ParkedCar({ layout, world }: { layout: SiteLayout; world: World }) {
  const FL = layout.plot.polygon[0];
  const M = layout.site.meadow;
  // ENE = 22.5° north of east; east = +X, north = −Z in the world, and the car's nose points +X
  return <LandCruiser position={[world.x(FL.x - 5.5), 0, world.z(M.z0 + 6.2)]} rotation={[0, Math.PI / 8, 0]} />;
}
