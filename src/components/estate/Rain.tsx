"use client";
// Rain over the island when it rains in Pattukkottai (owner 2/11/2026: real weather). One draw call of streaks and one
// of splashes, animated entirely on the GPU from scene time: each drop falls from the top of a column and wraps round;
// how many drops show follows the rain's strength (drawRange). Streaks lean with the wind, never show under a roof
// (inside a house's footprint below its roof top) and fade at the ground, where small rings splash on the grass.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import type { Env } from "./env";
import { insidePolygon } from "./street-life";
import { rng, type World } from "./util";

const H = 46; // column height (ft)
const SPEED = 38; // ft/s

const RAIN_VERT = /* glsl */ `
  attribute float aSeed; attribute float aEnd;
  uniform float uTime; uniform float uLen; uniform vec2 uWind;
  uniform vec4 uRect0; uniform vec4 uRect1; uniform vec2 uRoof;
  varying float vA;
  bool under(vec3 p, vec4 r, float roof) { return p.x > r.x && p.x < r.z && p.z > r.y && p.z < r.w && p.y < roof; }
  void main() {
    float y = ${H.toFixed(1)} - mod(uTime * ${SPEED.toFixed(1)} + aSeed * ${H.toFixed(1)}, ${H.toFixed(1)});
    vec3 p = position;
    // the streak: head at y, tail up-wind behind it
    p.y = y + aEnd * uLen;
    p.xz += uWind * aEnd * uLen * 0.3;
    vA = smoothstep(0.0, 1.4, y) * (1.0 - smoothstep(${(H - 6).toFixed(1)}, ${H.toFixed(1)}, y)) * (1.0 - aEnd * 0.85);
    if (under(vec3(position.x, y, position.z), uRect0, uRoof.x) || under(vec3(position.x, y, position.z), uRect1, uRoof.y)) vA = 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RAIN_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vA;
  void main() {
    if (vA < 0.01) discard;
    gl_FragColor = vec4(uColor, uOpacity * vA);
  }
`;
const SPLASH_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime; uniform float uPx;
  varying float vK;
  void main() {
    vK = fract(uTime * 1.6 + aSeed * 7.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (0.4 + vK * 1.2) * uPx * 300.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const SPLASH_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vK;
  void main() {
    // a thin ring, squashed (we look down at the ground), fading as it spreads
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    q.y *= 1.8;
    float d = length(q);
    float ring = smoothstep(0.62, 0.8, d) * (1.0 - smoothstep(0.82, 1.0, d));
    float a = ring * (1.0 - vK) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function Rain({ layout, world, env, count }: { layout: SiteLayout; world: World; env: RefObject<Env>; count: number }) {
  const splashes = Math.round(count / 8);
  // drops scattered over the island (plan → world), seeded so they never jump between renders
  const { streakGeo, splashGeo } = useMemo(() => {
    const r = rng(4242);
    const tile = layout.site.tile;
    const xs = tile.map((p) => p.x);
    const zs = tile.map((p) => p.z);
    const pick = () => {
      for (;;) {
        const p = { x: Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z: Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs)) };
        if (insidePolygon(p, tile)) return p;
      }
    };
    const pos = new Float32Array(count * 6);
    const seed = new Float32Array(count * 2);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const p = pick();
      const s = r();
      for (let k = 0; k < 2; k++) {
        pos.set([world.x(p.x), 0, world.z(p.z)], (i * 2 + k) * 3);
        seed[i * 2 + k] = s;
        end[i * 2 + k] = k;
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sg.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    sg.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    const sp = new Float32Array(splashes * 3);
    const ss = new Float32Array(splashes);
    for (let i = 0; i < splashes; i++) {
      const p = pick();
      sp.set([world.x(p.x), 0.08, world.z(p.z)], i * 3);
      ss[i] = r();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    pg.setAttribute("aSeed", new THREE.BufferAttribute(ss, 1));
    return { streakGeo: sg, splashGeo: pg };
  }, [layout, world, count, splashes]);
  useEffect(
    () => () => {
      streakGeo.dispose();
      splashGeo.dispose();
    },
    [streakGeo, splashGeo],
  );
  // the two houses (world rects + roof tops): no rain inside them
  const roofs = useMemo(() => {
    const built = layout.slots.filter((s) => s.unit);
    const rect = (i: number) => {
      const s = built[i];
      if (!s) return { v: new THREE.Vector4(1e6, 1e6, -1e6, -1e6), h: -1 };
      const xa = world.x(s.rect.x0);
      const xb = world.x(s.rect.x1);
      const za = world.z(s.rect.z0);
      const zb = world.z(s.rect.z1);
      return { v: new THREE.Vector4(Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)), h: s.heightFt + s.parapetFt + 0.4 };
    };
    return [rect(0), rect(1)];
  }, [layout, world]);
  const streakMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLen: { value: 1.8 },
          uWind: { value: new THREE.Vector2() },
          uRect0: { value: new THREE.Vector4() },
          uRect1: { value: new THREE.Vector4() },
          uRoof: { value: new THREE.Vector2() },
          uColor: { value: new THREE.Color("#d3dbe8") },
          uOpacity: { value: 0 },
        },
        vertexShader: RAIN_VERT,
        fragmentShader: RAIN_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const splashMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uColor: { value: new THREE.Color("#e3eaf3") }, uOpacity: { value: 0 } },
        vertexShader: SPLASH_VERT,
        fragmentShader: SPLASH_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      streakMat.dispose();
      splashMat.dispose();
    },
    [streakMat, splashMat],
  );
  const lines = useRef<THREE.LineSegments>(null);
  const dots = useRef<THREE.Points>(null);
  const day = useMemo(() => new THREE.Color("#d3dbe8"), []);
  const night = useMemo(() => new THREE.Color("#7f8daa"), []);
  useFrame(({ gl }) => {
    const e = env.current;
    const on = e.rain > 0.02;
    if (lines.current) lines.current.visible = on;
    if (dots.current) dots.current.visible = on;
    if (!on) return;
    const u = streakMat.uniforms;
    u.uTime.value = e.t;
    u.uLen.value = 1.2 + e.rain * 1.4;
    u.uWind.value.set(e.windDir[0] * e.wind, e.windDir[1] * e.wind);
    u.uRect0.value.copy(roofs[0].v);
    u.uRect1.value.copy(roofs[1].v);
    u.uRoof.value.set(roofs[0].h, roofs[1].h);
    u.uColor.value.copy(day).lerp(night, e.night);
    u.uOpacity.value = 0.3 + e.rain * 0.3;
    streakGeo.setDrawRange(0, 2 * Math.round(count * Math.min(1, e.rain * 1.1)));
    const s = splashMat.uniforms;
    s.uTime.value = e.t;
    s.uPx.value = gl.getPixelRatio();
    s.uColor.value.copy(day).lerp(night, e.night * 0.7);
    s.uOpacity.value = 0.18 + e.rain * 0.4;
    splashGeo.setDrawRange(0, Math.round(splashes * Math.min(1, e.rain * 1.2)));
  });
  return (
    <>
      <lineSegments ref={lines} geometry={streakGeo} material={streakMat} frustumCulled={false} renderOrder={5} visible={false} />
      <points ref={dots} geometry={splashGeo} material={splashMat} frustumCulled={false} renderOrder={4} visible={false} />
    </>
  );
}
