"use client";
// Phones: the ☰ in the bottom bar opens the CHARTS menu over the 3D world (owner, 5/10/2026, option B).
// A tiny shared flag so the shell's tab bar and the overview can both read / flip it.
import { useSyncExternalStore } from "react";

let open = false;
const subs = new Set<() => void>();

export const chartMenu = {
  get: () => open,
  set(v: boolean) {
    if (v === open) return;
    open = v;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

export function useChartMenu(): boolean {
  return useSyncExternalStore(chartMenu.subscribe, chartMenu.get, () => false);
}
