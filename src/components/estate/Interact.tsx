"use client";
// Interaction layer of the world (DESIGN.md "inspect like a game"): every interactive object is a <Hotspot> that
// registers its anchor, shows the hover outline, sets the cursor, and reports hover / click with the object's
// position on screen (viewport px) so the HUD can anchor to it. (The right-click / long-press radial menu was
// removed by the owner, 9/10/2026.)
import { type ThreeEvent } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { Env } from "./env";
import { G } from "./materials";
import type { SceneObjectKind, ScreenPoint } from "./types";

export type V3 = [number, number, number];

export interface Spot {
  /** unique per object, e.g. "mailbox", "unit:<id>", "tenant:<id>" */
  key: string;
  kind: SceneObjectKind;
  unitId?: string;
  /** world point the object is anchored by (top centre): tooltips, hint dots and `screen` coords use it */
  anchor: V3;
}

export interface SceneApi {
  env: RefObject<Env>;
  interactive: boolean;
  /** world objects other than houses are clickable (hero mode, or whenever the host listens for object clicks) */
  objects: boolean;
  /** key of the hovered hotspot */
  hovered: string | null;
  /** the first few frames: every hotspot is in the outline selection once, so its shaders are built under the
   *  arrival cover instead of stalling the first hover (owner, 10/10/2026: smooth on every device) */
  warm?: boolean;
  setHover: (spot: Spot | null, key?: string) => void;
  activate: (spot: Spot) => void;
  register: (spot: Spot) => () => void;
}

const Ctx = createContext<SceneApi | null>(null);
export const SceneApiProvider = Ctx.Provider;

export function useScene(): SceneApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useScene() outside the estate scene");
  return api;
}

export const spotKey = (kind: SceneObjectKind, unitId?: string) => (unitId ? `${kind}:${unitId}` : kind);

/** Pointer handlers for one hotspot (spread them on a group or mesh). */
export function useSpotHandlers(spot: Spot | null) {
  const api = useScene();
  const ref = useRef(spot);
  ref.current = spot;
  const kind = spot?.kind;
  const { interactive, objects, setHover, activate } = api;
  return useMemo(() => {
    if (!interactive || (kind !== "unit" && !objects)) return {};
    const cur = () => ref.current;
    return {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const s = cur();
        if (s) setHover(s);
      },
      onPointerOut: () => {
        const s = cur();
        if (s) setHover(null, s.key);
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta > 6) return; // a drag (camera orbit / pan), not a click
        const s = cur();
        if (s) activate(s);
      },
    };
  }, [interactive, objects, kind, setHover, activate]);
}

/**
 * Registers a hotspot's anchor for hint dots, tooltips and getObjectScreen. It registers once per key / kind / unit;
 * the anchor is kept current in place. A walking person's anchor is one array moved every frame, so putting its
 * position in the registration made every scene render re-register them, and each re-register rendered the scene
 * again ("Maximum update depth exceeded" while hovering the property manager / tenants).
 */
export function useRegisterSpot(spot: Spot | null) {
  const { register } = useScene();
  const entry = useRef<Spot | null>(null);
  const id = spot ? `${spot.key}|${spot.kind}|${spot.unitId ?? ""}` : "";
  useEffect(() => {
    if (!spot) return;
    const own: Spot = { ...spot };
    entry.current = own;
    const off = register(own);
    return () => {
      if (entry.current === own) entry.current = null;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, register]);
  // a static object can move too (Config preview resizes the plot): the registered entry follows its latest anchor
  useEffect(() => {
    if (spot && entry.current) entry.current.anchor = spot.anchor;
  });
}

/**
 * An interactive world object: outline on hover, pointer cursor, click / right-click / long-press.
 * Children are the visuals; `hit` adds an invisible, more generous hit proxy (small objects are hard to click).
 */
export function Hotspot({ spot, children, hit, outline = true, selected = false }: { spot: Spot; children: ReactNode; hit?: ReactNode; outline?: boolean; selected?: boolean }) {
  const api = useScene();
  useRegisterSpot(spot);
  const handlers = useSpotHandlers(spot);
  const on = api.hovered === spot.key || selected;
  const live = api.interactive && (spot.kind === "unit" || api.objects);
  return (
    <group {...handlers}>
      <Select enabled={outline && live && (on || !!api.warm)}>{children}</Select>
      {hit}
    </group>
  );
}

const _v = new THREE.Vector3();
/** World point → viewport px (null when behind the camera). The projection includes the HUD view offset. */
export function projectToViewport(p: V3, camera: THREE.Camera, canvas: HTMLElement): ScreenPoint | null {
  _v.set(p[0], p[1], p[2]).project(camera);
  if (_v.z > 1 || _v.z < -1) return null;
  const r = canvas.getBoundingClientRect();
  return { x: Math.round(r.left + (_v.x * 0.5 + 0.5) * r.width), y: Math.round(r.top + (-_v.y * 0.5 + 0.5) * r.height) };
}

/** Invisible box used as a generous hit target. */
export function HitBox({ p, s, rotY = 0 }: { p: V3; s: V3; rotY?: number }) {
  return <mesh geometry={G.box()} position={p} scale={s} rotation={[0, rotY, 0]} visible={false} />;
}
