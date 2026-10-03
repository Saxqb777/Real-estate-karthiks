"use client";
// One of the owner's houses, built procedurally from a BuildingSlot (src/lib/site-layout.ts) to match his photos:
// ivory-cream plaster with black accent lines, a flat roof terrace behind a low parapet (black coping), a raised
// stepped parapet over the front with two arched jaali vents, a deep chajja with a black edge band over a front
// veranda enclosed by black diamond grills between square pillars with black flutes, maroon-framed grilled windows,
// a straight external concrete stair (solid cream balustrades, round black hand rails) up to the terrace, a maroon
// EB meter box at the stair foot and a black water tank on a cream stand. Floors come from the data (default 1).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { SITE_DEFAULTS, offsetPolygon, type BuildingSlot, type Pt, type Rect } from "@/lib/site-layout";
import { gustAt, type Env } from "./env";
import { ball, box, rod, type Part, type V3 } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { G, PAL, holoMaterial, std, type Finish } from "./materials";
import { doorTex, kolamTex, plasterTex, ventArchTex, verandaGrillTex, windowGlowTex, windowTex, withRepeat } from "./textures";
import { FLAT, hash, planShape, type World } from "./util";

const FH = SITE_DEFAULTS.floorHeightFt;
const WIN_W = 3.0;
const WIN_H = 4.2;
const PLINTH = 1.2;
/** underside of the front sunshade (chajja) = top of the veranda opening */
const CHAJJA_Y = 7.6;
const CHAJJA_OUT = 2.3;
const PARAPET_T = 0.45;
const CREAM = PAL.plaster;
const CREAM_LIGHT = "#f5f1e6";
const BLACK = PAL.black;

export interface TownhouseProps {
  slot: BuildingSlot;
  world: World;
  env: RefObject<Env>;
  finish: Finish;
  ghost: boolean;
  /** occupied → windows glow at night, kolam + thoranam at the door */
  lived: boolean;
  /** clothes drying on the roof */
  clothes: boolean;
  animate: boolean;
}

interface WindowSpot {
  pos: [number, number, number];
  rotY: number;
  lit: boolean;
}
interface Panel {
  pos: V3;
  rotY: number;
  w: number;
  h: number;
}
interface Edge {
  a: Pt;
  b: Pt;
  n: Pt;
  len: number;
  kind: "front" | "side" | "back" | "porch" | "stair" | "party" | "veranda";
}

function extrude(pts: Pt[], world: World, depth: number, holes: Pt[][] = []) {
  return new THREE.ExtrudeGeometry(planShape(pts, world, holes), { depth, bevelEnabled: false, curveSegments: 1 });
}

/** The front-right veranda (recessed under the roof, open on the front and the passage side), or null when too small. */
export function verandaOf(slot: BuildingSlot): Rect | null {
  const { x1, z0 } = slot.rect;
  const frontLen = x1 - slot.notch.wide.x1;
  if (frontLen < 8 || slot.depthFt < 14) return null;
  return { x0: x1 - Math.min(9.5, frontLen * 0.72), x1, z0, z1: z0 + Math.min(6.5, slot.depthFt * 0.24) };
}

/** Straight external stair against the lane-side boundary: from just inside the main gate up to the roof edge. */
export function stairOf(slot: BuildingSlot) {
  const { wide, step } = slot.notch;
  const s = slot.stairs;
  const w = Math.min(3.6, s.x1 - s.x0);
  const x0 = s.x0 + 0.28; // inner face of the lane-side compound wall
  const z0 = wide.z0 + Math.min(3.2, (step.z1 - wide.z0) * 0.34);
  return { x0, x1: x0 + w, z0, z1: s.z1 };
}

/** Plan edges of a CCW polygon with outward normals. */
function edgesOf(pts: Pt[]): Omit<Edge, "kind">[] {
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { a, b, len, n: { x: (b.z - a.z) / len, z: -(b.x - a.x) / len } };
  });
}

export function Townhouse({ slot, world, env, finish, ghost, lived, clothes, animate }: TownhouseProps) {
  const H = slot.heightFt;
  const P = slot.parapetFt;
  const sig = JSON.stringify([slot.outline, H, slot.floors, world.cx, world.cz]);
  const ver = useMemo(() => verandaOf(slot), [slot]);
  const stair = useMemo(() => stairOf(slot), [slot]);

  // ground-floor outline: the footprint with the veranda corner cut out
  const groundOutline = useMemo<Pt[]>(() => {
    const o = slot.outline;
    if (!ver) return o;
    // o = [notch front corner, front-right, back-right, …]: cut the front-right corner
    return [o[0], { x: ver.x0, z: ver.z0 }, { x: ver.x0, z: ver.z1 }, { x: ver.x1, z: ver.z1 }, ...o.slice(2)];
  }, [slot.outline, ver]);

  // classify every wall edge (windows go on front / left / back / porch walls)
  const wallKinds = useMemo(() => {
    const m = new Map<string, Edge["kind"]>();
    for (const w of slot.walls) m.set(`${w.a.x},${w.a.z}|${w.b.x},${w.b.z}`, w.kind);
    return m;
  }, [slot.walls]);
  const classify = (e: Omit<Edge, "kind">): Edge["kind"] => {
    const k = wallKinds.get(`${e.a.x},${e.a.z}|${e.b.x},${e.b.z}`);
    if (k) return k;
    if (ver && Math.min(e.a.x, e.b.x) >= ver.x0 - 0.01 && Math.max(e.a.z, e.b.z) <= ver.z1 + 0.01) {
      if (Math.abs(e.a.z - ver.z0) < 0.01 && Math.abs(e.b.z - ver.z0) < 0.01) return "front";
      if (Math.abs(e.a.x - ver.x1) < 0.01 && Math.abs(e.b.x - ver.x1) < 0.01) return "side";
      return "veranda";
    }
    return e.n.z < -0.5 ? "front" : e.n.x > 0.5 ? "side" : e.n.z > 0.5 ? "back" : "party";
  };

  const geo = useMemo(() => {
    const o = slot.outline;
    const g = {
      ground: extrude(groundOutline, world, Math.min(H, FH)),
      upper: slot.floors > 1 ? extrude(o, world, H - FH) : null,
      plinth: extrude(offsetPolygon(o, 0.2), world, PLINTH),
      bands: Array.from({ length: slot.floors - 1 }, () => extrude(offsetPolygon(o, 0.22), world, 0.4)),
      coping: extrude(offsetPolygon(o, 0.1), world, 0.28),
    };
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, groundOutline]);
  useEffect(
    () => () => {
      geo.ground.dispose();
      geo.upper?.dispose();
      geo.plinth.dispose();
      geo.bands.forEach((b) => b.dispose());
      geo.coping.dispose();
    },
    [geo],
  );
  const edgeLines = useMemo(() => (ghost ? [new THREE.EdgesGeometry(geo.ground, 20), ...(geo.upper ? [new THREE.EdgesGeometry(geo.upper, 20)] : [])] : []), [ghost, geo]);
  useEffect(() => () => edgeLines.forEach((e) => e.dispose()), [edgeLines]);

  // ── materials ──
  const holo = useMemo(() => (ghost ? holoMaterial() : null), [ghost]);
  useEffect(() => () => holo?.dispose(), [holo]);
  const M = useMemo(() => {
    if (holo) return { plaster: holo, roof: holo, plinth: holo, black: holo, stair: holo, grill: holo, vent: holo };
    const f = finish;
    return {
      plaster: std(CREAM, { map: withRepeat(plasterTex(), 1 / 9, 1 / 9), rough: 0.92, finish: f }),
      roof: std("#f3f0e8", { map: withRepeat(plasterTex(), 1 / 14, 1 / 14), rough: 0.95, finish: f }),
      plinth: std("#e2dac4", { map: withRepeat(plasterTex(), 1 / 5, 1 / 5), rough: 0.92, finish: f }),
      black: std(BLACK, { rough: 0.6, finish: f }),
      stair: std(CREAM_LIGHT, { map: withRepeat(plasterTex(), 1 / 4, 1 / 4), rough: 0.9, finish: f }),
      grill: std("#ffffff", { map: verandaGrillTex(), alphaTest: 0.5, side: THREE.DoubleSide, rough: 0.5, metal: 0.3, finish: f }),
      vent: std("#ffffff", { map: ventArchTex(), alphaTest: 0.5, rough: 0.8, finish: f }),
    };
  }, [holo, finish]);

  // ── windows (instanced): ground floor on the cut outline, upper floors on the full footprint ──
  const windows = useMemo(() => {
    const spots: WindowSpot[] = [];
    for (let f = 0; f < slot.floors; f++) {
      const edges = edgesOf(f === 0 ? groundOutline : slot.outline);
      edges.forEach((e, wi) => {
        const kind = classify(e);
        // windows on the front / passage side / back / porch walls, and on the lane-side wall (it looks over the lane wall)
        const laneSide = kind === "party" && e.n.x < -0.5;
        if ((!["front", "side", "back", "porch"].includes(kind) && !laneSide) || e.len < 4.2) return;
        const n = Math.max(1, Math.floor((e.len - 1.2) / 6.6));
        const dx = (e.b.x - e.a.x) / e.len;
        const dz = (e.b.z - e.a.z) / e.len;
        const rotY = Math.atan2(e.n.x, -e.n.z);
        for (let i = 0; i < n; i++) {
          let t = ((i + 0.5) * e.len) / n;
          // the meter box hangs at the front end of the porch wall: keep the window behind it
          if (kind === "porch" && f === 0 && Math.abs(dz) > 0.5) t = Math.max(0, Math.min(e.len, (Math.max(slot.rect.z0 + 4.2, Math.min(e.a.z, e.b.z) + 1.6) - e.a.z) / dz));
          const px = e.a.x + dx * t + e.n.x * 0.06;
          const pz = e.a.z + dz * t + e.n.z * 0.06;
          const y = f * FH + 3.1 + WIN_H / 2;
          spots.push({ pos: [world.x(px), y, world.z(pz)], rotY, lit: hash(wi * 31 + f * 7 + i * 3 + slot.rect.z0) < 0.72 });
        }
      });
    }
    return spots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, groundOutline, wallKinds]);
  // only a lived-in unit gets glowing windows (inactive / vacant units keep them dark)
  const [litWin, darkWin] = useMemo(() => (lived ? [windows.filter((w) => w.lit), windows.filter((w) => !w.lit)] : [[], windows]), [windows, lived]);

  const winMat = useMemo(() => std("#ffffff", { map: windowTex(), rough: 0.35, finish }), [finish]);
  const litMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: windowTex(), emissiveMap: windowGlowTex(), emissive: new THREE.Color("#ffc47a"), emissiveIntensity: 0, roughness: 0.35 }),
    [],
  );
  useEffect(() => () => litMat.dispose(), [litMat]);
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff2d6", emissive: "#ffc67a", emissiveIntensity: 0, toneMapped: false }), []);
  useEffect(() => () => lampMat.dispose(), [lampMat]);
  const kolamMat = useMemo(() => new THREE.MeshStandardMaterial({ map: kolamTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), []);
  useEffect(() => () => kolamMat.dispose(), [kolamMat]);

  useFrame(({ clock }) => {
    const e = env.current;
    litMat.emissiveIntensity = lived ? e.windows * 2.4 : 0;
    lampMat.emissiveIntensity = lived ? 0.3 + e.lamps * 5 : 0.2;
    kolamMat.opacity = e.kolam * 0.95;
    if (holo) holo.uniforms.uTime.value = clock.elapsedTime;
  });

  // ── the external stair: one straight flight per floor (alternating direction), solid on the ground floor ──
  const stairs = useMemo(() => {
    const st = stair;
    const run = Math.max(2, st.z1 - st.z0);
    const n = Math.max(6, Math.round(FH / 0.62));
    const rise = FH / n;
    const tread = run / n;
    const cx = world.x((st.x0 + st.x1) / 2);
    const w = st.x1 - st.x0;
    const steps: { p: V3; s: V3 }[] = [];
    const parts: Part[] = [];
    const pitch = Math.atan2(FH, run);
    const L = Math.hypot(run, FH);
    const hb = 3.4; // balustrade: ~1 ft below the nosing line + ~2.4 ft above it (measured square to the slope)
    for (let f = 0; f < slot.floors; f++) {
      const up = f % 2 === 0; // even flights climb front → back
      for (let k = 0; k < n; k++) {
        const za = up ? st.z0 + k * tread : st.z1 - (k + 1) * tread;
        const top = f * FH + (k + 1) * rise;
        const bottom = f === 0 ? 0 : top - rise * 2.2;
        steps.push({ p: [cx, (top + bottom) / 2, world.z(za + tread / 2)], s: [w - 0.05, top - bottom, tread + 0.02] });
      }
      // sloped solid balustrades + round black hand rails along both sides
      const zm = world.z((st.z0 + st.z1) / 2);
      const ym = f * FH + FH / 2;
      const sgn = up ? 1 : -1;
      const nUp: V3 = [0, Math.cos(pitch), sgn * Math.sin(pitch)]; // square to the slope, "up"
      for (const x of [st.x0 + 0.2, st.x1 - 0.2]) {
        const X = world.x(x);
        const off = hb / 2 - 1.0;
        parts.push(box([X, ym + nUp[1] * off, zm + nUp[2] * off], [0.42, hb, L], CREAM_LIGHT, [sgn * pitch, 0, 0]));
        const r = hb - 1.0 + 0.16;
        parts.push(rod([X, ym + nUp[1] * r, zm + nUp[2] * r], [0.4, L + 0.2, 0.4], BLACK, [up ? pitch - Math.PI / 2 : Math.PI / 2 - pitch, 0, 0]));
      }
      // landing at the front for flights that arrive there (upper floors only)
      if (!up) {
        const zl0 = slot.notch.wide.z0 + 0.6;
        parts.push(box([cx, (f + 1) * FH - 0.25, world.z((zl0 + st.z0) / 2)], [w, 0.5, Math.max(0.5, st.z0 - zl0)], CREAM_LIGHT));
      }
    }
    // newel blocks at the foot of the stair
    for (const x of [st.x0 + 0.2, st.x1 - 0.2]) parts.push(box([world.x(x), 1.1, world.z(st.z0 + 0.25)], [0.5, 2.2, 0.5], CREAM_LIGHT));
    return { steps, parts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, stair]);

  // ── veranda: pillars with black flutes, knee walls, the spandrel above, grill panels ──
  const veranda = useMemo(() => {
    if (!ver) return { parts: [] as Part[], grills: [] as Panel[] };
    const parts: Part[] = [];
    const grills: Panel[] = [];
    const pz = ver.z0 + 0.5;
    const px = ver.x1 - 0.5;
    const yTop = CHAJJA_Y;
    const ph = yTop - PLINTH;
    const pillar = (x: number, z: number, faces: ("front" | "side")[]) => {
      const X = world.x(x);
      const Z = world.z(z);
      parts.push(box([X, PLINTH + ph / 2, Z], [1.0, ph, 1.0], CREAM));
      parts.push(box([X, PLINTH + 0.35, Z], [1.25, 0.7, 1.25], CREAM));
      parts.push(box([X, yTop - 0.35, Z], [1.2, 0.5, 1.2], CREAM));
      for (const f of faces)
        for (const d of [-0.28, 0, 0.28]) {
          const sx = f === "front" ? d : 0.52;
          const sz = f === "front" ? 0.52 : d;
          parts.push(box([X + sx, PLINTH + 0.75 + (ph - 1.5) / 2, Z + sz], f === "front" ? [0.09, ph - 1.5, 0.04] : [0.04, ph - 1.5, 0.09], BLACK));
        }
    };
    const midX = ver.x0 + (ver.x1 - ver.x0) / 2;
    const midZ = ver.z0 + (ver.z1 - ver.z0) / 2;
    pillar(px, pz, ["front", "side"]);
    pillar(midX, pz, ["front"]);
    if (ver.z1 - ver.z0 > 4.5) pillar(px, midZ, ["side"]);
    // spandrel between the opening and the roof (the veranda ceiling)
    parts.push(box([world.x((ver.x0 + ver.x1) / 2), (yTop + FH) / 2, world.z((ver.z0 + ver.z1) / 2)], [ver.x1 - ver.x0, FH - yTop, ver.z1 - ver.z0], CREAM));
    // knee walls + grills between the pillars
    const kneeH = 1.0;
    const gy0 = PLINTH + kneeH;
    const gh = yTop - 0.6 - gy0;
    const run = (a: number, b: number, along: "x" | "z") => {
      const len = b - a;
      if (len < 0.6) return;
      const c = (a + b) / 2;
      const [X, Z] = along === "x" ? [world.x(c), world.z(pz)] : [world.x(px), world.z(c)];
      parts.push(box([X, PLINTH + kneeH / 2, Z], along === "x" ? [len, kneeH, 0.5] : [0.5, kneeH, len], CREAM));
      grills.push({ pos: [X, gy0 + gh / 2, Z], rotY: along === "x" ? 0 : Math.PI / 2, w: len, h: gh });
    };
    run(ver.x0, midX - 0.5, "x");
    run(midX + 0.5, px - 0.5, "x");
    if (ver.z1 - ver.z0 > 4.5) {
      run(pz + 0.5, midZ - 0.5, "z");
      run(midZ + 0.5, ver.z1, "z");
    } else run(pz + 0.5, ver.z1, "z");
    return { parts, grills };
  }, [ver, world]);

  // ── chajja (sunshade) with black edge band, wrapped round the veranda corner ──
  const chajja = useMemo<Part[]>(() => {
    const { x1, z0 } = slot.rect;
    const xStart = slot.notch.wide.x1;
    const parts: Part[] = [];
    const slab = (xa: number, xb: number, za: number, zb: number) =>
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y + 0.2, world.z((za + zb) / 2)], [xb - xa, 0.4, zb - za], CREAM_LIGHT));
    const fascia = (xa: number, xb: number, za: number, zb: number) => {
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y + 0.05, world.z((za + zb) / 2)], [Math.max(0.3, xb - xa), 0.75, Math.max(0.3, zb - za)], CREAM_LIGHT));
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y - 0.24, world.z((za + zb) / 2)], [Math.max(0.36, xb - xa + 0.06), 0.2, Math.max(0.36, zb - za + 0.06)], BLACK));
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y + 0.44, world.z((za + zb) / 2)], [Math.max(0.36, xb - xa + 0.06), 0.08, Math.max(0.36, zb - za + 0.06)], BLACK));
    };
    const right = ver ? CHAJJA_OUT : 0;
    slab(xStart, x1 + right, z0 - CHAJJA_OUT, z0 + 0.3);
    fascia(xStart, x1 + right, z0 - CHAJJA_OUT, z0 - CHAJJA_OUT + 0.3);
    if (ver) {
      const zEnd = ver.z1 + 1.0;
      slab(x1 - 0.3, x1 + CHAJJA_OUT, z0, zEnd);
      fascia(x1 + CHAJJA_OUT - 0.3, x1 + CHAJJA_OUT, z0 - CHAJJA_OUT, zEnd);
    }
    return parts;
  }, [slot.rect, slot.notch.wide.x1, ver, world]);

  // ── roof: low parapet with black coping (gap where the stair arrives) + the raised stepped front parapet ──
  const roof = useMemo(() => {
    const parts: Part[] = [];
    const vents: Panel[] = [];
    const top = H;
    for (const e of edgesOf(slot.outline)) {
      const segs: [number, number][] = [[0, e.len]];
      // the stair arrives through the parapet on the stair-well edge
      const kind = wallKinds.get(`${e.a.x},${e.a.z}|${e.b.x},${e.b.z}`);
      if (kind === "stair" && Math.abs(e.a.z - e.b.z) < 0.01) {
        const dx = (e.b.x - e.a.x) / e.len;
        const g0 = (stair.x0 - 0.3 - e.a.x) / dx;
        const g1 = (stair.x1 + 0.3 - e.a.x) / dx;
        segs.length = 0;
        const lo = Math.max(0, Math.min(g0, g1));
        const hi = Math.min(e.len, Math.max(g0, g1));
        if (lo > 0.3) segs.push([0, lo]);
        if (hi < e.len - 0.3) segs.push([hi, e.len]);
      }
      const dx = (e.b.x - e.a.x) / e.len;
      const dz = (e.b.z - e.a.z) / e.len;
      const rotY = Math.atan2(e.b.z - e.a.z, e.b.x - e.a.x); // local X along the edge: plan (dx, dz) → world (dx, −dz)
      for (const [s0, s1] of segs) {
        const ext = PARAPET_T / 2;
        const ta = s0 === 0 ? -ext : s0;
        const tb = s1 === e.len ? e.len + ext : s1;
        const mid = (ta + tb) / 2;
        const x = e.a.x + dx * mid - e.n.x * (PARAPET_T / 2);
        const z = e.a.z + dz * mid - e.n.z * (PARAPET_T / 2);
        parts.push(box([world.x(x), top + (P - 0.14) / 2, world.z(z)], [tb - ta, P - 0.14, PARAPET_T], CREAM, [0, rotY, 0]));
        parts.push(box([world.x(x), top + P - 0.07, world.z(z)], [tb - ta + 0.04, 0.16, PARAPET_T + 0.14], BLACK, [0, rotY, 0]));
      }
    }
    // raised stepped parapet over the front (centred on the veranda), with two arched jaali vents
    const { x1, z0 } = slot.rect;
    const frontLen = x1 - slot.notch.wide.x1;
    if (frontLen > 5) {
      const cx = ver ? (ver.x0 + ver.x1) / 2 - 0.4 : slot.notch.wide.x1 + frontLen / 2;
      const Wc = Math.min(8, frontLen * 0.62);
      const d = 1.1;
      const Z = world.z(z0 + d / 2 - 0.12);
      const X = world.x(cx);
      const yb = top;
      const hS = P + 1.0; // shoulders
      const hC = P + 2.3; // centre
      const wC = Wc * 0.58;
      parts.push(box([X, yb + hS / 2, Z], [Wc, hS, d], CREAM));
      parts.push(box([X, yb + hC / 2, Z], [wC, hC, d + 0.1], CREAM));
      // black coping on every step + a black line across the face
      parts.push(box([X, yb + hS + 0.07, Z], [Wc + 0.12, 0.16, d + 0.14], BLACK));
      parts.push(box([X, yb + hC + 0.08, Z], [wC + 0.16, 0.18, d + 0.24], BLACK));
      parts.push(box([X, yb + hC - 0.55, Z + d / 2 + 0.06], [wC + 0.02, 0.1, 0.06], BLACK));
      // corner piers rising above the centre, with black caps
      for (const sx of [-1, 1]) {
        const px = X + sx * (wC / 2 + 0.05);
        parts.push(box([px, yb + (hC + 0.7) / 2, Z], [0.55, hC + 0.7, d + 0.2], CREAM));
        parts.push(box([px, yb + hC + 0.78, Z], [0.7, 0.16, d + 0.34], BLACK));
        vents.push({ pos: [X + sx * wC * 0.22, yb + hC - 1.45, Z + d / 2 + 0.08], rotY: 0, w: 0.85, h: 1.15 });
      }
    }
    // water tank: black HDPE cylinder on a small raised cream stand, at the rear passage-side corner of the terrace
    const tx = world.x(slot.rect.x1 - 3.0);
    const tz = world.z(slot.rect.z1 - 3.0);
    parts.push(
      box([tx, top + 0.15, tz], [4.4, 0.3, 4.4], CREAM_LIGHT),
      ...[-1.6, 1.6].flatMap((dx) => [-1.6, 1.6].map((dz) => box([tx + dx, top + 0.9, tz + dz], [0.7, 1.5, 0.7], CREAM))),
      box([tx, top + 1.85, tz], [4.4, 0.4, 4.4], CREAM_LIGHT),
      rod([tx, top + 4.15, tz], [3.9, 4.2, 3.9], PAL.tank),
      ...[3.0, 4.15, 5.3].map((y) => rod([tx, top + y, tz], [4.05, 0.14, 4.05], "#101113")),
      rod([tx, top + 6.4, tz], [1.3, 0.35, 1.3], PAL.tank),
    );
    return { parts, vents };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, stair, ver, wallKinds]);

  // ── meter box, rain pipes, door ──
  const extras = useMemo<Part[]>(() => {
    const top = H;
    const { wide } = slot.notch;
    const parts: Part[] = [
        // PVC rain-water down pipes at the passage-side corners
      ...[slot.rect.z0 + (ver ? ver.z1 - slot.rect.z0 + 0.3 : 0.45), slot.rect.z1 - 0.45].flatMap((z) => {
        const x = world.x(slot.rect.x1 + 0.28);
        const Z = world.z(z);
        return [rod([x, (top + 0.8) / 2, Z], [0.3, top + 0.8, 0.3], "#e6e1d3"), box([x + 0.25, 0.35, Z], [0.7, 0.22, 0.32], "#e6e1d3")];
      }),
    ];
    // maroon EB meter box in a cream frame on the porch wall at the stair foot (faces the stair and the gate)
    if (wide.z1 - wide.z0 > 3) {
      const X = world.x(wide.x1);
      const Z = world.z(wide.z0 + 1.5);
      parts.push(
        box([X - 0.12, 5.0, Z], [0.24, 2.3, 2.2], CREAM_LIGHT),
        box([X - 0.3, 5.0, Z], [0.2, 1.7, 1.6], PAL.maroon),
        box([X - 0.42, 5.25, Z + 0.3], [0.08, 0.55, 0.42], "#cfd3d6"),
        box([X - 0.42, 4.7, Z - 0.4], [0.1, 0.5, 0.5], "#8e2a22"),
      );
    }
    // entrance steps at the front of the veranda / porch
    if (ver) parts.push(box([world.x(ver.x0 + (ver.x1 - ver.x0) * 0.25), 0.3, world.z(ver.z0 - 0.4)], [2.6, 0.6, 0.8], "#d9d2bf"));
    return parts;
  }, [slot, ver, world, H]);

  const door = slot.door;
  const doorOnVeranda = !!ver;
  const doorPos: V3 = ver ? [world.x(ver.x0 + (ver.x1 - ver.x0) * 0.34), PLINTH + 3.5, world.z(ver.z1 - 0.07)] : [world.x(door.x - 0.07), 0.6 + 3.5, world.z(door.z)];
  const doorW = ver ? 3.2 : door.widthFt;
  const doorTrim = useMemo<Part[]>(
    () => [
      box([0, 0.2, -0.05], [doorW + 0.6, 7.4, 0.18], PAL.maroon),
      box([-doorW / 2 - 0.85, 1.4, 0.06], [0.7, 0.45, 0.05], BLACK), // door-number plate
      box([-doorW / 2 - 0.85, 1.4, 0.09], [0.5, 0.08, 0.02], "#e3c25e"),
    ],
    [doorW],
  );

  const stepRef = useRef<THREE.InstancedMesh>(null);
  const winRef = useRef<THREE.InstancedMesh>(null);
  const litRef = useRef<THREE.InstancedMesh>(null);
  const shadeRef = useRef<THREE.InstancedMesh>(null);
  const edgeRef = useRef<THREE.InstancedMesh>(null);
  const grillRef = useRef<THREE.InstancedMesh>(null);
  const ventRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    const fill = (m: THREE.InstancedMesh | null, list: WindowSpot[], kind: "glass" | "shade" | "edge") => {
      if (!m) return;
      list.forEach((w, i) => {
        o.position.set(...w.pos);
        o.rotation.set(0, w.rotY, 0);
        o.scale.set(WIN_W, WIN_H, 1);
        if (kind === "shade") {
          // thin sunshade (chajja) over the window
          o.translateY(WIN_H / 2 + 0.5);
          o.translateZ(0.75);
          o.scale.set(WIN_W + 1.2, 0.22, 1.5);
        } else if (kind === "edge") {
          o.translateY(WIN_H / 2 + 0.36);
          o.translateZ(1.52);
          o.scale.set(WIN_W + 1.26, 0.14, 0.08);
        }
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    };
    fill(winRef.current, darkWin, "glass");
    fill(litRef.current, litWin, "glass");
    fill(shadeRef.current, windows, "shade");
    fill(edgeRef.current, windows, "edge");
    const panels = (m: THREE.InstancedMesh | null, list: Panel[]) => {
      if (!m) return;
      list.forEach((p, i) => {
        o.position.set(...p.pos);
        o.rotation.set(0, p.rotY, 0);
        o.scale.set(p.w, p.h, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    };
    panels(grillRef.current, veranda.grills);
    panels(ventRef.current, roof.vents);
    const sm = stepRef.current;
    if (sm) {
      stairs.steps.forEach((st, i) => {
        o.position.set(...st.p);
        o.rotation.set(0, 0, 0);
        o.scale.set(...st.s);
        o.updateMatrix();
        sm.setMatrixAt(i, o.matrix);
      });
      sm.count = stairs.steps.length;
      sm.instanceMatrix.needsUpdate = true;
      sm.computeBoundingSphere();
    }
  }, [windows, litWin, darkWin, stairs, veranda, roof]);

  const furniture = useMemo(() => [...stairs.parts, ...veranda.parts, ...chajja, ...roof.parts, ...extras], [stairs, veranda, chajja, roof, extras]);
  const furnitureMat = holo ?? vcMaterial(0.8, finish);
  const kolam = ver
    ? { x: ver.x0 + (ver.x1 - ver.x0) * 0.4, z: ver.z0 + (ver.z1 - ver.z0) * 0.55, s: Math.min(ver.x1 - ver.x0, ver.z1 - ver.z0) * 0.62, y: PLINTH + 0.03 }
    : { x: slot.kolam.x, z: slot.kolam.z, s: slot.kolam.sizeFt, y: 0.62 };

  return (
    <group>
      <mesh geometry={geo.ground} material={[M.roof, M.plaster]} rotation={FLAT} castShadow={!ghost} receiveShadow />
      {geo.upper && <mesh geometry={geo.upper} material={[M.roof, M.plaster]} rotation={FLAT} position={[0, FH, 0]} castShadow={!ghost} receiveShadow />}
      <mesh geometry={geo.plinth} material={M.plinth} rotation={FLAT} castShadow={!ghost} receiveShadow />
      {geo.bands.map((b, i) => (
        <mesh key={i} geometry={b} material={M.black} rotation={FLAT} position={[0, (i + 1) * FH - 0.2, 0]} receiveShadow />
      ))}
      <mesh geometry={geo.coping} material={M.black} rotation={FLAT} position={[0, H - 0.62, 0]} receiveShadow />
      {edgeLines.map((e, i) => (
        <lineSegments key={i} geometry={e} rotation={FLAT} position={[0, i ? FH : 0, 0]}>
          <lineBasicMaterial color="#a8d4ff" transparent opacity={0.9} toneMapped={false} />
        </lineSegments>
      ))}

      {/* windows + their sunshades with a black edge */}
      <instancedMesh ref={winRef} args={[G.plane(), ghost ? M.plaster : winMat, Math.max(1, windows.length)]} />
      <instancedMesh ref={litRef} args={[G.plane(), ghost ? M.plaster : litMat, Math.max(1, windows.length)]} />
      <instancedMesh ref={shadeRef} args={[G.box(), ghost ? M.plaster : std(CREAM_LIGHT, { rough: 0.9, finish }), Math.max(1, windows.length)]} castShadow={!ghost} receiveShadow />
      {!ghost && <instancedMesh ref={edgeRef} args={[G.box(), M.black, Math.max(1, windows.length)]} />}
      {/* veranda grills + parapet vents */}
      <instancedMesh ref={grillRef} args={[G.plane(), M.grill, Math.max(1, veranda.grills.length)]} castShadow={!ghost} />
      <instancedMesh ref={ventRef} args={[G.plane(), M.vent, Math.max(1, roof.vents.length)]} />

      {/* main door with frame + lamp */}
      <group position={doorPos} rotation={[0, doorOnVeranda ? 0 : -Math.PI / 2, 0]}>
        <Baked parts={doorTrim} cast={!ghost} material={furnitureMat} />
        <mesh geometry={G.plane()} material={ghost ? M.plaster : std("#ffffff", { map: doorTex(), rough: 0.6, finish })} scale={[doorW, 7, 1]} position={[0, 0, 0.06]} />
        {!ghost && <mesh geometry={G.sphere()} material={lampMat} scale={0.4} position={[doorW / 2 + 0.75, 2.6, 0.3]} />}
        {lived && !ghost && <Thoranam width={doorW + 0.6} animate={animate} />}
      </group>

      {/* stair treads (instanced) + baked balustrades, rails, veranda, chajja, parapets, tank, meter box */}
      <instancedMesh ref={stepRef} args={[G.box(), M.stair, Math.max(1, stairs.steps.length)]} castShadow={!ghost} receiveShadow />
      <Baked parts={furniture} cast={!ghost} receive material={furnitureMat} />

      {/* kolam at the door */}
      {lived && !ghost && <mesh geometry={G.plane()} material={kolamMat} rotation={FLAT} position={[world.x(kolam.x), kolam.y, world.z(kolam.z)]} scale={[kolam.s, kolam.s, 1]} />}
      {clothes && !ghost && <ClothesLine slot={slot} world={world} env={env} y={H} animate={animate} />}
    </group>
  );
}

/** Mango-leaf thoranam (optionally with marigolds) strung along local X at height y, z in front. */
export function Thoranam({ width, animate, y = 3.55, z = 0.55, flowers = false }: { width: number; animate: boolean; y?: number; z?: number; flowers?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.max(5, Math.round(width / 0.42));
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // diamond leaf hanging down from the origin
    const v = new Float32Array([0, 0, 0, 0.14, -0.35, 0.02, 0, -0.95, 0, 0, 0, 0, 0, -0.95, 0, -0.14, -0.35, 0.02]);
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const pose = (t: number) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + (i + 0.5) * (width / count);
      const sag = Math.sin(((i + 0.5) / count) * Math.PI) * 0.25;
      o.position.set(x, y - sag, z);
      o.rotation.set(0.25 + Math.sin(t * 2.6 + i * 0.9) * 0.18, 0, Math.sin(t * 1.7 + i) * 0.08);
      o.scale.setScalar(i % 2 ? 0.9 : 1.05);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };
  useEffect(() => pose(0));
  useFrame(({ clock }) => animate && pose(clock.elapsedTime));
  const blooms = useMemo<Part[]>(
    () =>
      flowers
        ? Array.from({ length: count + 1 }, (_, i) => {
            const t = i / count;
            return ball([-width / 2 + t * width, y - Math.sin(t * Math.PI) * 0.25 + 0.05, z], 0.34, i % 2 ? PAL.saffron : PAL.marigold);
          })
        : [],
    [flowers, count, width, y, z],
  );
  return (
    <group>
      <mesh geometry={G.box()} material={std("#e8d9b5")} scale={[width, 0.05, 0.05]} position={[0, y, z]} />
      <instancedMesh ref={ref} args={[geo, std("#3f8a35", { side: THREE.DoubleSide, flat: true, rough: 0.7 }), count]} />
      {flowers && <Baked parts={blooms} />}
    </group>
  );
}

const CLOTH_COLORS = ["#c2185b", "#f4f1ea", "#2f6fb5", "#e0a020", "#2e8b57"];

/**
 * A clothes line on the roof terrace: saree, veshti, shirt, towel — one merged mesh whose vertices flutter with the
 * same travelling gust that bends the palms and carries the petals.
 */
function ClothesLine({ slot, world, env, y, animate }: { slot: BuildingSlot; world: World; env: RefObject<Env>; y: number; animate: boolean }) {
  const z = slot.rect.z1 - 6.5;
  const x0 = Math.max(slot.stairs.x1 + 1.5, slot.rect.x0 + 2.5);
  const x1 = slot.rect.x1 - 6.5;
  const len = Math.max(4, x1 - x0);
  const cloth = useMemo(() => {
    const geos: THREE.PlaneGeometry[] = [];
    let cursor = 0.5;
    const widths = [1.1, 1.5, 1.3, 1.0, 1.2];
    const col: number[] = [];
    const c = new THREE.Color();
    widths.forEach((w, i) => {
      if (cursor + w > len - 0.3) return;
      const h = i === 0 ? 3.2 : i === 1 ? 2.4 : 1.5;
      const g = new THREE.PlaneGeometry(w, h, 6, 5);
      g.translate(cursor + w / 2, 5.1 - h / 2, 0);
      c.set(CLOTH_COLORS[i]);
      for (let k = 0; k < g.attributes.position.count; k++) col.push(c.r, c.g, c.b);
      geos.push(g);
      cursor += w + 0.35;
    });
    const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3);
    const idx: number[] = [];
    let off = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array as Float32Array, off * 3);
      for (const i of g.index!.array) idx.push(i + off);
      off += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return { geo, base: Float32Array.from(pos) };
  }, [len]);
  useEffect(() => () => cloth.geo.dispose(), [cloth]);
  const wx = world.x(x0);
  const wz = world.z(z);
  useFrame(() => {
    if (!animate) return;
    const e = env.current;
    const t = e.t;
    const g = gustAt(e, wx, wz);
    const wind = 0.25 + g;
    const pos = cloth.geo.attributes.position as THREE.BufferAttribute;
    const b = cloth.base;
    for (let i = 0; i < pos.count; i++) {
      const bx = b[i * 3];
      const by = b[i * 3 + 1];
      const hang = (5.1 - by) / 3.2;
      pos.setZ(i, Math.sin(t * (4 + g * 4) + bx * 1.8) * 0.3 * hang * wind + hang * hang * 0.9 * wind * e.windDir[1]);
      pos.setX(i, bx + hang * hang * 0.5 * wind * e.windDir[0]);
    }
    pos.needsUpdate = true;
    cloth.geo.computeVertexNormals();
  });
  const frame = useMemo<Part[]>(() => [rod([0, 2.6, 0], [0.14, 5.2, 0.14], "#8a8a8a"), rod([len, 2.6, 0], [0.14, 5.2, 0.14], "#8a8a8a"), box([len / 2, 5.1, 0], [len, 0.04, 0.04], "#dddddd")], [len]);
  return (
    <group position={[wx, y, wz]}>
      <Baked parts={frame} cast />
      <mesh geometry={cloth.geo} material={std("#ffffff", { vertexColors: true, side: THREE.DoubleSide, rough: 0.95 })} castShadow />
    </group>
  );
}
