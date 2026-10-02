"use client";
// Orbit camera with sensible limits + scripted glides: hero fly-in, glide to the selected unit, glide home on deselect.
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import type { SceneMode } from "./UnitSlot";
import { easeInOutCubic, easeOutCubic, type World } from "./util";

export const FOV = 30;

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

interface Pose {
  target: THREE.Vector3;
  radius: number;
  phi: number;
  theta: number;
}

interface Flight {
  from: Pose;
  to: Pose;
  /** flying back to the overview pose (keeps following it if the framing changes mid-flight) */
  home?: boolean;
  /** clock time the flight started (set on its first frame) */
  start: number | null;
  dur: number;
  ease: (t: number) => number;
}

const VIEW: Record<SceneMode, { phi: number; theta: number; fit: number }> = {
  hero: { phi: 0.98, theta: -0.3, fit: 0.66 },
  preview: { phi: 0.8, theta: -0.25, fit: 0.7 },
  login: { phi: 1.04, theta: -0.45, fit: 0.78 },
};

function poseOf(camera: THREE.Camera, target: THREE.Vector3): Pose {
  const off = camera.position.clone().sub(target);
  const sph = new THREE.Spherical().setFromVector3(off);
  return { target: target.clone(), radius: sph.radius, phi: sph.phi, theta: sph.theta };
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function CameraRig({
  layout,
  world,
  mode,
  selectedSlot,
  intro,
  reduced,
  zoomEnabled,
  view,
}: {
  layout: SiteLayout;
  world: World;
  mode: SceneMode;
  selectedSlot: string | null;
  intro: boolean;
  reduced: boolean;
  zoomEnabled: boolean;
  view?: { theta?: number; phi?: number; fit?: number };
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const flight = useRef<Flight | null>(null);
  const started = useRef(false);
  /** true while the camera sits on (or flies to) the overview pose — then data / size changes may reframe it */
  const atHome = useRef(true);

  const vt = view?.theta;
  const vp = view?.phi;
  const vf = view?.fit;
  // Fit the whole tile (plot + street) for the current viewport.
  const home = useMemo<Pose>(() => {
    const v = { ...VIEW[mode], ...(vt !== undefined && { theta: vt }), ...(vp !== undefined && { phi: vp }), ...(vf !== undefined && { fit: vf }) };
    const aspect = size.width / Math.max(1, size.height);
    const vfov = THREE.MathUtils.degToRad(FOV);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    // portrait screens: crop the tile corners a little more so the plot fills the width
    const R = layout.radius * v.fit * (aspect < 1 ? 0.8 : 1) + layout.maxHeightFt * 0.15;
    const dist = R / Math.sin(Math.min(vfov, hfov) / 2);
    const target = new THREE.Vector3(1.5, Math.min(8, layout.maxHeightFt * 0.25), world.z(layout.center.z) + (mode === "preview" ? 5 : 6));
    return { target, radius: dist, phi: v.phi, theta: v.theta };
  }, [layout.radius, layout.maxHeightFt, layout.center.z, mode, size.width, size.height, world, vt, vp, vf]);

  const focus = useMemo<Pose | null>(() => {
    const s = layout.slots.find((x) => x.slot === selectedSlot);
    if (!s) return null;
    const h = s.heightFt + s.parapetFt;
    const r = Math.hypot(s.widthFt, s.depthFt, h) / 2;
    const vfov = THREE.MathUtils.degToRad(FOV);
    const aspect = size.width / Math.max(1, size.height);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    return {
      target: new THREE.Vector3(world.x((s.rect.x0 + s.rect.x1) / 2), h * 0.45, world.z((s.rect.z0 + s.rect.z1) / 2)),
      radius: (r * 1.55) / Math.sin(Math.min(vfov, hfov) / 2),
      phi: 0.95,
      theta: 0,
    };
  }, [layout.slots, selectedSlot, size.width, size.height, world]);

  const apply = (p: Pose) => {
    const c = controls.current;
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(p.radius, p.phi, p.theta));
    camera.position.copy(p.target).add(off);
    if (c) c.target.copy(p.target);
    camera.lookAt(p.target);
  };

  const fly = (to: Pose, dur: number, ease = easeInOutCubic, home = false) => {
    const c = controls.current;
    if (!c || reduced) {
      apply(to);
      c?.update();
      return;
    }
    flight.current = { from: poseOf(camera, c.target), to, start: null, dur, ease, home };
  };

  // first placement (+ hero fly-in)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (focus) {
      // mounted with a unit already selected
      atHome.current = false;
      apply({ ...focus, theta: home.theta, phi: 0.95 });
    } else if (intro && !reduced) {
      apply({ ...home, radius: home.radius * 1.9, phi: 0.45, theta: home.theta - 1.25 });
      flight.current = { from: { ...home, radius: home.radius * 1.9, phi: 0.45, theta: home.theta - 1.25 }, to: home, start: null, dur: 3.2, ease: easeOutCubic, home: true };
    } else {
      apply(home);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // selection changes: glide to the unit, or back to the overview
  const lastFocus = useRef(focus);
  useEffect(() => {
    if (!started.current || !controls.current || lastFocus.current === focus) return;
    lastFocus.current = focus;
    if (focus) {
      const cur = poseOf(camera, controls.current.target);
      atHome.current = false;
      fly({ ...focus, theta: cur.theta, phi: Math.min(1.1, Math.max(0.75, cur.phi)) }, 1.25);
    } else {
      atHome.current = true;
      fly(home, 1.2, easeInOutCubic, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // overview framing changes (plot resized, viewport resized): follow only if the user has not moved the camera
  useEffect(() => {
    if (!started.current || focus || !atHome.current) return;
    const f = flight.current;
    if (f?.home) f.to = home;
    else if (!f) {
      apply(home);
      controls.current?.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);

  useFrame(({ clock }) => {
    const c = controls.current;
    const f = flight.current;
    if (!c) return;
    if (f) {
      f.start ??= clock.elapsedTime;
      const t = Math.min(1, (clock.elapsedTime - f.start) / f.dur);
      const k = f.ease(t);
      const target = f.from.target.clone().lerp(f.to.target, k);
      apply({
        target,
        radius: THREE.MathUtils.lerp(f.from.radius, f.to.radius, k),
        phi: THREE.MathUtils.lerp(f.from.phi, f.to.phi, k),
        theta: lerpAngle(f.from.theta, f.to.theta, k),
      });
      if (t >= 1) flight.current = null;
    }
    // keep panning near the plot
    const lim = layout.radius * 0.7;
    c.target.x = THREE.MathUtils.clamp(c.target.x, -lim, lim);
    c.target.z = THREE.MathUtils.clamp(c.target.z, -lim, lim);
    c.target.y = THREE.MathUtils.clamp(c.target.y, 0, 30);
  });

  const login = mode === "login";
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      panSpeed={0.6}
      enablePan={!login}
      enableZoom={!login && zoomEnabled}
      screenSpacePanning={false}
      minDistance={28}
      maxDistance={home.radius * 2.2}
      minPolarAngle={0.12}
      maxPolarAngle={1.36}
      autoRotate={login && !reduced}
      autoRotateSpeed={0.35}
      onStart={() => {
        flight.current = null;
        atHome.current = false;
      }}
    />
  );
}
