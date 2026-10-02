"use client";
// /lab — visual sandbox for the 3D estate scene: every state switchable from a panel or from the URL, e.g.
//   /lab?units=2&state=overdue&state2=vacant&time=night&dims=1&hl=frontWidthFt&panel=0
//   /lab?insets=panel&dim=1&hints=mailbox,noticeboard,pole   (SCENE CONTRACT v2 props)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trapezoidArea } from "@/lib/calculations";
import type { PlotGeometry, RentState, UnitStatus } from "@/lib/dashboard-types";
import type { SceneUnit, SlotName } from "@/lib/site-layout";
import EstateSceneLazy from "./EstateSceneLazy";
import { FIELDS, HINT_KINDS, INSET_PRESETS, LAB_DEFAULTS, MODES, STATES, TIMES, toParams, type InsetPreset, type LabConfig, type LabState } from "./lab-params";
import { SCENE_OBJECT_INFO, type ObjectScreenFn, type SceneInsets, type SceneObjectKind, type ScreenPoint } from "./types";
import s from "./lab.module.css";

function unitFor(id: string, name: string, state: LabState, position: SlotName | null, floors: number, w: number | null, d: number | null, tenant: string, rent: number): SceneUnit {
  const status: UnitStatus = state === "vacant" ? "vacant" : state === "incoming" ? "incoming" : state === "inactive" ? "inactive" : "occupied";
  const rentState: RentState = status !== "occupied" ? "none" : (state as RentState);
  const named = status === "occupied" || status === "incoming";
  return {
    id,
    name,
    position,
    floors,
    footprintWidthFt: w,
    footprintDepthFt: d,
    status,
    rentState,
    tenantName: named ? tenant : null,
    monthlyRent: named ? rent : null,
    isActive: state !== "inactive",
    daysOverdue: state === "overdue" ? 9 : 0,
    vacantDays: state === "vacant" || state === "incoming" ? 42 : 0,
    ...(status === "incoming" && { moveInDate: "2026-11-01T00:00:00.000Z" }),
  };
}

function Seg<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: readonly T[]; onPick: (v: T) => void }) {
  return (
    <div className={s.row}>
      <span className={s.label}>{label}</span>
      <div className={s.seg}>
        {options.map((o) => (
          <button key={String(o)} type="button" className={o === value ? s.on : ""} onClick={() => onPick(o)}>
            {String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onPick, unit = "ft" }: { label: string; value: number | null; min: number; max: number; step: number; onPick: (v: number | null) => void; unit?: string }) {
  return (
    <label className={s.row}>
      <span className={s.label}>
        {label} <b>{value === null ? "default" : `${value} ${unit}`}</b>
      </span>
      <span className={s.sliderRow}>
        <input type="range" min={min} max={max} step={step} value={value ?? (min + max) / 2} onChange={(e) => onPick(Number(e.target.value))} />
        {value !== null && unit === "ft" && (
          <button type="button" className={s.mini} onClick={() => onPick(null)} title="Use default">
            ×
          </button>
        )}
      </span>
    </label>
  );
}

/** HUD-like insets for a preset at the current window size (px). */
function presetInsets(p: InsetPreset, w: number, h: number): SceneInsets {
  const mobile = w < 720;
  switch (p) {
    case "hud":
      return mobile ? { top: 52, right: 0, bottom: Math.round(h * 0.45), left: 0 } : { top: 56, right: 0, bottom: 48, left: 340 };
    case "panel":
      return mobile ? { top: 52, right: 0, bottom: Math.round(h * 0.55), left: 0 } : { top: 56, right: 380, bottom: 48, left: 0 };
    case "dock":
      return { top: 56, right: 0, bottom: mobile ? Math.round(h * 0.5) : 300, left: 0 };
    case "sheet":
      return { top: 52, right: 0, bottom: Math.round(h * 0.45), left: 0 };
    default:
      return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

export default function EstateLab({ initial }: { initial: LabConfig }) {
  const [c, setC] = useState<LabConfig>(initial);
  const [log, setLog] = useState<string[]>([]);
  const [mark, setMark] = useState<(ScreenPoint & { label: string }) | null>(null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const lookup = useRef<ObjectScreenFn | null>(null);
  const set = <K extends keyof LabConfig>(k: K, v: LabConfig[K]) => setC((p) => ({ ...p, [k]: v }));
  const note = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString("en-IN", { hour12: false })} · ${m}`, ...l].slice(0, 8));

  useEffect(() => {
    const q = toParams(c);
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [c]);
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const plot = useMemo<PlotGeometry>(
    () => ({
      frontWidthFt: c.front,
      backWidthFt: c.back,
      depthFt: c.depth,
      areaSqft: trapezoidArea(c.front, c.back, c.depth),
      townName: "Pattukottai",
      sitePlanImageUrl: null,
      usingDefaults: false,
    }),
    [c.front, c.back, c.depth],
  );
  const units = useMemo<SceneUnit[]>(() => {
    const list: SceneUnit[] = [];
    if (c.units >= 1) list.push(unitFor("unit-a", "Unit A", c.a, c.units === 1 ? c.aPos : "front", c.aFloors, c.aw, c.ad, "Murugan K.", 12000));
    if (c.units === 2) list.push(unitFor("unit-b", "Unit B", c.b, "back", c.bFloors, c.bw, c.bd, "Lakshmi S.", 11500));
    return list;
  }, [c]);
  const selectedUnitId = c.sel === "a" ? "unit-a" : c.sel === "b" ? "unit-b" : null;
  const cameraView = useMemo(() => {
    if (!c.cam) return undefined;
    const [theta, phi, fit] = c.cam.split(",").map(Number);
    return { theta, phi: isFinite(phi) ? phi : undefined, fit: isFinite(fit) ? fit : undefined };
  }, [c.cam]);
  // the lab panel itself covers the right edge on desktop: count it as HUD so the framing stays honest
  const insets = useMemo(() => {
    const base = presetInsets(c.insets, vp.w, vp.h);
    if (c.panel && vp.w >= 720) base.right += 324;
    return base;
  }, [c.insets, c.panel, vp.w, vp.h]);
  const cues = useMemo(() => ({ todos: c.todos, mail: c.mail, tax: c.tax || undefined }), [c.todos, c.mail, c.tax]);
  const getObjectScreen = useCallback((fn: ObjectScreenFn | null) => {
    lookup.current = fn;
    (window as unknown as { __objectScreen?: ObjectScreenFn | null }).__objectScreen = fn; // for automated checks
  }, []);
  const locate = (kind: SceneObjectKind) => {
    const p = lookup.current?.(kind) ?? null;
    note(`locate ${kind} → ${p ? `${p.x}, ${p.y}` : "not in the world"}`);
    setMark(p ? { ...p, label: kind } : null);
  };
  const toggleHint = (k: SceneObjectKind) => set("hints", c.hints.includes(k) ? c.hints.filter((x) => x !== k) : [...c.hints, k]);

  return (
    <div className={s.lab}>
      <EstateSceneLazy
        className={s.scene}
        plot={plot}
        units={units}
        mode={c.mode}
        timeOfDay={c.time}
        showLabels={c.labels}
        showDimensions={c.dims}
        highlightField={c.hl || null}
        selectedUnitId={selectedUnitId}
        onSelectUnit={(id) => {
          set("sel", id === "unit-a" ? "a" : id === "unit-b" ? "b" : "");
          if (!id) note("deselect (click on empty ground)");
        }}
        onEmptySlotClick={(slot) => note(`build unit → ${slot} slot`)}
        onObjectClick={(o) => {
          note(`click ${o.kind}${o.unitId ? ` ${o.unitId}` : ""} @ ${o.screen ? `${o.screen.x}, ${o.screen.y}` : "?"}`);
          setMark(o.screen ? { ...o.screen, label: o.kind } : null);
        }}
        onObjectHover={(o) => o && note(`hover ${o.kind}${o.unitId ? ` ${o.unitId}` : ""}`)}
        onUnitContextMenu={(id, at) => {
          note(`radial menu ${id} @ ${at.x}, ${at.y}`);
          setMark({ ...at, label: "menu" });
        }}
        insets={insets}
        dimmed={c.dimmed}
        hintObjects={c.hints}
        getObjectScreen={getObjectScreen}
        tooltips={c.tips}
        cues={cues}
        life={c.life}
        quality={c.quality === "auto" ? undefined : c.quality}
        hud
        wheelZoom="always"
        intro={c.intro}
        cameraView={cameraView}
        debug={c.debug}
        key={`${c.mode}-${c.quality}`}
      />
      {/* free area the camera frames into (dashed) + the last reported screen point */}
      {c.insets !== "none" && (
        <div className={s.free} style={{ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }} aria-hidden>
          <span>free area</span>
        </div>
      )}
      {mark && (
        <div className={s.mark} style={{ left: mark.x, top: mark.y }} aria-hidden>
          <span>{mark.label}</span>
        </div>
      )}
      {c.panel ? (
        <aside className={s.panel}>
          <header className={s.head}>
            <span>Scene lab</span>
            <button type="button" className={s.mini} onClick={() => set("panel", false)} title="Hide panel">
              ⟩
            </button>
          </header>
          <Seg label="Mode" value={c.mode} options={MODES} onPick={(v) => set("mode", v)} />
          <Seg label="Units" value={c.units} options={[0, 1, 2] as const} onPick={(v) => set("units", v)} />
          {c.units === 1 && <Seg label="Unit A slot" value={c.aPos} options={["front", "back"] as const} onPick={(v) => set("aPos", v)} />}
          {c.units >= 1 && <Seg label="Unit A" value={c.a} options={STATES} onPick={(v) => set("a", v)} />}
          {c.units === 2 && <Seg label="Unit B" value={c.b} options={STATES} onPick={(v) => set("b", v)} />}
          <Seg label="Time" value={c.time} options={TIMES} onPick={(v) => set("time", v)} />
          <div className={s.toggles}>
            {(["dims", "labels", "life", "intro", "tips"] as const).map((k) => (
              <button key={k} type="button" className={c[k] ? s.on : ""} onClick={() => set(k, !c[k])}>
                {k === "dims" ? "Dimensions" : k === "labels" ? "Labels" : k === "life" ? "Life" : k === "intro" ? "Intro" : "Tooltips"}
              </button>
            ))}
          </div>

          <div className={s.group}>HUD (contract v2)</div>
          <Seg label="Insets" value={c.insets} options={INSET_PRESETS} onPick={(v) => set("insets", v)} />
          <div className={s.toggles}>
            <button type="button" className={c.dimmed ? s.on : ""} onClick={() => set("dimmed", !c.dimmed)}>
              Dimmed
            </button>
            <button type="button" className={c.mail ? s.on : ""} onClick={() => set("mail", !c.mail)}>
              Mail
            </button>
          </div>
          <Seg label="Tax stamp" value={c.tax || "plain"} options={["plain", "paid", "due"] as const} onPick={(v) => set("tax", v === "plain" ? "" : v)} />
          <Slider label="To-dos on board" value={c.todos} min={0} max={6} step={1} unit="" onPick={(v) => set("todos", v ?? 3)} />
          <div className={s.row}>
            <span className={s.label}>Unexplored hints (max 3 shown)</span>
            <div className={s.seg}>
              {HINT_KINDS.map((k) => (
                <button key={k} type="button" className={c.hints.includes(k) ? s.on : ""} onClick={() => toggleHint(k)} title={SCENE_OBJECT_INFO[k].opens}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className={s.row}>
            <span className={s.label}>getObjectScreen</span>
            <div className={s.seg}>
              {HINT_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => locate(k)}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <label className={s.row}>
            <span className={s.label}>Highlight field</span>
            <select value={c.hl} onChange={(e) => set("hl", e.target.value)}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f || "— none —"}
                </option>
              ))}
            </select>
          </label>
          <Seg label="Quality" value={c.quality} options={["auto", "high", "mid", "low"] as const} onPick={(v) => set("quality", v)} />
          <div className={s.group}>Plot</div>
          <Slider label="Front width" value={c.front} min={12} max={40} step={0.25} onPick={(v) => set("front", v ?? LAB_DEFAULTS.front)} />
          <Slider label="Back width" value={c.back} min={12} max={40} step={0.25} onPick={(v) => set("back", v ?? LAB_DEFAULTS.back)} />
          <Slider label="Depth" value={c.depth} min={30} max={120} step={0.5} onPick={(v) => set("depth", v ?? LAB_DEFAULTS.depth)} />
          {c.units >= 1 && (
            <>
              <div className={s.group}>Unit A</div>
              <Slider label="Floors" value={c.aFloors} min={1} max={4} step={1} unit="" onPick={(v) => set("aFloors", v ?? 2)} />
              <Slider label="Footprint W" value={c.aw} min={8} max={30} step={0.5} onPick={(v) => set("aw", v)} />
              <Slider label="Footprint D" value={c.ad} min={10} max={50} step={0.5} onPick={(v) => set("ad", v)} />
            </>
          )}
          {c.units === 2 && (
            <>
              <div className={s.group}>Unit B</div>
              <Slider label="Floors" value={c.bFloors} min={1} max={4} step={1} unit="" onPick={(v) => set("bFloors", v ?? 2)} />
              <Slider label="Footprint W" value={c.bw} min={8} max={30} step={0.5} onPick={(v) => set("bw", v)} />
              <Slider label="Footprint D" value={c.bd} min={10} max={50} step={0.5} onPick={(v) => set("bd", v)} />
            </>
          )}
          <div className={s.group}>Events</div>
          <ol className={s.log}>{log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li className={s.faint}>Hover / click / right-click a house, the mailbox, the notice board…</li>}</ol>
        </aside>
      ) : (
        <button type="button" className={s.reopen} onClick={() => set("panel", true)}>
          Lab ⟨
        </button>
      )}
    </div>
  );
}
