"use client";
// One of the owner's houses, built procedurally from a BuildingSlot (src/lib/site-layout.ts) to match his photos:
// ivory-cream plaster with black accent lines, a flat roof terrace behind a low parapet (black coping), a designed
// front parapet centred on the façade (arched jaali panel between risers, stepped risers at both ends — photo 10), a deep chajja with a black edge band over a front
// veranda enclosed by black diamond grills between square pillars with black flutes, maroon-framed grilled windows,
// a dog-leg external concrete stair in the yard in front of the house (solid cream balustrades, round black hand rails)
// up to the terrace, a maroon EB meter box at the stair foot, a black water tank on a cream stand, and a small open
// backyard at the rear-right with a bathroom ventilator and a back-exit door (owner's annotated plan). Floors come from the data (default 1).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
  kind: "front" | "side" | "back" | "notch" | "party" | "veranda";
}

function extrude(pts: Pt[], world: World, depth: number, holes: Pt[][] = []) {
  return new THREE.ExtrudeGeometry(planShape(pts, world, holes), { depth, bevelEnabled: false, curveSegments: 1 });
}

/**
 * The veranda round the house entrance at the front-left (recessed under the roof, open on the front and the lane-passage
 * side), clear of the stair in front of the front-right corner — or null when too small.
 */
export function verandaOf(slot: BuildingSlot): Rect | null {
  const { x0, z0 } = slot.rect;
  const room = slot.stairs.x0 - x0 - 2.4; // leave a bit of solid wall (with the meter box) next to the stair
  if (room < 5 || slot.depthFt < 14) return null;
  return { x0, x1: x0 + Math.min(9, room), z0, z1: z0 + Math.min(6.5, slot.depthFt * 0.24) };
}

/**
 * Dog-leg stair in the yard in front of the front-right corner (owner's plan + photos 4 / 6): the foot is by the right
 * wall, the lower flight climbs along the outer lane towards the left, a half landing at the left, and the upper flight
 * comes back along the house front to a top landing just inside the right corner riser of the front parapet, where it
 * steps onto the terrace (so the centred parapet design stays whole).
 */
export function stairOf(slot: BuildingSlot) {
  const s = slot.stairs;
  const w = s.x1 - s.x0;
  const land = Math.min(2.4, w * 0.24);
  const top = Math.min(1.8, w * 0.18);
  /** right-end corner riser of the front parapet (its width) */
  const riser = Math.min(1.4, w * 0.14);
  const zMid = (s.z0 + s.z1) / 2;
  /** where the top landing meets the roof edge (x range) */
  const arrive = { x0: s.x1 - riser - top, x1: s.x1 - riser };
  return { ...s, land, top, riser, zMid, arrive };
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
    // o = [front-left, front-right, …, back-left]: cut the front-left corner
    return [{ x: ver.x0, z: ver.z1 }, { x: ver.x1, z: ver.z1 }, { x: ver.x1, z: ver.z0 }, ...o.slice(1)];
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
    if (ver && Math.max(e.a.x, e.b.x) <= ver.x1 + 0.01 && Math.max(e.a.z, e.b.z) <= ver.z1 + 0.01) return "veranda";
    return e.n.z < -0.5 ? "front" : e.n.x < -0.5 ? "side" : e.n.z > 0.5 ? "back" : "party";
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
    if (holo) return { plaster: holo, roof: holo, plinth: holo, black: holo, stair: holo, tread: holo, stairWall: holo, grill: holo, vent: holo };
    const f = finish;
    return {
      plaster: std(CREAM, { map: withRepeat(plasterTex(), 1 / 9, 1 / 9), rough: 0.92, finish: f }),
      roof: std("#f3f0e8", { map: withRepeat(plasterTex(), 1 / 14, 1 / 14), rough: 0.95, finish: f }),
      plinth: std("#e2dac4", { map: withRepeat(plasterTex(), 1 / 5, 1 / 5), rough: 0.92, finish: f }),
      black: std(BLACK, { rough: 0.6, finish: f }),
      stair: std("#e2dccb", { map: withRepeat(plasterTex(), 1 / 4, 1 / 4), rough: 0.92, finish: f }),
      tread: std("#faf8f1", { rough: 0.85, finish: f }),
      stairWall: std(CREAM_LIGHT, { map: withRepeat(plasterTex(), 1 / 5, 1 / 5), rough: 0.9, finish: f }),
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
        // windows on the front, the lane-passage side and the back (never behind the stair in front of the house)
        if (!["front", "side", "back"].includes(kind) || e.len < 4.2) return;
        const n = Math.max(1, Math.floor((e.len - 1.2) / 6.6));
        const dx = (e.b.x - e.a.x) / e.len;
        const dz = (e.b.z - e.a.z) / e.len;
        const rotY = Math.atan2(e.n.x, -e.n.z);
        for (let i = 0; i < n; i++) {
          const t = ((i + 0.5) * e.len) / n;
          if (kind === "front" && f === 0 && e.a.x + dx * t > slot.stairs.x0 - 2.2) continue;
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

  // ── the external dog-leg stair in the yard (photos 4 + 6) ──
  // Foot by the right wall → lower flight climbs left along the outer lane (solid wedge under it only) → flat landing at
  // the left end → upper flight climbs right along the house front on individual treads over a thin waist slab (open
  // underneath) → arrival platform just inside the right corner riser of the front parapet. Cream balustrade walls follow
  // each flight's slope with round black hand rails on top; every step has a lighter tread cap so it reads.
  const stairs = useMemo(() => {
    const st = stair;
    const xL = st.x0; // left end (landing)
    const xa = st.x0 + st.land; // landing edge
    const xArr = st.arrive.x0; // start of the arrival platform
    const xR = st.x1; // right end (foot / arrival)
    const zO = st.z0; // outer edge (towards the gate)
    const zM = st.zMid;
    const zI = st.z1; // the house front
    const runL = xR - xa;
    const runU = xArr - xa;
    const rise1 = (H * runL) / (runL + runU);
    const rise2 = H - rise1;
    const n1 = Math.max(5, Math.round(rise1 / 0.62));
    const n2 = Math.max(3, Math.round(rise2 / 0.62));
    const r1 = rise1 / n1;
    const r2 = rise2 / n2;
    const t1 = runL / n1;
    const t2 = runU / n2;
    const T = 0.4; // wall thickness
    const RAIL = 2.2; // balustrade height above the nosing line
    const BAND = 0.35; // how far the balustrade band reaches below the nosing line (the stepped profile shows below it)
    const yL = (x: number) => (rise1 * (xR - x)) / runL; // lower nosing (0 at the foot, rise1 at the landing)
    const yU = (x: number) => (x >= xArr ? H : rise1 + (rise2 * (x - xa)) / runU); // upper nosing
    const steps: { p: V3; s: V3 }[] = [];
    const caps: { p: V3; s: V3 }[] = [];
    const lowZ0 = zO + 0.03; // just inside the balustrade face (no coplanar flicker)
    const lowZ1 = zM - T / 2;
    const upZ0 = zM + T / 2;
    const upZ1 = zI - 0.05;
    const step = (xa0: number, xa1: number, z0s: number, z1s: number, top: number, bottom: number) => {
      const cx = world.x((xa0 + xa1) / 2);
      const cz = world.z((z0s + z1s) / 2);
      steps.push({ p: [cx, (top + bottom) / 2 - 0.04, cz], s: [xa1 - xa0, top - bottom - 0.08, z1s - z0s] });
      caps.push({ p: [cx, top - 0.04, cz], s: [xa1 - xa0 + 0.08, 0.1, z1s - z0s] }); // tread with a little nosing
    };
    for (let k = 0; k < n1; k++) step(xR - (k + 1) * t1, xR - k * t1, lowZ0, lowZ1, (k + 1) * r1, 0); // solid wedge
    for (let k = 0; k < n2; k++) step(xa + k * t2, xa + (k + 1) * t2, upZ0, upZ1, rise1 + (k + 1) * r2, rise1 + (k + 1) * r2 - Math.max(0.55, r2 * 1.4));

    // walls as clean extruded profiles (x–y outlines extruded across z): no crossing slabs
    const geos: THREE.BufferGeometry[] = [];
    const wall = (pts: [number, number][], zc: number, depth: number) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(world.x(x), y)));
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 1 });
      g.translate(0, 0, world.z(zc) - depth / 2);
      geos.push(g);
    };
    // outer balustrade: a band following the lower flight's slope (its stepped profile shows below it), flat over the
    // landing
    wall([[xR, Math.max(0, -BAND)], [xR, RAIL], [xa, rise1 + RAIL], [xL, rise1 + RAIL], [xL, rise1 - BAND], [xa, rise1 - BAND], [xR - (BAND * runL) / rise1, 0]].filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]) as [number, number][], zO + T / 2, T);
    // landing: solid block under it, with a parapet on its left end
    wall([[xL, 0], [xa, 0], [xa, rise1], [xL, rise1]], (zO + zI) / 2, zI - zO - 0.02);
    wall([[xL, rise1], [xL + T, rise1], [xL + T, rise1 + RAIL], [xL, rise1 + RAIL]], (zO + zI) / 2, zI - zO - 0.02);
    // divider between the flights: the lower flight's inner side (solid, ground → its rail) and, above it, the upper
    // flight's outer balustrade (its slope + rail); the gap between the two stays open
    wall([[xR - (BAND * runL) / rise1, 0], [xR, 0], [xR, RAIL], [xa, rise1 + RAIL], [xa, rise1 - BAND]], zM, T);
    {
      const xs = [xa, xArr, xR];
      // bottom of the upper balustrade = max(its nosing − 1, the lower wall's top + a hair)
      const bot = (x: number) => Math.max(yU(x) - BAND - 0.3, yL(x) + RAIL + 0.02);
      // where the two bottom lines cross (yU − 1 = yL + RAIL), so the outline has its exact kink
      const kU = rise2 / runU;
      const kL = rise1 / runL;
      const xc = xa + (RAIL + BAND + 0.3) / (kU + kL);
      const samples = [xa, ...(xc > xa && xc < xArr ? [xc] : []), xArr, xR];
      const top: [number, number][] = xs.map((x) => [x, yU(x) + RAIL]);
      const bottom: [number, number][] = [...samples].reverse().map((x) => [x, bot(x)]);
      wall([...top, ...bottom], zM, T);
    }
    // waist slab under the upper flight's treads (thin, follows the slope) + the arrival platform + its column
    wall([[xa, rise1 - 0.7], [xArr, H - 0.7], [xArr, H - 0.3], [xa, rise1 - 0.3]], (upZ0 + upZ1) / 2, upZ1 - upZ0);
    wall([[xArr, H - 0.55], [xR, H - 0.55], [xR, H], [xArr, H]], (upZ0 + upZ1) / 2, upZ1 - upZ0);
    wall([[xR - 0.65, 0], [xR, 0], [xR, H - 0.55], [xR - 0.65, H - 0.55]], (upZ0 + upZ1) / 2, 0.65);
    // arrival platform: parapet on its right end
    wall([[xR - T, H], [xR, H], [xR, H + RAIL], [xR - T, H + RAIL]], (upZ0 + upZ1) / 2, upZ1 - upZ0);
    const wallGeo = mergeGeometries(geos) ?? new THREE.BufferGeometry();
    geos.forEach((g) => g.dispose());

    // round black hand rails on top of every balustrade
    const parts: Part[] = [];
    const rail = (x0: number, y0: number, x1r: number, y1: number, z: number) => {
      const X0 = world.x(x0);
      const X1 = world.x(x1r);
      const L = Math.hypot(X1 - X0, y1 - y0);
      parts.push(rod([(X0 + X1) / 2, (y0 + y1) / 2 + 0.16, world.z(z)], [0.38, L + 0.12, 0.38], BLACK, [0, 0, Math.atan2(-(X1 - X0), y1 - y0)]));
    };
    rail(xR, RAIL, xa, rise1 + RAIL, zO + T / 2);
    rail(xa, rise1 + RAIL, xL, rise1 + RAIL, zO + T / 2);
    rail(xa, rise1 + RAIL, xArr, H + RAIL, zM);
    rail(xArr, H + RAIL, xR, H + RAIL, zM);
    const zRail = (x: number, y: number, za: number, zb: number) =>
      parts.push(rod([world.x(x), y + 0.16, world.z((za + zb) / 2)], [0.38, zb - za, 0.38], BLACK, [Math.PI / 2, 0, 0]));
    zRail(xL + T / 2, rise1 + RAIL, zO, zI);
    zRail(xR - T / 2, H + RAIL, upZ0 - T / 2, zI);
    return { steps, caps, parts, wallGeo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, stair]);
  useEffect(() => () => stairs.wallGeo.dispose(), [stairs]);

  // ── veranda: pillars with black flutes, knee walls, the spandrel above, grill panels ──
  const veranda = useMemo(() => {
    if (!ver) return { parts: [] as Part[], grills: [] as Panel[] };
    const parts: Part[] = [];
    const grills: Panel[] = [];
    const pz = ver.z0 + 0.5;
    const px = ver.x0 + 0.5;
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
          const sx = f === "front" ? d : -0.52;
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
      grills.push({ pos: [X, gy0 + gh / 2, Z], rotY: along === "x" ? 0 : -Math.PI / 2, w: len, h: gh });
    };
    run(px + 0.5, midX - 0.5, "x");
    run(midX + 0.5, ver.x1, "x");
    if (ver.z1 - ver.z0 > 4.5) {
      run(pz + 0.5, midZ - 0.5, "z");
      run(midZ + 0.5, ver.z1, "z");
    } else run(pz + 0.5, ver.z1, "z");
    return { parts, grills };
  }, [ver, world]);

  // ── chajja (sunshade) with black edge band, wrapped round the veranda corner ──
  const chajja = useMemo<Part[]>(() => {
    const { x0, z0 } = slot.rect;
    const xEnd = slot.stairs.x0 - 0.3; // stops short of the stair in front of the house
    const parts: Part[] = [];
    const slab = (xa: number, xb: number, za: number, zb: number) =>
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y + 0.2, world.z((za + zb) / 2)], [xb - xa, 0.4, zb - za], CREAM_LIGHT));
    const fascia = (xa: number, xb: number, za: number, zb: number) => {
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y + 0.05, world.z((za + zb) / 2)], [Math.max(0.3, xb - xa), 0.75, Math.max(0.3, zb - za)], CREAM_LIGHT));
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y - 0.24, world.z((za + zb) / 2)], [Math.max(0.36, xb - xa + 0.06), 0.2, Math.max(0.36, zb - za + 0.06)], BLACK));
      parts.push(box([world.x((xa + xb) / 2), CHAJJA_Y + 0.44, world.z((za + zb) / 2)], [Math.max(0.36, xb - xa + 0.06), 0.08, Math.max(0.36, zb - za + 0.06)], BLACK));
    };
    if (xEnd - x0 > 2) {
      const left = ver ? CHAJJA_OUT : 0;
      slab(x0 - left, xEnd, z0 - CHAJJA_OUT, z0 + 0.3);
      fascia(x0 - left, xEnd, z0 - CHAJJA_OUT, z0 - CHAJJA_OUT + 0.3);
      if (ver) {
        const zEnd = ver.z1 + 1.0;
        slab(x0 - CHAJJA_OUT, x0 + 0.3, z0, zEnd);
        fascia(x0 - CHAJJA_OUT, x0 - CHAJJA_OUT + 0.3, z0 - CHAJJA_OUT, zEnd);
      }
    }
    return parts;
  }, [slot.rect, slot.stairs.x0, ver, world]);

  // ── roof: low parapet with black coping (gap where the stair arrives) + the raised stepped front parapet ──
  const roof = useMemo(() => {
    const parts: Part[] = [];
    const vents: Panel[] = [];
    const top = H;
    for (const e of edgesOf(slot.outline)) {
      const segs: [number, number][] = [[0, e.len]];
      // the stair's top landing arrives through a gap in the front parapet
      const kind = wallKinds.get(`${e.a.x},${e.a.z}|${e.b.x},${e.b.z}`);
      if (kind === "front" && Math.abs(e.a.z - e.b.z) < 0.01) {
        const dx = (e.b.x - e.a.x) / e.len;
        const g0 = (stair.arrive.x0 - 0.1 - e.a.x) / dx;
        const g1 = (stair.arrive.x1 + 0.05 - e.a.x) / dx;
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
    // the designed front parapet (photo 10): CENTRED on the front face — a raised central panel with one ornate arched
    // jaali vent and a black coping band, flanked by two tall pillar-like risers with black caps — and the design ENDS
    // with matching stepped corner risers (small jaali vents, black caps) at both the left and the right end
    const { x0, x1, z0 } = slot.rect;
    const frontW = x1 - x0;
    if (frontW > 8) {
      const d = 0.9;
      const Z = world.z(z0 + d / 2 - 0.12);
      const face = Z + d / 2 + 0.06; // world z of the front face (+Z = towards the front)
      const yb = top;
      const cx = (x0 + x1) / 2;
      const wP = Math.min(6.2, frontW * 0.32);
      const hP = P + 2.0;
      const hR = P + 2.8;
      const X = world.x(cx);
      parts.push(box([X, yb + hP / 2, Z], [wP, hP, d], CREAM));
      parts.push(box([X, yb + hP + 0.09, Z], [wP + 0.16, 0.18, d + 0.2], BLACK)); // coping band
      parts.push(box([X, yb + hP - 0.5, face], [wP, 0.12, 0.06], BLACK)); // a black line just under it
      parts.push(box([X, yb + P - 0.35, face], [wP, 0.1, 0.06], BLACK));
      vents.push({ pos: [X, yb + P + 0.55, face + 0.02], rotY: 0, w: 1.35, h: 1.8 });
      for (const sx of [-1, 1]) {
        const rx = X + sx * (wP / 2 + 0.38);
        parts.push(box([rx, yb + hR / 2, Z], [0.76, hR, d + 0.2], CREAM));
        parts.push(box([rx, yb + hR + 0.09, Z], [0.96, 0.18, d + 0.4], BLACK));
        parts.push(box([rx, yb + hR - 0.55, Z], [0.86, 0.2, d + 0.3], CREAM_LIGHT)); // moulded neck
      }
      // stepped corner risers at both ends of the front
      for (const [ex, sx] of [
        [x0 + 0.7, 1],
        [x1 - stair.riser / 2, -1],
      ] as const) {
        const EX = world.x(ex);
        const hLow = P + 0.9;
        const hHigh = P + 1.8;
        parts.push(box([EX, yb + hLow / 2, Z], [1.4, hLow, d + 0.1], CREAM));
        parts.push(box([EX, yb + hLow + 0.08, Z], [1.56, 0.16, d + 0.26], BLACK));
        const UX = EX - sx * 0.25;
        parts.push(box([UX, yb + hHigh / 2, Z], [0.8, hHigh, d + 0.15], CREAM));
        parts.push(box([UX, yb + hHigh + 0.09, Z], [0.98, 0.18, d + 0.32], BLACK));
        vents.push({ pos: [EX + sx * 0.12, yb + P - 0.1, face + 0.03], rotY: 0, w: 0.62, h: 0.86 });
      }
    }
    // water tank: black HDPE cylinder on a small raised cream stand, on the terrace just behind the parapet over the
    // back exit (the wall between the house and the rear-right backyard)
    const ex = slot.backExit;
    const tx = world.x(Math.min(slot.rect.x1 - 2.6, Math.max(slot.rect.x0 + 2.6, ex.x)));
    const tz = world.z(ex.z - 2.7);
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

  // ── meter box, rain pipes, back exit + bathroom ventilator ──
  const extras = useMemo<Part[]>(() => {
    const top = H;
    const { wide, step } = slot.notch;
    const parts: Part[] = [
      // PVC rain-water down pipes at the lane-side corners
      ...[slot.rect.z0 + (ver ? ver.z1 - slot.rect.z0 + 0.3 : 0.45), slot.rect.z1 - 0.45].flatMap((z) => {
        const x = world.x(slot.rect.x0 - 0.28);
        const Z = world.z(z);
        return [rod([x, (top + 0.8) / 2, Z], [0.3, top + 0.8, 0.3], "#e6e1d3"), box([x - 0.25, 0.35, Z], [0.7, 0.22, 0.32], "#e6e1d3")];
      }),
    ];
    // maroon EB meter box in a cream frame on the front wall just left of the stair foot (photo 4)
    if (!ver || slot.stairs.x0 - ver.x1 > 1.6) {
      const X = world.x(slot.stairs.x0 - 1.1);
      const Z = world.z(slot.rect.z0);
      parts.push(
        box([X, 5.0, Z + 0.12], [2.2, 2.3, 0.24], CREAM_LIGHT),
        box([X, 5.0, Z + 0.3], [1.6, 1.7, 0.2], PAL.maroon),
        box([X + 0.3, 5.25, Z + 0.42], [0.42, 0.55, 0.08], "#cfd3d6"),
        box([X - 0.4, 4.7, Z + 0.42], [0.5, 0.5, 0.1], "#8e2a22"),
      );
    }
    // back exit: a maroon-framed door from the house into the backyard (notch front wall, facing the back)
    const bx = world.x(slot.backExit.x);
    const bz = world.z(slot.backExit.z);
    const bw = slot.backExit.widthFt;
    parts.push(box([bx, 3.6, bz - 0.06], [bw + 0.5, 7.2, 0.14], PAL.maroon), box([bx, 3.5, bz - 0.13], [bw, 6.8, 0.06], "#5e3319"));
    // bathroom ventilator high on the notch's inner wall
    const vx = world.x(wide.x0 + 0.06);
    const vz = world.z((wide.z0 + wide.z1) / 2);
    parts.push(box([vx, 7.6, vz], [0.14, 1.2, 1.7], CREAM_LIGHT), box([vx + 0.06, 7.6, vz], [0.08, 0.8, 1.3], "#2a2622"));
    // a small concrete step out of the back exit
    parts.push(box([bx, 0.18, world.z(step.z0 + 0.5)], [bw + 0.6, 0.36, 1.0], "#d9d2bf"));
    // entrance steps in front of the veranda
    if (ver) parts.push(box([world.x(ver.x0 + (ver.x1 - ver.x0) * 0.66), 0.3, world.z(ver.z0 - 0.4)], [2.6, 0.6, 0.8], "#d9d2bf"));
    return parts;
  }, [slot, ver, world, H]);

  const door = slot.door;
  const doorPos: V3 = ver ? [world.x(ver.x0 + (ver.x1 - ver.x0) * 0.66), PLINTH + 3.5, world.z(ver.z1 - 0.07)] : [world.x(door.x), 0.6 + 3.5, world.z(door.z - 0.07)];
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
  const capRef = useRef<THREE.InstancedMesh>(null);
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
    const boxes = (m: THREE.InstancedMesh | null, list: { p: V3; s: V3 }[]) => {
      if (!m) return;
      list.forEach((st, i) => {
        o.position.set(...st.p);
        o.rotation.set(0, 0, 0);
        o.scale.set(...st.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    };
    boxes(stepRef.current, stairs.steps);
    boxes(capRef.current, stairs.caps);
  }, [windows, litWin, darkWin, stairs, veranda, roof]);

  const furniture = useMemo(() => [...stairs.parts, ...veranda.parts, ...chajja, ...roof.parts, ...extras], [stairs, veranda, chajja, roof, extras]);
  const furnitureMat = holo ?? vcMaterial(0.8, finish);
  const kolam = ver
    ? { x: ver.x0 + (ver.x1 - ver.x0) * 0.6, z: ver.z0 + (ver.z1 - ver.z0) * 0.55, s: Math.min(ver.x1 - ver.x0, ver.z1 - ver.z0) * 0.62, y: PLINTH + 0.03 }
    : { x: slot.kolam.x, z: slot.kolam.z, s: slot.kolam.sizeFt, y: 0.08 };

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
      {/* house entrance (faces the yard) */}
      <group position={doorPos}>
        <Baked parts={doorTrim} cast={!ghost} material={furnitureMat} />
        <mesh geometry={G.plane()} material={ghost ? M.plaster : std("#ffffff", { map: doorTex(), rough: 0.6, finish })} scale={[doorW, 7, 1]} position={[0, 0, 0.06]} />
        {!ghost && <mesh geometry={G.sphere()} material={lampMat} scale={0.4} position={[doorW / 2 + 0.75, 2.6, 0.3]} />}
        {lived && !ghost && <Thoranam width={doorW + 0.6} animate={animate} />}
      </group>

      {/* stair treads (instanced) + baked balustrades, rails, veranda, chajja, parapets, tank, meter box */}
      <instancedMesh ref={stepRef} args={[G.box(), M.stair, Math.max(1, stairs.steps.length)]} castShadow={!ghost} receiveShadow />
      <instancedMesh ref={capRef} args={[G.box(), M.tread, Math.max(1, stairs.caps.length)]} receiveShadow />
      <mesh geometry={stairs.wallGeo} material={M.stairWall} castShadow={!ghost} receiveShadow />
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
  const x0 = slot.rect.x0 + 2.0;
  const x1 = Math.min(slot.notch.wide.x0 - 1.5, slot.rect.x1 - 2.5);
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
