// Small shared helpers for the estate scene: seeded randomness, easing, plan → world mapping, shapes.
import * as THREE from "three";
import type { Pt, SiteLayout } from "@/lib/site-layout";

/** Deterministic PRNG (mulberry32) so the diorama looks the same on every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, rate: number, dt: number) => lerp(current, target, 1 - Math.exp(-rate * dt));

/**
 * Plan (x right, z from the street to the back) → world (X right, Z towards the viewer, Y up).
 * World origin = plot centre; the street side faces +Z so the default camera looks at the front.
 */
export interface World {
  cx: number;
  cz: number;
  x: (x: number) => number;
  z: (z: number) => number;
  v: (p: Pt, y?: number) => [number, number, number];
}
export function makeWorld(layout: Pick<SiteLayout, "center">): World {
  const { x: cx, z: cz } = layout.center;
  return {
    cx,
    cz,
    x: (x) => x - cx,
    z: (z) => cz - z,
    v: (p, y = 0) => [p.x - cx, y, cz - p.z],
  };
}

/**
 * THREE.Shape from plan points. A mesh built from it must be rotated [-π/2, 0, 0]: shape (sx, sy) → world (sx, −sy),
 * and extrusion depth goes up (+Y).
 */
export function planShape(pts: Pt[], w: World, holes: Pt[][] = []): THREE.Shape {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x - w.cx, p.z - w.cz)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x - w.cx, p.z - w.cz))));
  return shape;
}

export const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Hook-free media query helper (client only). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** CSS custom property font stack, e.g. resolved next/font family for canvas text. */
export function cssFont(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}
