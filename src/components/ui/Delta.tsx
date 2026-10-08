"use client";
// "Compared with last year" chip (owner 8/10/2026): ▲ 12.3% / ▼ 4.0%, green when the change is good for the owner
// (rent or net cash up, expenses down), red when it is bad. Nothing to compare (last year was ₹0) → renders nothing.
import { cx } from "./cx";
import s from "./Delta.module.css";

export interface DeltaProps {
  /** (now − before) ÷ |before| as a fraction; null = nothing to compare */
  change: number | null;
  /** which direction is good: "up" for rent / net cash, "down" for expenses */
  better?: "up" | "down";
  /** hover text, e.g. "FY 2025-26 to 8/10/2025: ₹86,000" */
  title?: string;
  onClick?: () => void;
  className?: string;
}

export function Delta({ change, better = "up", title, onClick, className }: DeltaProps) {
  if (change === null || !Number.isFinite(change)) return null;
  const pct = Math.abs(change) * 100;
  const flat = pct < 0.05;
  const up = change > 0;
  const good = flat ? null : up === (better === "up");
  const text = flat ? "0%" : pct >= 1000 ? ">999%" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
  const cls = cx(s.delta, good === true && s.good, good === false && s.bad, onClick && s.button, className);
  const body = (
    <>
      <span aria-hidden>{flat ? "=" : up ? "▲" : "▼"}</span>
      {text}
    </>
  );
  const label = `${flat ? "No change" : up ? "Up" : "Down"} ${text} on last year`;
  return onClick ? (
    <button type="button" className={cls} title={title} aria-label={label} onClick={onClick}>
      {body}
    </button>
  ) : (
    <span className={cls} title={title} aria-label={label}>
      {body}
    </span>
  );
}
