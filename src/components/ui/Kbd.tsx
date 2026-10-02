"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { useIsMac } from "./hooks";
import styles from "./Kbd.module.css";

const NAMES: Record<string, string> = {
  enter: "↵",
  esc: "Esc",
  escape: "Esc",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  shift: "⇧",
  tab: "Tab",
  space: "Space",
};

export interface KbdProps {
  /** Key names; "mod" renders ⌘ on Mac and Ctrl elsewhere. */
  keys?: string[];
  children?: ReactNode;
  className?: string;
}

/** Keyboard key cap(s): <Kbd keys={["mod", "k"]} /> or <Kbd>Esc</Kbd>. */
export function Kbd({ keys, children, className }: KbdProps) {
  const mac = useIsMac();
  if (!keys) return <kbd className={cx(styles.kbd, className)}>{children}</kbd>;
  return (
    <span className={cx(styles.group, className)}>
      {keys.map((k) => {
        const lower = k.toLowerCase();
        const label = lower === "mod" ? (mac ? "⌘" : "Ctrl") : lower === "alt" ? (mac ? "⌥" : "Alt") : (NAMES[lower] ?? k.toUpperCase());
        return (
          <kbd key={k} className={styles.kbd}>
            {label}
          </kbd>
        );
      })}
    </span>
  );
}
