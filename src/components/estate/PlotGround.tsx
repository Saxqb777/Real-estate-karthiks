"use client";
// Inside the compound: swept red-earth yard, cement-tile paving, red-oxide porches, compound wall with gates,
// a tulsi maadam in the courtyard and potted marigolds.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BuildingSlot, CompoundWall, SiteLayout } from "@/lib/site-layout";
import { ball, box, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import { G, PAL, std } from "./materials";
import { gateTex, pavingTex, plasterTex, withRepeat } from "./textures";
import { Thoranam } from "./Townhouse";
import { FLAT, planShape, rng, type World } from "./util";

const WALL_H = 4.6;
const WALL_T = 0.55;

export function PlotGround({ layout, world, animate }: { layout: SiteLayout; world: World; animate: boolean }) {
  const key = JSON.stringify([layout.plot.polygon, layout.paved, world.cx, world.cz]);
  const geos = useMemo(() => {
    const yard = new THREE.ShapeGeometry(planShape(layout.plot.polygon, world));
    const paved = new THREE.ShapeGeometry(planShape(layout.paved, world));
    return { yard, paved };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const yardMat = std("#b8714a", { map: withRepeat(plasterTex(), 1 / 7, 1 / 7), rough: 1, polygonOffset: 1 });
  const paveMat = std("#ffffff", { map: withRepeat(pavingTex(), 1 / 8, 1 / 8), rough: 0.8, polygonOffset: 2 });

  return (
    <group>
      <mesh geometry={geos.yard} material={yardMat} rotation={FLAT} position={[0, 0.02, 0]} receiveShadow />
      {layout.paved[2].z > 0 && <mesh geometry={geos.paved} material={paveMat} rotation={FLAT} position={[0, 0.05, 0]} receiveShadow />}
      {layout.slots.filter((s) => s.status !== "empty").map((s) => (
        <Porch key={s.slot} slot={s} world={world} />
      ))}
      <Walls walls={layout.compoundWalls} world={world} animate={animate} />
      {layout.courtyard && layout.courtyard.z1 - layout.courtyard.z0 > 5 && <Tulsi layout={layout} world={world} />}
      <Pots layout={layout} world={world} />
      <Bougainvillea layout={layout} world={world} />
    </group>
  );
}

/** Raised red-oxide porch floor in the stepped notch (baked: one draw call). */
function Porch({ slot, world }: { slot: BuildingSlot; world: World }) {
  const parts = useMemo<Part[]>(() => {
    const r = (x0: number, x1: number, z0: number, z1: number, h: number, c: string) => box([world.x((x0 + x1) / 2), h / 2, world.z((z0 + z1) / 2)], [x1 - x0, h, z1 - z0], c);
    const { wide, step } = slot.notch;
    return [r(wide.x0, wide.x1, wide.z0, wide.z1, 0.6, PAL.redOxide), r(step.x0, step.x1, step.z0, step.z1, 0.6, PAL.redOxide), r(wide.x0, wide.x1, slot.rect.z0, slot.rect.z0 + 0.36, 0.62, "#d9cbb4")];
  }, [slot, world]);
  return <Baked parts={parts} receive material={vcMaterial(0.35)} />;
}

function wallParts(walls: CompoundWall[], world: World): { solid: Part[]; gates: { x: number; z: number; rotY: number; len: number }[] } {
  const solid: Part[] = [];
  const gates: { x: number; z: number; rotY: number; len: number }[] = [];
  const plaster = PAL.plasterWarm;
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
    const at = (t: number, y: number): [number, number, number] => [mx + ux * t, y, mz + uz * t];
    if (w.kind === "gate") {
      for (const sgn of [-1, 1]) {
        solid.push(box(at((sgn * len) / 2, (WALL_H + 1) / 2), [0.95, WALL_H + 1, 0.95], PAL.plaster, [0, rotY, 0]));
        solid.push(box(at((sgn * len) / 2, WALL_H + 1.15), [1.2, 0.3, 1.2], PAL.terracotta, [0, rotY, 0]));
        solid.push(ball(at((sgn * len) / 2, WALL_H + 1.55), 0.55, PAL.white));
      }
      gates.push({ x: mx, z: mz, rotY, len });
      continue;
    }
    solid.push(box(at(0, WALL_H / 2), [len, WALL_H, WALL_T], plaster, [0, rotY, 0]));
    solid.push(box(at(0, WALL_H + 0.14), [len + 0.1, 0.28, WALL_T + 0.22], PAL.terracotta, [0, rotY, 0]));
    for (const sgn of [-1, 1]) solid.push(box(at((sgn * len) / 2, (WALL_H + 0.5) / 2), [0.85, WALL_H + 0.5, 0.85], PAL.plaster, [0, rotY, 0]));
  }
  return { solid, gates };
}

function Walls({ walls, world, animate }: { walls: CompoundWall[]; world: World; animate: boolean }) {
  const { solid, gates } = useMemo(() => wallParts(walls, world), [walls, world]);
  const gateMat = std("#ffffff", { map: gateTex(), alphaTest: 0.5, side: THREE.DoubleSide, rough: 0.5, metal: 0.4 });
  return (
    <group>
      <Baked parts={solid} cast receive material={vcMaterial(0.9)} />
      {gates.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]} rotation={[0, g.rotY, 0]}>
          <mesh geometry={G.plane()} material={gateMat} position={[0, (WALL_H - 0.3) / 2 + 0.25, 0]} scale={[Math.max(0.5, g.len - 0.95), WALL_H - 0.3, 1]} />
          {/* mango-leaf + marigold thoranam across the gate */}
          <Thoranam width={Math.max(1, g.len - 0.4)} y={WALL_H + 0.75} z={0.05} animate={animate} flowers />
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
    const X = world.x((back ? back.rect.x0 : layout.plot.rightX - 10) + 3.2);
    const Z = world.z((c.z0 + c.z1) / 2);
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
      spots.push([s.notch.wide.x0 + 0.9, s.rect.z0 + 0.8]);
      spots.push([s.rect.x1 - 0.9, s.rect.z0 + 0.8]);
    }
    if (layout.courtyard) {
      spots.push([layout.plot.rightX - 1.2, layout.courtyard.z1 - 1.2]);
      spots.push([layout.plot.rightX - 2.6, layout.courtyard.z1 - 1.0]);
    }
    return spots.flatMap(([x, z], i) => {
      const raised = layout.slots.some((s) => s.status !== "empty" && x >= s.notch.wide.x0 - 0.01 && z <= s.notch.wide.z1 && z >= s.rect.z0) ? 0.6 : 0;
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

/** Bougainvillea spilling over the compound wall — front-left by the gate and over the courtyard wall. */
function Bougainvillea({ layout, world }: { layout: SiteLayout; world: World }) {
  const parts = useMemo<Part[]>(() => {
    const r = rng(2024);
    const [FL, FR, , BL] = layout.plot.polygon;
    const D = layout.plot.depthFt;
    const leftX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
    const spots: { x: number; z: number; out: [number, number] }[] = [{ x: leftX(2.2) + 0.4, z: 2.2, out: [-1, 0] }];
    if (layout.courtyard) spots.push({ x: FR.x - 0.4, z: (layout.courtyard.z0 + layout.courtyard.z1) / 2, out: [1, 0] });
    const pinks = ["#d4237a", "#e8559a", "#c2185b", "#f06292"];
    return spots.flatMap(({ x, z, out }) => {
      const X = world.x(x);
      const Z = world.z(z);
      const parts: Part[] = [];
      for (let i = 0; i < 7; i++) parts.push(ball([X + (r() - 0.5) * 2.2, WALL_H + 0.4 + r() * 1.4, Z + (r() - 0.5) * 3.2], 1.3 + r() * 0.8, r() > 0.5 ? "#3f7d3a" : "#4f8f45"));
      for (let i = 0; i < 64; i++) {
        const hang = r();
        const y = WALL_H + 1.6 - hang * (WALL_H - 0.6);
        parts.push(ball([X + out[0] * (0.5 + r() * 0.6 + (1 - hang) * 0.4) + (r() - 0.5) * 1.6, y + r() * 0.9, Z + (r() - 0.5) * 3.6], 0.42 + r() * 0.35, pinks[Math.floor(r() * pinks.length)]));
      }
      return parts;
    });
  }, [layout, world]);
  return <Baked parts={parts} cast />;
}

export { WALL_H };
