"use client";
// Inside the compound: swept red-earth yard, cement-tile paving, red-oxide porches, compound wall with gates,
// a tulsi maadam in the courtyard and potted marigolds.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BuildingSlot, CompoundWall, SiteLayout } from "@/lib/site-layout";
import { G, PAL, std } from "./materials";
import { gateTex, pavingTex, plasterTex, withRepeat } from "./textures";
import { FLAT, planShape, type World } from "./util";

const WALL_H = 4.6;
const WALL_T = 0.55;

export function PlotGround({ layout, world }: { layout: SiteLayout; world: World }) {
  const key = JSON.stringify([layout.plot.polygon, layout.paved, world.cx, world.cz]);
  const geos = useMemo(() => {
    const yard = new THREE.ShapeGeometry(planShape(layout.plot.polygon, world));
    const paved = new THREE.ShapeGeometry(planShape(layout.paved, world));
    return { yard, paved };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const yardMat = std("#a7633f", { map: withRepeat(plasterTex(), 1 / 7, 1 / 7), rough: 1, polygonOffset: 1 });
  const paveMat = std("#ffffff", { map: withRepeat(pavingTex(), 1 / 8, 1 / 8), rough: 0.8, polygonOffset: 2 });

  return (
    <group>
      <mesh geometry={geos.yard} material={yardMat} rotation={FLAT} position={[0, 0.02, 0]} receiveShadow />
      <mesh geometry={geos.paved} material={paveMat} rotation={FLAT} position={[0, 0.05, 0]} receiveShadow />
      {layout.slots.filter((s) => s.status !== "empty").map((s) => (
        <Porch key={s.slot} slot={s} world={world} />
      ))}
      <Walls walls={layout.compoundWalls} world={world} />
      {layout.courtyard && layout.courtyard.z1 - layout.courtyard.z0 > 5 && <Tulsi layout={layout} world={world} />}
      <Pots layout={layout} world={world} />
    </group>
  );
}

/** Raised red-oxide porch floor in the stepped notch. */
function Porch({ slot, world }: { slot: BuildingSlot; world: World }) {
  const m = std(PAL.redOxide, { rough: 0.32, metal: 0.05 });
  const edge = std("#d9cbb4", { rough: 0.9 });
  const rects = [slot.notch.wide, slot.notch.step];
  return (
    <group>
      {rects.map((r, i) => (
        <mesh
          key={i}
          geometry={G.box()}
          material={m}
          position={[world.x((r.x0 + r.x1) / 2), 0.3, world.z((r.z0 + r.z1) / 2)]}
          scale={[r.x1 - r.x0, 0.6, r.z1 - r.z0]}
          receiveShadow
        />
      ))}
      {/* step edge at the porch mouth */}
      <mesh
        geometry={G.box()}
        material={edge}
        position={[world.x((slot.notch.wide.x0 + slot.notch.wide.x1) / 2), 0.31, world.z(slot.rect.z0 + 0.18)]}
        scale={[slot.notch.wide.x1 - slot.notch.wide.x0, 0.62, 0.36]}
        receiveShadow
      />
    </group>
  );
}

function Walls({ walls, world }: { walls: CompoundWall[]; world: World }) {
  const plaster = std(PAL.plasterWarm, { map: withRepeat(plasterTex(), 1 / 6, 1 / 6), rough: 0.95 });
  const cap = std(PAL.terracotta, { rough: 0.8 });
  const pillar = std(PAL.plaster, { map: withRepeat(plasterTex(), 1 / 4, 1 / 4), rough: 0.9 });
  const gateMat = useMemo(() => std("#ffffff", { map: gateTex(), alphaTest: 0.5, side: THREE.DoubleSide, rough: 0.5, metal: 0.4 }), []);
  return (
    <group>
      {walls.map((w, i) => {
        const dx = w.b.x - w.a.x;
        const dz = w.b.z - w.a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.05) return null;
        const mx = world.x((w.a.x + w.b.x) / 2);
        const mz = world.z((w.a.z + w.b.z) / 2);
        // plan direction (dx, dz) → world (dx, −dz); rotation about Y aligns local +X with it
        const rotY = Math.atan2(dz, dx);
        if (w.kind === "gate") {
          return (
            <group key={i} position={[mx, 0, mz]} rotation={[0, rotY, 0]}>
              {[-1, 1].map((sgn) => (
                <group key={sgn} position={[(sgn * len) / 2, 0, 0]}>
                  <mesh geometry={G.box()} material={pillar} scale={[0.95, WALL_H + 1, 0.95]} position={[0, (WALL_H + 1) / 2, 0]} castShadow receiveShadow />
                  <mesh geometry={G.box()} material={cap} scale={[1.2, 0.3, 1.2]} position={[0, WALL_H + 1.15, 0]} castShadow />
                  <mesh geometry={G.sphere()} material={std(PAL.white, { rough: 0.5 })} scale={0.55} position={[0, WALL_H + 1.55, 0]} castShadow />
                </group>
              ))}
              <mesh geometry={G.plane()} material={gateMat} scale={[Math.max(0.5, len - 0.95), WALL_H - 0.3, 1]} position={[0, (WALL_H - 0.3) / 2 + 0.25, 0]} />
            </group>
          );
        }
        return (
          <group key={i} position={[mx, 0, mz]} rotation={[0, rotY, 0]}>
            <mesh geometry={G.box()} material={plaster} scale={[len, WALL_H, WALL_T]} position={[0, WALL_H / 2, 0]} castShadow receiveShadow />
            <mesh geometry={G.box()} material={cap} scale={[len + 0.1, 0.28, WALL_T + 0.22]} position={[0, WALL_H + 0.14, 0]} castShadow receiveShadow />
            {[-1, 1].map((sgn) => (
              <mesh key={sgn} geometry={G.box()} material={pillar} scale={[0.85, WALL_H + 0.5, 0.85]} position={[(sgn * len) / 2, (WALL_H + 0.5) / 2, 0]} castShadow receiveShadow />
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Tulsi maadam — the holy-basil planter found in Tamil courtyards. */
function Tulsi({ layout, world }: { layout: SiteLayout; world: World }) {
  const c = layout.courtyard!;
  const back = layout.slots.find((s) => s.slot === "back");
  const z = (c.z0 + c.z1) / 2;
  const x = (back ? back.rect.x0 : layout.plot.rightX - 10) + 3.2;
  const body = std(PAL.plaster, { rough: 0.85 });
  const trim = std(PAL.terracotta, { rough: 0.8 });
  const leaf = std("#3f7d3a", { flat: true, rough: 0.9 });
  return (
    <group position={[world.x(x), 0, world.z(z)]}>
      <mesh geometry={G.box()} material={body} scale={[2.2, 0.5, 2.2]} position={[0, 0.25, 0]} castShadow receiveShadow />
      <mesh geometry={G.box()} material={body} scale={[1.6, 2.6, 1.6]} position={[0, 1.8, 0]} castShadow receiveShadow />
      <mesh geometry={G.box()} material={trim} scale={[1.75, 0.22, 1.75]} position={[0, 3.15, 0]} castShadow />
      <mesh geometry={G.box()} material={trim} scale={[0.9, 0.18, 1.62]} position={[0, 1.2, 0]} />
      <mesh geometry={G.box()} material={std("#2a1a12")} scale={[0.5, 0.6, 0.1]} position={[0, 1.9, 0.78]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={G.ico()} material={leaf} scale={0.9 - i * 0.08} position={[Math.sin(i * 2.1) * 0.35, 3.6 + i * 0.32, Math.cos(i * 2.1) * 0.35]} castShadow />
      ))}
    </group>
  );
}

/** Terracotta pots of marigolds at porch mouths and courtyard corners. */
function Pots({ layout, world }: { layout: SiteLayout; world: World }) {
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
  const pot = std(PAL.terracotta, { rough: 0.85 });
  const bloom = std(PAL.saffron, { flat: true, rough: 0.8 });
  const bloom2 = std(PAL.marigold, { flat: true, rough: 0.8 });
  const leaf = std(PAL.bush, { flat: true });
  return (
    <group>
      {spots.map(([x, z], i) => {
        const raised = layout.slots.some((s) => s.status !== "empty" && x >= s.notch.wide.x0 - 0.01 && z <= s.notch.wide.z1 && z >= s.rect.z0) ? 0.6 : 0;
        return (
          <group key={i} position={[world.x(x), raised, world.z(z)]}>
            <mesh geometry={G.cyl()} material={pot} scale={[1.0, 0.9, 1.0]} position={[0, 0.45, 0]} castShadow />
            <mesh geometry={G.ico()} material={leaf} scale={1.05} position={[0, 1.15, 0]} castShadow />
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} geometry={G.ico()} material={k % 2 ? bloom : bloom2} scale={0.38} position={[Math.cos(k * 1.3 + i) * 0.38, 1.45 + (k % 2) * 0.12, Math.sin(k * 1.3 + i) * 0.38]} />
            ))}
          </group>
        );
      })}
    </group>
  );
}

export { WALL_H };
