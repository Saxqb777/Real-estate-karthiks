"use client";
// The interactive 3D estate diorama — the centrepiece. Driven entirely by data:
// plot widths/depth, each unit's footprint, position, floors, occupancy and rent state map onto the model.
// Import it through EstateSceneLazy (next/dynamic, ssr: false) so three.js never runs on the server.
// SCENE CONTRACT v2 (types.ts): world objects report hover / click / right-click with their screen position,
// the camera frames the plot inside the area the HUD leaves free, and `dimmed` softly dims the world.
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, advance, useFrame, useThree, events as r3fEvents } from "@react-three/fiber";
import { Selection } from "@react-three/postprocessing";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { PlotGeometry } from "@/lib/dashboard-types";
import { computeSiteLayout, formatFeetInches, highlightedSlots, type SceneUnit, type SlotName } from "@/lib/site-layout";
import { formatIndianNumber } from "@/lib/format";
import { Backdrop, EnvDriver, Lights } from "./Atmosphere";
import { CameraRig, FOV, NO_INSETS } from "./CameraRig";
import { Dimensions, dimensionLabels } from "./Dimensions";
import { Effects, type FxLevel, type Tier } from "./Effects";
import { createEnv, type TimeOfDay } from "./env";
import { Fixtures, type WorldCues } from "./Fixtures";
import { GroundShade } from "./GroundShade";
import { Tile } from "./Island";
import { SceneApiProvider, projectToViewport, spotKey, type SceneApi, type Spot, type V3 } from "./Interact";
import { LabelProjector, OverlayLabels, type LabelSpec, type Tone } from "./Overlay";
import { Life } from "./Life";
import { PlotGround } from "./PlotGround";
import { SitePlanFallback } from "./SitePlanFallback";
import { UnitSlot, dayMonth, slotLabels, type SceneMode } from "./UnitSlot";
import { useAnimatedLayout } from "./useAnimatedLayout";
import { Clouds, Fireflies } from "./SkyLife";
import { Garden, Greenery, Palms } from "./Vegetation";
import { gateSign } from "./street-life";
import { SCENE_OBJECT_INFO, type ObjectScreenFn, type SceneInsets, type SceneObject, type SceneObjectKind } from "./types";
import { makeWorld, prefersReducedMotion } from "./util";
import s from "./estate.module.css";

export type { SceneMode } from "./UnitSlot";
export type { TimeOfDay } from "./env";
export type { WorldCues } from "./Fixtures";
export type { ObjectScreenFn, SceneInsets, SceneObject, SceneObjectKind, ScreenPoint } from "./types";

export interface EstateSceneProps {
  plot: PlotGeometry | Partial<Pick<PlotGeometry, "frontWidthFt" | "backWidthFt" | "depthFt" | "areaSqft" | "townName">>;
  units: SceneUnit[];
  mode?: SceneMode;
  selectedUnitId?: string | null;
  onSelectUnit?: (id: string | null) => void;
  onEmptySlotClick?: (slot: "front" | "back") => void;
  /** "auto" follows the IST clock (src/lib/day-phase.ts); the rest are previews. */
  timeOfDay?: TimeOfDay;
  showLabels?: boolean;
  showDimensions?: boolean;
  /** e.g. "frontWidthFt", "depthFt", "footprintWidthFt:front", "floors:<unitId>", "areaSqft" */
  highlightField?: string | null;
  className?: string;
  /** World life (people, the cow and the dog, birds, petals). Uncontrolled by default with a toggle in the scene HUD. */
  life?: boolean;
  /** Force a quality tier (default: auto — high on the desktop hero, mid in the preview and on phones / tablets). */
  quality?: Tier;
  /** Show the small in-scene HUD (Life toggle). Default: hero only. */
  hud?: boolean;
  /** Mouse-wheel zoom: "focus" (after clicking into the scene — keeps page scroll working) or "always". */
  wheelZoom?: "focus" | "always";
  /** Hero fly-in on first load (default true in hero mode). */
  intro?: boolean;
  /** Called once the scene has drawn its first few frames (shaders warmed up) — or straight away when the 2D fallback shows. */
  onFirstFrame?: () => void;
  /** Override the default camera angle: theta (azimuth, rad, 0 = straight from the street), phi (from vertical), fit (zoom multiplier). */
  cameraView?: { theta?: number; phi?: number; fit?: number };
  /** Show fps / draw calls / triangles (for performance checks). */
  debug?: boolean;
  /**
   * Adapt the render resolution / post effects to the frame rate (default: on — except in automated browsers, whose
   * software-rendered frame rates say nothing about a real device; screenshots there show the full quality).
   */
  governor?: boolean;

  // ── SCENE CONTRACT v2 ──
  /** Every interactive world object (house, mailbox, notice board, pole, TO-LET, tenant, tax stamp, plot marker). A house click also calls onSelectUnit. */
  onObjectClick?: (obj: SceneObject) => void;
  /** Hover enter (object) / leave (null) — for hint labels in the HUD. */
  onObjectHover?: (obj: SceneObject | null) => void;
  /** Pixels covered by HUD panels; the camera frames the plot in the free area (animated). */
  insets?: SceneInsets;
  /** Focus dimming: the world softly dims / desaturates and ambient motion slows (while a panel is read). */
  dimmed?: boolean;
  /** Show a small marigold "unexplored" marker above these objects (max 3 shown, in this order). */
  hintObjects?: SceneObjectKind[];
  /** Receives a live lookup (kind, unitId?) → viewport px | null, so the HUD can anchor cards; null on unmount. */
  getObjectScreen?: (fn: ObjectScreenFn | null) => void;

  // ── optional extras ──
  /**
   * In-world hover tooltips (depth 1 of the inspect pattern: name + one line + next step). Default: on, unless
   * `onObjectHover` is given — then the host is assumed to draw its own hover hint. Pass true/false to force.
   */
  tooltips?: boolean;
  /** Second line of an object's tooltip, e.g. { noticeboard: "2 open to-dos", taxstamp: "2026 due" }. */
  objectNotes?: Partial<Record<SceneObjectKind, string>>;
  /** Data shown on the objects themselves: notes on the notice board, a letter in the mailbox, the tax stamp. */
  cues?: WorldCues;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[estate] 3D scene failed, showing the site plan", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Fires `onDone` once after a few rendered frames, when the first-render hitch (shader compile, uploads) is behind us. */
function FirstFrames({ onDone }: { onDone: () => void }) {
  const n = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  useFrame(() => {
    if (++n.current === 4) done.current();
  });
  return null;
}

/**
 * Paces the world at a steady frame rate (owner, 10/10/2026: "smooth on my phone and laptop and any other device"):
 * on a 60 Hz screen every refresh draws; on 120 / 144 Hz screens every other one (a steady 60–72 fps instead of
 * frames jittering between 8 and 16 ms, and half the GPU work); 90 Hz screens draw every refresh. Drives R3F with
 * frameloop="never" + advance(), so nothing runs while the scene is off screen or the tab is hidden.
 */
function Pacer({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let prev = 0;
    let last = -Infinity;
    // the screen's refresh interval: the shortest gap between callbacks (a skipped callback returns at once, so its
    // successor lands exactly one refresh later)
    const gaps: number[] = [];
    let vsync = 1000 / 60;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (prev) {
        gaps.push(now - prev);
        if (gaps.length > 90) gaps.shift();
        if (gaps.length >= 20) vsync = Math.max(4, Math.min(...gaps));
      }
      prev = now;
      const every = Math.max(1, Math.floor(1000 / vsync / 60 + 0.1));
      if (now - last < every * vsync - vsync / 2) return;
      last = now;
      advance(now / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return null;
}

// The world's static parts don't depend on what is hovered or selected: a hover / click re-renders only the houses,
// the labels and the hotspots — not every palm, person, wall and cloud (owner, 10/10/2026: smooth on every device).
const TileM = memo(Tile);
const PlotGroundM = memo(PlotGround);
const GroundShadeM = memo(GroundShade);
const GreeneryM = memo(Greenery);
const PalmsM = memo(Palms);
const GardenM = memo(Garden);
const FixturesM = memo(Fixtures);
const LifeM = memo(Life);
const FirefliesM = memo(Fireflies);
const CloudsM = memo(Clouds);

/** Render resolution steps the governor moves through (never below 1×). */
const DPR_STEP = 0.25;
const FX_DOWN: Record<FxLevel, FxLevel | null> = { full: "lite", lite: "aa", aa: null };
const order = (l: FxLevel) => ({ full: 0, lite: 1, aa: 2 })[l];

/** Calls `onDone` once `n` frames have been drawn. */
function AfterFrames({ n, onDone }: { n: number; onDone: () => void }) {
  const count = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  useFrame(() => {
    if (++count.current === n + 1) done.current();
  });
  return null;
}

/**
 * Once the world has drawn, builds the shaders of everything in it — hidden things too (gate leaves, the car's lamps,
 * night glows, people waiting off stage) — without blocking where the browser can (KHR_parallel_shader_compile), so
 * nothing stalls the first time it shows up.
 */
function Precompile() {
  const gl = useThree((st) => st.gl);
  const scene = useThree((st) => st.scene);
  const camera = useThree((st) => st.camera);
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current !== 2) return;
    gl.compileAsync(scene, camera).catch(() => {});
  });
  return null;
}

interface ThreeHandle {
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
}

export default function EstateScene(props: EstateSceneProps) {
  const { plot, units, mode = "hero", className } = props;
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [lifeState, setLifeState] = useState<boolean | null>(null);
  const [zoomFocus, setZoomFocus] = useState(false);
  const [autoTier, setAutoTier] = useState<Tier>("high");
  // render resolution: starts at the screen's own sharpness and adapts quietly to the device (the tier — and so what
  // is in the world — never changes mid-session)
  const [dpr, setDpr] = useState(1);
  const [monitor, setMonitor] = useState(false);
  // post effects: full on the desktop hero, lite elsewhere; the governor may step them down on a slow device
  const [fxDown, setFxDown] = useState<FxLevel | null>(null);
  const settled = useRef(false);
  const [automated, setAutomated] = useState(false);
  const [labels, setLabels] = useState<LabelSpec[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hoverCursor, setHoverCursor] = useState(false);
  // antialiasing is fixed when the WebGL context is created: MSAA only where post-processing (SMAA) won't run
  const [antialias, setAntialias] = useState(false);
  const registry = useRef(new Map<string, HTMLElement>());
  const debugEl = useRef<HTMLDivElement>(null);
  const three = useRef<ThreeHandle | null>(null);
  const spots = useRef(new Map<string, Spot>());

  useEffect(() => {
    const gl = hasWebGL();
    setWebgl(gl);
    if (!gl) props.onFirstFrame?.();
    const rm = prefersReducedMotion();
    setReduced(rm);
    setAutomated(!!navigator.webdriver);
    const phone = window.matchMedia?.("(max-width: 720px) and (pointer: coarse), (max-width: 520px)").matches ?? false;
    const small = phone || (window.matchMedia?.("(pointer: coarse)").matches ?? false);
    setMobile(small);
    // phones get the mid world + the same post effects as a laptop (owner, 10/10/2026); the governor protects slow ones
    const auto: Tier = mode === "preview" || small ? "mid" : "high";
    setAutoTier(auto);
    setAntialias((props.quality ?? auto) === "low");
    setReady(true);
    const onVis = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "80px" });
    if (root.current) io.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const tier: Tier = props.quality ?? autoTier;
  // the sharpest worth drawing: the screen's own pixels, up to 2× on a laptop and 2.5× on a phone (3× phones look the
  // same at 2.5× for far less work)
  const maxDpr = mobile ? 2.5 : 2;
  const fxStart: FxLevel | null = tier === "high" ? "full" : tier === "mid" ? "lite" : null;
  const fx: FxLevel | null = fxStart && fxDown && order(fxDown) > order(fxStart) ? fxDown : fxStart;
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, maxDpr));
    // judge the frame rate only once the first-load work (shader compile, uploads) is over
    const t = window.setTimeout(() => setMonitor(true), 2000);
    return () => window.clearTimeout(t);
  }, [maxDpr]);
  // governor: under ~50 fps → a quarter step less resolution (never below 1×), then lighter post effects; a steady
  // 60 → a quarter step back up (to the screen's own sharpness). If it keeps going down and up again it stops going
  // up (the lower setting wins); it never stops going down, so a device that heats up later still stays smooth.
  const dprNow = useRef(dpr);
  dprNow.current = dpr;
  const lastWay = useRef<0 | 1 | -1>(0);
  const turns = useRef(0);
  const turn = (way: 1 | -1) => {
    if (lastWay.current === -way) turns.current++;
    lastWay.current = way;
  };
  const decline = useCallback((fps: number) => {
    const d = dprNow.current;
    if (d > 1) {
      turn(-1);
      // the drawing cost goes with the pixel count (dpr²): jump straight to about what reaches 60 fps
      const fit = Math.floor(d * Math.sqrt(Math.max(10, fps) / 58) * 4) / 4;
      setDpr(Math.max(1, Math.min(+(d - DPR_STEP).toFixed(2), fit)));
      return;
    }
    const down = fx ? FX_DOWN[fx] : null;
    if (down) {
      turn(-1);
      setFxDown(down);
    }
  }, [fx]);
  const incline = useCallback(() => {
    const top = Math.min(window.devicePixelRatio || 1, maxDpr);
    const d = dprNow.current;
    if (settled.current || d >= top) return;
    turn(1);
    if (turns.current >= 3) {
      settled.current = true;
      return;
    }
    setDpr(Math.min(top, +(d + DPR_STEP).toFixed(2)));
  }, [maxDpr]);
  const life = props.life ?? lifeState ?? !reduced;
  const hud = props.hud ?? mode === "hero";
  const active = onScreen && pageVisible;
  const fallbackLayout = useMemo(() => (webgl ? null : computeSiteLayout(plot, units)), [webgl, plot, units]);

  // click on empty space (not a drag) → deselect
  const down = useRef<{ x: number; y: number } | null>(null);
  const onSelectUnit = props.onSelectUnit;
  const missed = useCallback(
    (e: MouseEvent) => {
      const d = down.current;
      if (e.button === 2) return;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      onSelectUnit?.(null);
    },
    [onSelectUnit],
  );

  // live object → screen lookup for the HUD (anchoring inspect cards)
  const getObjectScreen = props.getObjectScreen;
  useEffect(() => {
    if (!getObjectScreen) return;
    const fn: ObjectScreenFn = (kind, unitId) => {
      const h = three.current;
      if (!h) return null;
      const spot = spots.current.get(spotKey(kind, unitId)) ?? (unitId ? null : [...spots.current.values()].find((x) => x.kind === kind));
      return spot ? projectToViewport(spot.anchor, h.camera, h.canvas) : null;
    };
    getObjectScreen(fn);
    return () => getObjectScreen(null);
  }, [getObjectScreen]);

  return (
    <div
      ref={root}
      className={`${s.root} ${props.wheelZoom === "always" ? "" : s.pageScroll} ${props.dimmed ? s.dimmed : ""} ${className ?? ""}`}
      style={hoverCursor ? { cursor: "pointer" } : undefined}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
        setZoomFocus(true);
      }}
      onPointerLeave={() => setZoomFocus(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!webgl && fallbackLayout && <SitePlanFallback layout={fallbackLayout} reason="this browser or device has WebGL turned off" />}
      {ready && webgl && (
        <SceneBoundary fallback={<SitePlanFallback layout={computeSiteLayout(plot, units)} reason="the graphics driver could not start it" />}>
          <Canvas
            className={`${s.canvas} ${s.fadeIn}`}
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={dpr}
            frameloop="never"
            camera={{ fov: FOV, near: 2, far: 6000, position: [-120, 140, 220] }}
            gl={{ antialias, powerPreference: "high-performance", stencil: false }}
            onPointerMissed={missed}
            // small moving people (tenants on the terrace) win over the big house hit boxes around them
            events={(store) => ({
              ...r3fEvents(store),
              filter: (items) => {
                const first = items.filter((i) => i.object.userData.pickFirst);
                return first.length ? [...first, ...items.filter((i) => !i.object.userData.pickFirst)] : items;
              },
            })}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
            }}
            aria-label="3D model of the plot and its units"
          >
            <SceneContents
              {...props}
              mode={mode}
              tier={tier}
              fx={fx}
              reduced={reduced}
              mobile={mobile}
              life={life}
              zoomEnabled={props.wheelZoom === "always" || zoomFocus}
              onLabels={setLabels}
              onWarnings={setWarnings}
              registry={registry}
              three={three}
              spots={spots}
              onCursor={setHoverCursor}
            />
            <Pacer active={active} />
            {props.onFirstFrame && <FirstFrames onDone={props.onFirstFrame} />}
            {props.debug && <DebugStats target={debugEl} tier={tier} fx={fx} />}
            {monitor && (props.governor ?? !automated) && <PerformanceMonitor bounds={() => [50, 57]} onDecline={(m) => decline(m.fps)} onIncline={incline} />}
          </Canvas>
        </SceneBoundary>
      )}
      {props.debug && <div ref={debugEl} className={s.debug} />}
      {ready && webgl && <OverlayLabels labels={labels} registry={registry} onBuild={props.onEmptySlotClick} />}
      {mode === "preview" && webgl && (warnings.length > 0 || ("usingDefaults" in plot && plot.usingDefaults)) && (
        <div className={s.warnings} role="status">
          {warnings.length ? warnings.map((w) => <div key={w}>{w}</div>) : <div>Drawn from the site-plan defaults — enter the plot sizes to make it exact.</div>}
        </div>
      )}
      {hud && webgl && (
        <div className={s.hud} style={props.insets ? { right: props.insets.right + 14, bottom: props.insets.bottom + 20 } : undefined}>
          <button type="button" className={s.hudBtn} aria-pressed={life} onClick={() => setLifeState(!life)} title="Life: people, animals, birds">
            Life {life ? "on" : "off"}
          </button>
        </div>
      )}
    </div>
  );
}

/** fps / draw calls / triangles, sampled twice a second (counts every pass of the frame). */
function DebugStats({ target, tier, fx }: { target: RefObject<HTMLDivElement | null>; tier: Tier; fx: FxLevel | null }) {
  const acc = useRef({ frames: 0, t: 0, calls: 0, tris: 0 });
  const state = useThree();
  useEffect(() => {
    // debug handle for automated checks (only with debug on)
    (window as unknown as { __estate?: unknown }).__estate = state;
  }, [state]);
  useFrame(({ gl }, dt) => {
    const a = acc.current;
    if (gl.info.autoReset) gl.info.autoReset = false;
    a.calls = gl.info.render.calls;
    a.tris = gl.info.render.triangles;
    gl.info.reset();
    a.frames++;
    a.t += dt;
    if (a.t >= 0.5 && target.current) {
      target.current.textContent = `${Math.round(a.frames / a.t)} fps · ${a.calls} calls · ${(a.tris / 1000).toFixed(0)}k tris · ${tier} · fx ${fx ?? "off"} · dpr ${gl.getPixelRatio()}`;
      target.current.dataset.calls = String(a.calls);
      a.frames = 0;
      a.t = 0;
    }
  }, -100);
  return null;
}

interface ContentsProps extends EstateSceneProps {
  mode: SceneMode;
  tier: Tier;
  fx: FxLevel | null;
  reduced: boolean;
  mobile: boolean;
  life: boolean;
  zoomEnabled: boolean;
  onLabels: (labels: LabelSpec[]) => void;
  onWarnings: (warnings: string[]) => void;
  registry: RefObject<Map<string, HTMLElement>>;
  three: RefObject<ThreeHandle | null>;
  spots: RefObject<Map<string, Spot>>;
  onCursor: (on: boolean) => void;
}

const OBJECT_HINT: Record<SceneObjectKind, string> = {
  unit: "Click for details · right-click for actions",
  mailbox: "Click to record rent",
  noticeboard: "Click him to see the to-dos",
  pole: "Click for consumer no. & pay link",
  tolet: "Click to start a lease",
  tenant: "Click for profile & call",
  taxstamp: "Click to see or mark tax paid",
  plot: "Click for plot dimensions",
  car: "Click to drive off (sign out)",
  photographer: "Click to see the photos",
};

function SceneContents({
  plot,
  units,
  mode,
  selectedUnitId = null,
  onSelectUnit,
  onEmptySlotClick,
  timeOfDay = "auto",
  showLabels = false,
  showDimensions = false,
  highlightField = null,
  tier,
  fx,
  reduced,
  mobile,
  life,
  zoomEnabled,
  intro,
  onLabels,
  onWarnings,
  registry,
  cameraView,
  insets,
  dimmed = false,
  hintObjects,
  onObjectClick,
  onObjectHover,
  tooltips: tooltipsProp,
  objectNotes,
  cues,
  three,
  spots,
  onCursor,
  debug,
}: ContentsProps) {
  const env = useRef(createEnv());
  // debug handle for automated checks (debug on only): read / jump the scene clock, e.g. to a passer-by's stop
  useEffect(() => {
    if (debug) (window as unknown as { __peEnv?: unknown }).__peEnv = env;
  }, [debug]);
  const tooltips = tooltipsProp ?? !onObjectHover;
  const { layout, target } = useAnimatedLayout(plot, units, !reduced);
  const warnSig = target.warnings.join("\n");
  useEffect(() => onWarnings(warnSig ? warnSig.split("\n") : []), [warnSig, onWarnings]);
  const world = useMemo(() => makeWorld(layout), [layout]);
  const interactive = mode !== "login";
  const camera = useThree((st) => st.camera);
  const canvas = useThree((st) => st.gl.domElement);
  useEffect(() => {
    three.current = { camera, canvas };
    return () => {
      three.current = null;
    };
  }, [camera, canvas, three]);

  // ── interaction API for every hotspot ──
  const [hovered, setHovered] = useState<Spot | null>(null);
  const [spotVersion, setSpotVersion] = useState(0);
  const screenOf = useCallback((sp: Spot) => projectToViewport(sp.anchor, camera, canvas) ?? undefined, [camera, canvas]);
  const cb = useRef({ onObjectClick, onObjectHover, onSelectUnit });
  cb.current = { onObjectClick, onObjectHover, onSelectUnit };
  const objects = interactive && (mode === "hero" || !!onObjectClick);
  // stable callbacks (hotspots register once; only `hovered` changes on hover)
  const fns = useMemo(
    () => ({
      setHover: (sp: Spot | null, key?: string) => setHovered((cur) => (sp ? (cur?.key === sp.key ? cur : sp) : cur && (!key || cur.key === key) ? null : cur)),
      activate: (sp: Spot) => {
        if (sp.kind === "unit" && sp.unitId) cb.current.onSelectUnit?.(sp.unitId);
        cb.current.onObjectClick?.({ kind: sp.kind, unitId: sp.unitId, screen: screenOf(sp) });
      },
      register: (sp: Spot) => {
        spots.current.set(sp.key, sp);
        setSpotVersion((v) => v + 1);
        return () => {
          if (spots.current.get(sp.key) === sp) spots.current.delete(sp.key);
          setSpotVersion((v) => v + 1);
          // only drop the hover when the spot is really gone, not when the same key registers again right after this
          // cleanup (useRegisterSpot re-registers only for a new key / kind / unit, never for movement)
          queueMicrotask(() => {
            if (!spots.current.has(sp.key)) setHovered((cur) => (cur?.key === sp.key ? null : cur));
          });
        };
      },
    }),
    [screenOf, spots],
  );
  // hero: the first frames (under the arrival cover) outline everything once, so the outline's shaders are ready
  const [warm, setWarm] = useState(mode === "hero");
  const api = useMemo<SceneApi>(() => ({ env, interactive, objects, hovered: hovered?.key ?? null, warm, ...fns }), [hovered, interactive, objects, warm, fns]);
  // hover → cursor + HUD callback (once per object, not per face the pointer crosses)
  const hoveredKey = hovered?.key ?? null;
  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;
  useEffect(() => {
    const h = hoveredRef.current;
    onCursor(!!h && interactive);
    cb.current.onObjectHover?.(h ? { kind: h.kind, unitId: h.unitId, screen: screenOf(h) } : null);
  }, [hoveredKey, interactive, onCursor, screenOf]);
  useEffect(() => () => onCursor(false), [onCursor]);

  const selectedSlot = layout.slots.find((x) => x.unit && x.unit.id === selectedUnitId)?.slot ?? null;
  const hot = new Set(highlightedSlots(layout, highlightField));
  const counts =
    tier === "high" ? { palms: 14, grass: 260, clouds: 14, flies: 70 } : tier === "mid" ? { palms: 11, grass: 150, clouds: 9, flies: 40 } : { palms: 9, grass: 70, clouds: 6, flies: 22 };
  const animate = !reduced;
  const occluders = useRef(new Set<THREE.Object3D>());
  const occluderFor = useMemo(() => {
    const last = new Map<string, THREE.Object3D>();
    return (key: string) => (o: THREE.Object3D | null) => {
      const prev = last.get(key);
      if (prev) occluders.current.delete(prev);
      if (o) {
        occluders.current.add(o);
        last.set(key, o);
      } else last.delete(key);
    };
  }, []);
  // each unit's own gate: the front unit's main gate at its stair foot (front wall), the back unit's gate in the
  // middle of the lane-side wall; the point just outside it carries the TO-LET board / the kolam (street-life.ts)
  const signAt = (sl: SlotName) => gateSign(layout, sl);

  // ── DOM labels: cards / tags / tooltips / hint markers / dimensions (anchors read every frame) ──
  const anchors = useRef(new Map<string, V3>());
  const legacyCards = !onObjectClick; // without an inspect card from the HUD, the selected unit keeps its card
  const hoveredUnit = hovered?.kind === "unit" ? hovered.unitId : null;
  const entries: { spec: LabelSpec; anchor: V3 }[] = [
    ...layout.slots.flatMap((slot) =>
      slotLabels(slot, world, {
        hovered: tooltips && !!slot.unit && hoveredUnit === slot.unit.id && !(slot.unit.id === selectedUnitId && !legacyCards),
        selected: legacyCards && selectedSlot === slot.slot,
        showLabel: showLabels,
        interactive,
        canBuild: !!onEmptySlotClick,
        meta: mode === "preview",
      }),
    ),
    ...dimensionLabels(layout, world, showDimensions, highlightField),
  ];
  if (tooltips && hovered && hovered.kind !== "unit") {
    const tip = objectTip(hovered, layout, objectNotes?.[hovered.kind] ?? null, cues);
    entries.push({ spec: { key: `tip:${hovered.key}`, kind: "tip", ...tip }, anchor: hovered.anchor });
  }
  if (hintObjects?.length && interactive) {
    void spotVersion;
    const seen = new Set<string>();
    let n = 0;
    for (const kind of hintObjects) {
      for (const sp of spots.current.values()) {
        if (sp.kind !== kind || seen.has(sp.key) || n >= 3) continue;
        seen.add(sp.key);
        n++;
        entries.push({ spec: { key: `hint:${sp.key}`, kind: "hint" }, anchor: [sp.anchor[0], sp.anchor[1] + (sp.kind === "unit" ? -1.5 : 0.6), sp.anchor[2]] });
      }
    }
  }
  anchors.current = new Map(entries.map((e) => [e.spec.key, e.anchor]));
  const specs = entries.map((e) => e.spec);
  const sig = JSON.stringify(specs);
  useEffect(() => {
    onLabels(JSON.parse(sig) as LabelSpec[]);
  }, [sig, onLabels]);

  const showFixtures = mode === "hero";
  const body = (
    <>
      <TileM layout={layout} world={world} />
      <PlotGroundM layout={layout} world={world} animate={animate} />
      <GroundShadeM layout={layout} world={world} />
      <GreeneryM layout={layout} world={world} grassCount={counts.grass} />
      <PalmsM layout={layout} world={world} env={env} animate={animate} count={counts.palms} />
      {mode !== "preview" && <GardenM layout={layout} world={world} env={env} animate={animate} />}
      <FixturesM layout={layout} world={world} env={env} cues={cues} lampLight={tier !== "low"} crows={life && animate && tier !== "low" && showFixtures} />
      {layout.slots.map((slot, i) => (
        <UnitSlot
          key={`${slot.slot}-${slot.unit?.id ?? "empty"}`}
          slot={slot}
          world={world}
          env={env}
          mode={mode}
          index={i}
          selected={selectedSlot === slot.slot}
          highlighted={hot.has(slot.slot)}
          interactive={interactive}
          reduced={reduced}
          life={life}
          rise={animate}
          onEmptyClick={onEmptySlotClick}
          signAt={signAt(slot.slot)}
          boardOnWall={false}
          occluder={occluderFor(slot.slot)}
        />
      ))}
      <Dimensions layout={layout} world={world} show={showDimensions} highlight={highlightField} reduced={reduced} />
      <LifeM layout={layout} world={world} env={env} enabled={life && animate} tier={tier} mobile={mobile} />
      <FirefliesM layout={layout} world={world} env={env} count={counts.flies} animate={animate} />
    </>
  );

  return (
    <SceneApiProvider value={api}>
      <EnvDriver env={env} timeOfDay={timeOfDay} instant={reduced} dimmed={dimmed} />
      <Backdrop env={env} insets={insets} />
      <CloudsM layout={layout} env={env} count={counts.clouds} animate={animate} />
      {/* sharper shadows (owner, 10/10/2026: ultra HD): 4096 on the desktop hero while it runs its full effects */}
      <Lights env={env} radius={layout.radius} shadowSize={tier === "high" && fx === "full" ? 4096 : tier === "low" ? 1024 : 2048} shadowRadius={tier === "high" && fx === "full" ? 5 : 4} shadows />
      {/* the tree shape stays the same across tiers / effect levels so stepping down never remounts the world */}
      <Selection enabled={!!fx && fx !== "aa"}>
        {fx && <Effects level={fx} preview={mode === "preview"} />}
        {body}
      </Selection>
      <CameraRig
        layout={layout}
        world={world}
        mode={mode}
        selectedSlot={selectedSlot}
        intro={intro ?? mode === "hero"}
        reduced={reduced}
        zoomEnabled={zoomEnabled}
        view={cameraView}
        insets={insets ?? NO_INSETS}
      />
      <LabelProjector anchors={anchors} registry={registry} occluders={occluders} />
      {warm && <AfterFrames n={2} onDone={() => setWarm(false)} />}
      <Precompile />
    </SceneApiProvider>
  );
}

/** Tooltip text for a world object (depth 1 of the inspect pattern: name + one line + next step). */
function objectTip(sp: Spot, layout: ReturnType<typeof computeSiteLayout>, note: string | null, cues?: WorldCues): { title: string; sub: string; note: string | null; hint: string | null; tone: Tone } {
  const info = SCENE_OBJECT_INFO[sp.kind];
  const slot = sp.unitId ? layout.slots.find((x) => x.unit?.id === sp.unitId) : undefined;
  const unitName = slot?.unit?.name ?? "";
  switch (sp.kind) {
    case "tolet": {
      if (slot?.status === "incoming") {
        const who = slot.unit?.tenantName;
        return { title: `Moving in ${dayMonth(slot.unit?.moveInDate)}`, sub: `${unitName}${who ? ` · ${who}` : ""}`, note, hint: "Click to see the lease", tone: "sky" };
      }
      return { title: `TO-LET · ${unitName}`, sub: slot?.unit?.vacantDays ? `Vacant ${slot.unit.vacantDays} days` : "Vacant", note, hint: OBJECT_HINT.tolet, tone: "sky" };
    }
    case "tenant":
      return { title: slot?.unit?.tenantName || "Tenant", sub: `Tenant · ${unitName}`, note, hint: OBJECT_HINT.tenant, tone: "teal" };
    case "plot": {
      const P = layout.plot;
      return {
        title: "Plot",
        sub: `${formatFeetInches(P.frontWidthFt)} × ${formatFeetInches(P.depthFt)} · ${formatIndianNumber(P.areaSqft)} sq ft`,
        note,
        hint: OBJECT_HINT.plot,
        tone: "marigold",
      };
    }
    case "taxstamp":
      return { title: "Property tax", sub: cues?.tax === "due" ? "This year's tax is due" : cues?.tax === "paid" ? "This year's tax is paid" : info.opens, note, hint: OBJECT_HINT.taxstamp, tone: cues?.tax === "due" ? "coral" : "marigold" };
    case "noticeboard":
      return { title: info.name, sub: cues?.todos !== undefined ? (cues.todos ? `${cues.todos} open to-do${cues.todos === 1 ? "" : "s"}` : "Nothing pending") : info.opens, note, hint: OBJECT_HINT.noticeboard, tone: "marigold" };
    case "mailbox":
      return { title: info.name, sub: info.opens, note, hint: OBJECT_HINT.mailbox, tone: "marigold" };
    case "pole":
      return { title: "EB meter", sub: info.opens, note, hint: OBJECT_HINT.pole, tone: "marigold" };
    default:
      return { title: info.name, sub: info.opens, note, hint: OBJECT_HINT[sp.kind], tone: "marigold" };
  }
}
