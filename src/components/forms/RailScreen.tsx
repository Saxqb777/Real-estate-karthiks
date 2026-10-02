"use client";
// One-screen frame for Data and Config: a game-style tab rail on the left (a chip strip on phones) and one panel.
// Number keys 1–9 switch tabs and N runs the active tab's "add" action (ignored while typing or in a dialog).
import { useEffect, useRef, type ReactNode } from "react";
import { Kbd, cx, isFocusTrapActive } from "@/components/ui";
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

export function RailScreen({ eyebrow, title, tamil, items, value, onChange, onNew, children, label }: RailScreenProps) {
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

  return (
    <div className={s.screen}>
      <nav className={s.rail} aria-label={label}>
        <header className={s.head}>
          <div className={s.eyebrow}>
            <span className={s.pip} aria-hidden />
            {eyebrow}
          </div>
          <h1 className={s.title}>{title}</h1>
          {tamil && <div className={cx(s.tamil, "tamil")}>{tamil}</div>}
        </header>
        <div ref={listRef} role="tablist" aria-orientation="vertical" aria-label={label} className={s.list} onKeyDown={onListKey}>
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
                onClick={() => onChange(it.id)}
              >
                <span className={s.index}>{String(i + 1).padStart(2, "0")}</span>
                {it.icon && <span className={s.icon}>{it.icon}</span>}
                <span className={s.text}>
                  <span className={s.label}>{it.label}</span>
                  {it.note && <span className={s.note}>{it.note}</span>}
                </span>
                {it.count !== undefined && it.count > 0 && <span className={cx(s.count, "num", it.alert && s.countAlert)}>{it.count}</span>}
              </button>
            );
          })}
        </div>
        <footer className={s.keys}>
          <span>
            <Kbd keys={["1"]} />–<Kbd keys={[String(Math.min(9, items.length))]} /> switch
          </span>
          {onNew && (
            <span>
              <Kbd keys={["N"]} /> new
            </span>
          )}
        </footer>
      </nav>
      <div className={s.main} role="tabpanel" aria-label={items.find((it) => it.id === value)?.label}>
        {children}
      </div>
    </div>
  );
}
