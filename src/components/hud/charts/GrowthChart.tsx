"use client";
// Dock tab 5 — Growth, as two separate charts (never one dual-axis chart):
//   left  CASH: running net cash at each year end (data.cumulativeNetByYear)
//   right PAPER VALUE: price per sqft — what you paid vs what it's worth now (est. / offer), per unit and overall
import { useState } from "react";
import { cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { BucketIcon, PaperTag } from "../Figure";
import { inr } from "../format";
import { ChartTip, LegendKey, axisINR, barPath, niceTicks, useSize } from "./util";
import s from "./charts.module.css";

export interface GrowthChartProps {
  data: DashboardData;
  onDrill?: (key: string) => void;
  className?: string;
}

const M = { l: 50, r: 8, t: 14, b: 20 };

export function GrowthChart({ data, onDrill, className }: GrowthChartProps) {
  return (
    <div className={cx(s.growth, className)}>
      <CumulativeNet data={data} onDrill={onDrill} />
      <PerSqft data={data} onDrill={onDrill} />
    </div>
  );
}

function CumulativeNet({ data, onDrill }: { data: DashboardData; onDrill?: (key: string) => void }) {
  const pts = data.cumulativeNetByYear;
  const [box, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const last = pts[pts.length - 1];
  return (
    <section className={s.growthCol}>
      <header className={s.growthHead}>
        <BucketIcon bucket="cash" />
        <span className={s.growthTitle}>Net cash, added up year by year</span>
        {last && (
          <button type="button" className={s.growthTotal} onClick={onDrill ? () => onDrill("netCash") : undefined} disabled={!onDrill} title="Net cash, all time · click for breakdown">
            <span className="num">{inr(last.cumulative)}</span>
          </button>
        )}
      </header>
      <div ref={box} className={s.plot} onMouseLeave={() => setHover(null)}>
        {pts.length === 0 ? (
          <div className={s.empty}>No cash yet.</div>
        ) : (
          size.w > 0 &&
          (() => {
            const W = size.w;
            const H = Math.max(size.h, 100);
            const pw = W - M.l - M.r;
            const ph = H - M.t - M.b;
            const ticks = niceTicks(Math.min(0, ...pts.map((p) => p.cumulative)), Math.max(0, ...pts.map((p) => p.cumulative)), 4);
            const lo = ticks[0];
            const hi = ticks[ticks.length - 1];
            const y = (v: number) => M.t + ph - ((v - lo) / (hi - lo || 1)) * ph;
            const band = pw / pts.length;
            const bw = Math.min(24, band - 10);
            const short = (l: string) => l.replace(/^FY (\d{4})-(\d{2})$/, (_, a: string, b: string) => `${a.slice(2)}-${b}`);
            return (
              <svg width={W} height={H} role="img" aria-label="Running net cash at each year end">
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? s.zero : s.grid} />
                    <text x={M.l - 8} y={y(t)} className={s.yLabel} dominantBaseline="middle" textAnchor="end">
                      {axisINR(t)}
                    </text>
                  </g>
                ))}
                {pts.map((p, i) => {
                  const x0 = M.l + band * i + (band - bw) / 2;
                  return (
                    <g key={p.year} onMouseEnter={() => setHover(i)}>
                      <rect x={M.l + band * i} y={M.t} width={band} height={ph} fill="transparent" />
                      <path d={barPath(x0, y(0), y(p.cumulative), bw)} className={cx(s.bar, p.cumulative < 0 ? s.barNeg : s.barPos, hover === i && s.barHover)} />
                      <text x={x0 + bw / 2} y={H - 5} className={s.xLabel} textAnchor="middle">
                        {short(p.label)}
                      </text>
                    </g>
                  );
                })}
                {last && (
                  <text x={M.l + band * (pts.length - 1) + band / 2} y={y(last.cumulative) - 6} className={s.endLabel} textAnchor="middle">
                    {axisINR(last.cumulative)}
                  </text>
                )}
              </svg>
            );
          })()
        )}
        {hover !== null && pts[hover] && (
          <ChartTip
            x={M.l + ((size.w - M.l - M.r) / pts.length) * (hover + 0.5)}
            y={2}
            boxWidth={size.w}
            title={pts[hover].label}
            rows={[
              { label: "Net cash that year", value: inr(pts[hover].net) },
              { label: "Running total", value: inr(pts[hover].cumulative), strong: true },
            ]}
          />
        )}
      </div>
    </section>
  );
}

function PerSqft({ data, onDrill }: { data: DashboardData; onDrill?: (key: string) => void }) {
  const units = data.units.filter((u) => u.isActive && u.boughtAtPerSqft !== null);
  const rows = [
    ...units.map((u) => ({ id: u.id, label: u.name, bought: u.boughtAtPerSqft, now: u.offeredAtPerSqft, src: u.valuationSource, bKey: `unit:${u.id}:perSqftBought`, nKey: `unit:${u.id}:perSqftOffered` })),
    { id: "all", label: "Property", bought: data.kpis.boughtAtPerSqft, now: data.kpis.offeredAtPerSqft, src: data.kpis.bestOfferIsPartialEstimate ? "estimate" : "offer", bKey: "perSqftBought", nKey: "perSqftOffered" },
  ].filter((r) => r.bought !== null);
  const max = Math.max(1, ...rows.flatMap((r) => [r.bought ?? 0, r.now ?? 0]));
  return (
    <section className={s.growthCol}>
      <header className={s.growthHead}>
        <BucketIcon bucket="value" />
        <span className={s.growthTitle}>Price per sqft — paid vs worth now</span>
        <PaperTag kind="est." />
      </header>
      <div className={s.legend}>
        <LegendKey color="var(--text-faint)" label="Paid" />
        <LegendKey color="var(--marigold)" label="Worth now (est. / offer)" />
      </div>
      <ul className={s.sqft}>
        {rows.map((r) => (
          <li key={r.id} className={cx(s.sqftRow, r.id === "all" && s.sqftAll)}>
            <span className={s.sqftLabel}>{r.label}</span>
            <div className={s.sqftBars}>
              <SqftBar value={r.bought} max={max} tone="paid" onClick={onDrill && data.explain[r.bKey] ? () => onDrill(r.bKey) : undefined} />
              <SqftBar value={r.now} max={max} tone="now" onClick={onDrill && data.explain[r.nKey] ? () => onDrill(r.nKey) : undefined} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SqftBar({ value, max, tone, onClick }: { value: number | null; max: number; tone: "paid" | "now"; onClick?: () => void }) {
  const w = value === null ? 0 : (value / max) * 100;
  const body = (
    <>
      <span className={cx(s.sqftFill, tone === "now" ? s.sqftNow : s.sqftPaid)} style={{ width: `calc(${w}% - 64px)` }} />
      <span className={cx(s.sqftVal, "num", tone === "now" && s.paperNum)}>{value === null ? "—" : `${inr(value)}`}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={s.sqftBar} onClick={onClick} title="Click for breakdown">
      {body}
    </button>
  ) : (
    <span className={s.sqftBar}>{body}</span>
  );
}
