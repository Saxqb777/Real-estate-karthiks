"use client";
// Coconut palms (Pattukottai is coconut country), hedges, grass and the side garden (banana clumps, a chilli mat, a hand
// pump) — instanced, swaying with the travelling wind gusts (env.ts gustAt) shared with the laundry and the petals.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { offsetPolygon, type Pt, type SiteLayout } from "@/lib/site-layout";
import { gustAt, type Env } from "./env";
import { Baked } from "./Baked";
import type { Part } from "./bake";
import { G, PAL, std } from "./materials";
import { chilliMatTex } from "./textures";
import { rng, type World } from "./util";

export function insidePolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// ── geometry builders ──

const TRUNK_TOP = new THREE.Vector3(2.6, 30, 0);
const trunkCurve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 10, 0), new THREE.Vector3(3.3, 20, 0), TRUNK_TOP);

/** Coconut trunk: a slight S-curve, flared base, leaf-scar rings (grooves) and a fibrous boot under the crown. */
function trunkGeometry(): THREE.BufferGeometry {
  const rings = 34;
  const segs = rings * 2;
  const radial = 9;
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color("#6a5a48");
  const top = new THREE.Color("#a08a68");
  const groove = new THREE.Color("#4a3c2e");
  const boot = new THREE.Color("#5b4630");
  const ring = (i: number) => {
    const t = i / segs;
    const c = trunkCurve.getPoint(t);
    const tan = trunkCurve.getTangent(t);
    const n = new THREE.Vector3(0, 0, 1).cross(tan).normalize();
    const b = tan.clone().cross(n).normalize();
    const isGroove = i % 2 === 1 && t < 0.93;
    const r = (0.44 + (1 - t) * 0.2 + Math.max(0, 0.09 - t) * 7 + (t > 0.93 ? 0.16 : 0)) * (isGroove ? 0.9 : 1);
    const colr = t > 0.93 ? boot : isGroove ? groove : base.clone().lerp(top, t);
    return {
      pts: Array.from({ length: radial }, (_, j) => {
        const a = (j / radial) * Math.PI * 2;
        return c.clone().addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
      }),
      colr,
    };
  };
  for (let i = 0; i < segs; i++) {
    const r0 = ring(i);
    const r1 = ring(i + 1);
    for (let j = 0; j < radial; j++) {
      const k = (j + 1) % radial;
      const quad: [THREE.Vector3, THREE.Color][] = [
        [r0.pts[j], r0.colr],
        [r1.pts[j], r1.colr],
        [r1.pts[k], r1.colr],
        [r0.pts[j], r0.colr],
        [r1.pts[k], r1.colr],
        [r0.pts[k], r0.colr],
      ];
      for (const [v, c] of quad) {
        pos.push(v.x, v.y, v.z);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A coconut frond along +X (length 1): the rachis arches up then droops, with ~30 narrow leaflets a side hanging
 * down in a V (the classic drooping coconut look), darker at the base, yellowing towards the tip.
 */
function frondGeometry(): THREE.BufferGeometry {
  const N = 30;
  const pos: number[] = [];
  const col: number[] = [];
  const spine = (t: number) => new THREE.Vector3(t * 0.97, 0.2 * Math.sin(t * Math.PI * 0.75) - 0.5 * t * t, 0);
  const cBase = new THREE.Color("#28562c");
  const cMid = new THREE.Color("#3f7f3a");
  const cTip = new THREE.Color("#79a94a");
  const cOld = new THREE.Color("#a3a650");
  const push = (v: THREE.Vector3, c: THREE.Color) => {
    pos.push(v.x, v.y, v.z);
    col.push(c.r, c.g, c.b);
  };
  // rachis (thin ribbon so the frond reads even edge-on)
  for (let i = 0; i < 12; i++) {
    const a = spine(i / 12);
    const b = spine((i + 1) / 12);
    const w = 0.012 * (1 - i / 12) + 0.004;
    const c = cBase.clone().lerp(cMid, i / 12);
    push(new THREE.Vector3(a.x, a.y + w, 0), c);
    push(new THREE.Vector3(a.x, a.y - w, 0), c);
    push(new THREE.Vector3(b.x, b.y - w, 0), c);
    push(new THREE.Vector3(a.x, a.y + w, 0), c);
    push(new THREE.Vector3(b.x, b.y - w, 0), c);
    push(new THREE.Vector3(b.x, b.y + w, 0), c);
  }
  for (let i = 0; i < N; i++) {
    const t = 0.07 + (i / (N - 1)) * 0.91;
    const s = spine(t);
    const ahead = spine(Math.min(1, t + 0.02)).sub(s).normalize();
    const L = 0.34 * Math.pow(Math.sin(Math.min(1, t * 1.06) * Math.PI), 0.55) + 0.03;
    const w = 0.018;
    const shade = cMid.clone().lerp(cTip, t).lerp(cOld, Math.max(0, t - 0.7) * 1.4);
    for (const side of [-1, 1]) {
      // leaflets angle forward and hang down more towards the tip
      const droop = 0.55 + t * 0.55;
      const dir = new THREE.Vector3(0.38, -droop, side * 0.82).normalize();
      const tip = s.clone().addScaledVector(dir, L);
      const mid = s.clone().addScaledVector(dir, L * 0.5).add(new THREE.Vector3(0, -L * 0.06, 0));
      const a = s.clone().addScaledVector(ahead, -w);
      const b = s.clone().addScaledVector(ahead, w);
      const base = cBase.clone().lerp(shade, 0.35);
      push(a, base);
      push(b, base);
      push(mid, shade);
      push(b, base);
      push(tip, shade);
      push(mid, shade);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

interface PalmSpec {
  x: number;
  z: number;
  s: number;
  yaw: number;
  lean: number;
  phase: number;
  fronds: { yaw: number; pitch: number; len: number; dead: boolean }[];
}

function palmSpots(layout: SiteLayout): Pt[] {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const R = layout.plot.rightX;
  const leftX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  const M = layout.site.meadow;
  // on the right and behind the buildings: they frame the view from the front-left instead of hiding the facades;
  // two more at the front-right corner of the grass, where the cow grazes
  const spots: Pt[] = [
    { x: R + 9.2, z: M.z0 + 4.4 },
    { x: R + 13.4, z: M.z0 + 2.4 },
    { x: R + 7, z: 5 },
    { x: R + 10.5, z: 23 },
    { x: R + 7.5, z: 42 },
    { x: R + 11, z: 58 },
    { x: R + 7, z: D - 3 },
    { x: (R + leftX(D)) / 2 + 6, z: D + 6 },
    { x: (R + leftX(D)) / 2 - 6, z: D + 5 },
    { x: leftX(D) - 9, z: D + 6.5 },
    { x: leftX(D - 6) - 11, z: D - 6 },
  ];
  const rear = layout.rearYard.z1 - layout.rearYard.z0;
  if (rear > 6.5) spots.push({ x: leftX(D - rear / 2) + 4.2, z: D - rear / 2 });
  const tileIn = offsetPolygon(layout.site.tile, -2.2);
  return spots.filter((p) => insidePolygon(p, tileIn));
}

export function Palms({ layout, world, env, animate, count }: { layout: SiteLayout; world: World; env: RefObject<Env>; animate: boolean; count: number }) {
  const trunkGeo = useMemo(trunkGeometry, []);
  const frondGeo = useMemo(frondGeometry, []);
  const nutGeo = useMemo(() => new THREE.IcosahedronGeometry(0.5, 0), []);
  useEffect(
    () => () => {
      trunkGeo.dispose();
      frondGeo.dispose();
      nutGeo.dispose();
    },
    [trunkGeo, frondGeo, nutGeo],
  );
  const specs = useMemo<PalmSpec[]>(() => {
    const r = rng(1234);
    return palmSpots(layout)
      .slice(0, count)
      .map((p) => {
        const nF = 14 + Math.floor(r() * 4);
        return {
          x: world.x(p.x),
          z: world.z(p.z),
          s: (24 + r() * 14) / 30,
          yaw: r() * Math.PI * 2,
          lean: 0.04 + r() * 0.14,
          phase: r() * 10,
          fronds: Array.from({ length: nF }, (_, k) => {
            const dead = k >= nF - 2;
            const young = k < 3;
            return {
              yaw: (k / nF) * Math.PI * 2 * 2.39 + r() * 0.3, // golden-angle spiral like a real crown
              pitch: dead ? -1.25 - r() * 0.25 : young ? 0.75 + r() * 0.35 : k % 2 ? 0.05 + r() * 0.3 : -0.25 - r() * 0.45,
              len: dead ? 6.0 : young ? 6.2 + r() * 1.5 : 8.2 + r() * 2.6,
              dead,
            };
          }),
        };
      });
  }, [layout, world, count]);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const frondRef = useRef<THREE.InstancedMesh>(null);
  const nutRef = useRef<THREE.InstancedMesh>(null);
  const frondCount = specs.reduce((n, p) => n + p.fronds.length, 0);
  const nutCount = specs.length * 6;

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      base: new THREE.Matrix4(),
      crown: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      qw: new THREE.Quaternion(),
      e: new THREE.Euler(),
      v: new THREE.Vector3(),
      ax: new THREE.Vector3(),
      s: new THREE.Vector3(),
      o: new THREE.Object3D(),
    }),
    [],
  );

  useEffect(() => {
    const fr = frondRef.current;
    if (!fr) return;
    const c = new THREE.Color();
    let i = 0;
    const r = rng(99);
    for (const p of specs)
      for (const f of p.fronds) {
        c.set(f.dead ? "#9c8a55" : "#ffffff").multiplyScalar(f.dead ? 1 : 0.86 + r() * 0.26);
        fr.setColorAt(i++, c);
      }
    if (fr.instanceColor) fr.instanceColor.needsUpdate = true;
  }, [specs]);

  const pose = (e: Env | null) => {
    const tr = trunkRef.current;
    const fr = frondRef.current;
    const nr = nutRef.current;
    if (!tr || !fr || !nr) return;
    const { m, base, crown, q, qw, e: eu, v, ax, s, o } = tmp;
    const t = e?.t ?? 0;
    const [wx, wz] = e?.windDir ?? [1, 0];
    ax.set(wz, 0, -wx).normalize(); // tilting about this axis leans things downwind
    let fi = 0;
    let ni = 0;
    specs.forEach((p, pi) => {
      // the gust reaches each palm when its front passes (gustAt), so a wave rolls across the grove
      const g = e && animate ? gustAt(e, p.x, p.z) : 0.35;
      const sway = animate ? Math.sin(t * 0.9 + p.phase) * 0.012 * (0.4 + g) : 0;
      eu.set(0, p.yaw, -p.lean);
      q.setFromEuler(eu);
      qw.setFromAxisAngle(ax, g * 0.035 + sway);
      q.premultiply(qw);
      base.compose(v.set(p.x, 0, p.z), q, s.setScalar(p.s));
      tr.setMatrixAt(pi, base);
      // crown bends further than the trunk
      qw.setFromAxisAngle(ax, g * 0.09 + sway * 2);
      crown.compose(v.set(p.x, 0, p.z), q.clone().premultiply(qw), s.setScalar(p.s)).multiply(m.makeTranslation(TRUNK_TOP.x, TRUNK_TOP.y, TRUNK_TOP.z));
      for (const f of p.fronds) {
        const yawW = p.yaw + f.yaw;
        const along = Math.cos(yawW) * wx - Math.sin(yawW) * wz; // + = frond points downwind
        const flutter = animate ? Math.sin(t * (2.2 + g * 2.5) + p.phase + f.yaw * 3) * (0.03 + g * 0.09) : 0;
        o.position.set(0, 0, 0);
        o.rotation.set(0, f.yaw, f.pitch + flutter - along * g * 0.22 + (f.dead ? 0 : -g * 0.05), "YXZ");
        o.scale.setScalar(f.len);
        o.updateMatrix();
        m.multiplyMatrices(crown, o.matrix);
        fr.setMatrixAt(fi++, m);
      }
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + p.phase;
        o.position.set(Math.cos(a) * 0.62, -0.5 - (k % 2) * 0.38, Math.sin(a) * 0.62);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(0.88);
        o.updateMatrix();
        m.multiplyMatrices(crown, o.matrix);
        nr.setMatrixAt(ni++, m);
      }
    });
    tr.instanceMatrix.needsUpdate = true;
    fr.instanceMatrix.needsUpdate = true;
    nr.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    pose(env.current);
    trunkRef.current?.computeBoundingSphere();
    frondRef.current?.computeBoundingSphere();
    nutRef.current?.computeBoundingSphere();
  });
  useFrame(() => {
    if (animate) pose(env.current);
  });

  const trunkMat = useMemo(() => std("#ffffff", { vertexColors: true, rough: 0.95 }), []);
  const frondMat = useMemo(() => std("#ffffff", { vertexColors: true, side: THREE.DoubleSide, rough: 0.75 }), []);
  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, Math.max(1, specs.length)]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={frondRef} args={[frondGeo, frondMat, Math.max(1, frondCount)]} castShadow frustumCulled={false} />
      <instancedMesh ref={nutRef} args={[nutGeo, std(PAL.coconut, { flat: true, rough: 0.7 }), Math.max(1, nutCount)]} castShadow frustumCulled={false} />
    </group>
  );
}

/** Shrubs along the outside of the compound wall + grass tufts all over the grass round the plot. */
export function Greenery({ layout, world, grassCount }: { layout: SiteLayout; world: World; grassCount: number }) {
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const bushGeo = useMemo(() => new THREE.IcosahedronGeometry(0.5, 1), []);
  const grassGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2 + 0.3;
      const lean = 0.25;
      pos.push(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, Math.cos(a + 1.6) * 0.12, 0, Math.sin(a + 1.6) * 0.12, Math.cos(a) * lean, 1, Math.sin(a) * lean);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(
    () => () => {
      bushGeo.dispose();
      grassGeo.dispose();
    },
    [bushGeo, grassGeo],
  );

  const data = useMemo(() => {
    const r = rng(4321);
    const P = layout.plot;
    const [FL, FR, BR, BL] = P.polygon;
    const D = P.depthFt;
    const leftX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
    const bushes: { x: number; z: number; s: number; c: number }[] = [];
    // a few shrubs along the far half of the left wall (the near half shows the wall's black line pattern)
    const gateB = layout.compoundWalls.find((w) => w.gate === "side");
    const gz = gateB ? (gateB.a.z + gateB.b.z) / 2 : -99;
    for (let z = D * 0.55; z < D; z += 4.5 + r() * 3) if (Math.abs(z - gz) > 4.5) bushes.push({ x: leftX(z) - 1.5 - r() * 0.6, z, s: 1.2 + r() * 0.8, c: r() });
    for (let x = BL.x + 1; x < BR.x; x += 2.6 + r() * 1.4) bushes.push({ x, z: D + 1.4 + r() * 0.5, s: 1.3 + r() * 0.9, c: r() });
    const rightX = (z: number) => FR.x + ((BR.x - FR.x) * z) / D;
    for (let z = 3; z < D; z += 5 + r() * 4) bushes.push({ x: rightX(z) + 1.5 + r() * 0.6, z, s: 1.0 + r() * 0.8, c: r() });
    const rear = layout.rearYard.z1 - layout.rearYard.z0;
    if (rear > 3) for (let i = 0; i < 5; i++) bushes.push({ x: BR.x - 1.5 - i * 3.6, z: D - 1.4, s: 1.2 + r() * 0.6, c: r() });
    const tileIn = offsetPolygon(layout.site.tile, -1.6);
    const plotOut = offsetPolygon(P.polygon, 1.2);
    const xs = layout.site.tile.map((p) => p.x);
    const zs = layout.site.tile.map((p) => p.z);
    const grass: { x: number; z: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (grass.length < grassCount && guard++ < grassCount * 30) {
      const p = { x: Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z: Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs)) };
      if (!insidePolygon(p, tileIn) || insidePolygon(p, plotOut)) continue;
      grass.push({ ...p, s: 0.7 + r() * 0.9, rot: r() * 6 });
    }
    return { bushes, grass };
  }, [layout, grassCount]);

  useEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const b = bushRef.current;
    if (b) {
      data.bushes.forEach((p, i) => {
        o.position.set(world.x(p.x), p.s * 0.38, world.z(p.z));
        o.rotation.set(0, p.c * 6, 0);
        o.scale.set(p.s * 1.2, p.s, p.s * 1.1);
        o.updateMatrix();
        b.setMatrixAt(i, o.matrix);
        b.setColorAt(i, c.set(p.c > 0.66 ? "#4f8a3f" : p.c > 0.33 ? "#3f7637" : "#5a944a"));
      });
      b.instanceMatrix.needsUpdate = true;
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
      b.computeBoundingSphere();
    }
    const g = grassRef.current;
    if (g) {
      data.grass.forEach((p, i) => {
        o.position.set(world.x(p.x), 0, world.z(p.z));
        o.rotation.set(0, p.rot, 0);
        o.scale.set(p.s, p.s * 1.1, p.s);
        o.updateMatrix();
        g.setMatrixAt(i, o.matrix);
        g.setColorAt(i, c.set(p.rot > 3 ? "#6f9a45" : "#86a84f"));
      });
      g.instanceMatrix.needsUpdate = true;
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
      g.computeBoundingSphere();
    }
  }, [data, world]);

  return (
    <group>
      <instancedMesh ref={bushRef} args={[bushGeo, std("#ffffff", { flat: true, rough: 0.9 }), Math.max(1, data.bushes.length)]} castShadow receiveShadow />
      <instancedMesh ref={grassRef} args={[grassGeo, std("#ffffff", { side: THREE.DoubleSide, rough: 1 }), Math.max(1, data.grass.length)]} />
    </group>
  );
}

// ───────────────────────────── the side garden (left margin, in the foreground) ─────────────────────────────

/** A banana leaf along +X (length 1): broad, slightly cupped blade on a midrib that arches and droops. */
function bananaLeafGeometry(): THREE.BufferGeometry {
  const N = 10;
  const pos: number[] = [];
  const col: number[] = [];
  const rib = (t: number) => new THREE.Vector3(t, 0.25 * Math.sin(t * Math.PI * 0.8) - 0.35 * t * t, 0);
  const width = (t: number) => 0.17 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6;
  const dark = new THREE.Color("#3d7a2f");
  const light = new THREE.Color("#7fb04a");
  for (let i = 0; i < N; i++) {
    const t0 = 0.1 + (i / N) * 0.9;
    const t1 = 0.1 + ((i + 1) / N) * 0.9;
    const a = rib(t0);
    const b = rib(t1);
    for (const side of [-1, 1]) {
      const a2 = a.clone().add(new THREE.Vector3(0, -width(t0) * 0.35, side * width(t0)));
      const b2 = b.clone().add(new THREE.Vector3(0, -width(t1) * 0.35, side * width(t1)));
      const c0 = dark.clone().lerp(light, t0);
      const c1 = dark.clone().lerp(light, t1);
      for (const [v, c] of [
        [a, c0],
        [b, c1],
        [b2, c1],
        [a, c0],
        [b2, c1],
        [a2, c0],
      ] as const) {
        pos.push(v.x, v.y, v.z);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * The side garden on the tile's left margin: two banana clumps swaying in the same gusts, chillies drying on a mat,
 * a green hand pump with a brass pot, and a stack of coconut husks.
 */
export function Garden({ layout, world, env, animate }: { layout: SiteLayout; world: World; env: RefObject<Env>; animate: boolean }) {
  const [FL, , , BL] = layout.plot.polygon;
  const D = layout.plot.depthFt;
  const leftX = (z: number) => FL.x + ((BL.x - FL.x) * z) / D;
  const leafGeo = useMemo(bananaLeafGeometry, []);
  useEffect(() => () => leafGeo.dispose(), [leafGeo]);
  const clumps = useMemo(() => {
    const r = rng(515);
    const spots = [
      { x: leftX(D * 0.36) - 9.5, z: D * 0.36 },
      { x: leftX(D * 0.36 + 3) - 12.5, z: D * 0.36 + 3.5 },
      { x: leftX(D * 0.62) - 8.5, z: D * 0.62 },
      { x: layout.plot.rightX + 6.8, z: layout.site.meadow.z0 + 2.8 },
    ];
    const tileIn = offsetPolygon(layout.site.tile, -2);
    return spots
      .filter((p) => insidePolygon(p, tileIn))
      .map((p) => ({
        x: world.x(p.x),
        z: world.z(p.z),
        h: 7 + r() * 3,
        leaves: Array.from({ length: 7 }, (_, k) => ({ yaw: (k / 7) * Math.PI * 2 + r() * 0.5, pitch: 0.55 - r() * 0.7, len: 5.5 + r() * 2, ph: r() * 6 })),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, world]);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const leafCount = clumps.reduce((n, c) => n + c.leaves.length, 0);
  const o = useMemo(() => new THREE.Object3D(), []);
  const pose = (e: Env | null) => {
    const m = leafRef.current;
    if (!m) return;
    let i = 0;
    for (const c of clumps) {
      const g = e && animate ? gustAt(e, c.x, c.z) : 0.3;
      const t = e?.t ?? 0;
      for (const l of c.leaves) {
        const flutter = animate ? Math.sin(t * (2 + g * 3) + l.ph) * (0.05 + g * 0.12) : 0;
        o.position.set(c.x, c.h, c.z);
        o.rotation.set(0, l.yaw, l.pitch + flutter, "YXZ");
        o.scale.setScalar(l.len);
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  };
  useEffect(() => {
    pose(env.current);
    leafRef.current?.computeBoundingSphere();
  });
  useFrame(() => {
    if (animate) pose(env.current);
  });
  const props = useMemo<Part[]>(() => {
    const parts: Part[] = [];
    for (const c of clumps) {
      parts.push({ g: "cyl", p: [c.x, c.h / 2, c.z], s: [0.9, c.h, 0.9], c: "#6f8f3a" });
      parts.push({ g: "cyl", p: [c.x + 0.9, c.h * 0.3, c.z + 0.5], s: [0.55, c.h * 0.6, 0.55], c: "#7b9a42" });
      parts.push({ g: "sphere", p: [c.x + 0.4, c.h * 0.78, c.z - 0.5], s: [0.8, 1.3, 0.8], c: "#5b2a3a" }); // banana flower
    }
    // hand pump on a small cement platform with a brass pot
    const px = world.x(leftX(D * 0.2) - 6.5);
    const pz = world.z(D * 0.2);
    parts.push(
      { g: "box", p: [px, 0.2, pz], s: [3.2, 0.4, 3.2], c: "#bdb5a8" },
      { g: "cyl", p: [px, 1.9, pz], s: [0.42, 3.2, 0.42], c: "#2f6b4f" },
      { g: "box", p: [px + 0.55, 2.9, pz], s: [1.1, 0.24, 0.24], c: "#2f6b4f" },
      { g: "box", p: [px - 0.9, 3.6, pz], s: [2.2, 0.16, 0.16], c: "#2f6b4f", r: [0, 0, 0.35] },
      { g: "cyl", p: [px + 1.0, 0.85, pz + 0.2], s: [0.9, 0.9, 0.9], c: "#c9a03e" },
      { g: "sphere", p: [px + 1.0, 1.3, pz + 0.2], s: [0.95, 0.5, 0.95], c: "#c9a03e" },
    );
    // coconut husk / frond stack by the wall
    const hx = world.x(leftX(D * 0.5) - 3.6);
    const hz = world.z(D * 0.5);
    for (let i = 0; i < 9; i++) parts.push({ g: "sphere", p: [hx + ((i % 3) - 1) * 0.7, 0.35 + Math.floor(i / 3) * 0.45, hz + (i % 2) * 0.5], s: [0.8, 0.55, 0.7], c: i % 2 ? "#8a6a42" : "#9c7a4c" });
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clumps, world, layout]);
  const mat = useMemo(() => std("#ffffff", { map: chilliMatTex(), rough: 0.95 }), []);
  const mx = world.x(leftX(D * 0.12) - 8.5);
  const mz = world.z(D * 0.12);
  return (
    <group>
      <instancedMesh ref={leafRef} args={[leafGeo, std("#ffffff", { vertexColors: true, side: THREE.DoubleSide, rough: 0.7 }), Math.max(1, leafCount)]} castShadow frustumCulled={false} />
      <Baked parts={props} cast receive />
      <mesh geometry={G.plane()} material={mat} rotation={[-Math.PI / 2, 0, 0.3]} position={[mx, 0.06, mz]} scale={[6.5, 5, 1]} receiveShadow />
    </group>
  );
}
