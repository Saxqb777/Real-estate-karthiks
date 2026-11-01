"use client";
// The list that drops down from every <Select> (owner 1/11/2026: "drop downs should match the website") — a glass
// list in the site's look instead of the browser's own menu. The <select> itself stays in the page (its value, form
// name, label and change events all work as before); only the menu is ours: it reads the select's options / groups when
// it opens, and a pick sets the select's value and fires "change" like a real choice.
import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import styles from "./SelectMenu.module.css";

export type MenuEntry =
  | { kind: "group"; label: string }
  | { kind: "option"; value: string; label: string; disabled: boolean; placeholder: boolean };

/** The select's options (and group headings) in order; hidden options and the empty "Choose a …" prompt are left out. */
export function readEntries(sel: HTMLSelectElement): MenuEntry[] {
  const out: MenuEntry[] = [];
  const add = (o: HTMLOptionElement, groupOff: boolean) => {
    if (o.hidden || o.dataset.placeholder !== undefined) return;
    out.push({ kind: "option", value: o.value, label: o.label || o.text, disabled: o.disabled || groupOff, placeholder: o.dataset.placeholder !== undefined });
  };
  for (const child of Array.from(sel.children)) {
    if (child instanceof HTMLOptGroupElement) {
      out.push({ kind: "group", label: child.label });
      for (const o of Array.from(child.children)) if (o instanceof HTMLOptionElement) add(o, child.disabled);
    } else if (child instanceof HTMLOptionElement) add(child, false);
  }
  return out;
}

/** Choose `value` as if the person had picked it in the browser's menu (React's onChange runs). */
export function pickValue(sel: HTMLSelectElement, value: string) {
  if (sel.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(sel, value);
  else sel.value = value;
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

type Opt = Extract<MenuEntry, { kind: "option" }>;

export interface SelectMenuProps {
  anchor: RefObject<HTMLElement | null>;
  entries: MenuEntry[];
  value: string;
  onPick: (value: string) => void;
  /** refocus = give focus back to the select (keyboard close / pick) */
  onClose: (refocus: boolean) => void;
}

const GAP = 6;
const EDGE = 8;

/** The page panel / window / dialog the field sits in (the list stays inside it), else the screen. */
const PANEL = '[data-menu-bounds], [role="dialog"], [role="alertdialog"], [data-game-main], [data-centre-panel]';
function boundsOf(field: HTMLElement): { left: number; right: number; top: number; bottom: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const p = field.closest<HTMLElement>(PANEL)?.getBoundingClientRect();
  if (!p) return { left: 0, right: vw, top: 0, bottom: vh };
  return { left: Math.max(0, p.left), right: Math.min(vw, p.right), top: Math.max(0, p.top), bottom: Math.min(vh, p.bottom) };
}

export function SelectMenu({ anchor, entries, value, onPick, onClose }: SelectMenuProps) {
  const opts = entries.filter((e): e is Opt => e.kind === "option");
  const firstOn = opts.findIndex((o) => !o.disabled);
  const chosen = opts.findIndex((o) => o.value === value && !o.disabled);
  const [active, setActive] = useState(chosen >= 0 ? chosen : firstOn);
  const menuRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const live = useRef({ active, opts, onPick, onClose });
  useEffect(() => {
    live.current = { active, opts, onPick, onClose };
  });

  // place it under the field (above when there's more room there), INSIDE the page panel it belongs to (owner 1/11/2026:
  // "dont let me go outside the page, cleanly sit in the page"): it lines up with the field's left edge, or with its
  // right edge when that would run past the panel, and never crosses the panel (or the screen) edges
  useLayoutEffect(() => {
    const place = () => {
      const box = anchor.current;
      const menu = menuRef.current;
      if (!box || !menu) return;
      const r = box.getBoundingClientRect();
      const b = boundsOf(box);
      const below = b.bottom - r.bottom - GAP - EDGE;
      const above = r.top - b.top - GAP - EDGE;
      menu.style.minWidth = `${Math.round(Math.min(r.width, b.right - b.left - EDGE * 2))}px`;
      menu.style.maxWidth = `${Math.round(b.right - b.left - EDGE * 2)}px`;
      const natural = menu.scrollHeight;
      const up = below < Math.min(natural, 220) && above > below;
      menu.style.maxHeight = `${Math.max(120, Math.min(360, up ? above : below))}px`;
      menu.style.top = up ? "" : `${Math.round(r.bottom + GAP)}px`;
      menu.style.bottom = up ? `${Math.round(window.innerHeight - r.top + GAP)}px` : "";
      const w = menu.offsetWidth;
      const lo = b.left + EDGE;
      const hi = b.right - EDGE;
      const left = r.left + w <= hi ? r.left : r.right - w; // field's left edge, else its right edge
      menu.style.left = `${Math.round(Math.max(lo, Math.min(left, hi - w)))}px`;
      menu.dataset.up = up ? "true" : "false";
      menu.style.visibility = "visible";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  // keys while open (window capture: runs before a dialog's own Esc / Tab handling, so Esc closes only the list)
  useEffect(() => {
    const step = (from: number, dir: 1 | -1) => {
      const { opts: list } = live.current;
      for (let i = from + dir; i >= 0 && i < list.length; i += dir) if (!list[i].disabled) return i;
      return from;
    };
    const onKey = (e: KeyboardEvent) => {
      const { active: a, opts: list, onPick: pick, onClose: close } = live.current;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      switch (e.key) {
        case "ArrowDown":
          stop();
          setActive(step(a, 1));
          return;
        case "ArrowUp":
          stop();
          setActive(step(a, -1));
          return;
        case "Home":
          stop();
          setActive(step(-1, 1));
          return;
        case "End":
          stop();
          setActive(step(list.length, -1));
          return;
        case "Enter":
          stop();
          if (list[a] && !list[a].disabled) pick(list[a].value);
          else close(true);
          return;
        case " ":
          if (typed.current.text && Date.now() - typed.current.at < 600) break;
          stop();
          if (list[a] && !list[a].disabled) pick(list[a].value);
          return;
        case "Escape":
          stop();
          close(true);
          return;
        case "Tab":
          close(false);
          return;
      }
      // type to jump: the first name that starts with what was typed
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        stop();
        const now = Date.now();
        typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
        const q = typed.current.text;
        const order = [...list.keys()].map((i) => (a + 1 + i) % list.length);
        const hit = order.find((i) => !list[i].disabled && list[i].label.toLowerCase().startsWith(q));
        if (hit !== undefined) setActive(hit);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || anchor.current?.contains(t)) return;
      live.current.onClose(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [anchor]);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let i = -1;
  return createPortal(
    <div ref={menuRef} className={styles.menu} role="listbox" style={{ visibility: "hidden" }} onMouseDown={(e) => e.preventDefault()}>
      {entries.map((e, k) => {
        if (e.kind === "group")
          return (
            <div key={`g${k}`} className={styles.group} role="presentation">
              {e.label}
            </div>
          );
        i += 1;
        const idx = i;
        const on = e.value === value;
        return (
          <div
            key={`o${k}`}
            data-i={idx}
            role="option"
            aria-selected={on}
            aria-disabled={e.disabled || undefined}
            className={cx(styles.item, idx === active && styles.active, on && styles.on, e.placeholder && styles.placeholder)}
            onPointerMove={() => !e.disabled && idx !== active && setActive(idx)}
            onClick={() => !e.disabled && onPick(e.value)}
          >
            <span className={styles.label}>{e.label}</span>
            {on && <Check className={styles.check} aria-hidden />}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
