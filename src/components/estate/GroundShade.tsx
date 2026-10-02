"use client";
// Contact shade where things meet the ground: a soft dark gradient strip around every building and along both
// sides of the compound wall. Baked ambient occlusion in one transparent draw call — keeps the houses grounded on
// every tier (the screen-space AO pass only runs on the high tier).
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { offsetPolygon, type Pt, type SiteLayout } from "@/lib/site-layout";
import type { World } from "./util";

function pushQuad(pos: number[], col: number[], a: Pt, b: Pt, c: Pt, d: Pt, alphaIn: number, world: World, y: number) {
  // a-b inner edge (alphaIn), c-d outer edge (0): triangles a b c, a c d
  const v = (p: Pt, al: number) => {
    pos.push(world.x(p.x), y, world.z(p.z));
    col.push(0, 0, 0, al);
  };
  v(a, alphaIn);
  v(b, alphaIn);
  v(c, 0);
  v(a, alphaIn);
  v(c, 0);
  v(d, 0);
}

export function GroundShade({ layout, world }: { layout: SiteLayout; world: World }) {
  const key = JSON.stringify([layout.slots.map((s) => [s.outline, s.status]), layout.compoundWalls, world.cx, world.cz]);
  const geo = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    for (const s of layout.slots) {
      if (s.status === "empty" || s.status === "vacant" || s.status === "incoming") continue;
      const inner = offsetPolygon(s.outline, 0.3);
      const outer = offsetPolygon(s.outline, 3.0);
      for (let i = 0; i < inner.length; i++) {
        const j = (i + 1) % inner.length;
        pushQuad(pos, col, inner[i], inner[j], outer[j], outer[i], 0.42, world, 0.075);
      }
    }
    for (const w of layout.compoundWalls) {
      const dx = w.b.x - w.a.x;
      const dz = w.b.z - w.a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.3 || w.kind === "gate") continue;
      const n = { x: dz / len, z: -dx / len };
      for (const sgn of [1, -1]) {
        const off = (k: number): [Pt, Pt] => [
          { x: w.a.x + n.x * k * sgn, z: w.a.z + n.z * k * sgn },
          { x: w.b.x + n.x * k * sgn, z: w.b.z + n.z * k * sgn },
        ];
        const [a, b] = off(0.3);
        const [c, d] = off(1.6);
        pushQuad(pos, col, a, b, d, c, 0.3, world, 0.07);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geo} material={mat} renderOrder={1} />;
}
