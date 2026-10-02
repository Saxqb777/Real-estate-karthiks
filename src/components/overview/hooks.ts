"use client";
// Small client hooks for the game screen: media queries, per-browser flags (tour seen, quest log hidden),
// single-key hotkeys that never fire while typing or while a dialog owns the keyboard.
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { isFocusTrapActive } from "@/components/ui";

// ---------------------------------------------------------------- media query

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Phones (< 768px): world on top + bottom sheet. */
export const MOBILE_QUERY = "(max-width: 767px)";

// ---------------------------------------------------------------- per-browser flags

const EVENT = "pe:overview-flag";
const memory = new Map<string, string | null>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value: string | null) {
  memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private window: remembered for this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** A string remembered per browser (null until set; always null on the server). */
export function useFlag(key: string): [string | null, (v: string | null) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const onLocal = (e: Event) => (e as CustomEvent<string>).detail === key && cb();
      const onStorage = (e: StorageEvent) => e.key === key && cb();
      window.addEventListener(EVENT, onLocal);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(EVENT, onLocal);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback((v: string | null) => writeFlag(key, v), [key]);
  return [value, set];
}

export const TOUR_KEY = "pe.overview.tour";
export const QUEST_KEY = "pe.overview.quests";

// ---------------------------------------------------------------- hotkeys

/** true when the key event comes from a text field or a dialog owns the keyboard. */
export function keyBlocked(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  if (isFocusTrapActive()) return true;
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

/** Single-key shortcuts: { p: () => …, "?": () => … } (case-insensitive letters). */
export function useHotkeys(map: Record<string, () => void>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (keyBlocked(e) || e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const fn = ref.current[k];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
