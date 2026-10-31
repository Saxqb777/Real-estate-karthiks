"use client";
// The main tabs switch pages like the owner's video (31/10/2026): the page on screen dissolves away over the world,
// then the next page's sections fade in from a soft blur. Plain clicks only — ⌘ / Ctrl / middle clicks open tabs as usual.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, type MouseEvent } from "react";
import { isActive } from "./nav";
import { EXIT_MS, pageExit } from "./world-state";

export function useSmoothNav() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (href: string, e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (isActive(pathname, href)) return; // already there
      e.preventDefault();
      if (pageExit.get()) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }
      pageExit.set(true);
      window.setTimeout(() => router.push(href), EXIT_MS);
    },
    [router, pathname],
  );
}
