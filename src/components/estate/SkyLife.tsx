"use client";
// Sky life: soft painted clouds drifting around (and below) the floating tile, crow / parakeet flocks crossing,
// fireflies at night and marigold petals blowing across the plot on the gusts. All instanced / points.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { offsetPolygon, type SiteLayout } from "@/lib/site-layout";
import { gustAt, type Env } from "./env";
import { std } from "./materials";
import { rng, type World } from "./util";
import { insidePolygon } from "./Vegetation";

// ───────────────────────────── clouds ─────────────────────────────

/** Four hand-painted cumulus shapes in a 2×2 atlas: R = density (alpha), G = how sunlit that part is (top-left lit). */
function cloudAtlas(): THREE.CanvasTexture {
  const S = 256;
  const dens = document.createElement("canvas");
  dens.width = dens.height = S * 2;
  const lite = document.createElement("canvas");
  lite.width = lite.height = S * 2;
  const d = dens.getContext("2d")!;
  const l = lite.getContext("2d")!;
  d.fillStyle = "#000";
  d.fillRect(0, 0, S * 2, S * 2);
  l.fillStyle = "#000";
  l.fillRect(0, 0, S * 2, S * 2);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * S;
    const oy = Math.floor(cell / 2) * S;
    const r = rng(300 + cell * 17);
    const base = oy + S * 0.7; // flat-ish bottom
    const n = 7 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = ox + S * (0.14 + 0.72 * t) + (r() - 0.5) * 18;
      const hump = Math.sin(t * Math.PI);
      const rad = S * (0.11 + 0.17 * hump * (0.7 + r() * 0.5));
      const y = Math.min(base - rad * 0.55, base - S * 0.08 - hump * S * 0.22 + (r() - 0.5) * 14);
      const g = d.createRadialGradient(x, y, rad * 0.2, x, y, rad);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.62, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      d.globalCompositeOperation = "lighter";
      d.fillStyle = g;
      d.beginPath();
      d.arc(x, y, rad, 0, Math.PI * 2);
      d.fill();
      const lg = l.createRadialGradient(x - rad * 0.35, y - rad * 0.45, rad * 0.1, x, y, rad * 1.05);
      lg.addColorStop(0, "rgba(255,255,255,1)");
      lg.addColorStop(0.55, "rgba(190,190,190,1)");
      lg.addColorStop(1, "rgba(80,80,80,1)");
      l.globalCompositeOperation = "lighten";
      l.fillStyle = lg;
      l.beginPath();
      l.arc(x, y, rad, 0, Math.PI * 2);
      l.fill();
    }
    // soften the base: fade density out under the baseline
    const fade = d.createLinearGradient(0, base - S * 0.1, 0, base + S * 0.06);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    d.globalCompositeOperation = "source-over";
    d.fillStyle = fade;
    d.fillRect(ox, base - S * 0.1, S, S * 0.4);
  }
  const out = document.createElement("canvas");
  out.width = out.height = S * 2;
  const o = out.getContext("2d")!;
  const di = d.getImageData(0, 0, S * 2, S * 2).data;
  const li = l.getImageData(0, 0, S * 2, S * 2).data;
  const img = o.createImageData(S * 2, S * 2);
  for (let i = 0; i < di.length; i += 4) {
    img.data[i] = Math.min(255, di[i]);
    img.data[i + 1] = li[i];
    img.data[i + 2] = 0;
    img.data[i + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
let atlas: THREE.CanvasTexture | null = null;

const CLOUD_VERT = /* glsl */ `
  attribute vec3 aCloud; // x: atlas cell, y: opacity, z: flip
  varying vec2 vUv;
  varying float vAlpha;
  varying float vFog;
  void main() {
    vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sx = length(instanceMatrix[0].xyz);
    vec2 q = position.xy * vec2(sx * 2.0, sx);
    c.xy += q;
    gl_Position = projectionMatrix * c;
    float cell = aCloud.x;
    vec2 uv0 = vec2(mod(cell, 2.0), 1.0 - floor(cell / 2.0)) * 0.5;
    vec2 u = uv;
    if (aCloud.z > 0.5) u.x = 1.0 - u.x;
    vUv = uv0 + u * 0.5;
    vAlpha = aCloud.y;
    vFog = clamp((-c.z - 200.0) / 1600.0, 0.0, 1.0);
  }
`;
const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uHaze; uniform float uOpacity;
  varying vec2 vUv; varying float vAlpha; varying float vFog;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float a = smoothstep(0.06, 0.75, t.r) * vAlpha * uOpacity;
    if (a < 0.004) discard;
    vec3 col = mix(uShade, uLit, smoothstep(0.25, 1.0, t.g));
    col = mix(col, uHaze, vFog * 0.6);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

/** Soft painted cumulus billboards drifting around and below the floating tile. */
export function Clouds({ layout, env, count, animate }: { layout: SiteLayout; env: RefObject<Env>; count: number; animate: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const r = rng(77);
    const attr = new Float32Array(Math.max(1, count) * 3);
    for (let i = 0; i < count; i++) {
      attr[i * 3] = i % 4;
      attr[i * 3 + 1] = 0.55 + r() * 0.4;
      attr[i * 3 + 2] = r() > 0.5 ? 1 : 0;
    }
    g.setAttribute("aCloud", new THREE.InstancedBufferAttribute(attr, 3));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => {
    atlas ??= cloudAtlas();
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uOpacity: { value: 1 } },
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      transparent: true,
      depthWrite: false,
    });
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const R = layout.radius;
  const specs = useMemo(() => {
    const r = rng(555);
    return Array.from({ length: count }, (_, i) => {
      // two layers: a cloud sea drifting under the tile, and a few big ones far behind at tile height
      const low = i % 3 !== 2;
      return {
        a: r() * Math.PI * 2,
        rad: R * (low ? 0.75 + r() * 1.5 : 2.6 + r() * 1.2),
        y: low ? -48 - r() * 70 : -6 + r() * 40,
        s: low ? 34 + r() * 30 : 60 + r() * 40,
        speed: (0.006 + r() * 0.008) * (r() > 0.5 ? 1 : -1),
        bob: r() * 10,
      };
    });
  }, [count, R]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const pose = (t: number) => {
    const m = ref.current;
    if (!m) return;
    specs.forEach((c, i) => {
      const a = c.a + t * c.speed;
      o.position.set(Math.cos(a) * c.rad, c.y + Math.sin(t * 0.15 + c.bob) * 1.5, Math.sin(a) * c.rad);
      o.scale.setScalar(c.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  useEffect(() => pose(0));
  useFrame(() => {
    const e = env.current;
    const u = mat.uniforms;
    u.uLit.value.copy(e.cloud);
    u.uShade.value.copy(e.cloud).lerp(e.skyTop, 0.45).multiplyScalar(0.82);
    u.uHaze.value.copy(e.skyBottom);
    u.uOpacity.value = 0.92 - e.night * 0.25;
    if (animate) pose(e.t);
  });
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, count)]} frustumCulled={false} renderOrder={-50} />;
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
    gl_PointSize = uPx * 1500.0 / -mv.z;
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
  useFrame(() => {
    const t = env.current.t;
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

export function Petals({ layout, world, env, count }: { layout: SiteLayout; world: World; env: RefObject<Env>; count: number }) {
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
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const e = env.current;
    const dt = Math.min(e.dt, 0.05);
    const t = e.t;
    const [wx, wz] = e.windDir;
    parts.forEach((p, i) => {
      // the same travelling gust that bends the palms and lifts the laundry carries the petals
      const w = gustAt(e, p.x, p.z);
      p.x += wx * (2 + w * 12) * dt;
      p.z += wz * (2 + w * 12) * dt;
      p.y += (Math.sin(t * 1.3 + p.ph) * 0.6 - p.fall + Math.max(0, w - 0.6) * 2.2) * dt;
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
