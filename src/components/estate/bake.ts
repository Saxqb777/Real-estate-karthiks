// Bake many small coloured primitives into one vertex-coloured geometry (one draw call per rigid part).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];
export type Prim = "box" | "sphere" | "cyl" | "cone";
export interface Part {
  g: Prim;
  p: V3;
  s: number | V3;
  r?: V3;
  c: string;
}

const proto: Record<Prim, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 12, 8),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: () => new THREE.ConeGeometry(0.5, 1, 10),
};
const protoCache = new Map<Prim, THREE.BufferGeometry>();
const unit = (g: Prim) => {
  let geo = protoCache.get(g);
  if (!geo) {
    geo = proto[g]().toNonIndexed();
    geo.deleteAttribute("uv");
    protoCache.set(g, geo);
  }
  return geo;
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const col = new THREE.Color();

/** Merge parts (local transforms + sRGB hex colours) into one geometry with a `color` attribute. */
export function bake(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((pt) => {
    const g = unit(pt.g).clone();
    const s = typeof pt.s === "number" ? [pt.s, pt.s, pt.s] : pt.s;
    m4.compose(pos.set(...pt.p), q.setFromEuler(e.set(...(pt.r ?? [0, 0, 0]))), scl.set(s[0], s[1], s[2]));
    g.applyMatrix4(m4);
    col.set(pt.c);
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  });
  const merged = mergeGeometries(geos) ?? new THREE.BufferGeometry();
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Part builders (terse model definitions). */
export const box = (p: V3, s: V3, c: string, r?: V3): Part => ({ g: "box", p, s, c, r });
export const ball = (p: V3, s: number | V3, c: string): Part => ({ g: "sphere", p, s, c });
export const rod = (p: V3, s: V3, c: string, r?: V3): Part => ({ g: "cyl", p, s, c, r });
export const cone = (p: V3, s: V3, c: string, r?: V3): Part => ({ g: "cone", p, s, c, r });
