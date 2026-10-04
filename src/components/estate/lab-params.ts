// /lab query-param parsing (server + client). Kept out of the "use client" module so the page can call it.
import type { Tier } from "./Effects";
import type { TimeOfDay } from "./env";
import type { SceneMode } from "./UnitSlot";
import type { SlotName } from "@/lib/site-layout";
import type { SceneObjectKind } from "./types";

export type LabState = "paid" | "due-soon" | "overdue" | "vacant" | "incoming" | "inactive";
export const STATES: LabState[] = ["paid", "due-soon", "overdue", "vacant", "incoming", "inactive"];
/** HUD inset presets (px) for checking the camera framing */
export type InsetPreset = "none" | "hud" | "panel" | "dock" | "sheet";
export const INSET_PRESETS: InsetPreset[] = ["none", "hud", "panel", "dock", "sheet"];
export const HINT_KINDS: SceneObjectKind[] = ["unit", "mailbox", "noticeboard", "pole", "tolet", "tenant", "taxstamp", "plot"];
export const TIMES: TimeOfDay[] = ["auto", "dawn", "morning", "day", "afternoon", "evening", "dusk", "night"];
export const MODES: SceneMode[] = ["hero", "preview", "login"];
export const FIELDS = [
  "",
  "frontWidthFt",
  "backWidthFt",
  "depthFt",
  "areaSqft",
  "footprintWidthFt:front",
  "footprintDepthFt:front",
  "footprintWidthFt:back",
  "footprintDepthFt:back",
  "floors:front",
  "floors:back",
  "position",
];

export interface LabConfig {
  units: 0 | 1 | 2;
  aPos: SlotName;
  a: LabState;
  b: LabState;
  aFloors: number;
  bFloors: number;
  aw: number | null;
  ad: number | null;
  bw: number | null;
  bd: number | null;
  front: number;
  back: number;
  depth: number;
  time: TimeOfDay;
  mode: SceneMode;
  dims: boolean;
  labels: boolean;
  hl: string;
  life: boolean;
  quality: Tier | "auto";
  panel: boolean;
  intro: boolean;
  sel: "" | "a" | "b";
  /** camera override "theta,phi,fit" (lab only) */
  cam: string;
  debug: boolean;
  /** contract v2 */
  insets: InsetPreset;
  dimmed: boolean;
  hints: SceneObjectKind[];
  tips: boolean;
  todos: number;
  mail: boolean;
  tax: "" | "paid" | "due";
}

export const LAB_DEFAULTS: LabConfig = {
  units: 2,
  aPos: "front",
  a: "paid",
  b: "due-soon",
  aFloors: 1,
  bFloors: 1,
  aw: null,
  ad: null,
  bw: null,
  bd: null,
  front: 23.25,
  back: 22.25,
  depth: 76.66,
  time: "auto",
  mode: "hero",
  dims: false,
  labels: true,
  hl: "",
  life: true,
  quality: "auto",
  panel: true,
  intro: true,
  sel: "",
  cam: "",
  debug: false,
  insets: "none",
  dimmed: false,
  hints: [],
  tips: true,
  todos: 3,
  mail: false,
  tax: "",
};

/** Parse /lab query params (server or client). */
export function parseLabParams(sp: Record<string, string | string[] | undefined>): LabConfig {
  const g = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const num = (k: string, d: number | null, lo: number, hi: number) => {
    const v = g(k);
    if (v === undefined || v === "") return d;
    const n = Number(v);
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const pick = <T extends string>(k: string, list: readonly T[], d: T) => (list.includes(g(k) as T) ? (g(k) as T) : d);
  const flag = (k: string, d: boolean) => (g(k) === undefined ? d : g(k) === "1" || g(k) === "true");
  const D = LAB_DEFAULTS;
  return {
    units: pick("units", ["0", "1", "2"] as const, String(D.units) as "2") === "0" ? 0 : g("units") === "1" ? 1 : 2,
    aPos: pick("apos", ["front", "back"] as const, D.aPos),
    a: pick("state", STATES, D.a),
    b: pick("state2", STATES, D.b),
    aFloors: num("fa", D.aFloors, 1, 6)!,
    bFloors: num("fb", D.bFloors, 1, 6)!,
    aw: num("aw", null, 4, 60),
    ad: num("ad", null, 4, 80),
    bw: num("bw", null, 4, 60),
    bd: num("bd", null, 4, 80),
    front: num("front", D.front, 8, 80)!,
    back: num("back", D.back, 8, 80)!,
    depth: num("depth", D.depth, 20, 200)!,
    time: pick("time", TIMES, D.time),
    mode: pick("mode", MODES, D.mode),
    dims: flag("dims", D.dims),
    labels: flag("labels", D.labels),
    hl: FIELDS.includes(g("hl") ?? "") ? (g("hl") ?? "") : D.hl,
    life: flag("life", D.life),
    quality: pick("q", ["auto", "high", "mid", "low"] as const, D.quality),
    panel: flag("panel", D.panel),
    intro: flag("intro", D.intro),
    sel: pick("sel", ["", "a", "b"] as const, D.sel),
    debug: flag("debug", D.debug),
    cam: /^-?[\d.]+(,-?[\d.]+){0,2}$/.test(g("cam") ?? "") ? (g("cam") as string) : D.cam,
    insets: pick("insets", INSET_PRESETS, D.insets),
    dimmed: flag("dim", D.dimmed),
    hints: (g("hints") ?? "").split(",").filter((k): k is SceneObjectKind => HINT_KINDS.includes(k as SceneObjectKind)),
    tips: flag("tips", D.tips),
    todos: num("todos", D.todos, 0, 9)!,
    mail: flag("mail", D.mail),
    tax: pick("tax", ["", "paid", "due"] as const, D.tax),
  };
}

export function toParams(c: LabConfig): string {
  const D = LAB_DEFAULTS;
  const p = new URLSearchParams();
  const put = (k: string, v: unknown, d: unknown) => v !== d && v !== null && p.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  put("units", c.units, D.units);
  put("apos", c.aPos, D.aPos);
  put("state", c.a, D.a);
  put("state2", c.b, D.b);
  put("fa", c.aFloors, D.aFloors);
  put("fb", c.bFloors, D.bFloors);
  put("aw", c.aw, null);
  put("ad", c.ad, null);
  put("bw", c.bw, null);
  put("bd", c.bd, null);
  put("front", c.front, D.front);
  put("back", c.back, D.back);
  put("depth", c.depth, D.depth);
  put("time", c.time, D.time);
  put("mode", c.mode, D.mode);
  put("dims", c.dims, D.dims);
  put("labels", c.labels, D.labels);
  put("hl", c.hl, D.hl);
  put("life", c.life, D.life);
  put("q", c.quality, D.quality);
  put("panel", c.panel, D.panel);
  put("intro", c.intro, D.intro);
  put("cam", c.cam, D.cam);
  put("debug", c.debug, D.debug);
  put("sel", c.sel, D.sel);
  put("insets", c.insets, D.insets);
  put("dim", c.dimmed, D.dimmed);
  put("hints", c.hints.join(","), "");
  put("tips", c.tips, D.tips);
  put("todos", c.todos, D.todos);
  put("mail", c.mail, D.mail);
  put("tax", c.tax, D.tax);
  return p.toString();
}

