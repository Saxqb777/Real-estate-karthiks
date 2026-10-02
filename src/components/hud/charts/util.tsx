"use client";
// Small chart helpers: element size, nice axis ticks, axis money labels, and the exact-₹ hover tip.
// Axis maths here is layout only (pixel scales / tick spacing) — every plotted value comes from the API.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import s from "./charts.module.css";

export { niceTicks, axisINR } from "./scale";

/** Track an element's content size. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export interface TipRow {
  label: ReactNode;
  value: ReactNode;
  /** colour key (series swatch) */
  color?: string;
  /** the total / result row */
  strong?: boolean;
}

/** Hover tip positioned inside a relatively positioned chart box. */
export function ChartTip({ x, y, title, rows, boxWidth, foot }: { x: number; y: number; title: ReactNode; rows: TipRow[]; boxWidth: number; foot?: ReactNode }) {
  const W = 210;
  const left = Math.min(Math.max(x + 14, 4), Math.max(4, boxWidth - W - 4));
  const flip = x + 14 + W > boxWidth;
  return (
    <div className={s.tip} style={{ left: flip ? Math.max(4, x - W - 14) : left, top: Math.max(0, y) }} role="tooltip">
      <div className={s.tipTitle}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} className={cx(s.tipRow, r.strong && s.tipStrong)}>
          <span className={s.tipLabel}>
            {r.color && <span className={s.tipSwatch} style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className={cx(s.tipValue, "num")}>{r.value}</span>
        </div>
      ))}
      {foot && <div className={s.tipFoot}>{foot}</div>}
    </div>
  );
}

/** Legend key: swatch + label (identity never by colour alone). */
export function LegendKey({ color, label, line, hatch }: { color: string; label: ReactNode; line?: boolean; hatch?: boolean }) {
  return (
    <span className={s.legendKey}>
      <span className={cx(s.legendSw, line && s.legendLine, hatch && s.legendHatch)} style={{ ["--c" as string]: color }} aria-hidden />
      {label}
    </span>
  );
}

/** Rounded-top bar path (4px data-end, square at the baseline). Works for negative bars too. */
export function barPath(x: number, y0: number, y1: number, w: number, r = 4): string {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const rr = Math.min(r, h, w / 2);
  if (y1 < y0) {
    // grows up from baseline y0 to y1
    return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}
