"use client";
// The floating laterite tile (soil strata edge) with open grass all round the plot — no road (owner's request).
// The EB poles live in Fixtures.tsx (they are clickable).
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { offsetPolygon, type Pt, type SiteLayout } from "@/lib/site-layout";
import { std } from "./materials";
import { earthTex, strataTex, withRepeat } from "./textures";
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
