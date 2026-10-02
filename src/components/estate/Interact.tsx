"use client";
// Interaction layer of the world (DESIGN.md "inspect like a game"): every interactive object is a <Hotspot> that
// registers its anchor, shows the hover outline, sets the cursor, and reports hover / click / right-click /
// long-press with the object's position on screen (viewport px) so the HUD can anchor its inspect card to it.
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
  setHover: (spot: Spot | null, key?: string) => void;
  activate: (spot: Spot) => void;
  contextMenu: (spot: Spot) => void;
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

const LONG_PRESS_MS = 520;
const MOVE_TOLERANCE = 9;

/** Shared gesture state (one pointer at a time is enough for a diorama). */
const gesture = {
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  down: null as { x: number; y: number; button: number; touch: boolean } | null,
  /** the click that ends a long-press must not also select the house */
  longPressed: false,
  lastLongPress: 0,
};

function cancelLongPress() {
  if (gesture.timer) clearTimeout(gesture.timer);
  gesture.timer = 0;
}

/** Pointer handlers for one hotspot (spread them on a group or mesh). */
export function useSpotHandlers(spot: Spot | null) {
  const api = useScene();
  const ref = useRef(spot);
  ref.current = spot;
  const kind = spot?.kind;
  const { interactive, objects, setHover, activate, contextMenu } = api;
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
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        const ne = e.nativeEvent;
        const touch = ne.pointerType === "touch" || ne.pointerType === "pen";
        gesture.down = { x: ne.clientX, y: ne.clientY, button: ne.button, touch };
        gesture.longPressed = false;
        cancelLongPress();
        const s = cur();
        if (!touch || !s || s.kind !== "unit") return;
        e.stopPropagation();
        const onMove = (m: PointerEvent) => {
          if (gesture.down && Math.hypot(m.clientX - gesture.down.x, m.clientY - gesture.down.y) > MOVE_TOLERANCE) done();
        };
        const done = () => {
          cancelLongPress();
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", done);
          window.removeEventListener("pointercancel", done);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerup", done);
        window.addEventListener("pointercancel", done);
        gesture.timer = setTimeout(() => {
          gesture.timer = 0;
          gesture.longPressed = true;
          gesture.lastLongPress = performance.now();
          navigator.vibrate?.(12);
          contextMenu(s);
          done();
        }, LONG_PRESS_MS);
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        cancelLongPress();
        if (e.delta > 6 || gesture.longPressed) return;
        const s = cur();
        if (s) activate(s);
      },
      onContextMenu: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        const s = cur();
        if (!s || s.kind !== "unit") return;
        // touch browsers also fire contextmenu on a long press — the long-press timer already handled it
        if (performance.now() - gesture.lastLongPress < 1200 || gesture.down?.touch) return;
        const d = gesture.down;
        // right-drag pans the camera: only a still right-click opens the menu
        if (d && d.button === 2 && Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > 6) return;
        contextMenu(s);
      },
    };
  }, [interactive, objects, kind, setHover, activate, contextMenu]);
}

/** Registers a hotspot's anchor for hint dots, tooltips and getObjectScreen. */
export function useRegisterSpot(spot: Spot | null) {
  const { register } = useScene();
  const sig = spot ? `${spot.key}|${spot.kind}|${spot.unitId ?? ""}|${spot.anchor.map((v) => v.toFixed(2)).join(",")}` : "";
  useEffect(() => {
    if (!spot) return;
    return register(spot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, register]);
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
      <Select enabled={outline && on && live}>{children}</Select>
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
