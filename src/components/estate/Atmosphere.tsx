"use client";
// Sky backdrop, lights and fog — all driven by the shared Env (time of day), plus the scene clock:
// EnvDriver advances scene time (slowed while the world is dimmed), the gusty wind and the IST palette.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { evalEnv, stepHour, targetHour, windAt, windDir, type Env, type TimeOfDay } from "./env";
import type { SceneInsets } from "./types";
import { damp } from "./util";

/** Advances the displayed hour towards the target (IST or override), scene time and wind; evaluates the palette. */
export function EnvDriver({ env, timeOfDay, instant, dimmed = false }: { env: RefObject<Env>; timeOfDay: TimeOfDay; instant: boolean; dimmed?: boolean }) {
  const hour = useRef<number | null>(null);
  const tod = useRef(timeOfDay);
  tod.current = timeOfDay;
  const dim = useRef(dimmed);
  dim.current = dimmed;
  useFrame((_, dtRaw) => {
    const e = env.current;
    const dt = Math.min(dtRaw, 0.1);
    const target = targetHour(tod.current);
    hour.current = hour.current === null || instant ? target : stepHour(hour.current, target, dt);
    evalEnv(hour.current, e);
    e.timeScale = instant ? (dim.current ? 0.3 : 1) : damp(e.timeScale, dim.current ? 0.3 : 1, 2.5, dt);
    e.dt = dt * e.timeScale;
    e.t += e.dt;
    e.wind = windAt(e.t);
    windDir(e.t, e.windDir);
  }, -10);
  return null;
}

const BACK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }
`;
const BACK_FRAG = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
  uniform vec3 uSunColor; uniform vec2 uSun; uniform float uSunVis;
  uniform vec2 uMoon; uniform float uMoonVis; uniform float uStars; uniform float uTime;
  uniform vec2 uRes; uniform float uBand;
  varying vec2 vUv;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec2 p = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    // painted sky: zenith → a soft horizon band → the hazy depth below the floating tile
    float up = smoothstep(uBand - 0.05, 1.0, p.y);
    float down = smoothstep(uBand + 0.02, 0.0, p.y);
    vec3 col = mix(uHorizon, uTop, pow(up, 0.8));
    col = mix(col, uBottom, pow(down, 0.9));
    // warm glow around the sun, then the disc with a soft rim
    vec2 ds = (p - uSun) * vec2(aspect, 1.0);
    float rs = length(ds);
    col += uSunColor * (exp(-rs * 4.0) * 0.22 + exp(-rs * 16.0) * 0.35) * uSunVis;
    float sun = smoothstep(0.042, 0.036, rs);
    col = mix(col, uSunColor * 1.25 + vec3(0.25, 0.2, 0.12), sun * uSunVis);
    // moon: pale disc with a crescent shadow and a faint halo
    vec2 dm = (p - uMoon) * vec2(aspect, 1.0);
    float rm = length(dm);
    col += vec3(0.55, 0.62, 0.85) * exp(-rm * 9.0) * 0.16 * uMoonVis;
    float moon = smoothstep(0.03, 0.026, rm);
    float shade = smoothstep(0.02, 0.031, length(dm - vec2(0.012, 0.006)));
    col = mix(col, mix(col * 0.6 + vec3(0.04, 0.05, 0.08), vec3(0.94, 0.92, 0.84), shade), moon * uMoonVis);
    // stars (upper sky only), gently twinkling
    if (uStars > 0.001) {
      vec2 cell = floor(gl_FragCoord.xy / 3.0);
      float s = hash(cell);
      float tw = 0.55 + 0.45 * sin(uTime * (0.7 + s * 2.6) + s * 50.0);
      col += vec3(0.9, 0.93, 1.0) * step(0.9965, s) * tw * uStars * smoothstep(uBand + 0.05, uBand + 0.4, p.y) * 0.9;
    }
    col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // dither: no banding in the gradients
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * The sky as a painted backdrop behind the diorama (the camera looks down, so a real sky dome would never show).
 * The sun and moon travel across it with the IST hour — inside the area the HUD leaves free.
 */
export function Backdrop({ env, insets }: { env: RefObject<Env>; insets?: SceneInsets }) {
  const size = useThree((s) => s.size);
  const freeX: [number, number] = [Math.min(0.45, (insets?.left ?? 0) / Math.max(1, size.width)), Math.max(0.55, 1 - (insets?.right ?? 0) / Math.max(1, size.width))];
  const geo = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uSunColor: { value: new THREE.Color() },
          uSun: { value: new THREE.Vector2(0.7, 0.8) },
          uSunVis: { value: 1 },
          uMoon: { value: new THREE.Vector2(0.3, 0.8) },
          uMoonVis: { value: 0 },
          uStars: { value: 0 },
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uBand: { value: 0.42 },
        },
        vertexShader: BACK_VERT,
        fragmentShader: BACK_FRAG,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const fx = useRef(freeX);
  fx.current = freeX;
  useFrame(({ clock }) => {
    const e = env.current;
    const u = mat.uniforms;
    u.uTop.value.copy(e.skyTop);
    u.uHorizon.value.copy(e.skyHorizon);
    u.uBottom.value.copy(e.skyBottom);
    u.uSunColor.value.copy(e.key);
    u.uRes.value.set(size.width, size.height);
    u.uTime.value = clock.elapsedTime;
    u.uStars.value = e.stars;
    const [l, r] = fx.current;
    const span = Math.max(0.2, r - l);
    // sun: rises at the left of the free sky, sets at its right
    const day = (e.hour - 5.9) / (18.4 - 5.9);
    u.uSun.value.set(l + span * (0.1 + 0.8 * day), 0.5 + 0.34 * Math.sin(Math.min(1, Math.max(0, day)) * Math.PI) - (day < 0 || day > 1 ? 0.2 : 0));
    u.uSunVis.value = e.sunVis * (1 - e.night * 0.8);
    const nightP = (((e.hour - 18.6 + 24) % 24) / (24 - 18.6 + 5.6));
    u.uMoon.value.set(l + span * (0.12 + 0.76 * nightP), 0.56 + 0.3 * Math.sin(Math.min(1, Math.max(0, nightP)) * Math.PI));
    u.uMoonVis.value = e.moonVis;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-100} />;
}

/** Hemisphere + key (sun/moon, shadow-casting) + fill light, and matching fog. */
export function Lights({ env, radius, shadowSize, shadows }: { env: RefObject<Env>; radius: number; shadowSize: number; shadows: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog("#000", 200, 1200), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useEffect(() => {
    const l = key.current;
    if (!l) return;
    const r = radius * 1.08;
    const cam = l.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = radius * 6;
    cam.updateProjectionMatrix();
    l.shadow.mapSize.set(shadowSize, shadowSize);
    l.shadow.map?.dispose();
    l.shadow.map = null;
  }, [radius, shadowSize]);

  useFrame(({ camera }) => {
    const e = env.current;
    if (hemi.current) {
      hemi.current.color.copy(e.hemiSky);
      hemi.current.groundColor.copy(e.hemiGround);
      hemi.current.intensity = e.hemi;
    }
    if (key.current) {
      key.current.color.copy(e.key);
      key.current.intensity = e.keyI;
      key.current.position.copy(e.keyDir).multiplyScalar(radius * 3);
    }
    if (fill.current) {
      fill.current.color.copy(e.fill);
      fill.current.intensity = e.fillI;
      fill.current.position.set(-e.keyDir.x, Math.max(0.3, e.keyDir.y), -e.keyDir.z).multiplyScalar(radius * 2);
    }
    fog.color.copy(e.fog);
    const d = camera.position.length();
    fog.near = d * 1.2;
    fog.far = d * 4.4;
  });

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={key}
        castShadow={shadows}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
        shadow-radius={4}
        shadow-blurSamples={12}
      />
      <directionalLight ref={fill} />
    </>
  );
}
