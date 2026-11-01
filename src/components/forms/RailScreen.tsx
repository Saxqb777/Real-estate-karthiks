"use client";
// One-screen frame for Data and Config ("option C", owner): chunky game buttons for the sections across the top, one
// gold-bordered panel below, all over a blurred picture of the estate.
// Number keys 1–9 switch tabs and N runs the active tab's "add" action (ignored while typing or in a dialog).
import { motion } from "motion/react";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { cx, isFocusTrapActive } from "@/components/ui";
import { useWorldReady } from "@/components/shell/world-state";
import s from "./RailScreen.module.css";

export interface RailItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Small count tag; hidden when undefined. */
  count?: number;
  /** Count in coral (overdue / due). */
  alert?: boolean;
  /** One short line under the label on wide screens ("2 current"). */
  note?: ReactNode;
  /** Draw a divider above this item (e.g. Reports). */
  divider?: boolean;
}

export interface RailScreenProps {
  eyebrow: string;
  title: string;
  /** Tamil accent under the title. */
  tamil?: string;
  items: RailItem[];
  value: string;
  onChange: (id: string) => void;
  /** Called on "N" (add new in the active tab). */
  onNew?: () => void;
  children: ReactNode;
  /** Label for the tablist. */
  label: string;
}

const isTyping = (el: Element | null) =>
  !!el && (el.matches("input, textarea, select, [contenteditable='true']") || !!el.closest("[role='dialog']"));

export function RailScreen({ eyebrow, title, items, value, onChange, onNew, children, label }: RailScreenProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ items, onChange, onNew });
  useEffect(() => {
    latest.current = { items, onChange, onNew };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isFocusTrapActive() || isTyping(document.activeElement)) return;
      const { items: list, onChange: change, onNew: add } = latest.current;
      if (/^[1-9]$/.test(e.key)) {
        const item = list[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          change(item.id);
        }
      } else if ((e.key === "n" || e.key === "N") && add) {
        e.preventDefault();
        add();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // keep the active chip visible on the phone strip
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const onListKey = (e: React.KeyboardEvent) => {
    const i = items.findIndex((it) => it.id === value);
    let next: RailItem | undefined;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = items[(i + 1) % items.length];
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = items[(i - 1 + items.length) % items.length];
    else if (e.key === "Home") next = items[0];
    else if (e.key === "End") next = items[items.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus());
  };

  const plateId = useId();
  const worldReady = useWorldReady();
  return (
    <div className={s.screen}>
      {/* a stand-in picture of the estate until the live world behind has drawn — then the world itself shows through */}
      <div className={s.backdrop} data-world={worldReady || undefined} aria-hidden />
      <nav className={s.rail} aria-label={label}>
        <h1 className={s.srOnly}>
          {title} · {eyebrow}
        </h1>
        <div ref={listRef} role="tablist" aria-orientation="horizontal" aria-label={label} className={s.list} onKeyDown={onListKey}>
          {items.map((it, i) => {
            const on = it.id === value;
            return (
              <button
                key={it.id}
                type="button"
                role="tab"
                data-id={it.id}
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                className={cx(s.item, it.divider && s.divider)}
                style={{ "--i": i } as CSSProperties}
                aria-label={it.label}
                title={it.label}
                onClick={() => onChange(it.id)}
              >
                {/* the chosen section: a gold-glass plate that slides to the button you pick (owner 31/10/2026) */}
                {on && <motion.span layoutId={`rail-plate-${plateId}`} className={s.plate} transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }} />}
                <span className={s.index}>{String(i + 1).padStart(2, "0")}</span>
                {/* icons only (owner 1/11/2026: "over here just keep icons") — the name is the button's label / tooltip */}
                {it.icon ? <span className={s.icon}>{it.icon}</span> : <span className={s.label}>{it.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
      <div className={s.main} data-game-main role="tabpanel" aria-label={items.find((it) => it.id === value)?.label}>
        {children}
      </div>
    </div>
  );
}
