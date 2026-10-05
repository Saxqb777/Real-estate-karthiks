"use client";
// Orbit camera with game-style framing:
//  • HUD-aware: `insets` (px covered by HUD panels) shift the projection centre into the free area (a view offset, so
//    orbiting, raycasting and labels keep working) and the distance is solved so the plot fills that free area —
//    ≈ 45% of the viewport width on a 1440×900 screen with nothing open, smaller as panels slide in.
//  • Scripted glides: hero fly-in, glide to the selected unit, glide home on deselect, re-frame when panels open.
//  • Everything snaps instead of gliding under prefers-reduced-motion.
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { offsetPolygon, type SiteLayout } from "@/lib/site-layout";
import type { SceneInsets } from "./types";
import type { SceneMode } from "./UnitSlot";
import { damp, easeInOutCubic, easeOutCubic, type World } from "./util";

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
  /** "home" / "focus": keeps following its goal if the framing changes mid-flight */
  goal: "home" | "focus" | null;
  /** seconds flown so far (advanced by capped frame time, so a slow frame pauses the flight instead of skipping it) */
  elapsed: number;
  dur: number;
  ease: (t: number) => number;
}

/**
 * Default angle per mode, looking down ~32° from the front-left. On a wide screen the long plot runs across the
 * view (theta ≈ −0.8); on a tall phone it recedes up the screen (theta ≈ −0.4) so it fills the portrait frame.
 */
function viewFor(mode: SceneMode, aspect: number): { phi: number; theta: number } {
  const k = THREE.MathUtils.clamp((aspect - 0.6) / 0.75, 0, 1);
  if (mode === "preview") return { phi: 0.88, theta: THREE.MathUtils.lerp(-0.32, -0.62, k) };
  if (mode === "login") return { phi: 1.04, theta: -0.5 };
  return { phi: 1.02, theta: THREE.MathUtils.lerp(-0.4, -0.8, k) };
}

export const NO_INSETS: SceneInsets = { top: 0, right: 0, bottom: 0, left: 0 };

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

const scratch = new THREE.PerspectiveCamera(FOV, 1, 1, 20000);
const _v = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * Solve target + distance so the points' screen bounding box is centred (in the un-offset frame) and fits
 * `box` px (w × h) on a W × H canvas, for a fixed viewing angle.
 */
export function fitPoints(points: THREE.Vector3[], phi: number, theta: number, W: number, H: number, box: { w: number; h: number }): { target: THREE.Vector3; radius: number } {
  const target = new THREE.Vector3();
  for (const p of points) target.add(p);
  target.divideScalar(Math.max(1, points.length));
  const dir = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, phi, theta));
  scratch.aspect = W / Math.max(1, H);
  scratch.fov = FOV;
  scratch.updateProjectionMatrix();
  let d = 200;
  const tanH = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
  for (let it = 0; it < 6; it++) {
    scratch.position.copy(target).addScaledVector(dir, d);
    scratch.lookAt(target);
    scratch.updateMatrixWorld(true);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      _v.copy(p).project(scratch);
      x0 = Math.min(x0, _v.x);
      x1 = Math.max(x1, _v.x);
      y0 = Math.min(y0, _v.y);
      y1 = Math.max(y1, _v.y);
    }
    const bw = ((x1 - x0) / 2) * W;
    const bh = ((y1 - y0) / 2) * H;
    _right.setFromMatrixColumn(scratch.matrixWorld, 0);
    _up.setFromMatrixColumn(scratch.matrixWorld, 1);
    const halfH = d * tanH;
    target.addScaledVector(_right, ((x0 + x1) / 2) * halfH * scratch.aspect).addScaledVector(_up, ((y0 + y1) / 2) * halfH);
    d *= Math.max(bw / Math.max(1, box.w), bh / Math.max(1, box.h));
  }
  return { target, radius: d };
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
  insets = NO_INSETS,
}: {
  layout: SiteLayout;
  world: World;
  mode: SceneMode;
  selectedSlot: string | null;
  intro: boolean;
  reduced: boolean;
  zoomEnabled: boolean;
  view?: { theta?: number; phi?: number; fit?: number };
  insets?: SceneInsets;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dom = useThree((s) => s.gl.domElement);
  const size = useThree((s) => s.size);
  const flight = useRef<Flight | null>(null);
  const started = useRef(false);
  /** true while the camera sits on (or flies to) the overview pose — then data / size / inset changes may reframe it */
  const atHome = useRef(true);
  const W = Math.max(1, size.width);
  const H = Math.max(1, size.height);
  const it = Math.max(0, insets.top);
  const ir = Math.max(0, insets.right);
  const ib = Math.max(0, insets.bottom);
  const il = Math.max(0, insets.left);
  // free area (never smaller than 35% of the canvas, so a huge panel can't collapse the view)
  const freeW = Math.max(W * 0.35, W - il - ir);
  const freeH = Math.max(H * 0.35, H - it - ib);
  const offX = Math.max(-W * 0.32, Math.min(W * 0.32, (il - ir) / 2));
  const offY = Math.max(-H * 0.32, Math.min(H * 0.32, (it - ib) / 2));

  const vt = view?.theta;
  const vp = view?.phi;
  const vf = view?.fit;

  // overview: the plot (+ its buildings) is the hero (≈ 45% of the width), the tile with the street and palms
  // stays inside the free area around it
  const home = useMemo<Pose>(() => {
    const v = { ...viewFor(mode, W / H), ...(vt !== undefined && { theta: vt }), ...(vp !== undefined && { phi: vp }) };
    const P = layout.plot;
    const ring = mode === "preview" ? offsetPolygon(P.polygon, 5.5) : P.polygon;
    const toV = (p: { x: number; z: number }, y = 0) => new THREE.Vector3(world.x(p.x), y, world.z(p.z));
    const plotPts: THREE.Vector3[] = ring.map((p) => toV(p));
    for (const s of layout.slots) {
      const top = s.heightFt + s.parapetFt + (s.unit ? 6.5 : 0);
      for (const [x, z] of [
        [s.rect.x0, s.rect.z0],
        [s.rect.x1, s.rect.z0],
        [s.rect.x1, s.rect.z1],
        [s.rect.x0, s.rect.z1],
      ])
        plotPts.push(toV({ x, z }, top));
    }
    const portrait = W < H;
    const fill = vf ?? 1;
    if (mode !== "hero") {
      const box = mode === "preview" ? { w: freeW * 0.9 * fill, h: freeH * 0.86 * fill } : { w: freeW * 0.96 * fill, h: freeH * 0.92 * fill };
      const f = fitPoints(mode === "login" ? layout.site.tile.map((p) => toV(p)) : plotPts, v.phi, v.theta, W, H, box);
      return { target: f.target, radius: f.radius, phi: v.phi, theta: v.theta };
    }
    // landscape: the plot ≈ 45% of the viewport width; portrait (phones): it fills the free width
    const plotFit = fitPoints(plotPts, v.phi, v.theta, W, H, { w: portrait ? freeW * 0.88 : Math.min(freeW * 0.8, W * 0.45), h: freeH * (portrait ? 0.86 : 0.8) });
    // the whole tile (street in front, palms around) should fit too — on a phone the tile may bleed off the sides
    const tilePts = [...layout.site.tile.map((p) => toV(p)), ...plotPts];
    const tileFit = fitPoints(tilePts, v.phi, v.theta, W, H, { w: freeW * (portrait ? 1.6 : 0.97), h: freeH * (portrait ? 0.96 : 0.95) });
    // centre on the tile (street included) at whichever distance satisfies both
    return { target: tileFit.target, radius: Math.max(plotFit.radius, tileFit.radius) / fill, phi: v.phi, theta: v.theta };
  }, [layout, world, mode, W, H, freeW, freeH, vt, vp, vf]);

  // a selected unit: fill ~3/4 of the free height, keep the current orbit angle
  const focusFor = (theta: number): Pose | null => {
    const s = layout.slots.find((x) => x.slot === selectedSlot);
    if (!s) return null;
    const top = s.heightFt + s.parapetFt + 7;
    const pts: THREE.Vector3[] = [];
    for (const [x, z] of [
      [s.rect.x0 - 2, s.rect.z0 - 3],
      [s.rect.x1 + 1, s.rect.z0 - 3],
      [s.rect.x1 + 1, s.rect.z1],
      [s.rect.x0 - 2, s.rect.z1],
    ])
      for (const y of [0, top]) pts.push(new THREE.Vector3(world.x(x), y, world.z(z)));
    const phi = 0.98;
    const f = fitPoints(pts, phi, theta, W, H, { w: freeW * 0.7, h: freeH * 0.78 });
    return { target: f.target, radius: f.radius, phi, theta };
  };
  const focusKey = `${selectedSlot}|${W}|${H}|${freeW}|${freeH}|${JSON.stringify(layout.slots.find((x) => x.slot === selectedSlot)?.rect ?? null)}`;

  const apply = (p: Pose) => {
    const c = controls.current;
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(p.radius, p.phi, p.theta));
    camera.position.copy(p.target).add(off);
    if (c) c.target.copy(p.target);
    camera.lookAt(p.target);
  };

  const fly = (to: Pose, dur: number, goal: Flight["goal"], ease = easeInOutCubic) => {
    const c = controls.current;
    if (!c || reduced) {
      apply(to);
      c?.update();
      flight.current = null;
      return;
    }
    flight.current = { from: poseOf(camera, c.target), to, elapsed: 0, dur, ease, goal };
  };

  // view offset (HUD shift), eased every frame
  const offset = useRef({ x: offX, y: offY, init: false });

  // first placement (+ hero fly-in)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    offset.current = { x: offX, y: offY, init: true };
    const f = focusFor(home.theta);
    if (f) {
      atHome.current = false;
      apply(f);
    } else if (intro && !reduced) {
      const from = { ...home, radius: home.radius * 1.9, phi: 0.45, theta: home.theta - 1.25 };
      apply(from);
      flight.current = { from, to: home, elapsed: 0, dur: 3.2, ease: easeOutCubic, goal: "home" };
    } else {
      apply(home);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // selection changes: glide to the unit, or back to the overview
  const lastSel = useRef(selectedSlot);
  useEffect(() => {
    if (!started.current || !controls.current) return;
    const changed = lastSel.current !== selectedSlot;
    lastSel.current = selectedSlot;
    const cur = poseOf(camera, controls.current.target);
    const f = focusFor(flight.current?.goal === "focus" ? flight.current.to.theta : cur.theta);
    if (f) {
      atHome.current = false;
      if (!changed && flight.current?.goal === "focus") flight.current.to = f;
      else if (changed) fly(f, 1.25, "focus");
      else if (!flight.current) fly(f, 0.8, "focus");
    } else if (changed) {
      atHome.current = true;
      fly(home, 1.2, "home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // overview framing changes (plot resized, viewport resized, panels opened): follow if the user has not moved the camera
  useEffect(() => {
    if (!started.current || selectedSlot || !atHome.current) return;
    const f = flight.current;
    if (f?.goal === "home") f.to = home;
    else if (!f) fly(home, 0.9, "home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);

  // only a real drag / wheel by the user takes the camera off its scripted pose (a click on an object must not)
  useEffect(() => {
    let down: { x: number; y: number } | null = null;
    const takeOver = () => {
      flight.current = null;
      atHome.current = false;
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (down && e.buttons && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
        takeOver();
        down = null;
      }
    };
    const onUp = () => {
      down = null;
    };
    const onWheel = () => {
      if (zoomEnabled && mode !== "login") takeOver();
    };
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    dom.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dom.removeEventListener("wheel", onWheel);
    };
  }, [dom, zoomEnabled, mode]);

  useFrame((_, dt) => {
    const c = controls.current;
    const f = flight.current;
    // HUD view offset: the projection centre sits in the middle of the free area
    const o = offset.current;
    const step = reduced ? 1 : Math.min(dt, 0.1);
    o.x = Math.abs(o.x - offX) < 0.3 || reduced ? offX : damp(o.x, offX, 6, step);
    o.y = Math.abs(o.y - offY) < 0.3 || reduced ? offY : damp(o.y, offY, 6, step);
    const cur = camera.view;
    if (Math.abs(o.x) < 0.01 && Math.abs(o.y) < 0.01) {
      if (cur?.enabled) camera.clearViewOffset();
    } else if (!cur?.enabled || cur.offsetX !== -o.x || cur.offsetY !== -o.y || cur.fullWidth !== W || cur.fullHeight !== H) {
      camera.setViewOffset(W, H, -o.x, -o.y, W, H);
    }
    if (!c) return;
    if (f) {
      f.elapsed += Math.min(dt, 1 / 30);
      const t = Math.min(1, f.elapsed / f.dur);
      const e = f.ease(t);
      const target = f.from.target.clone().lerp(f.to.target, e);
      apply({
        target,
        radius: THREE.MathUtils.lerp(f.from.radius, f.to.radius, e),
        phi: THREE.MathUtils.lerp(f.from.phi, f.to.phi, e),
        theta: lerpAngle(f.from.theta, f.to.theta, e),
      });
      if (t >= 1) flight.current = null;
    }
    // keep panning near the plot
    const lim = layout.radius * 0.7;
    c.target.x = THREE.MathUtils.clamp(c.target.x, -lim, lim);
    c.target.z = THREE.MathUtils.clamp(c.target.z, -lim, lim);
    c.target.y = THREE.MathUtils.clamp(c.target.y, -4, 34);
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
      minDistance={26}
      maxDistance={home.radius * 2.2}
      minPolarAngle={0.12}
      maxPolarAngle={1.36}
      autoRotate={login && !reduced}
      autoRotateSpeed={0.35}
    />
  );
}
