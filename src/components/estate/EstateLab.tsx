"use client";
// /lab — visual sandbox for the 3D estate scene: every state switchable from a panel or from the URL, e.g.
//   /lab?units=2&state=overdue&state2=vacant&time=night&dims=1&hl=frontWidthFt&panel=0
import { useEffect, useMemo, useState } from "react";
import { trapezoidArea } from "@/lib/calculations";
import type { PlotGeometry, RentState, UnitStatus } from "@/lib/dashboard-types";
import type { SceneUnit, SlotName } from "@/lib/site-layout";
import EstateSceneLazy from "./EstateSceneLazy";
import { FIELDS, LAB_DEFAULTS, MODES, STATES, TIMES, toParams, type LabConfig, type LabState } from "./lab-params";
import s from "./lab.module.css";

function unitFor(id: string, name: string, state: LabState, position: SlotName | null, floors: number, w: number | null, d: number | null, tenant: string, rent: number): SceneUnit {
  const status: UnitStatus = state === "vacant" ? "vacant" : state === "inactive" ? "inactive" : "occupied";
  const rentState: RentState = status !== "occupied" ? "none" : (state as RentState);
  return {
    id,
    name,
    position,
    floors,
    footprintWidthFt: w,
    footprintDepthFt: d,
    status,
    rentState,
    tenantName: status === "occupied" ? tenant : null,
    monthlyRent: status === "occupied" ? rent : null,
    isActive: state !== "inactive",
    daysOverdue: state === "overdue" ? 9 : 0,
    vacantDays: state === "vacant" ? 42 : 0,
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

export default function EstateLab({ initial }: { initial: LabConfig }) {
  const [c, setC] = useState<LabConfig>(initial);
  const [log, setLog] = useState<string[]>([]);
  const set = <K extends keyof LabConfig>(k: K, v: LabConfig[K]) => setC((p) => ({ ...p, [k]: v }));
  const note = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString("en-IN")} · ${m}`, ...l].slice(0, 6));

  useEffect(() => {
    const q = toParams(c);
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [c]);

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
          note(id ? `select ${id}` : "deselect");
        }}
        onEmptySlotClick={(slot) => note(`build unit → ${slot} slot`)}
        life={c.life}
        quality={c.quality === "auto" ? undefined : c.quality}
        hud
        wheelZoom="always"
        intro={c.intro}
        cameraView={cameraView}
        key={`${c.mode}-${c.quality}`}
      />
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
            {(["dims", "labels", "life", "intro"] as const).map((k) => (
              <button key={k} type="button" className={c[k] ? s.on : ""} onClick={() => set(k, !c[k])}>
                {k === "dims" ? "Dimensions" : k === "labels" ? "Labels" : k === "life" ? "Life" : "Intro"}
              </button>
            ))}
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
          <ol className={s.log}>{log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li className={s.faint}>Click a unit or an empty slot</li>}</ol>
        </aside>
      ) : (
        <button type="button" className={s.reopen} onClick={() => set("panel", true)}>
          Lab ⟨
        </button>
      )}
    </div>
  );
}
