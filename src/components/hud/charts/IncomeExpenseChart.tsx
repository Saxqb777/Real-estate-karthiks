"use client";
// Dock tab 1 — Income vs expenses: monthly rent collected (teal) and expenses (coral) as paired columns, net cash as a
// line, one FY / calendar year at a time (data.monthlyByYear, grouped by the API — the UI never regroups).
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { YearSeries } from "@/lib/dashboard-types";
import { inr } from "../format";
import { ChartTip, LegendKey, axisINR, barPath, niceTicks, useSize } from "./util";
import s from "./charts.module.css";

export interface IncomeExpenseChartProps {
  years: YearSeries[];
  /** selected year key (default: the year containing the as-of date) */
  year?: number;
  onYearChange?: (year: number) => void;
  /** click a total of the CURRENT year → its explanation ("year:netCash"; other years have no explanation) */
  onDrill?: (key: "rentCollected" | "expenses" | "netCash", year: YearSeries) => void;
  className?: string;
}

const C = { income: "var(--teal)", expense: "var(--coral)", net: "var(--plaster)" };
const M = { l: 50, r: 10, t: 12, b: 22 };

export function IncomeExpenseChart({ years, year: controlled, onYearChange, onDrill, className }: IncomeExpenseChartProps) {
  const current = years.find((y) => y.isCurrent) ?? years[years.length - 1];
  const [inner, setInner] = useState<number | undefined>(undefined);
  const key = controlled ?? inner ?? current?.year;
  const idx = Math.max(0, years.findIndex((y) => y.year === key));
  const ys = years[idx];
  const setYear = (i: number) => {
    const y = years[i];
    if (!y) return;
    setInner(y.year);
    onYearChange?.(y.year);
  };
  const [box, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (!ys) return <div className={s.empty}>No money recorded yet — the months fill in as rent and expenses are added.</div>;

  const W = Math.max(size.w, 200);
  const H = Math.max(size.h, 120);
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const vals = ys.months.flatMap((m) => (m.isFuture ? [0] : [m.income, m.expenses, m.net]));
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => M.t + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const band = pw / 12;
  const bw = Math.max(4, Math.min(20, (band - 14) / 2));
  const cx0 = (i: number) => M.l + band * i + band / 2;
  const past = ys.months.map((m, i) => ({ m, i })).filter((p) => !p.m.isFuture);
  const linePts = past.map(({ m, i }) => `${cx0(i)},${y(m.net)}`).join(" ");
  const hm = hover !== null ? ys.months[hover] : null;
  const drill = onDrill && ys.isCurrent ? onDrill : undefined;
  const allZero = past.every(({ m }) => m.income === 0 && m.expenses === 0);

  return (
    <div className={cx(s.chart, className)}>
      <div className={s.chartBar}>
        <div className={s.stepper}>
          <button type="button" onClick={() => setYear(idx - 1)} disabled={idx === 0} aria-label="Previous year">
            <ChevronLeft aria-hidden />
          </button>
          <span className={s.stepperLabel}>{ys.label}</span>
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
          <Total label="Rent collected" value={ys.income} tone="income" onClick={drill ? () => drill("rentCollected", ys) : undefined} />
          <Total label="Expenses" value={ys.expenses} tone="expense" onClick={drill ? () => drill("expenses", ys) : undefined} />
          <Total label="Net cash" value={ys.net} tone={ys.net < 0 ? "expense" : undefined} strong onClick={drill ? () => drill("netCash", ys) : undefined} />
        </div>
      </div>
      <div ref={box} className={s.plot} onMouseLeave={() => setHover(null)}>
        {size.w > 0 && (
          <svg width={W} height={H} role="img" aria-label={`Rent collected and expenses by month, ${ys.label}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? s.zero : s.grid} />
                <text x={M.l - 8} y={y(t)} className={s.yLabel} dominantBaseline="middle" textAnchor="end">
                  {axisINR(t)}
                </text>
              </g>
            ))}
            {ys.months.map((m, i) => (
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
        {allZero && <div className={s.plotNote}>No rent or expenses in {ys.label}</div>}
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
            foot={`Running net in ${ys.label}: ${inr(hm.cumulative)}`}
          />
        )}
      </div>
      <table className="sr-only">
        <caption>Monthly cash, {ys.label}</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Rent collected</th>
            <th>Expenses</th>
            <th>Net cash</th>
          </tr>
        </thead>
        <tbody>
          {ys.months.map((m) => (
            <tr key={m.key}>
              <td>{m.longLabel}</td>
              <td>{inr(m.income)}</td>
              <td>{inr(m.expenses)}</td>
              <td>{inr(m.net)}</td>
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
