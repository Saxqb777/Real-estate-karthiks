// Rigid-limb characters in ONE draw call each: every limb's parts are baked into a single vertex-coloured geometry
// with per-vertex limb index, pivot and hinge axis; the vertex shader swings each limb by an angle from a small
// uniform array. Used for pedestrians, the tenant at the door, the dog and the cow (shadows animate too).
import * as THREE from "three";
import { bake, type Part, type V3 } from "./bake";
import { VEHICLE_CLIP } from "./materials";

export const MAX_LIMBS = 8;

export interface Limb {
  /** parts in model space (already placed where the limb hangs at rest) */
  parts: Part[];
  /** hinge point and axis; limb 0 is the root and never rotates */
  pivot?: V3;
  axis?: V3;
}

/** Bake limbs into one geometry with aLimb / aPivot / aAxis attributes. */
export function rigGeometry(limbs: Limb[]): THREE.BufferGeometry {
  const geos = limbs.map((l, i) => {
    const g = bake(l.parts);
    const n = g.attributes.position.count;
    const limb = new Float32Array(n).fill(i);
    const pivot = new Float32Array(n * 3);
    const axis = new Float32Array(n * 3);
    const p = l.pivot ?? [0, 0, 0];
    const a = l.axis ?? [1, 0, 0];
    for (let k = 0; k < n; k++) {
      pivot.set(p, k * 3);
      axis.set(a, k * 3);
    }
    g.setAttribute("aLimb", new THREE.BufferAttribute(limb, 1));
    g.setAttribute("aPivot", new THREE.BufferAttribute(pivot, 3));
    g.setAttribute("aAxis", new THREE.BufferAttribute(axis, 3));
    return g;
  });
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color", "aLimb", "aPivot", "aAxis"]) {
    const size = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array as Float32Array, off);
      off += g.attributes[name].count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  geos.forEach((g) => g.dispose());
  out.computeBoundingSphere();
  if (out.boundingSphere) out.boundingSphere.radius *= 1.25; // limbs swing a little outside the rest pose
  return out;
}

const RIG_PARS = /* glsl */ `
  attribute float aLimb;
  attribute vec3 aPivot;
  attribute vec3 aAxis;
  uniform float uAng[${MAX_LIMBS}];
  uniform vec3 uShift;
  uniform float uLean;
  vec3 rigRot(vec3 v, vec3 k, float a) {
    float c = cos(a); float s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
  }
  float rigAngle() { int i = int(aLimb + 0.5); return uAng[i]; }
`;

const REPLACE_BEGIN = /* glsl */ `
  #include <begin_vertex>
  {
    float ang = rigAngle();
    transformed = aPivot + rigRot(transformed - aPivot, aAxis, ang);
    transformed = rigRot(transformed, vec3(1.0, 0.0, 0.0), uLean) + uShift;
  }
`;
const REPLACE_NORMAL = /* glsl */ `
  #include <beginnormal_vertex>
  objectNormal = rigRot(rigRot(objectNormal, aAxis, rigAngle()), vec3(1.0, 0.0, 0.0), uLean);
`;

export interface RigUniforms {
  uAng: { value: Float32Array };
  uShift: { value: THREE.Vector3 };
  uLean: { value: number };
}

function inject(shader: THREE.WebGLProgramParametersWithUniforms, u: RigUniforms, normals: boolean) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${RIG_PARS}`).replace("#include <begin_vertex>", REPLACE_BEGIN);
  if (normals) shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", REPLACE_NORMAL);
}

export interface RigMaterials {
  mat: THREE.MeshStandardMaterial;
  depth: THREE.MeshDepthMaterial;
  u: RigUniforms;
  dispose: () => void;
}

/** One material set per character (uniforms are per material; the shader program is shared). */
export function rigMaterials(o: { rough?: number; clip?: boolean } = {}): RigMaterials {
  const u: RigUniforms = { uAng: { value: new Float32Array(MAX_LIMBS) }, uShift: { value: new THREE.Vector3() }, uLean: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.8 });
  mat.onBeforeCompile = (sh) => inject(sh, u, true);
  mat.customProgramCacheKey = () => "estate-rig";
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => inject(sh, u, false);
  depth.customProgramCacheKey = () => "estate-rig-depth";
  if (o.clip) {
    mat.clippingPlanes = VEHICLE_CLIP;
    depth.clippingPlanes = VEHICLE_CLIP;
  }
  return {
    mat,
    depth,
    u,
    dispose: () => {
      mat.dispose();
      depth.dispose();
    },
  };
}

// ───────────────────────────── people ─────────────────────────────

export interface Outfit {
  top: string;
  bottom: string;
  /** "veshti" / "saree" = long wrap hiding the legs; "shorts" = kid; "lungi" = knee length */
  wrap: "veshti" | "saree" | "shorts" | "lungi" | "pants";
  skin?: string;
  hair?: "short" | "bun" | "plait";
  umbrella?: boolean;
  jasmine?: boolean;
  /** towel over the shoulder (veshti men) */
  towel?: string;
}

export const SKIN = { light: "#a06a45", mid: "#8a5536", dark: "#5f3a26" } as const;
const HAIR = "#141110";
const SHOE = "#2b211b";

/** Limb indices for people. */
export const P = { body: 0, legL: 1, legR: 2, armL: 3, armR: 4 } as const;

/** A stylised Tamil Nadu townsperson, ≈ 5.4 ft at scale 1, facing +Z. */
export function personLimbs(o: Outfit): Limb[] {
  const skin = o.skin ?? SKIN.mid;
  const long = o.wrap === "veshti" || o.wrap === "saree";
  const legColor = o.wrap === "shorts" || o.wrap === "lungi" ? skin : o.wrap === "pants" ? o.bottom : o.bottom;
  const leg = (x: number): Part[] => {
    const parts: Part[] = [
      { g: "box", p: [x, 1.45, 0], s: [0.3, 2.4, 0.32], c: legColor },
      { g: "box", p: [x, 0.13, 0.1], s: [0.32, 0.18, 0.55], c: SHOE },
    ];
    if (o.wrap === "shorts") parts.push({ g: "box", p: [x, 2.25, 0], s: [0.38, 0.8, 0.38], c: o.bottom });
    return parts;
  };
  const body: Part[] = [
    { g: "box", p: [0, 3.55, 0], s: [0.94, 1.7, 0.52], c: o.top },
    { g: "box", p: [0, 4.48, 0], s: [0.3, 0.2, 0.3], c: skin }, // neck
    { g: "sphere", p: [0, 4.95, 0.02], s: [0.7, 0.78, 0.72], c: skin },
    { g: "sphere", p: [0, 5.12, -0.06], s: [0.75, 0.55, 0.74], c: HAIR },
    { g: "box", p: [0, 2.72, 0], s: [0.96, 0.16, 0.54], c: "#3b2a1e" }, // waist
  ];
  if (long) body.push({ g: "cyl", p: [0, 1.5, 0], s: [1.04, 2.3, 0.8], c: o.bottom });
  if (o.wrap === "lungi") body.push({ g: "cyl", p: [0, 2.05, 0], s: [1.0, 1.25, 0.78], c: o.bottom });
  if (o.wrap === "saree") {
    body.push({ g: "box", p: [0.14, 3.75, 0.06], s: [0.36, 2.0, 0.58], c: o.bottom, r: [0, 0, 0.5] });
    body.push({ g: "box", p: [0, 0.35, 0], s: [1.08, 0.12, 0.84], c: "#d4a72c" }); // zari border
  }
  if (o.hair === "bun") body.push({ g: "sphere", p: [0, 5.0, -0.42], s: 0.36, c: HAIR });
  if (o.hair === "plait") body.push({ g: "box", p: [0, 4.3, -0.4], s: [0.16, 1.3, 0.14], c: HAIR });
  if (o.jasmine) body.push({ g: "sphere", p: [0, 5.12, -0.42], s: [0.44, 0.15, 0.22], c: "#fbfbf4" });
  if (o.towel) body.push({ g: "box", p: [-0.32, 4.1, 0.02], s: [0.22, 0.95, 0.56], c: o.towel, r: [0, 0, 0.15] });
  if (o.umbrella) {
    body.push({ g: "cyl", p: [0.42, 5.7, 0.15], s: [0.06, 2.4, 0.06], c: "#3a2a1c" });
    body.push({ g: "cone", p: [0.42, 7.05, 0.15], s: [3.6, 0.9, 3.6], c: "#16161a" });
  }
  const arm = (x: number, c: string): Part[] => [
    { g: "box", p: [x, 3.6, 0], s: [0.22, 1.55, 0.25], c },
    { g: "sphere", p: [x, 2.8, 0], s: 0.26, c: skin },
  ];
  const sleeve = o.wrap === "saree" ? o.bottom : skin;
  return [
    { parts: body },
    { parts: leg(-0.21), pivot: [-0.21, 2.65, 0], axis: [1, 0, 0] },
    { parts: leg(0.21), pivot: [0.21, 2.65, 0], axis: [1, 0, 0] },
    { parts: arm(-0.61, skin), pivot: [-0.61, 4.35, 0], axis: [1, 0, 0] },
    { parts: arm(0.61, sleeve), pivot: [0.61, 4.35, 0], axis: [1, 0, 0] },
  ];
}

export type Gait = "walk" | "run" | "push" | "idle" | "wave";

/**
 * Write a pose into the rig uniforms. `phase` advances with distance walked (radians), `t` is scene time for idles.
 * Walk: legs swing opposite, arms counter-swing, a little bob; run: bigger swing, forward lean, bent arms.
 */
export function posePerson(u: RigUniforms, gait: Gait, phase: number, t: number, seed = 0) {
  const a = u.uAng.value;
  const s = Math.sin(phase);
  switch (gait) {
    case "walk":
      a[P.legL] = s * 0.42;
      a[P.legR] = -s * 0.42;
      a[P.armL] = -s * 0.34;
      a[P.armR] = s * 0.34;
      u.uShift.value.set(0, Math.abs(Math.cos(phase)) * 0.09, 0);
      u.uLean.value = 0.03;
      break;
    case "run":
      a[P.legL] = s * 0.85;
      a[P.legR] = -s * 0.85;
      a[P.armL] = -s * 0.8 - 0.5;
      a[P.armR] = s * 0.8 - 0.5;
      u.uShift.value.set(0, Math.abs(Math.cos(phase)) * 0.32, 0);
      u.uLean.value = 0.16;
      break;
    case "push":
      a[P.legL] = s * 0.36;
      a[P.legR] = -s * 0.36;
      a[P.armL] = -1.15;
      a[P.armR] = -1.15;
      u.uShift.value.set(0, Math.abs(Math.cos(phase)) * 0.06, 0);
      u.uLean.value = 0.12;
      break;
    case "wave": {
      a[P.legL] = 0;
      a[P.legR] = 0;
      a[P.armL] = 0.04;
      a[P.armR] = -2.6 + Math.sin(t * 7) * 0.35;
      u.uShift.value.set(0, 0, 0);
      u.uLean.value = 0;
      break;
    }
    default: {
      // idle: weight shift and breathing, now and then a hand to the chin
      const shift = Math.sin(t * 0.7 + seed) * 0.04;
      a[P.legL] = shift;
      a[P.legR] = -shift * 0.5;
      const gesture = Math.max(0, Math.sin(t * 0.23 + seed * 3)) ** 6;
      a[P.armL] = 0.05 + Math.sin(t * 1.1 + seed) * 0.03;
      a[P.armR] = -gesture * 1.6 + 0.05;
      u.uShift.value.set(0, Math.sin(t * 1.6 + seed) * 0.02, 0);
      u.uLean.value = 0;
    }
  }
}
