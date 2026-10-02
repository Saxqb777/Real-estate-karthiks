"use client";
// Sky life: low-poly clouds drifting around (and below) the floating tile, crow / parakeet flocks crossing,
// fireflies at night and marigold petals blowing across the plot. All instanced / points.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { offsetPolygon, type SiteLayout } from "@/lib/site-layout";
import { windAt, windDir, type Env } from "./env";
import { std } from "./materials";
import { rng, type World } from "./util";
import { insidePolygon } from "./Vegetation";

// ───────────────────────────── clouds ─────────────────────────────

function cloudGeometry(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const s = 0.55 + r() * 0.6;
    g.scale(s * 1.25, s * 0.85, s);
    g.translate((i - n / 2) * 0.9 + r() * 0.4, Math.sin((i / n) * Math.PI) * 0.45 + r() * 0.2, (r() - 0.5) * 0.9);
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

export function Clouds({ layout, env, count, animate }: { layout: SiteLayout; env: RefObject<Env>; count: number; animate: boolean }) {
  const geos = useMemo(() => [cloudGeometry(3), cloudGeometry(8), cloudGeometry(21)], []);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const mat = useMemo(() => {
    const m = std("#ffffff", { flat: true, rough: 1 }).clone();
    m.transparent = true;
    m.opacity = 0.96;
    return m;
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const R = layout.radius;
  const specs = useMemo(() => {
    const r = rng(555);
    // default camera looks from the front-left; keep high clouds behind the island so they never block the view
    const behind = Math.atan2(-0.88, 0.48);
    return Array.from({ length: count }, (_, i) => {
      const low = i % 3 !== 0;
      const a = low ? r() * Math.PI * 2 : behind + (r() - 0.5) * 2.2;
      return { a, rad: R * (low ? 1.2 + r() * 1.3 : 2.2 + r() * 1.2), y: low ? -38 - r() * 40 : 55 + r() * 35, s: (low ? 4.5 : 7) + r() * 5, v: i % 3, spin: (r() - 0.5) * 0.4, speed: 0.004 + r() * 0.008 };
    });
  }, [count, R]);
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const o = useMemo(() => new THREE.Object3D(), []);
  const pose = (t: number) => {
    const idx = [0, 0, 0];
    specs.forEach((c) => {
      const m = refs[c.v].current;
      if (!m) return;
      const a = c.a + t * c.speed;
      o.position.set(Math.cos(a) * c.rad, c.y + Math.sin(t * 0.2 + c.a * 5) * 1.2, Math.sin(a) * c.rad);
      o.rotation.set(0, -a + c.spin, 0);
      o.scale.setScalar(c.s);
      o.updateMatrix();
      m.setMatrixAt(idx[c.v]++, o.matrix);
    });
    refs.forEach((r, i) => {
      if (!r.current) return;
      r.current.count = idx[i];
      r.current.instanceMatrix.needsUpdate = true;
      r.current.computeBoundingSphere();
    });
  };
  useEffect(() => pose(0));
  useFrame(({ clock }) => {
    const e = env.current;
    mat.color.copy(e.cloud);
    mat.emissive.copy(e.cloud).multiplyScalar(0.28);
    if (animate) pose(clock.elapsedTime);
  });
  return (
    <group>
      {geos.map((g, i) => (
        <instancedMesh key={i} ref={refs[i]} args={[g, mat, Math.max(1, count)]} frustumCulled={false} />
      ))}
    </group>
  );
}

// ───────────────────────────── fireflies ─────────────────────────────

const FF_VERT = /* glsl */ `
  attribute float aPhase;
  uniform float uTime; uniform float uPx;
  varying float vBlink;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.6 + aPhase * 7.0) * 1.6;
    p.y += sin(uTime * 0.9 + aPhase * 3.0) * 0.9;
    p.z += cos(uTime * 0.5 + aPhase * 5.0) * 1.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPx * 180.0 / -mv.z;
    vBlink = pow(0.5 + 0.5 * sin(uTime * (1.5 + fract(aPhase * 13.0) * 2.0) + aPhase * 40.0), 3.0);
  }
`;
const FF_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vBlink;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.45) * 3.0 * a, a * vBlink * uOpacity);
  }
`;

export function Fireflies({ layout, world, env, count, animate }: { layout: SiteLayout; world: World; env: RefObject<Env>; count: number; animate: boolean }) {
  const geo = useMemo(() => {
    const r = rng(808);
    const tile = offsetPolygon(layout.site.tile, -3);
    const xs = tile.map((p) => p.x);
    const zs = tile.map((p) => p.z);
    const pos: number[] = [];
    const ph: number[] = [];
    let guard = 0;
    while (ph.length < count && guard++ < count * 40) {
      const p = { x: Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z: Math.max(0.5, Math.min(...zs)) + r() * (Math.max(...zs) - Math.max(0.5, Math.min(...zs))) };
      if (!insidePolygon(p, tile)) continue;
      if (layout.slots.some((s) => p.x > s.rect.x0 - 1 && p.x < s.rect.x1 + 1 && p.z > s.rect.z0 - 1 && p.z < s.rect.z1 + 1)) continue;
      pos.push(world.x(p.x), 1.2 + r() * 7, world.z(p.z));
      ph.push(r());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(ph, 1));
    return g;
  }, [layout, world, count]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uOpacity: { value: 0 } },
        vertexShader: FF_VERT,
        fragmentShader: FF_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const pts = useRef<THREE.Points>(null);
  useFrame(({ clock, gl }) => {
    const n = env.current.night;
    mat.uniforms.uOpacity.value = Math.max(0, (n - 0.45) / 0.55);
    mat.uniforms.uTime.value = animate ? clock.elapsedTime : 1.5;
    mat.uniforms.uPx.value = gl.getPixelRatio();
    if (pts.current) pts.current.visible = n > 0.45;
  });
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />;
}

// ───────────────────────────── birds ─────────────────────────────

const FLOCK_PERIOD = 26;

export function Birds({ layout, env }: { layout: SiteLayout; env: RefObject<Env> }) {
  const N = 7;
  const bodyGeo = useMemo(() => {
    const g = new THREE.OctahedronGeometry(0.5, 0);
    g.scale(1.6, 0.45, 0.5);
    return g;
  }, []);
  const wingGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0.35, 0, 0, -0.35, 0, 0, -0.25, 0, 1.6], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(
    () => () => {
      bodyGeo.dispose();
      wingGeo.dispose();
    },
    [bodyGeo, wingGeo],
  );
  const body = useRef<THREE.InstancedMesh>(null);
  const wl = useRef<THREE.InstancedMesh>(null);
  const wr = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), w: new THREE.Object3D(), m: new THREE.Matrix4() }), []);
  const crow = useMemo(() => std("#1d1d24", { flat: true, side: THREE.DoubleSide, rough: 0.7 }), []);
  const parrot = useMemo(() => std("#3fa65a", { flat: true, side: THREE.DoubleSide, rough: 0.7 }), []);
  const R = layout.radius;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const flock = Math.floor(t / FLOCK_PERIOD);
    const ft = t - flock * FLOCK_PERIOD;
    const r = rng(flock * 97 + 3);
    const heading = r() * Math.PI * 2;
    const isParrot = r() > 0.6;
    const night = env.current.night > 0.6;
    const meshes = [body.current, wl.current, wr.current];
    if (meshes.some((m) => !m)) return;
    meshes.forEach((m) => (m!.visible = !night && ft < 14));
    if (night || ft >= 14) return;
    meshes.forEach((m) => (m!.material = isParrot ? parrot : crow));
    const dx = Math.cos(heading);
    const dz = Math.sin(heading);
    const along = (ft / 14) * R * 3.2 - R * 1.6;
    const y = 52 + r() * 18;
    const side = r() * 20 - 10;
    const { o, w, m } = tmp;
    for (let i = 0; i < N; i++) {
      const row = Math.ceil(i / 2);
      const sgn = i % 2 ? 1 : -1;
      const back = row * 3.2 + Math.sin(t * 0.7 + i) * 0.8;
      const lat = sgn * row * 2.6 + side;
      o.position.set(dx * (along - back) - dz * lat, y + Math.sin(t * 1.3 + i * 1.7) * 1.2, dz * (along - back) + dx * lat);
      o.rotation.set(0, -heading, 0);
      o.scale.setScalar(isParrot ? 1.1 : 1.4);
      o.updateMatrix();
      body.current!.setMatrixAt(i, o.matrix);
      const flap = Math.sin(t * (isParrot ? 16 : 10) + i * 0.9) * 0.75;
      w.position.set(0.2, 0.05, 0);
      w.rotation.set(flap, 0, 0);
      w.scale.set(1, 1, 1);
      w.updateMatrix();
      m.multiplyMatrices(o.matrix, w.matrix);
      wl.current!.setMatrixAt(i, m);
      w.rotation.set(-flap, 0, 0);
      w.scale.set(1, 1, -1);
      w.updateMatrix();
      m.multiplyMatrices(o.matrix, w.matrix);
      wr.current!.setMatrixAt(i, m);
    }
    meshes.forEach((mm) => {
      mm!.instanceMatrix.needsUpdate = true;
    });
  });
  return (
    <group>
      <instancedMesh ref={body} args={[bodyGeo, crow, N]} frustumCulled={false} />
      <instancedMesh ref={wl} args={[wingGeo, crow, N]} frustumCulled={false} />
      <instancedMesh ref={wr} args={[wingGeo, crow, N]} frustumCulled={false} />
    </group>
  );
}

// ───────────────────────────── petals ─────────────────────────────

export function Petals({ layout, world, count }: { layout: SiteLayout; world: World; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.42, 0.26);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const box = useMemo(() => {
    const xs = layout.site.tile.map((p) => world.x(p.x));
    const zs = layout.site.tile.map((p) => world.z(p.z));
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }, [layout, world]);
  const parts = useMemo(() => {
    const r = rng(4242);
    return Array.from({ length: count }, () => ({
      x: box.x0 + r() * (box.x1 - box.x0),
      z: box.z0 + r() * (box.z1 - box.z0),
      y: 1 + r() * 12,
      spin: new THREE.Vector3(r() * 3, r() * 3, r() * 3),
      rot: new THREE.Euler(r() * 6, r() * 6, r() * 6),
      fall: 0.35 + r() * 0.5,
      ph: r() * 10,
      c: r(),
    }));
  }, [count, box]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    parts.forEach((p, i) => m.setColorAt(i, c.set(p.c > 0.55 ? "#ffb547" : p.c > 0.25 ? "#ff8a3d" : "#6fae4c")));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [parts]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, dtRaw) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const w = windAt(t);
    const [wx, wz] = windDir(t);
    parts.forEach((p, i) => {
      p.x += wx * (3 + w * 9) * dt;
      p.z += wz * (3 + w * 9) * dt;
      p.y += (Math.sin(t * 1.3 + p.ph) * 0.6 - p.fall) * dt;
      if (p.x > box.x1) p.x = box.x0;
      if (p.x < box.x0) p.x = box.x1;
      if (p.z > box.z1) p.z = box.z0;
      if (p.z < box.z0) p.z = box.z1;
      if (p.y < 0.3) p.y = 6 + p.ph;
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      o.position.set(p.x, p.y, p.z);
      o.rotation.copy(p.rot);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, std("#ffffff", { side: THREE.DoubleSide, rough: 0.8 }), count]} frustumCulled={false} />;
}
