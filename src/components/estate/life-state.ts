// The owner's LIFE switch (people, animals, birds in the world) — one shared choice so the side bar's icon (hud/Dock)
// and the scene agree. null = not chosen yet (on, unless the viewer prefers reduced motion).
import { useSyncExternalStore } from "react";

let choice: boolean | null = null;
const listeners = new Set<() => void>();

export const lifeSwitch = {
  get: () => choice,
  set(next: boolean | null) {
    if (next === choice) return;
    choice = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

const getServer = () => null;

/** the owner's choice (null = automatic) */
export function useLifeChoice(): boolean | null {
  return useSyncExternalStore(lifeSwitch.subscribe, lifeSwitch.get, getServer);
}
