"use client";
// Small shared hooks for the UI kit: client detection, platform, focus trap, scroll lock.
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const noopSubscribe = () => () => {};

/** false during SSR + hydration, true afterwards (safe gate for portals / browser-only UI). */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** true on macOS / iOS (for ⌘ vs Ctrl hints). Always false on the server. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

/** Stack of active traps — only the top-most handles Tab / Escape (nested dialogs). */
const trapStack: HTMLElement[] = [];

/**
 * Trap Tab focus inside `ref` while active, call onEscape on Esc, focus the first
 * `[data-autofocus]` (else the first focusable not inside `[data-no-autofocus]`) on open,
 * and restore focus on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const escRef = useRef(onEscape);
  useEffect(() => {
    escRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    trapStack.push(node);
    const raf = requestAnimationFrame(() => {
      if (node.contains(document.activeElement)) return;
      const target =
        node.querySelector<HTMLElement>("[data-autofocus]") ??
        focusables(node).find((el) => !el.closest("[data-no-autofocus]")) ??
        focusables(node)[0] ??
        node;
      target.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== node) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        escRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(node);
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !node.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !node.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      const i = trapStack.lastIndexOf(node);
      if (i >= 0) trapStack.splice(i, 1);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

let lockCount = 0;

/** Lock page scroll while any overlay is open (ref-counted). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    document.documentElement.style.overflow = "hidden";
    return () => {
      lockCount--;
      if (lockCount === 0) document.documentElement.style.overflow = "";
    };
  }, [active]);
}
