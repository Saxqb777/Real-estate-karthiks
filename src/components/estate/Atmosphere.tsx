"use client";
// Sky dome, sun/moon, stars, lights and fog — all driven by the shared Env (time of day).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { evalEnv, stepHour, targetHour, type Env, type TimeOfDay } from "./env";

/** Advances the displayed hour towards the target (IST or override) and evaluates the palette every frame. */
export function EnvDriver({ env, timeOfDay, instant }: { env: RefObject<Env>; timeOfDay: TimeOfDay; instant: boolean }) {
  const hour = useRef<number | null>(null);
  const tod = useRef(timeOfDay);
  tod.current = timeOfDay;
  useFrame((_, dt) => {
    const target = targetHour(tod.current);
    hour.current = hour.current === null || instant ? target : stepHour(hour.current, target, Math.min(dt, 0.1));
    evalEnv(hour.current, env.current);
  }, -10);
  return null;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
  uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunVis;
  uniform vec3 uMoonDir; uniform float uMoonVis; uniform float uStars; uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // the camera mostly looks below the horizon, so the lower half carries a long horizon → ground-haze gradient
    vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(uHorizon, uBottom, smoothstep(0.0, 0.9, pow(clamp(-h, 0.0, 1.0), 0.75)));
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.5) * uSunVis;
    col += uSunColor * smoothstep(0.9986, 0.9993, sd) * 6.0 * uSunVis;
    float md = max(dot(d, uMoonDir), 0.0);
    col += vec3(0.55, 0.65, 0.95) * pow(md, 24.0) * 0.22 * uMoonVis;
    col += vec3(1.0, 0.97, 0.9) * smoothstep(0.99935, 0.9997, md) * 3.0 * uMoonVis;
    if (uStars > 0.001 && h > 0.0) {
      vec3 cell = floor(d * 260.0);
      float s = hash(cell);
      float tw = 0.55 + 0.45 * sin(uTime * (0.8 + s * 3.0) + s * 60.0);
      col += vec3(0.9, 0.95, 1.0) * step(0.9972, s) * tw * uStars * smoothstep(0.03, 0.3, h) * 1.4;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function SkyDome({ env }: { env: RefObject<Env> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uSunVis: { value: 1 },
          uMoonDir: { value: new THREE.Vector3() },
          uMoonVis: { value: 0 },
          uStars: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ camera, clock }) => {
    const e = env.current;
    const u = mat.uniforms;
    u.uTop.value.copy(e.skyTop);
    u.uHorizon.value.copy(e.skyHorizon);
    u.uBottom.value.copy(e.skyBottom);
    u.uSunDir.value.copy(e.sunDir);
    u.uSunColor.value.copy(e.key);
    u.uSunVis.value = e.sunVis;
    u.uMoonDir.value.copy(e.moonDir);
    u.uMoonVis.value = e.moonVis;
    u.uStars.value = e.stars;
    u.uTime.value = clock.elapsedTime;
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-100} frustumCulled={false} scale={1000}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  );
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
    fog.near = d * 1.15;
    fog.far = d * 4.2;
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
