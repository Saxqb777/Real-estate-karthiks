"use client";
// Inside the compound (owner's photos): grey concrete yard and passage, a concrete step at each porch, and the
// cream compound wall — square pillars, the same unbroken black line pattern on the outer face of EVERY side (owner:
// uniform on all sides, no jaali panels), two black steel gates with a diamond motif (the main
// gate at the front unit's stair foot, the back unit's gate mid-way along the lane wall) and a door-number pole
// outside each gate. The wall is a separate enclosure on the plot boundary — it never touches a house. A tulsi maadam in the courtyard and potted marigolds.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BuildingSlot, CompoundWall, SiteLayout } from "@/lib/site-layout";
import { ball, box, rod, type Part, type V3 } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { G, PAL, std } from "./materials";
import { gateTex, houseNumberTex, plasterTex, withRepeat } from "./textures";
import { FLAT, planShape, type World } from "./util";

const WALL_H = 4.6;
const WALL_T = 0.55;
const PILLAR = 0.95;
/** the owner's door number, painted on the corner pillar */
export const HOUSE_NUMBER = "116/87";

export function PlotGround({ layout, world }: { layout: SiteLayout; world: World; animate?: boolean }) {
  const key = JSON.stringify([layout.plot.polygon, layout.paved, world.cx, world.cz]);
  const geos = useMemo(() => {
    const yard = new THREE.ShapeGeometry(planShape(layout.plot.polygon, world));
    const paved = new THREE.ShapeGeometry(planShape(layout.paved, world));
    return { yard, paved };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const yardMat = std("#aaa496", { map: withRepeat(plasterTex(), 1 / 7, 1 / 7), rough: 1, polygonOffset: 1 });
  const paveMat = std("#bcb8ae", { map: withRepeat(plasterTex(), 1 / 5, 1 / 5), rough: 0.95, polygonOffset: 2 });

  return (
    <group>
      <mesh geometry={geos.yard} material={yardMat} rotation={FLAT} position={[0, 0.02, 0]} receiveShadow />
      {layout.paved[2].z > 0 && <mesh geometry={geos.paved} material={paveMat} rotation={FLAT} position={[0, 0.05, 0]} receiveShadow />}
      {layout.slots.filter((s) => s.status !== "empty").map((s) => (
        <Porch key={s.slot} slot={s} world={world} />
      ))}
      <Walls layout={layout} world={world} />
      {layout.courtyard && layout.courtyard.z1 - layout.courtyard.z0 > 5 && <Tulsi layout={layout} world={world} />}
      <Pots layout={layout} world={world} />
    </group>
  );
}

/** Concrete floor of the rear-right backyard notch + the pad under the stair (baked: one draw call). */
function Porch({ slot, world }: { slot: BuildingSlot; world: World }) {
  const parts = useMemo<Part[]>(() => {
    const r = (x0: number, x1: number, z0: number, z1: number, h: number, c: string) => box([world.x((x0 + x1) / 2), h / 2, world.z((z0 + z1) / 2)], [x1 - x0, h, z1 - z0], c);
    const { wide, step } = slot.notch;
    return [r(wide.x0, wide.x1, wide.z0, wide.z1, 0.2, "#b3aea3"), r(step.x0, step.x1, step.z0, step.z1, 0.2, "#b3aea3"), r(slot.stairs.x0 - 0.3, slot.stairs.x1, slot.stairs.z0 - 0.3, slot.stairs.z1, 0.12, "#c4bfb3")];
  }, [slot, world]);
  return <Baked parts={parts} receive material={vcMaterial(0.9)} />;
}

/**
 * Compound wall from the layout segments: cream wall + coping, square pillars (ends + every ~8 ft), the black line
 * pattern on the outer face of every wall, gate pillars.
 */
function wallParts(layout: SiteLayout, world: World): { solid: Part[]; gates: { x: number; z: number; rotY: number; len: number }[] } {
  const walls: CompoundWall[] = layout.compoundWalls;
  const solid: Part[] = [];
  const gates: { x: number; z: number; rotY: number; len: number }[] = [];
  const cream = PAL.plasterWarm;
  const black = PAL.black;
  const P = layout.plot.polygon;
  const cxp = P.reduce((a, p) => a + p.x, 0) / P.length;
  const czp = P.reduce((a, p) => a + p.z, 0) / P.length;
  for (const w of walls) {
    const dx = w.b.x - w.a.x;
    const dz = w.b.z - w.a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const ux = dx / len;
    const uz = -dz / len; // world direction of the segment
    const mx = world.x((w.a.x + w.b.x) / 2);
    const mz = world.z((w.a.z + w.b.z) / 2);
    // plan direction (dx, dz) → world (dx, −dz); rotation about Y aligns local +X with it
    const rotY = Math.atan2(dz, dx);
    // outward (away from the plot) unit normal in world space
    const away = uz * ((w.a.x + w.b.x) / 2 - cxp) - -ux * ((w.a.z + w.b.z) / 2 - czp) >= 0 ? 1 : -1;
    const nx = uz * away;
    const nz = -ux * away;
    const at = (t: number, y: number, out = 0): V3 => [mx + ux * t + nx * out, y, mz + uz * t + nz * out];
    if (w.kind === "gate") {
      for (const sgn of [-1, 1]) {
        solid.push(box(at((sgn * len) / 2, (WALL_H + 0.7) / 2), [1.05, WALL_H + 0.7, 1.05], cream, [0, rotY, 0]));
        solid.push(box(at((sgn * len) / 2, WALL_H + 0.78), [1.25, 0.18, 1.25], PAL.cornice, [0, rotY, 0]));
      }
      gates.push({ x: mx, z: mz, rotY, len });
      continue;
    }
    solid.push(box(at(0, WALL_H / 2), [len, WALL_H, WALL_T], cream, [0, rotY, 0]));
    solid.push(box(at(0, WALL_H + 0.1), [len + 0.1, 0.2, WALL_T + 0.14], PAL.cornice, [0, rotY, 0]));
    // pillars: both ends + evenly spaced ≤ 8.5 ft apart
    const nPanels = Math.max(1, Math.round(len / 8));
    const pillarTs: number[] = [];
    for (let i = 0; i <= nPanels; i++) pillarTs.push(-len / 2 + (i * len) / nPanels);
    for (const t of pillarTs) {
      solid.push(box(at(t, (WALL_H + 0.45) / 2), [PILLAR, WALL_H + 0.45, PILLAR], cream, [0, rotY, 0]));
      solid.push(box(at(t, WALL_H + 0.5), [PILLAR + 0.16, 0.14, PILLAR + 0.16], PAL.cornice, [0, rotY, 0]));
    }
    const outFace = WALL_T / 2 + 0.025;
    // graphic black pattern on the OUTER face of every wall (owner: "throughout the compound wall in all sides"): a black
    // post on every pillar, two rails per panel that step up and down from panel to panel, a
    // short vertical link and black dashes under the coping
    for (const t of pillarTs) solid.push(box(at(t, (WALL_H + 0.1) / 2, PILLAR / 2 + 0.02), [0.28, WALL_H - 0.3, 0.05], black, [0, rotY, 0]));
    for (let i = 0; i < nPanels; i++) {
      const ta = pillarTs[i] + PILLAR / 2;
      const tb = pillarTs[i + 1] - PILLAR / 2;
      if (tb - ta < 0.6) continue;
      const pl = tb - ta;
      const pc = (ta + tb) / 2;
      const ys = i % 2 ? [1.25, 2.55] : [1.85, 3.15];
      for (const y of ys) solid.push(box(at(pc, y, outFace), [pl, 0.17, 0.05], black, [0, rotY, 0]));
      solid.push(box(at(pc + (i % 2 ? 0.28 : -0.28) * pl, (ys[0] + ys[1]) / 2, outFace), [0.17, ys[1] - ys[0], 0.05], black, [0, rotY, 0]));
      for (const f of [-0.25, 0.25]) solid.push(box(at(pc + f * pl, WALL_H - 0.42, outFace), [0.55, 0.32, 0.05], black, [0, rotY, 0]));
    }
  }
  return { solid, gates };
}

/**
 * A slim black pole with the unit's door number on the grass just outside each unit's own gate (owner): Gate A in the
 * front wall carries the front unit's number (right of the gate), Gate B in the lane wall the back unit's (towards the back).
 */
function numberPoles(layout: SiteLayout, world: World): { pos: V3; rotY: number; no: string }[] {
  const out: { pos: V3; rotY: number; no: string }[] = [];
  const name = (sl: "front" | "back") => layout.slots.find((s) => s.slot === sl)?.unit?.name || HOUSE_NUMBER;
  const front = layout.compoundWalls.find((w) => w.gate === "front");
  if (front) out.push({ pos: [world.x(Math.max(front.a.x, front.b.x) + 1.8), 0, world.z(-1.3)], rotY: 0, no: name("front") });
  const side = layout.compoundWalls.find((w) => w.gate === "side");
  if (side) {
    const x = Math.min(side.a.x, side.b.x) - 1.3;
    out.push({ pos: [world.x(x), 0, world.z(Math.max(side.a.z, side.b.z) + 2.6)], rotY: -Math.PI / 2, no: name("back") });
  }
  return out;
}

function NumberPole({ pos, rotY, no }: { pos: V3; rotY: number; no: string }) {
  // self-lit (emissive = the plate itself) so the gold numerals stay readable at dusk and night
  const tex = houseNumberTex(no);
  const plateMat = std("#ffffff", { map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.85, rough: 0.6 });
  const parts = useMemo<Part[]>(
    () => [rod([0, 2.6, -0.24], [0.24, 5.2, 0.24], "#17171a"), rod([0, 0.12, -0.24], [0.55, 0.24, 0.55], "#8f877b"), box([0, 5.4, -0.07], [2.3, 1.02, 0.1], "#121212")],
    [],
  );
  // the pole stands BEHIND the plate (holds it from the back) so it never cuts across the numbers
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <Baked parts={parts} cast />
      <mesh geometry={G.plane()} material={plateMat} position={[0, 5.4, 0.0]} scale={[2.2, 0.92, 1]} />
    </group>
  );
}

function Walls({ layout, world }: { layout: SiteLayout; world: World }) {
  const { solid, gates } = useMemo(() => wallParts(layout, world), [layout, world]);
  const poles = useMemo(() => numberPoles(layout, world), [layout, world]);
  const gateMat = std("#ffffff", { map: gateTex(), alphaTest: 0.5, side: THREE.DoubleSide, rough: 0.5, metal: 0.4 });
  return (
    <group>
      <Baked parts={solid} cast receive material={vcMaterial(0.92)} />
      {poles.map((p) => (
        <NumberPole key={p.no + p.rotY} {...p} />
      ))}
      {gates.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]} rotation={[0, g.rotY, 0]}>
          <mesh geometry={G.plane()} material={gateMat} position={[0, (WALL_H - 0.2) / 2 + 0.2, 0]} scale={[Math.max(0.5, g.len - 1.05), WALL_H - 0.2, 1]} castShadow />
        </group>
      ))}
    </group>
  );
}

/** Tulsi maadam — the holy-basil planter found in Tamil courtyards. */
function Tulsi({ layout, world }: { layout: SiteLayout; world: World }) {
  const parts = useMemo<Part[]>(() => {
    const c = layout.courtyard!;
    const back = layout.slots.find((s) => s.slot === "back");
    const X = world.x((back ? back.rect.x0 : layout.plot.rightX - 12) + 3.0); // courtyard, left of Unit B's stair
    const Z = world.z(c.z0 + Math.min(2.2, (c.z1 - c.z0) * 0.25)); // against the front house, clear of Gate B
    const p = (x: number, y: number, z: number): [number, number, number] => [X + x, y, Z + z];
    return [
      box(p(0, 0.25, 0), [2.2, 0.5, 2.2], PAL.plaster),
      box(p(0, 1.8, 0), [1.6, 2.6, 1.6], PAL.plaster),
      box(p(0, 3.15, 0), [1.75, 0.22, 1.75], PAL.terracotta),
      box(p(0, 1.2, 0), [0.9, 0.18, 1.62], PAL.terracotta),
      box(p(0, 1.9, 0.78), [0.5, 0.6, 0.1], "#2a1a12"),
      ...[0, 1, 2, 3, 4].map((i) => ball(p(Math.sin(i * 2.1) * 0.35, 3.6 + i * 0.32, Math.cos(i * 2.1) * 0.35), 0.9 - i * 0.08, i % 2 ? "#3f7d3a" : "#4b8a40")),
    ];
  }, [layout, world]);
  return <Baked parts={parts} cast receive />;
}

/** Terracotta pots of marigolds at porch mouths and courtyard corners. */
function Pots({ layout, world }: { layout: SiteLayout; world: World }) {
  const parts = useMemo<Part[]>(() => {
    const spots: [number, number][] = [];
    for (const s of layout.slots) {
      if (s.status === "empty") continue;
      // either side of the entrance steps
      spots.push([s.rect.x0 + 0.9, s.rect.z0 - 0.9]);
      spots.push([s.stairs.x0 - 1.0, s.rect.z0 - 0.9]);
    }
    return spots.flatMap(([x, z], i) => {
      const raised = 0;
      const X = world.x(x);
      const Z = world.z(z);
      return [
        rod([X, raised + 0.45, Z], [1.0, 0.9, 1.0], PAL.terracotta),
        ball([X, raised + 1.15, Z], 1.05, PAL.bush),
        ...[0, 1, 2, 3, 4].map((k) => ball([X + Math.cos(k * 1.3 + i) * 0.38, raised + 1.45 + (k % 2) * 0.12, Z + Math.sin(k * 1.3 + i) * 0.38], 0.38, k % 2 ? PAL.saffron : PAL.marigold)),
      ];
    });
  }, [layout, world]);
  return <Baked parts={parts} cast />;
}

export { WALL_H };
