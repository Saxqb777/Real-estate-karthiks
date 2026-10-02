"use client";
// Small per-browser stores for the HUD (all localStorage access is wrapped — private windows just don't remember):
//   usePeriod()     All time · Year · Month (the global period control)
//   usePinned(id)   📌 panels that stay open
//   useExplored()   "unexplored" marigold dots (max 3 at once)
//   useEscape()     one Esc stack so Esc always steps back exactly one depth (card → drill level → panel)
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { isFocusTrapActive } from "@/components/ui";
import type { PeriodKind } from "./types";

// ---------------------------------------------------------------- localStorage store

const EVENT = "pe:hud-store";

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
const memory = new Map<string, string | null>();
function writeKey(key: string, value: string | null) {
  memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode: keep it for this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}
function subscribeKey(key: string, cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === key && cb();
  const onLocal = (e: Event) => (e as CustomEvent<string>).detail === key && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onLocal);
  };
}
const getKey = (key: string) => (memory.has(key) ? (memory.get(key) ?? null) : readKey(key));

/** A string value remembered per browser (null until set). */
function useStored(key: string): [string | null, (v: string | null) => void] {
  const sub = useCallback((cb: () => void) => subscribeKey(key, cb), [key]);
  const value = useSyncExternalStore(sub, () => getKey(key), () => null);
  const set = useCallback((v: string | null) => writeKey(key, v), [key]);
  return [value, set];
}

// ---------------------------------------------------------------- period

export const PERIOD_KEY = "pe.period";
const PERIODS: PeriodKind[] = ["allTime", "year", "month"];

/** [period, setPeriod] — the HUD's All time · Year · Month choice (default Year), remembered per browser. */
export function usePeriod(fallback: PeriodKind = "year"): [PeriodKind, (p: PeriodKind) => void] {
  const [raw, set] = useStored(PERIOD_KEY);
  const period = PERIODS.includes(raw as PeriodKind) ? (raw as PeriodKind) : fallback;
  return [period, useCallback((p: PeriodKind) => set(p), [set])];
}

// ---------------------------------------------------------------- pins

const PIN_KEY = "pe.hud.pins";

/** [pinned, setPinned] for one panel id ("property", "unit", "mailbox"…). Pinned panels ignore Esc / empty-ground clicks. */
export function usePinned(id: string): [boolean, (on: boolean) => void] {
  const [raw, set] = useStored(PIN_KEY);
  const list = (raw ?? "").split(",").filter(Boolean);
  const pinned = list.includes(id);
  const setPinned = useCallback(
    (on: boolean) => {
      const cur = (getKey(PIN_KEY) ?? "").split(",").filter(Boolean).filter((x) => x !== id);
      if (on) cur.push(id);
      set(cur.length ? cur.join(",") : null);
    },
    [id, set],
  );
  return [pinned, setPinned];
}

// ---------------------------------------------------------------- unexplored hints

const EXPLORED_KEY = "pe.explored";

/**
 * Unexplored hints: `dots(candidates)` returns the first `max` ids (in your priority order) never opened yet;
 * `markExplored(id)` removes a dot for good. Ids are free-form: "unit", "mailbox", "dock:income"…
 */
export function useExplored(max = 3) {
  const [raw, set] = useStored(EXPLORED_KEY);
  const explored = new Set((raw ?? "").split(",").filter(Boolean));
  const markExplored = useCallback(
    (id: string) => {
      const cur = new Set((getKey(EXPLORED_KEY) ?? "").split(",").filter(Boolean));
      if (cur.has(id)) return;
      cur.add(id);
      set([...cur].join(","));
    },
    [set],
  );
  const dots = (candidates: string[]) => new Set(candidates.filter((c) => !explored.has(c)).slice(0, max));
  const reset = useCallback(() => set(null), [set]);
  return { explored, dots, markExplored, reset };
}

// ---------------------------------------------------------------- Esc stack

type Entry = { id: number; run: () => void };
const stack: Entry[] = [];
let installed = false;
let nextId = 1;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  if (isFocusTrapActive()) return; // a modal / drawer / palette owns Esc
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
    t.blur(); // first Esc leaves the text field; the next one steps back
    e.preventDefault();
    return;
  }
  e.preventDefault();
  e.stopPropagation(); // capture on window: InspectCard's own document listener never double-closes
  stack[stack.length - 1].run();
}

/**
 * While `active`, Esc runs `onEscape` — the most recently activated layer wins, so one press steps back one depth.
 * Registered in the capture phase on window; modal dialogs (focus traps) keep priority.
 */
export function useEscape(active: boolean, onEscape: () => void) {
  const ref = useRef(onEscape);
  useEffect(() => {
    ref.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    if (!installed) {
      window.addEventListener("keydown", onKeyDown, true);
      installed = true;
    }
    const entry: Entry = { id: nextId++, run: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.findIndex((x) => x.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** true when the key event comes from a text field (hotkeys must ignore typing). */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}
