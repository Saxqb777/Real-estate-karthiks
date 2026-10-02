"use client";
// The interactive 3D estate diorama — the centrepiece. Driven entirely by data:
// plot widths/depth, each unit's footprint, position, floors, occupancy and rent state map onto the model.
// Import it through EstateSceneLazy (next/dynamic, ssr: false) so three.js never runs on the server.
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Selection } from "@react-three/postprocessing";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { PlotGeometry } from "@/lib/dashboard-types";
import { computeSiteLayout, highlightedSlots, type SceneUnit, type SlotName } from "@/lib/site-layout";
import { EnvDriver, Lights, SkyDome } from "./Atmosphere";
import { CameraRig, FOV } from "./CameraRig";
import { Dimensions, dimensionLabels } from "./Dimensions";
import { Effects, type Tier } from "./Effects";
import { createEnv, type TimeOfDay } from "./env";
import { Milestone, PoleAndLamp, Puddle, Street, Tile } from "./Island";
import { LabelProjector, OverlayLabels, type LabelSpec, type V3 } from "./Overlay";
import { Life } from "./Life";
import { PlotGround } from "./PlotGround";
import { SitePlanFallback } from "./SitePlanFallback";
import { UnitSlot, slotLabels, type SceneMode } from "./UnitSlot";
import { useAnimatedLayout } from "./useAnimatedLayout";
import { Clouds, Fireflies } from "./SkyLife";
import { Greenery, Palms } from "./Vegetation";
import { makeWorld, prefersReducedMotion } from "./util";
import s from "./estate.module.css";

export type { SceneMode } from "./UnitSlot";
export type { TimeOfDay } from "./env";

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
  /** Street life (traffic, people, animals, birds). Uncontrolled by default with a toggle in the scene HUD. */
  life?: boolean;
  /** Force a quality tier (default: auto — high on desktop hero, mid on phones / preview, steps down if slow). */
  quality?: Tier;
  /** Show the small in-scene HUD (Life toggle). Default: hero only. */
  hud?: boolean;
  /** Mouse-wheel zoom: "focus" (after clicking into the scene — keeps page scroll working) or "always". */
  wheelZoom?: "focus" | "always";
  /** Hero fly-in on first load (default true in hero mode). */
  intro?: boolean;
  /** Override the default camera angle: theta (azimuth, rad, 0 = straight from the street), phi (from vertical), fit (zoom). */
  cameraView?: { theta?: number; phi?: number; fit?: number };
  /** Show fps / draw calls / triangles (for performance checks). */
  debug?: boolean;
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
  const [labels, setLabels] = useState<LabelSpec[]>([]);
  const registry = useRef(new Map<string, HTMLElement>());
  const debugEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWebgl(hasWebGL());
    const rm = prefersReducedMotion();
    setReduced(rm);
    const small = window.matchMedia?.("(max-width: 720px), (pointer: coarse)").matches ?? false;
    setMobile(small);
    setAutoTier(mode === "preview" || small ? "mid" : "high");
    setReady(true);
    const onVis = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "80px" });
    if (root.current) io.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, [mode]);

  const tier: Tier = props.quality ?? autoTier;
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
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      onSelectUnit?.(null);
    },
    [onSelectUnit],
  );

  return (
    <div
      ref={root}
      className={`${s.root} ${className ?? ""}`}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
        setZoomFocus(true);
      }}
      onPointerLeave={() => setZoomFocus(false)}
    >
      {!webgl && fallbackLayout && <SitePlanFallback layout={fallbackLayout} reason="this browser or device has WebGL turned off" />}
      {ready && webgl && (
        <SceneBoundary fallback={<SitePlanFallback layout={computeSiteLayout(plot, units)} reason="the graphics driver could not start it" />}>
          <Canvas
            className={`${s.canvas} ${s.fadeIn}`}
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={tier === "high" ? [1, 2] : tier === "mid" ? [1, 1.5] : 1}
            frameloop={active ? "always" : "never"}
            camera={{ fov: FOV, near: 2, far: 6000, position: [-120, 140, 220] }}
            gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
            onPointerMissed={missed}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
            }}
            aria-label="3D model of the plot and its units"
          >
            <SceneContents
              {...props}
              mode={mode}
              tier={tier}
              reduced={reduced}
              mobile={mobile}
              life={life}
              zoomEnabled={props.wheelZoom === "always" || zoomFocus}
              onLabels={setLabels}
              registry={registry}
            />
            {props.debug && <DebugStats target={debugEl} tier={tier} />}
            {!props.quality && tier !== "low" && (
              <PerformanceMonitor flipflops={1} onDecline={() => setAutoTier((t) => (t === "high" ? "mid" : "low"))} />
            )}
          </Canvas>
        </SceneBoundary>
      )}
      {props.debug && <div ref={debugEl} className={s.debug} />}
      {ready && webgl && <OverlayLabels labels={labels} registry={registry} onBuild={props.onEmptySlotClick} />}
      {hud && webgl && (
        <div className={s.hud}>
          <button type="button" className={s.hudBtn} aria-pressed={life} onClick={() => setLifeState(!life)} title="Street life: traffic, people, animals, birds">
            Life {life ? "on" : "off"}
          </button>
        </div>
      )}
    </div>
  );
}

/** fps / draw calls / triangles, sampled twice a second (counts every pass of the frame). */
function DebugStats({ target, tier }: { target: RefObject<HTMLDivElement | null>; tier: Tier }) {
  const acc = useRef({ frames: 0, t: 0, calls: 0, tris: 0 });
  useFrame(({ gl }, dt) => {
    const a = acc.current;
    if (gl.info.autoReset) gl.info.autoReset = false;
    a.calls = gl.info.render.calls;
    a.tris = gl.info.render.triangles;
    gl.info.reset();
    a.frames++;
    a.t += dt;
    if (a.t >= 0.5 && target.current) {
      target.current.textContent = `${Math.round(a.frames / a.t)} fps · ${a.calls} calls · ${(a.tris / 1000).toFixed(0)}k tris · ${tier} · dpr ${gl.getPixelRatio()}`;
      a.frames = 0;
      a.t = 0;
    }
  }, -100);
  return null;
}

interface ContentsProps extends EstateSceneProps {
  mode: SceneMode;
  tier: Tier;
  reduced: boolean;
  mobile: boolean;
  life: boolean;
  zoomEnabled: boolean;
  onLabels: (labels: LabelSpec[]) => void;
  registry: RefObject<Map<string, HTMLElement>>;
}

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
  reduced,
  mobile,
  life,
  zoomEnabled,
  intro,
  onLabels,
  registry,
  cameraView,
}: ContentsProps) {
  const env = useRef(createEnv());
  const { layout } = useAnimatedLayout(plot, units, !reduced);
  const world = useMemo(() => makeWorld(layout), [layout]);
  const [hovered, setHovered] = useState<SlotName | null>(null);
  const interactive = mode !== "login";

  useEffect(() => {
    document.body.style.cursor = hovered && interactive ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, interactive]);

  const selectedSlot = layout.slots.find((x) => x.unit && x.unit.id === selectedUnitId)?.slot ?? null;
  const hot = new Set(highlightedSlots(layout, highlightField));
  const counts = tier === "high" ? { palms: 14, grass: 260, clouds: 12, flies: 70 } : tier === "mid" ? { palms: 11, grass: 150, clouds: 8, flies: 40 } : { palms: 8, grass: 70, clouds: 5, flies: 20 };
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
  const gate = layout.compoundWalls.find((w) => w.gate === "passage" || w.gate === "main");
  const porchGate = layout.compoundWalls.find((w) => w.gate === "porch");
  const signAt = (s: SlotName) => {
    const g = s === "front" ? (porchGate ?? gate) : (gate ?? porchGate);
    return g ? { x: (g.a.x + g.b.x) / 2, z: -2.6 } : undefined;
  };

  // labels: specs go to the DOM overlay only when their content changes; anchors are read every frame
  const anchors = useRef(new Map<string, V3>());
  const entries = [
    ...layout.slots.flatMap((slot) =>
      slotLabels(slot, world, {
        hovered: hovered === slot.slot,
        selected: selectedSlot === slot.slot,
        showLabel: showLabels,
        interactive,
        canBuild: !!onEmptySlotClick,
      }),
    ),
    ...dimensionLabels(layout, world, showDimensions, highlightField),
  ];
  anchors.current = new Map(entries.map((e) => [e.spec.key, e.anchor]));
  const specs = entries.map((e) => e.spec);
  const sig = JSON.stringify(specs);
  useEffect(() => {
    onLabels(JSON.parse(sig) as LabelSpec[]);
  }, [sig, onLabels]);

  const body = (
    <>
      <Tile layout={layout} world={world} />
      <Street layout={layout} world={world} />
      <PoleAndLamp layout={layout} world={world} env={env} lampLight={tier !== "low"} />
      <Milestone layout={layout} world={world} />
      <Puddle layout={layout} world={world} env={env} />
      <PlotGround layout={layout} world={world} />
      <Greenery layout={layout} world={world} grassCount={counts.grass} />
      <Palms layout={layout} world={world} animate={animate} count={counts.palms} />
      {layout.slots.map((slot, i) => (
        <UnitSlot
          key={`${slot.slot}-${slot.unit?.id ?? "empty"}`}
          slot={slot}
          world={world}
          env={env}
          mode={mode}
          index={i}
          selected={selectedSlot === slot.slot}
          hovered={hovered === slot.slot}
          highlighted={hot.has(slot.slot)}
          interactive={interactive}
          reduced={reduced}
          life={life && animate}
          rise={animate}
          onHover={setHovered}
          onSelect={onSelectUnit}
          onEmptyClick={onEmptySlotClick}
          signAt={signAt(slot.slot)}
          occluder={occluderFor(slot.slot)}
        />
      ))}
      <Dimensions layout={layout} world={world} show={showDimensions} highlight={highlightField} reduced={reduced} />
      <Life layout={layout} world={world} env={env} enabled={life && animate} tier={tier} mobile={mobile} />
      <Clouds layout={layout} env={env} count={counts.clouds} animate={animate} />
      <Fireflies layout={layout} world={world} env={env} count={counts.flies} animate={animate} />
    </>
  );

  return (
    <>
      <EnvDriver env={env} timeOfDay={timeOfDay} instant={reduced} />
      <SkyDome env={env} />
      <Lights env={env} radius={layout.radius} shadowSize={tier === "high" ? 2048 : 1024} shadows />
      {tier === "low" ? (
        body
      ) : (
        <Selection>
          <Effects tier={tier} preview={mode === "preview"} />
          {body}
        </Selection>
      )}
      <CameraRig layout={layout} world={world} mode={mode} selectedSlot={selectedSlot} intro={intro ?? mode === "hero"} reduced={reduced} zoomEnabled={zoomEnabled} view={cameraView} />
      <LabelProjector anchors={anchors} registry={registry} occluders={occluders} />
    </>
  );
}
