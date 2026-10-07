"use client";
// Dock tab 2 — Where money went: expenses by category for the active scope (data.expenseComposition), each category
// in its own colour everywhere; the centre shows the scope's Expenses figure (the same number as the HUD).
import { useState } from "react";
import { cx } from "@/components/ui";
import type { ExpenseSlice } from "@/lib/dashboard-types";
import { formatPercent } from "@/lib/format";
import { inr } from "../format";
import s from "./charts.module.css";

export interface SpendingDonutProps {
  slices: ExpenseSlice[];
  /** the scope's Expenses figure (periods[x].expenses) — shown in the middle */
  total: number;
  scopeLabel: string;
  onCategory?: (slice: ExpenseSlice) => void;
  className?: string;
}

const TAU = Math.PI * 2;

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`;
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

export function SpendingDonut({ slices, total, scopeLabel, onCategory, className }: SpendingDonutProps) {
  const [hover, setHover] = useState<string | null>(null);
  if (slices.length === 0 || total === 0)
    return <div className={cx(s.empty, className)}>No expenses in {scopeLabel} — nothing spent yet.</div>;

  const size = 168;
  const c = size / 2;
  const r1 = c - 2;
  const r0 = r1 - 26;
  const gap = slices.length > 1 ? 0.012 : 0; // 2px surface gap between segments
  let a = 0;
  const segs = slices.map((sl) => {
    const a0 = a;
    a += sl.share * TAU;
    return { sl, a0: a0 + gap / 2, a1: Math.max(a0 + gap / 2 + 0.001, a - gap / 2) };
  });
  const hs = slices.find((x) => x.categoryId === hover);

  return (
    <div className={cx(s.donutWrap, className)}>
      <div className={s.donut}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Expenses by category, ${scopeLabel}`}>
          {segs.map(({ sl, a0, a1 }) =>
            slices.length === 1 ? (
              <circle key={sl.categoryId} cx={c} cy={c} r={(r0 + r1) / 2} fill="none" stroke={sl.color} strokeWidth={r1 - r0} />
            ) : (
              <path
                key={sl.categoryId}
                d={arc(c, c, hover === sl.categoryId ? r0 - 2 : r0, hover === sl.categoryId ? r1 + 1 : r1, a0, a1)}
                fill={sl.color}
                opacity={hover && hover !== sl.categoryId ? 0.35 : 1}
                className={s.seg}
                onMouseEnter={() => setHover(sl.categoryId)}
                onMouseLeave={() => setHover(null)}
                onClick={onCategory ? () => onCategory(sl) : undefined}
                style={{ cursor: onCategory ? "pointer" : undefined }}
              />
            ),
          )}
        </svg>
        <div className={s.donutCenter}>
          <span className={s.donutLabel}>{hs ? hs.name : "Expenses"}</span>
          <span className={cx(s.donutValue, "num", s.tExpense)}>{inr(hs ? hs.amount : total)}</span>
          <span className={s.donutSub}>{hs ? formatPercent(hs.share, 1) : scopeLabel}</span>
        </div>
      </div>
      <ul className={s.catList}>
        {slices.map((sl) => (
          <li key={sl.categoryId}>
            <button
              type="button"
              className={cx(s.cat, hover === sl.categoryId && s.catOn)}
              onMouseEnter={() => setHover(sl.categoryId)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(sl.categoryId)}
              onBlur={() => setHover(null)}
              onClick={onCategory ? () => onCategory(sl) : undefined}
              disabled={!onCategory}
            >
              <span className={s.catSw} style={{ background: sl.color }} aria-hidden />
              <span className={s.catName}>{sl.name}</span>
              <span className={s.catBar} aria-hidden>
                <span style={{ width: `${Math.max(2, sl.share * 100)}%`, background: sl.color }} />
              </span>
              <span className={cx(s.catPct, "num")}>{formatPercent(sl.share, 1)}</span>
              <span className={cx(s.catAmt, "num", s.tExpense)}>{inr(sl.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
