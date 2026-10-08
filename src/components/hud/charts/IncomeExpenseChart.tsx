"use client";
// Dock tab 1 — Income vs expenses: rent collected (green) and expenses (red) as paired columns, net cash as a line —
// one FY / calendar year month by month (data.monthlyByYear), or ALL TIME year by year (owner 8/10) with the totals
// from data.periods.allTime and the running net from data.cumulativeNetByYear (grouped by the API — the UI never regroups).
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { YearSeries } from "@/lib/dashboard-types";
import { inr } from "../format";
import { ChartTip, LegendKey, axisINR, barPath, niceTicks, useSize } from "./util";
import s from "./charts.module.css";

export interface IncomeExpenseChartProps {
  years: YearSeries[];
  /** all-time totals (data.periods.allTime) + running net per year (data.cumulativeNetByYear) → the ALL TIME view */
  allTime?: { rentCollected: number; expenses: number; net: number };
  cumulative?: { year: number; cumulative: number }[];
  /** selected year key or "all" (default: the year containing the as-of date) */
  year?: number | "all";
  onYearChange?: (year: number | "all") => void;
  /** click a total of the CURRENT year or of ALL TIME → its explanation (other years have no explanation) */
  onDrill?: (key: "rentCollected" | "expenses" | "netCash", scope: YearSeries | "all") => void;
  className?: string;
}

/** One column pair on the chart: a month (one year) or a year (all time). */
interface Point {
  key: string;
  label: string;
  longLabel: string;
  income: number;
  expenses: number;
  net: number;
  cumulative: number;
  isFuture: boolean;
}

/** "FY 2025-26" → "FY 25-26" so eight years fit under the columns. */
const shortYear = (label: string) => label.replace(/^FY (\d{2})(\d{2})-/, "FY $2-");

const C = { income: "var(--teal)", expense: "var(--coral)", net: "var(--plaster)" };
const M = { l: 50, r: 10, t: 12, b: 22 };

export function IncomeExpenseChart({ years, allTime, cumulative, year: controlled, onYearChange, onDrill, className }: IncomeExpenseChartProps) {
  const current = years.find((y) => y.isCurrent) ?? years[years.length - 1];
  const [inner, setInner] = useState<number | "all" | undefined>(undefined);
  const picked = controlled ?? inner ?? current?.year;
  const all = picked === "all" && Boolean(allTime);
  const [shown, setShown] = useState<number | undefined>(undefined); // the year the stepper shows while ALL TIME is on
  const key = picked === "all" ? (shown ?? current?.year) : picked;
  const idx = Math.max(0, years.findIndex((y) => y.year === key));
  const ys = years[idx];
  const pick = (v: number | "all") => {
    if (v !== "all") setShown(v);
    setInner(v);
    onYearChange?.(v);
  };
  const setYear = (i: number) => {
    const y = years[i];
    if (y) pick(y.year);
  };
  const [box, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (!ys) return <div className={s.empty}>No money recorded yet — the months fill in as rent and expenses are added.</div>;

  const runningNet = new Map((cumulative ?? []).map((c) => [c.year, c.cumulative]));
  const points: Point[] = all
    ? years.map((y) => ({
        key: String(y.year),
        label: shortYear(y.label),
        longLabel: y.label,
        income: y.income,
        expenses: y.expenses,
        net: y.net,
        cumulative: runningNet.get(y.year) ?? y.net,
        isFuture: false,
      }))
    : ys.months;
  const head = all ? { label: "All time", income: allTime!.rentCollected, expenses: allTime!.expenses, net: allTime!.net } : { label: ys.label, income: ys.income, expenses: ys.expenses, net: ys.net };

  const W = Math.max(size.w, 200);
  const H = Math.max(size.h, 120);
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const vals = points.flatMap((m) => (m.isFuture ? [0] : [m.income, m.expenses, m.net]));
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => M.t + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const band = pw / Math.max(1, points.length);
  const bw = Math.max(4, Math.min(20, (band - 14) / 2));
  const cx0 = (i: number) => M.l + band * i + band / 2;
  const past = points.map((m, i) => ({ m, i })).filter((p) => !p.m.isFuture);
  const linePts = past.map(({ m, i }) => `${cx0(i)},${y(m.net)}`).join(" ");
  const hm = hover !== null ? points[hover] : null;
  const scope: YearSeries | "all" = all ? "all" : ys;
  const drill = onDrill && (all || ys.isCurrent) ? (k: "rentCollected" | "expenses" | "netCash") => onDrill(k, scope) : undefined;
  const allZero = past.every(({ m }) => m.income === 0 && m.expenses === 0);

  return (
    <div className={cx(s.chart, className)}>
      <div className={s.chartBar}>
        <div className={s.stepper}>
          {allTime && (
            <button type="button" className={cx(s.stepperAll, all && s.stepperOn)} aria-pressed={all} onClick={() => pick("all")}>
              All time
            </button>
          )}
          <button type="button" onClick={() => setYear(idx - 1)} disabled={idx === 0} aria-label="Previous year">
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" className={cx(s.stepperLabel, !all && s.stepperOn)} aria-pressed={!all} onClick={() => pick(ys.year)}>
            {ys.label}
          </button>
          <button type="button" onClick={() => setYear(idx + 1)} disabled={idx === years.length - 1} aria-label="Next year">
            <ChevronRight aria-hidden />
          </button>
        </div>
        <div className={s.legend}>
          <LegendKey color={C.income} label="Rent collected" />
          <LegendKey color={C.expense} label="Expenses" />
          <LegendKey color={C.net} label="Net cash" line />
        </div>
        <div className={s.totals}>
          <Total label="Rent collected" value={head.income} tone="income" onClick={drill ? () => drill("rentCollected") : undefined} />
          <Total label="Expenses" value={head.expenses} tone="expense" onClick={drill ? () => drill("expenses") : undefined} />
          <Total label="Net cash" value={head.net} tone={head.net < 0 ? "expense" : head.net > 0 ? "income" : undefined} strong onClick={drill ? () => drill("netCash") : undefined} />
        </div>
      </div>
      <div ref={box} className={s.plot} onMouseLeave={() => setHover(null)}>
        {size.w > 0 && (
          <svg width={W} height={H} role="img" aria-label={all ? "Rent collected and expenses by year, all time" : `Rent collected and expenses by month, ${ys.label}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? s.zero : s.grid} />
                <text x={M.l - 8} y={y(t)} className={s.yLabel} dominantBaseline="middle" textAnchor="end">
                  {axisINR(t)}
                </text>
              </g>
            ))}
            {points.map((m, i) => (
              <g key={m.key}>
                {hover === i && <rect x={M.l + band * i + 2} y={M.t} width={band - 4} height={ph} className={s.hoverBand} />}
                {!m.isFuture && (
                  <>
                    <path d={barPath(cx0(i) - bw - 1, y(0), y(m.income), bw)} fill={C.income} className={s.bar} />
                    <path d={barPath(cx0(i) + 1, y(0), y(m.expenses), bw)} fill={C.expense} className={s.bar} />
                  </>
                )}
                <text x={cx0(i)} y={H - 6} className={cx(s.xLabel, m.isFuture && s.xFuture)} textAnchor="middle">
                  {m.label}
                </text>
                <rect
                  x={M.l + band * i}
                  y={M.t}
                  width={band}
                  height={ph + M.b}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={m.isFuture ? -1 : 0}
                  aria-label={`${m.longLabel}: rent ${inr(m.income)}, expenses ${inr(m.expenses)}, net ${inr(m.net)}`}
                />
              </g>
            ))}
            {past.length > 1 && <polyline points={linePts} className={s.netLine} />}
            {past.map(({ m, i }) => (
              <circle key={m.key} cx={cx0(i)} cy={y(m.net)} r={hover === i ? 4.5 : 3.5} className={s.netDot} />
            ))}
          </svg>
        )}
        {allZero && <div className={s.plotNote}>{all ? "No rent or expenses yet" : `No rent or expenses in ${ys.label}`}</div>}
        {hm && hover !== null && !hm.isFuture && (
          <ChartTip
            x={cx0(hover)}
            y={4}
            boxWidth={W}
            title={hm.longLabel}
            rows={[
              { label: "Rent collected", value: inr(hm.income), color: C.income },
              { label: "Expenses", value: inr(hm.expenses), color: C.expense },
              { label: "Net cash", value: inr(hm.net), strong: true },
            ]}
            foot={all ? `Running net since the start: ${inr(hm.cumulative)}` : `Running net in ${ys.label}: ${inr(hm.cumulative)}`}
          />
        )}
      </div>
      <table className="sr-only">
        <caption>{all ? "Cash by year, all time" : `Monthly cash, ${ys.label}`}</caption>
        <thead>
          <tr>
            <th>{all ? "Year" : "Month"}</th>
            <th>Rent collected</th>
            <th>Expenses</th>
            <th>Net cash</th>
          </tr>
        </thead>
        <tbody>
          {points.map((m) => (
            <tr key={m.key}>
              <td>{m.longLabel}</td>
              <td className={s.tIncome}>{inr(m.income)}</td>
              <td className={s.tExpense}>{inr(m.expenses)}</td>
              <td className={m.net < 0 ? s.tExpense : m.net > 0 ? s.tIncome : undefined}>{inr(m.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Total({ label, value, tone, strong, onClick }: { label: string; value: number; tone?: "income" | "expense"; strong?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className={s.totalLabel}>{label}</span>
      <span className={cx(s.totalValue, "num", value !== 0 && tone === "income" && s.tIncome, value !== 0 && tone === "expense" && s.tExpense, strong && s.totalStrong)}>{inr(value)}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={cx(s.total, s.totalBtn)} onClick={onClick} title="Click for breakdown">
      {body}
    </button>
  ) : (
    <span className={s.total}>{body}</span>
  );
}
