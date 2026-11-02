"use client";
// The 3D estate lives behind every page (owner, 31/10/2026: "see the background at all times … overview to data,
// back to overview — no loading screen"). A tiny shared flag: true once the world has drawn its first frames, so
// Data / Config can drop their stand-in picture and show the real world through their glass.
import { useSyncExternalStore } from "react";

let ready = false;
const subs = new Set<() => void>();

export const worldState = {
  get: () => ready,
  setReady(v: boolean) {
    if (v === ready) return;
    ready = v;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

export function useWorldReady(): boolean {
  return useSyncExternalStore(worldState.subscribe, worldState.get, () => false);
}

/** The pages that sit on the world: the overview itself, Data and Config. */
export const isWorldRoute = (pathname: string) => pathname === "/" || pathname.startsWith("/data") || pathname.startsWith("/config");

// ---------------------------------------------------------------- leaving a page (owner, 31/10/2026: "smooth like the video")
// The main tabs play a short dissolve of the page on screen (its glass fades and blurs away over the world) and only
// then switch pages; the new page's sections then fade in from a soft blur. The world behind never moves.

let leaving = false;
const leaveSubs = new Set<() => void>();

export const pageExit = {
  get: () => leaving,
  set(v: boolean) {
    if (v === leaving) return;
    leaving = v;
    leaveSubs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    leaveSubs.add(f);
    return () => {
      leaveSubs.delete(f);
    };
  },
};

export function useLeaving(): boolean {
  return useSyncExternalStore(pageExit.subscribe, pageExit.get, () => false);
}

/** How long the old page takes to dissolve before the switch. */
export const EXIT_MS = 170;

// ---------------------------------------------------------------- loading covers (owner 2/11/2026: "dont let the top
// option bar come in the loading page"): the floating Overview · Data · Config bar stays hidden while a loading cover is
// up — the overview's arrival screen (until the world has arrived on "/") and the sign-out screen — then fades in.

function flag() {
  let v = false;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set(n: boolean) {
      if (n === v) return;
      v = n;
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}
/** The overview's arrival screen has gone (the world is in, or it gave up waiting). */
export const arrivedFlag = flag();
/** The sign-out screen is up. */
export const signingOutFlag = flag();

/** True while a loading cover is on screen (server render on "/" too, so the bar never flashes before the cover). */
export function useCovered(pathname: string): boolean {
  const arrived = useSyncExternalStore(arrivedFlag.subscribe, arrivedFlag.get, () => false);
  const out = useSyncExternalStore(signingOutFlag.subscribe, signingOutFlag.get, () => false);
  return out || (pathname === "/" && !arrived);
}
