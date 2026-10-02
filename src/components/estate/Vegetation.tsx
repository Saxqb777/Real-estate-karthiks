"use client";
// Coconut palms (Pattukottai is coconut country), hedges and grass — all instanced, swaying with the gusty wind.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { offsetPolygon, type Pt, type SiteLayout } from "@/lib/site-layout";
import { windAt } from "./env";
import { PAL, std } from "./materials";
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

const TRUNK_P = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.7, 15, 0), new THREE.Vector3(2.5, 30, 0)];
const trunkCurve = new THREE.QuadraticBezierCurve3(TRUNK_P[0], TRUNK_P[1], TRUNK_P[2]);

function trunkGeometry(): THREE.BufferGeometry {
  const segs = 24;
  const radial = 7;
  const pos: number[] = [];
  const col: number[] = [];
  const light = new THREE.Color("#a3845f");
  const dark = new THREE.Color("#6f5338");
  const ring = (i: number) => {
    const t = i / segs;
    const c = trunkCurve.getPoint(t);
    const tan = trunkCurve.getTangent(t);
    const n = new THREE.Vector3(0, 0, 1).cross(tan).normalize();
    const b = tan.clone().cross(n).normalize();
    const r = 0.46 + (1 - t) * 0.26 + Math.max(0, 0.1 - t) * 6;
    return Array.from({ length: radial }, (_, j) => {
      const a = (j / radial) * Math.PI * 2;
      return c.clone().addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
    });
  };
  for (let i = 0; i < segs; i++) {
    const r0 = ring(i);
    const r1 = ring(i + 1);
    const c = i % 2 ? dark : light;
    for (let j = 0; j < radial; j++) {
      const k = (j + 1) % radial;
      for (const v of [r0[j], r1[j], r1[k], r0[j], r1[k], r0[k]]) {
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

/** A coconut frond along +X (length 1): arching spine with long drooping leaflets. */
function frondGeometry(): THREE.BufferGeometry {
  const N = 18;
  const pos: number[] = [];
  const col: number[] = [];
  const spine = (t: number) => new THREE.Vector3(t, 0.16 * Math.sin(t * Math.PI * 0.85) - 0.38 * t * t, 0);
  const width = (t: number) => 0.27 * Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI), 0.75);
  const cBase = new THREE.Color("#2c6a37");
  const cTip = new THREE.Color("#6cb35a");
  const cEnd = new THREE.Color("#a8b94e");
  for (let i = 1; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    const s0 = spine(t0);
    const s1 = spine(Math.min(1, t1));
    for (const side of [-1, 1]) {
      const tm = (t0 + t1) / 2;
      const w = width(tm);
      const tip = spine(tm).add(new THREE.Vector3(0.05, -0.42 * w, side * w));
      const tipC = cTip.clone().lerp(cEnd, Math.max(0, tm - 0.6) * 1.6);
      for (const [v, c] of [
        [s0, cBase],
        [s1, cBase],
        [tip, tipC],
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
  const st = layout.site.street;
  // mostly behind / beside the buildings so they frame the view instead of hiding the facades
  const spots: Pt[] = [
    { x: leftX(33) - 9.5, z: 33 },
    { x: leftX(D - 4) - 8, z: D - 4 },
    { x: leftX(14) - 13, z: 14 },
    { x: R + 7, z: 5 },
    { x: R + 10.5, z: 23 },
    { x: R + 7.5, z: 42 },
    { x: R + 11, z: 58 },
    { x: R + 7, z: D - 3 },
    { x: (R + leftX(D)) / 2 + 6, z: D + 6 },
    { x: (R + leftX(D)) / 2 - 6, z: D + 5 },
    { x: R + 14, z: (st.farShoulder[0] + st.farShoulder[1]) / 2 - 1 },
  ];
  const rear = layout.rearYard.z1 - layout.rearYard.z0;
  if (rear > 6.5) spots.push({ x: leftX(D - rear / 2) + 4.2, z: D - rear / 2 });
  const tileIn = offsetPolygon(layout.site.tile, -2.2);
  return spots.filter((p) => insidePolygon(p, tileIn));
}

export function Palms({ layout, world, animate, count }: { layout: SiteLayout; world: World; animate: boolean; count: number }) {
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
        const nF = 11 + Math.floor(r() * 3);
        return {
          x: world.x(p.x),
          z: world.z(p.z),
          s: (24 + r() * 14) / 30,
          yaw: r() * Math.PI * 2,
          lean: 0.04 + r() * 0.14,
          phase: r() * 10,
          fronds: Array.from({ length: nF }, (_, k) => {
            const dead = k >= nF - 2;
            return {
              yaw: (k / nF) * Math.PI * 2 + r() * 0.4,
              pitch: dead ? -1.15 - r() * 0.3 : k % 3 === 0 ? 0.55 + r() * 0.3 : -0.05 - r() * 0.45,
              len: dead ? 5.2 : 6.6 + r() * 2.4,
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
  const nutCount = specs.length * 5;

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), base: new THREE.Matrix4(), crown: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), o: new THREE.Object3D() }),
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
        c.set(f.dead ? "#9a8650" : "#ffffff").multiplyScalar(f.dead ? 1 : 0.85 + r() * 0.3);
        fr.setColorAt(i++, c);
      }
    if (fr.instanceColor) fr.instanceColor.needsUpdate = true;
  }, [specs]);

  const pose = (t: number) => {
    const tr = trunkRef.current;
    const fr = frondRef.current;
    const nr = nutRef.current;
    if (!tr || !fr || !nr) return;
    const { m, base, crown, q, e, v, s, o } = tmp;
    const wind = windAt(t);
    let fi = 0;
    let ni = 0;
    specs.forEach((p, i) => {
      const sway = animate ? wind * 0.035 + Math.sin(t * 1.05 + p.phase) * 0.022 * (0.4 + wind) : 0.02;
      e.set(0, p.yaw, -(p.lean + sway));
      q.setFromEuler(e);
      base.compose(v.set(p.x, 0, p.z), q, s.setScalar(p.s));
      tr.setMatrixAt(i, base);
      crown.copy(base).multiply(m.makeTranslation(TRUNK_P[2].x, TRUNK_P[2].y, TRUNK_P[2].z));
      for (const f of p.fronds) {
        const flutter = animate ? Math.sin(t * 2.6 + p.phase + f.yaw * 3) * 0.07 * (0.3 + wind) : 0;
        o.position.set(0, 0, 0);
        o.rotation.set(0, f.yaw, f.pitch + flutter, "YXZ");
        o.scale.setScalar(f.len);
        o.updateMatrix();
        m.multiplyMatrices(crown, o.matrix);
        fr.setMatrixAt(fi++, m);
      }
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + p.phase;
        o.position.set(Math.cos(a) * 0.65, -0.45 - (k % 2) * 0.35, Math.sin(a) * 0.65);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(0.85);
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
    pose(0);
    trunkRef.current?.computeBoundingSphere();
    frondRef.current?.computeBoundingSphere();
    nutRef.current?.computeBoundingSphere();
  });
  useFrame(({ clock }) => {
    if (animate) pose(clock.elapsedTime);
  });

  const trunkMat = useMemo(() => std("#ffffff", { vertexColors: true, flat: true, rough: 0.95 }), []);
  const frondMat = useMemo(() => std("#ffffff", { vertexColors: true, flat: true, side: THREE.DoubleSide, rough: 0.8 }), []);
  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, Math.max(1, specs.length)]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={frondRef} args={[frondGeo, frondMat, Math.max(1, frondCount)]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={nutRef} args={[nutGeo, std(PAL.coconut, { flat: true, rough: 0.7 }), Math.max(1, nutCount)]} castShadow frustumCulled={false} />
    </group>
  );
}

/** Hedges along the outside of the compound wall + grass tufts on the margins. */
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
    for (let z = 1.5; z < D; z += 2.6 + r() * 1.6) bushes.push({ x: leftX(z) - 1.4 - r() * 0.7, z, s: 1.4 + r() * 1.0, c: r() });
    for (let x = BL.x + 1; x < BR.x; x += 2.6 + r() * 1.4) bushes.push({ x, z: D + 1.4 + r() * 0.5, s: 1.3 + r() * 0.9, c: r() });
    for (let z = 3; z < D; z += 5 + r() * 4) bushes.push({ x: FR.x + 1.5 + r() * 0.6, z, s: 1.0 + r() * 0.8, c: r() });
    const rear = layout.rearYard.z1 - layout.rearYard.z0;
    if (rear > 3) for (let i = 0; i < 5; i++) bushes.push({ x: FR.x - 1.5 - i * 3.6, z: D - 1.4, s: 1.2 + r() * 0.6, c: r() });
    const tileIn = offsetPolygon(layout.site.tile, -1.6);
    const plotOut = offsetPolygon(P.polygon, 1.2);
    const xs = layout.site.tile.map((p) => p.x);
    const zs = layout.site.tile.map((p) => p.z);
    const grass: { x: number; z: number; s: number; rot: number }[] = [];
    const st = layout.site.street;
    let guard = 0;
    while (grass.length < grassCount && guard++ < grassCount * 30) {
      const p = { x: Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z: Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs)) };
      if (!insidePolygon(p, tileIn) || insidePolygon(p, plotOut)) continue;
      if (p.z < 0.6 && p.z > st.farShoulder[0] - 0.2) continue;
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
