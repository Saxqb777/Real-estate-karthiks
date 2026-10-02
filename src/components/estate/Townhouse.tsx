"use client";
// One Tamil Nadu townhouse, built procedurally from a BuildingSlot (src/lib/site-layout.ts): lime-plaster body,
// plinth, floor bands, Athangudi-tile accent band, terracotta parapet, teal shuttered windows with chajjas,
// teak door with kolam + mango-leaf thoranam, dog-leg external stairs in the notch, black water tank, DTH dish.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { SITE_DEFAULTS, offsetPolygon, type BuildingSlot, type Pt } from "@/lib/site-layout";
import type { Env } from "./env";
import { ball, box, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { G, PAL, holoMaterial, std, type Finish } from "./materials";
import { athangudiTex, doorTex, kolamTex, plasterTex, roofTex, windowGlowTex, windowTex, withRepeat } from "./textures";
import { FLAT, hash, planShape, type World } from "./util";

const FH = SITE_DEFAULTS.floorHeightFt;
const BAND_H = 1.15;
const WIN_W = 3.0;
const WIN_H = 4.2;

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

function extrude(pts: Pt[], world: World, depth: number, holes: Pt[][] = []) {
  return new THREE.ExtrudeGeometry(planShape(pts, world, holes), { depth, bevelEnabled: false, curveSegments: 1 });
}

export function Townhouse({ slot, world, env, finish, ghost, lived, clothes, animate }: TownhouseProps) {
  const H = slot.heightFt;
  const sig = JSON.stringify([slot.outline, H, slot.floors, world.cx, world.cz]);

  const geo = useMemo(() => {
    const o = slot.outline;
    const g = {
      body: extrude(o, world, H),
      plinth: extrude(offsetPolygon(o, 0.22), world, 1.4),
      bands: Array.from({ length: slot.floors - 1 }, () => extrude(offsetPolygon(o, 0.34), world, 0.42)),
      accent: extrude(offsetPolygon(o, 0.08), world, BAND_H),
      cornice: extrude(offsetPolygon(o, 0.55), world, 0.5),
      parapet: extrude(offsetPolygon(o, 0.14), world, slot.parapetFt - 0.15, [offsetPolygon(o, -0.45)]),
    };
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(
    () => () => {
      geo.body.dispose();
      geo.plinth.dispose();
      geo.bands.forEach((b) => b.dispose());
      geo.accent.dispose();
      geo.cornice.dispose();
      geo.parapet.dispose();
    },
    [geo],
  );
  const edges = useMemo(() => (ghost ? [new THREE.EdgesGeometry(geo.body, 20), new THREE.EdgesGeometry(geo.parapet, 20)] : []), [ghost, geo]);
  useEffect(() => () => edges.forEach((e) => e.dispose()), [edges]);

  // ── materials ──
  const holo = useMemo(() => (ghost ? holoMaterial() : null), [ghost]);
  useEffect(() => () => holo?.dispose(), [holo]);
  const M = useMemo(() => {
    if (holo) return { plaster: holo, roof: holo, plinth: holo, band: holo, accent: holo, cornice: holo, parapetSide: holo, parapetCap: holo, stair: holo };
    const f = finish;
    return {
      plaster: std(PAL.plaster, { map: withRepeat(plasterTex(), 1 / 9, 1 / 9), rough: 0.92, finish: f }),
      roof: std("#ffffff", { map: withRepeat(roofTex(), 1 / 8, 1 / 8), rough: 0.85, finish: f }),
      plinth: std(PAL.plinth, { map: withRepeat(plasterTex(), 1 / 5, 1 / 5), rough: 0.9, finish: f }),
      band: std(PAL.cornice, { rough: 0.85, finish: f }),
      accent: std("#ffffff", { map: withRepeat(athangudiTex(), 1 / (BAND_H * 4), 1 / BAND_H, 0, 1 - 1 / BAND_H), rough: 0.6, finish: f }),
      cornice: std(PAL.cornice, { rough: 0.85, finish: f }),
      parapetSide: std(PAL.terracotta, { map: withRepeat(plasterTex(), 1 / 6, 1 / 6), rough: 0.88, finish: f }),
      parapetCap: std(PAL.terracottaCap, { rough: 0.8, finish: f }),
      stair: std("#e6d9c4", { rough: 0.9, finish: f }),
    };
  }, [holo, finish]);

  // ── windows (instanced) ──
  const windows = useMemo(() => {
    const spots: WindowSpot[] = [];
    slot.walls.forEach((w, wi) => {
      if (!["front", "left", "back", "porch"].includes(w.kind) || w.length < 4.2) return;
      const n = Math.max(1, Math.floor((w.length - 1.2) / 6.2));
      const dx = (w.b.x - w.a.x) / w.length;
      const dz = (w.b.z - w.a.z) / w.length;
      const rotY = Math.atan2(w.n.x, -w.n.z);
      for (let f = 0; f < slot.floors; f++) {
        for (let i = 0; i < n; i++) {
          if (w.kind === "porch" && f === 0) continue; // the door is there
          const t = ((i + 0.5) * w.length) / n;
          const px = w.a.x + dx * t + w.n.x * 0.06;
          const pz = w.a.z + dz * t + w.n.z * 0.06;
          const y = f * FH + 3.1 + WIN_H / 2;
          spots.push({ pos: [world.x(px), y, world.z(pz)], rotY, lit: hash(wi * 31 + f * 7 + i * 3 + slot.rect.z0) < 0.72 });
        }
      }
    });
    return spots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
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

  // ── stairs (dog-leg in the stair well, one pair of flights per floor) ──
  const stairs = useMemo(() => {
    const s = slot.stairs;
    const step = slot.notch.step;
    const hw = (s.x1 - s.x0) / 2;
    const land = Math.min(2, (s.z1 - s.z0) * 0.3);
    const run = s.z1 - s.z0 - land;
    const n = 7;
    const rise = FH / 2 / n;
    const steps: { p: [number, number, number]; s: [number, number, number] }[] = [];
    const slabs: { p: [number, number, number]; s: [number, number, number] }[] = [];
    const rails: { p: [number, number, number]; len: number; pitch: number; x: number }[] = [];
    for (let f = 0; f < slot.floors; f++) {
      const y0 = f * FH + (f === 0 ? 0.6 : 0);
      const outerX = s.x0 + hw * 1.5;
      const innerX = s.x0 + hw * 0.5;
      for (let k = 0; k < n; k++) {
        // flight 1: outer lane, front → back
        const z1 = s.z0 + (k + 0.5) * (run / n);
        const top1 = y0 + (k + 1) * ((FH / 2 - (f === 0 ? 0.6 : 0)) / n);
        steps.push({ p: [world.x(outerX), top1 - rise, world.z(z1)], s: [hw - 0.12, rise * 2, run / n + 0.02] });
        // flight 2: inner lane, back → front
        const z2 = s.z0 + run - (k + 0.5) * (run / n);
        const top2 = f * FH + FH / 2 + (k + 1) * rise;
        steps.push({ p: [world.x(innerX), top2 - rise, world.z(z2)], s: [hw - 0.12, rise * 2, run / n + 0.02] });
      }
      const midY = f * FH + FH / 2;
      slabs.push({ p: [world.x((s.x0 + s.x1) / 2), midY - 0.25, world.z(s.z1 - land / 2)], s: [s.x1 - s.x0, 0.5, land] });
      slabs.push({ p: [world.x((s.x0 + s.x1) / 2), (f + 1) * FH - 0.25, world.z((step.z0 + step.z1) / 2)], s: [step.x1 - step.x0, 0.5, step.z1 - step.z0] });
      const len = Math.hypot(run, FH / 2);
      const pitch = Math.atan2(FH / 2, run);
      rails.push({ p: [world.x(s.x1 - 0.12), y0 + FH / 4 + 2.8, world.z(s.z0 + run / 2)], len, pitch, x: 0 });
    }
    return { steps, slabs, rails, spine: { p: [world.x(s.x0 + hw), 0, world.z(s.z0 + run / 2)] as [number, number, number], len: run, h: slot.floors * FH } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const stepRef = useRef<THREE.InstancedMesh>(null);
  const winRef = useRef<THREE.InstancedMesh>(null);
  const litRef = useRef<THREE.InstancedMesh>(null);
  const shadeRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    const fill = (m: THREE.InstancedMesh | null, list: WindowSpot[], kind: "glass" | "shade" | "sill") => {
      if (!m) return;
      list.forEach((w, i) => {
        o.position.set(...w.pos);
        o.rotation.set(0, w.rotY, 0);
        o.scale.set(WIN_W, WIN_H, 1);
        if (kind === "shade") {
          o.translateY(WIN_H / 2 + 0.4);
          o.translateZ(0.62);
          o.scale.set(WIN_W + 0.9, 0.24, 1.3);
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
  }, [windows, litWin, darkWin, stairs]);

  // ── door, roof furniture ──
  const door = slot.door;
  const doorPos: [number, number, number] = [world.x(door.x + 0.07), 0.6 + 3.5, world.z(door.z)];
  const top = H + 0.1;
  const furniture = useMemo<Part[]>(() => {
    const tx = world.x(slot.rect.x0 + 3.0);
    const tz = world.z(slot.rect.z1 - 3.0);
    const parts: Part[] = [
      // black HDPE water tank on a brick stand
      box([tx, top + 0.75, tz], [4.2, 1.5, 4.2], PAL.terracotta),
      rod([tx, top + 3.65, tz], [3.9, 4.3, 3.9], PAL.tank),
      ...[2.3, 3.6, 4.9].map((y) => rod([tx, top + y, tz], [4.05, 0.16, 4.05], "#121315")),
      rod([tx, top + 6.0, tz], [1.3, 0.4, 1.3], PAL.tank),
      // stair landings, spine wall, hand rails
      ...stairs.slabs.map((s) => box(s.p, s.s, "#e6d9c4")),
      box([stairs.spine.p[0], stairs.spine.h / 2, stairs.spine.p[2]], [0.32, stairs.spine.h, stairs.spine.len], PAL.plaster),
      ...stairs.rails.map((r) => box(r.p, [0.14, 0.14, r.len], PAL.woodDark, [r.pitch, 0, 0])),
    ];
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, stairs]);
  const furnitureMat = holo ?? vcMaterial(0.6, finish);
  const doorTrim = useMemo<Part[]>(() => [box([0, 0.2, -0.05], [door.widthFt + 0.7, 7.5, 0.18], PAL.woodDark), box([0, 4.05, 0.45], [door.widthFt + 1.4, 0.3, 1.0], PAL.cornice)], [door.widthFt]);

  return (
    <group>
      <mesh geometry={geo.body} material={[M.roof, M.plaster]} rotation={FLAT} castShadow receiveShadow />
      <mesh geometry={geo.plinth} material={M.plinth} rotation={FLAT} castShadow={!ghost} receiveShadow />
      {geo.bands.map((b, i) => (
        <mesh key={i} geometry={b} material={M.band} rotation={FLAT} position={[0, (i + 1) * FH - 0.21, 0]} castShadow={!ghost} receiveShadow />
      ))}
      <mesh geometry={geo.accent} material={[M.plaster, M.accent]} rotation={FLAT} position={[0, H - 1.55, 0]} receiveShadow />
      <mesh geometry={geo.cornice} material={[M.roof, M.cornice]} rotation={FLAT} position={[0, H - 0.4, 0]} castShadow={!ghost} receiveShadow />
      <mesh geometry={geo.parapet} material={[M.parapetCap, M.parapetSide]} rotation={FLAT} position={[0, top, 0]} castShadow={!ghost} receiveShadow />
      {edges.map((e, i) => (
        <lineSegments key={i} geometry={e} rotation={FLAT} position={[0, i ? top : 0, 0]}>
          <lineBasicMaterial color="#a8d4ff" transparent opacity={0.9} toneMapped={false} />
        </lineSegments>
      ))}

      {/* windows + chajjas */}
      <instancedMesh ref={winRef} args={[G.plane(), ghost ? M.plaster : winMat, Math.max(1, windows.length)]} />
      <instancedMesh ref={litRef} args={[G.plane(), ghost ? M.plaster : litMat, Math.max(1, windows.length)]} />
      <instancedMesh ref={shadeRef} args={[G.box(), M.band, Math.max(1, windows.length)]} castShadow={!ghost} receiveShadow />

      {/* door with frame, canopy, lamp */}
      <group position={doorPos} rotation={[0, Math.PI / 2, 0]}>
        <Baked parts={doorTrim} cast={!ghost} material={furnitureMat} />
        <mesh geometry={G.plane()} material={ghost ? M.plaster : std("#ffffff", { map: doorTex(), rough: 0.6, finish })} scale={[door.widthFt, 7, 1]} position={[0, 0, 0.06]} />
        {!ghost && <mesh geometry={G.sphere()} material={lampMat} scale={0.4} position={[door.widthFt / 2 + 0.75, 2.6, 0.3]} />}
        {lived && !ghost && <Thoranam width={door.widthFt + 0.6} animate={animate} />}
      </group>

      {/* external dog-leg staircase steps (instanced) + baked landings / spine / rails / water tank */}
      <instancedMesh ref={stepRef} args={[G.box(), M.stair, Math.max(1, stairs.steps.length)]} castShadow={!ghost} receiveShadow />
      <Baked parts={furniture} cast={!ghost} receive material={furnitureMat} />
      {!ghost && (
        <group position={[world.x(slot.rect.x0 + 1.4), top + slot.parapetFt - 0.1, world.z(slot.rect.z0 + 1.6)]}>
          <mesh geometry={G.cyl()} material={std("#d9d9d9", { rough: 0.5, metal: 0.3, finish })} scale={[0.12, 1.6, 0.12]} position={[0, 0.8, 0]} />
          <mesh material={std("#e9e9e9", { rough: 0.4, metal: 0.2, side: THREE.DoubleSide, finish })} position={[0.1, 1.8, 0.25]} rotation={[-0.9, 0.5, 0]} castShadow>
            <sphereGeometry args={[0.9, 16, 6, 0, Math.PI * 2, 0, 0.75]} />
          </mesh>
        </group>
      )}

      {/* kolam on the porch */}
      {lived && !ghost && (
        <mesh geometry={G.plane()} material={kolamMat} rotation={FLAT} position={[world.x(slot.kolam.x), 0.62, world.z(slot.kolam.z)]} scale={[slot.kolam.sizeFt, slot.kolam.sizeFt, 1]} />
      )}
      {clothes && !ghost && <ClothesLine slot={slot} world={world} y={top} animate={animate} />}
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

/** A clothes line on the roof terrace: saree, veshti, shirt, towel fluttering in the wind. */
function ClothesLine({ slot, world, y, animate }: { slot: BuildingSlot; world: World; y: number; animate: boolean }) {
  const z = slot.rect.z1 - 6.5;
  const x0 = slot.rect.x0 + 6.5;
  const x1 = Math.min(slot.stairs.x0 - 1.5, slot.rect.x1 - 2.5);
  const len = Math.max(4, x1 - x0);
  const clothes = useMemo(() => {
    const out: { geo: THREE.PlaneGeometry; base: Float32Array; x: number; w: number; h: number; color: string }[] = [];
    let cursor = 0.5;
    const widths = [1.1, 1.5, 1.3, 1.0, 1.2];
    widths.forEach((w, i) => {
      if (cursor + w > len - 0.3) return;
      const h = i === 0 ? 3.2 : i === 1 ? 2.4 : 1.5;
      const geo = new THREE.PlaneGeometry(w, h, 6, 5);
      geo.translate(0, -h / 2, 0);
      out.push({ geo, base: Float32Array.from(geo.attributes.position.array as Float32Array), x: cursor + w / 2, w, h, color: CLOTH_COLORS[i] });
      cursor += w + 0.35;
    });
    return out;
  }, [len]);
  useEffect(() => () => clothes.forEach((c) => c.geo.dispose()), [clothes]);
  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    const wind = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.21 + 1);
    for (const c of clothes) {
      const pos = c.geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const bx = c.base[i * 3];
        const by = c.base[i * 3 + 1];
        const hang = -by / c.h;
        pos.setZ(i, Math.sin(t * 5 + bx * 1.8 + c.x) * 0.35 * hang * wind + hang * hang * 0.6 * wind);
      }
      pos.needsUpdate = true;
    }
  });
  const frame = useMemo<Part[]>(() => [rod([0, 2.6, 0], [0.14, 5.2, 0.14], "#8a8a8a"), rod([len, 2.6, 0], [0.14, 5.2, 0.14], "#8a8a8a"), box([len / 2, 5.1, 0], [len, 0.04, 0.04], "#dddddd")], [len]);
  return (
    <group position={[world.x(x0), y, world.z(z)]}>
      <Baked parts={frame} cast />
      {clothes.map((c, i) => (
        <mesh key={i} geometry={c.geo} material={std(c.color, { side: THREE.DoubleSide, flat: true, rough: 0.95 })} position={[c.x, 5.1, 0]} castShadow />
      ))}
    </group>
  );
}
