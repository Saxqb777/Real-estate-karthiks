"use client";

/**
 * Toyota Land Cruiser 100 (GXR 4500 EFI), white with maroon/gold/grey side
 * decals. Built from primitives, merged into one mesh per material.
 * Rebuilt from the owner's model screenshots (materials, key dimensions and the
 * glass/pillar layout follow the owner's original component).
 *
 * Units: 1 unit = 1 foot. Y is up. Wheels sit on y = 0.
 * The car faces +X (front bumper at +X), centred on the origin.
 * The +Z side is the car's left (driver's) side.
 * Real size: ~16.3 ft long, 6.3 ft wide, 6.25 ft tall.
 *
 * Usage:
 *   <LandCruiser position={[x, 0, z]} rotation={[0, angle, 0]} />
 */

import { useEffect, useMemo } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type MatKey =
  | "paint"
  | "glass"
  | "trim"
  | "chassis"
  | "tyre"
  | "chrome"
  | "alloy"
  | "rimDark"
  | "lens"
  | "red"
  | "amber"
  | "maroon"
  | "gold"
  | "stripeGrey";

const MATERIALS: Record<MatKey, THREE.MeshStandardMaterialParameters> = {
  paint: { color: "#f1efe9", roughness: 0.3, metalness: 0.08 },
  glass: { color: "#24303a", roughness: 0.08, metalness: 0.3 },
  trim: { color: "#1d1e20", roughness: 0.75, metalness: 0 },
  chassis: { color: "#121314", roughness: 0.95, metalness: 0 },
  tyre: { color: "#161616", roughness: 0.95, metalness: 0 },
  chrome: { color: "#e6e9ec", roughness: 0.25, metalness: 0.35 },
  alloy: { color: "#c6cacf", roughness: 0.35, metalness: 0.3 },
  rimDark: { color: "#3a3d41", roughness: 0.6, metalness: 0.3 },
  lens: { color: "#e3e9ee", roughness: 0.1, metalness: 0.2, emissive: "#3a3a32", emissiveIntensity: 0.25 },
  red: { color: "#a3141b", roughness: 0.2, metalness: 0.1, emissive: "#3a0507", emissiveIntensity: 0.4 },
  amber: { color: "#e08a1e", roughness: 0.25, metalness: 0.1, emissive: "#3a2205", emissiveIntensity: 0.3 },
  maroon: { color: "#6e1b22", roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide },
  gold: { color: "#c49a52", roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide },
  stripeGrey: { color: "#8c9196", roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide },
};

// Key dimensions (feet)
const FRONT_AXLE = 5.05;
const REAR_AXLE = -4.3;
const WHEEL_R = 1.3;
const TRACK = 2.62; // wheel centre distance from the middle
const ARCH_R = 1.65;
const SILL_Y = 1.4;
const BELT_Y = 3.98;
const SIDE_Z = 3.15; // outer face of the lower body
const CABIN_Z = 2.95; // outer face of the greenhouse at the beltline
const NOSE_X = 8.15;
const TAIL_X = -8.0;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Narrows the car where the real one curves in: the greenhouse leans inward
 * toward the roof, and the nose and tail round off in plan view.
 */
function warpWidth(x: number, y: number) {
  let f = 1;
  f *= 1 - 0.09 * smooth(BELT_Y, 6.25, y);
  f *= 1 - 0.075 * smooth(6.2, 8.2, x) ** 1.5;
  f *= 1 - 0.035 * smooth(7.2, 8.3, -x);
  return f;
}

type V3 = [number, number, number];

function buildCarGeometries(): Partial<Record<MatKey, THREE.BufferGeometry>> {
  const bins: Partial<Record<MatKey, THREE.BufferGeometry[]>> = {};
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let warp = true;

  const put = (key: MatKey, geo: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(e.set(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) {
      if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (warp) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * warpWidth(p.getX(i), p.getY(i)));
    }
    // mirrored copies (negative scale) flip the winding — put it back so faces stay outward
    if (scale[0] * scale[1] * scale[2] < 0) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const uv = g.attributes.uv;
      for (let i = 0; i < p.count; i += 3) {
        for (const a of [p, n, uv]) {
          for (let c = 0; c < a.itemSize; c++) {
            const t = a.getComponent(i + 1, c);
            a.setComponent(i + 1, c, a.getComponent(i + 2, c));
            a.setComponent(i + 2, c, t);
          }
        }
      }
    }
    g.clearGroups();
    (bins[key] ??= []).push(g);
  };
  const box = (key: MatKey, size: V3, pos: V3, rot?: V3) => put(key, new THREE.BoxGeometry(...size), pos, rot);
  // Same part on both sides of the car (z and -z)
  const boxPair = (key: MatKey, size: V3, pos: V3, rot?: V3) => {
    box(key, size, pos, rot);
    box(key, size, [pos[0], pos[1], -pos[2]], rot && [-rot[0], -rot[1], rot[2]]);
  };
  const rbox = (key: MatKey, size: V3, radius: number, pos: V3) =>
    put(key, new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius), pos);
  const rboxPair = (key: MatKey, size: V3, radius: number, pos: V3) => {
    rbox(key, size, radius, pos);
    rbox(key, size, radius, [pos[0], pos[1], -pos[2]]);
  };
  // A flat shape on both flanks of the body at the given half-width (decals, seams, glass)
  const flank = (key: MatKey, geo: THREE.BufferGeometry, z: number) => {
    put(key, geo, [0, 0, z]);
    put(key, geo, [0, 0, -z], [0, 0, 0], [1, 1, -1]);
  };
  // Extrude a side profile across the width with soft rounded edges.
  // The outline stays where it is drawn; the flat side faces sit `r` inside it.
  const extrudeSoft = (shape: THREE.Shape, halfWidth: number, r: number) => {
    const depth = halfWidth * 2 - r * 2;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelOffset: -r,
      bevelSegments: 5,
      curveSegments: 24,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  const shapeOf = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const quad = (pts: [number, number][]) => new THREE.ShapeGeometry(shapeOf(pts));

  // ── lower body: side profile with both wheel arches cut out of the sill line
  const arch = (cx: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      out.push([cx + Math.cos(a) * ARCH_R, WHEEL_R + 0.12 + Math.sin(a) * ARCH_R]);
    }
    return out;
  };
  const bodyPts: [number, number][] = [
    [TAIL_X + 0.15, SILL_Y],
    [TAIL_X, SILL_Y + 0.35],
    [TAIL_X - 0.05, BELT_Y - 0.1],
    [TAIL_X + 0.15, BELT_Y],
    [3.0, BELT_Y],
    [6.4, BELT_Y - 0.12], // bonnet falls gently to the nose
    [7.85, BELT_Y - 0.3],
    [NOSE_X, BELT_Y - 0.62],
    [NOSE_X, SILL_Y + 0.45],
    [NOSE_X - 0.35, SILL_Y],
    ...arch(FRONT_AXLE),
    ...arch(REAR_AXLE),
  ];
  put("paint", extrudeSoft(shapeOf(bodyPts), SIDE_Z, 0.32), [0, 0, 0]);

  // ── greenhouse (clockwise from the rear foot): rear window, roof, windscreen
  const cabinPts: [number, number][] = [
    [-7.9, BELT_Y - 0.05],
    [-7.72, 6.22],
    [0.72, 6.25],
    [2.95, BELT_Y - 0.05],
  ];
  put("paint", extrudeSoft(shapeOf(cabinPts), CABIN_Z, 0.28), [0, 0, 0]);

  // Glass panel lying on a cabin edge (a -> b in clockwise order)
  const edgePanel = (a: [number, number], b: [number, number], insetA: number, insetB: number, width: number) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const L = len - insetA - insetB;
    const t = insetA + L / 2;
    const off = 0.02;
    box("glass", [L, 0.03, width], [a[0] + ux * t - uy * off, a[1] + uy * t + ux * off, 0], [0, 0, Math.atan2(uy, ux)]);
  };
  edgePanel(cabinPts[2], cabinPts[3], 0.2, 0.75, 5.1); // windscreen
  edgePanel(cabinPts[0], cabinPts[1], 0.75, 0.28, 4.6); // rear window

  // Blacked-out pillars and window surround, then the side glass on top
  flank("trim", quad([[-7.36, 4.12], [-7.31, 5.87], [0.66, 5.87], [2.5, 4.12]]), CABIN_Z + 0.004);
  for (const s of [
    [[-0.42, 4.17], [-0.42, 5.82], [0.62, 5.82], [2.42, 4.17]],
    [[-4.15, 4.17], [-4.15, 5.82], [-0.78, 5.82], [-0.78, 4.17]],
    [[-7.32, 4.17], [-7.27, 5.82], [-4.4, 5.82], [-4.4, 4.17]],
  ] as [number, number][][]) {
    flank("glass", quad(s), CABIN_Z + 0.008);
  }

  box("glass", [1.9, 0.03, 4.0], [-0.9, 6.28, 0]); // sunroof: a wide rectangle across the roof
  box("red", [0.06, 0.08, 0.9], [-7.74, 6.0, 0]); // high stop light

  // Wipers
  box("trim", [0.05, 0.05, 1.9], [2.95, 4.15, 0.75], [0, 0.12, 0]);
  box("trim", [0.05, 0.05, 1.9], [2.95, 4.15, -1.3], [0, 0.12, 0]);
  box("trim", [0.05, 0.04, 1.5], [-7.9, 4.4, 0.2], [0, 0, 0.06]); // rear wiper

  // ── door seams, handles, side decals
  const S = SIDE_Z + 0.006;
  for (const x of [2.62, -0.62]) flank("trim", quad([[x - 0.025, SILL_Y + 0.25], [x - 0.025, BELT_Y], [x + 0.025, BELT_Y], [x + 0.025, SILL_Y + 0.25]]), S);
  flank("trim", quad([[-4.32, BELT_Y - 0.35], [-4.32, BELT_Y], [-4.27, BELT_Y], [-4.27, BELT_Y - 0.35]]), S); // fuel-flap line
  for (const x of [1.7, -1.5]) boxPair("chrome", [0.55, 0.09, 0.06], [x, BELT_Y - 0.28, SIDE_Z + 0.02]);
  boxPair("stripeGrey", [0.5, 0.1, 0.03], [-7.1, BELT_Y - 0.15, SIDE_Z - 0.06]); // rear quarter badge
  boxPair("stripeGrey", [0.3, 0.06, 0.03], [5.1, BELT_Y - 0.55, SIDE_Z - 0.02]); // fender badge

  // Decal: grey pinstripes along the rear, maroon + gold lines to the front, a feathered maroon/gold flash mid-car
  const D = SIDE_Z + 0.012;
  const line = (key: MatKey, x0: number, y0: number, x1: number, y1: number, h: number, z = D) =>
    flank(key, quad([[x0, y0 - h / 2], [x0, y0 + h / 2], [x1, y1 + h / 2], [x1, y1 - h / 2]]), z);
  for (let i = 0; i < 4; i++) line("stripeGrey", -7.55, 3.25 - i * 0.1, -1.1, 3.25 - i * 0.1, 0.045);
  line("maroon", -7.55, 3.52, 7.3, 3.68, 0.07);
  line("gold", -7.55, 3.42, 6.6, 3.56, 0.045);
  // the flash: long tapering wedges stacked on each other (front point towards +X)
  const flash = (key: MatKey, y: number, h: number, x0: number, x1: number, z: number) =>
    flank(key, quad([[x0, y - h / 2], [x0, y + h / 2], [x1, y + h * 0.05], [x1, y - h * 0.05]]), z);
  flash("gold", 3.2, 0.62, -1.1, 4.6, D);
  flash("maroon", 3.22, 0.5, -1.0, 4.2, D + 0.003);
  for (let i = 0; i < 4; i++) flash("gold", 3.02 + i * 0.12, 0.03, -0.95, 3.6 - i * 0.25, D + 0.006);

  // ── front: grille, headlamps, black bumper with amber lamps
  rbox("trim", [0.16, 0.78, 2.5], 0.05, [NOSE_X, 3.0, 0]); // grille
  for (let i = 0; i < 4; i++) box("chassis", [0.03, 0.05, 2.3], [NOSE_X + 0.085, 2.72 + i * 0.18, 0]);
  put("chrome", new THREE.TorusGeometry(0.17, 0.04, 8, 24), [NOSE_X + 0.1, 3.0, 0], [0, Math.PI / 2, 0]); // emblem
  rboxPair("lens", [0.14, 0.58, 1.05], 0.08, [NOSE_X - 0.02, 3.02, 1.95]);
  for (const z of [1.7, 2.2]) {
    put("chrome", new THREE.CircleGeometry(0.2, 20), [NOSE_X + 0.06, 3.0, z], [0, Math.PI / 2, 0]);
    put("chrome", new THREE.CircleGeometry(0.2, 20), [NOSE_X + 0.06, 3.0, -z], [0, Math.PI / 2, 0]);
  }
  rbox("trim", [0.75, 1.0, 6.55], 0.22, [NOSE_X - 0.05, 1.85, 0]); // bumper
  boxPair("amber", [0.06, 0.16, 0.45], [NOSE_X + 0.33, 2.05, 2.55]);
  box("chassis", [0.08, 0.2, 3.0], [NOSE_X + 0.32, 1.55, 0]); // lower intake
  boxPair("amber", [0.25, 0.14, 0.05], [7.75, 2.75, SIDE_Z - 0.05]); // side repeaters

  // ── rear: tailgate seams, tall red lamps, chrome strip, bumper + tow hitch
  const R = TAIL_X - 0.05;
  box("trim", [0.04, 2.25, 0.04], [R, 2.85, 2.2]);
  box("trim", [0.04, 2.25, 0.04], [R, 2.85, -2.2]);
  box("trim", [0.04, 0.04, 4.4], [R, 3.97, 0]);
  boxPair("red", [0.14, 0.8, 0.5], [R + 0.03, 3.25, 2.65]);
  boxPair("amber", [0.14, 0.42, 0.5], [R + 0.03, 2.6, 2.65]); // rear indicators
  box("chrome", [0.06, 0.15, 2.3], [R - 0.01, 2.9, 0]);
  put("chrome", new THREE.TorusGeometry(0.16, 0.03, 8, 24), [R - 0.02, 3.35, 0], [0, Math.PI / 2, 0]);
  rbox("trim", [0.7, 0.85, 6.5], 0.2, [TAIL_X + 0.1, 1.85, 0]); // bumper
  box("chassis", [0.6, 0.2, 0.25], [TAIL_X - 0.45, 1.45, 0.4]); // hitch
  box("chrome", [0.22, 0.2, 0.22], [TAIL_X - 0.75, 1.5, 0.4]);

  // ── mirrors, running boards, mud flaps, underbody
  for (const z of [3.25, -3.25]) {
    rbox("paint", [0.45, 0.5, 0.4], 0.1, [2.55, 4.5, z]);
    box("trim", [0.3, 0.1, 0.3], [2.6, 4.22, z * 0.96]);
  }
  boxPair("alloy", [6.4, 0.1, 0.62], [0.35, 1.12, SIDE_Z + 0.05]);
  boxPair("trim", [6.4, 0.06, 0.62], [0.35, 1.04, SIDE_Z + 0.05]);
  for (const x of [FRONT_AXLE - ARCH_R - 0.05, REAR_AXLE - ARCH_R - 0.05]) boxPair("trim", [0.06, 0.8, 0.85], [x, 0.95, TRACK + 0.25]);
  box("chassis", [14.6, 0.5, 4.6], [0.1, 1.1, 0]);

  // ── wheels (no width warp): tyres, flared arches, six-spoke alloys
  warp = false;
  const tyre = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.95, 28);
  const sidewall = new THREE.TorusGeometry(WHEEL_R - 0.12, 0.12, 8, 28);
  const flare = new THREE.TorusGeometry(ARCH_R + 0.02, 0.17, 8, 24, Math.PI);
  for (const x of [FRONT_AXLE, REAR_AXLE]) {
    for (const s of [1, -1]) {
      const z = s * TRACK;
      put("tyre", tyre, [x, WHEEL_R, z], [Math.PI / 2, 0, 0]);
      for (const dz of [0.47, -0.47]) put("tyre", sidewall, [x, WHEEL_R, z + dz], [0, 0, 0]);
      put("paint", flare, [x, WHEEL_R + 0.12, s * (SIDE_Z + 0.02)], [0, 0, 0], [1, 1, 0.7]);
      const fz = z + s * 0.49;
      put("rimDark", new THREE.CircleGeometry(0.82, 28), [x, WHEEL_R, fz], [0, s > 0 ? 0 : Math.PI, 0]);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        box("alloy", [0.62, 0.17, 0.08], [x + Math.cos(a) * 0.4, WHEEL_R + Math.sin(a) * 0.4, fz + s * 0.02], [0, 0, a]);
      }
      put("alloy", new THREE.TorusGeometry(0.8, 0.06, 6, 28), [x, WHEEL_R, fz + s * 0.02]);
      put("alloy", new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), [x, WHEEL_R, fz + s * 0.04], [Math.PI / 2, 0, 0]);
    }
  }

  const out: Partial<Record<MatKey, THREE.BufferGeometry>> = {};
  for (const key of Object.keys(bins) as MatKey[]) {
    const merged = mergeGeometries(bins[key]!, false);
    if (merged) {
      merged.computeBoundingSphere();
      out[key] = merged;
    }
    for (const g of bins[key]!) g.dispose();
  }
  return out;
}

export function LandCruiser(props: ThreeElements["group"]) {
  const geos = useMemo(buildCarGeometries, []);
  const mats = useMemo(
    () => Object.fromEntries(Object.entries(MATERIALS).map(([k, p]) => [k, new THREE.MeshStandardMaterial(p)])) as Record<MatKey, THREE.MeshStandardMaterial>,
    [],
  );
  // hazard lights: the four corner indicators (and the side repeaters) blink amber together, ~85 times a minute
  useFrame(({ clock }) => {
    const on = clock.elapsedTime % 0.7 < 0.38;
    const a = mats.amber;
    a.emissive.set(on ? "#ffb21e" : "#3a2205");
    a.emissiveIntensity = on ? 2.6 : 0.3;
    a.color.set(on ? "#ffd27a" : "#e08a1e");
  });
  useEffect(
    () => () => {
      for (const g of Object.values(geos)) g?.dispose();
      for (const mt of Object.values(mats)) mt.dispose();
    },
    [geos, mats],
  );
  return (
    <group {...props}>
      {(Object.keys(geos) as MatKey[]).map((k) => (
        <mesh key={k} geometry={geos[k]} material={mats[k]} castShadow={k !== "glass" && k !== "maroon" && k !== "gold" && k !== "stripeGrey"} receiveShadow />
      ))}
    </group>
  );
}
