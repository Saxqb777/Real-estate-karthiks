"use client";
// Dock tab 4 — Occupancy: who lived where, purchase → today (data.timeline). Tenant bars in occupancy blue, empty
// stretches hatched with the rent they lost (an opportunity cost, never cash), year ticks and a today marker.
import { useId, useState } from "react";
import { cx } from "@/components/ui";
import type { Timeline, VacantPeriod } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { firstName, inr, inrCompact } from "../format";
import { ChartTip, LegendKey, useSize } from "./util";
import s from "./charts.module.css";

export interface OccupancyGanttProps {
  timeline: Timeline;
  /** the as-of date (marker) */
  asOf: string;
  isLive: boolean;
  onLease?: (leaseId: string, label: string) => void;
  onUnit?: (unitId: string) => void;
  className?: string;
}

const M = { r: 14, t: 18, b: 6 };
const DAY = 86_400_000;

type Hover =
  | { kind: "lease"; unit: string; name: string; start: string; end: string | null; rent: number; state: string; x: number; y: number }
  | { kind: "vacant"; unit: string; v: VacantPeriod; x: number; y: number };

const shortYear = (label: string) => label.replace(/^FY (\d{4})-(\d{2})$/, (_, a: string, b: string) => `FY ${a.slice(2)}-${b}`);

export function OccupancyGantt({ timeline, asOf, isLive, onLease, onUnit, className }: OccupancyGanttProps) {
  const [box, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const hatchId = `pe-hatch-${useId().replace(/:/g, "")}`;
  const units = timeline.units.filter((u) => u.isActive);
  if (!timeline.range.start || units.length === 0) return <div className={s.empty}>No units yet — the occupancy story starts with your first purchase.</div>;

  const t0 = new Date(timeline.range.start).getTime();
  const t1 = new Date(timeline.range.end).getTime() + DAY;
  const W = Math.max(size.w, 260);
  const H = Math.max(size.h, 100);
  const LABEL_W = W < 520 ? 66 : 92;
  const pw = W - LABEL_W - M.r;
  const x = (iso: string | number) => LABEL_W + ((Math.min(Math.max(typeof iso === "number" ? iso : new Date(iso).getTime(), t0), t1) - t0) / (t1 - t0)) * pw;
  const rowH = Math.min(46, (H - M.t - M.b) / units.length);
  const barH = Math.min(24, rowH - 12);
  const asOfX = x(new Date(asOf).getTime() + DAY / 2);
  // label every n-th year tick so labels never collide (lines stay for every year)
  const tickGap = timeline.yearTicks.length > 1 ? x(timeline.yearTicks[1].date) - x(timeline.yearTicks[0].date) : pw;
  const every = Math.max(1, Math.ceil(60 / Math.max(tickGap, 1)));

  return (
    <div className={cx(s.chart, className)}>
      <div className={s.chartBar}>
        <div className={s.legend}>
          <LegendKey color="var(--sky)" label="Tenant living there" />
          <LegendKey color="var(--text-dim)" label="Empty — rent lost (not cash)" hatch />
          <LegendKey color="var(--marigold)" label={isLive ? "Today" : "As of"} line />
        </div>
        <span className={s.chartNote}>
          {formatDate(timeline.range.start)} → {formatDate(timeline.range.end)}
        </span>
      </div>
      <div ref={box} className={s.plot} onMouseLeave={() => setHover(null)}>
        {size.w > 0 && (
          <svg width={W} height={H} role="img" aria-label="Who lived in each unit over time">
            <defs>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="rgba(243,233,216,0.03)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(243,233,216,0.22)" strokeWidth="1.5" />
              </pattern>
            </defs>
            {timeline.yearTicks.map((t, i) => (
              <g key={t.key}>
                <line x1={x(t.date)} x2={x(t.date)} y1={M.t - 4} y2={H - M.b} className={s.grid} />
                {(timeline.yearTicks.length - 1 - i) % every === 0 && (
                  <text x={x(t.date) + 4} y={M.t - 7} className={s.yLabel}>
                    {shortYear(t.label)}
                  </text>
                )}
              </g>
            ))}
            {units.map((u, i) => {
              const top = M.t + i * rowH + (rowH - barH) / 2;
              const cy = top + barH / 2;
              return (
                <g key={u.unitId}>
                  <line x1={LABEL_W} x2={W - M.r} y1={cy} y2={cy} className={s.track} />
                  <foreignObject x={0} y={top - 4} width={LABEL_W - 10} height={barH + 8}>
                    <button type="button" className={s.ganttUnit} onClick={onUnit ? () => onUnit(u.unitId) : undefined} disabled={!onUnit}>
                      <span>{u.unitName}</span>
                      {u.position && <span className={s.ganttPos}>{u.position === "front" ? "Front" : "Back"}</span>}
                    </button>
                  </foreignObject>
                  {/* purchase tick */}
                  <line x1={x(u.purchaseDate)} x2={x(u.purchaseDate)} y1={top - 3} y2={top + barH + 3} className={s.purchase} />
                  {u.vacant.map((v, j) => {
                    const x0 = x(v.start);
                    const x1 = x(new Date(v.end).getTime());
                    const w = Math.max(1, x1 - x0);
                    return (
                      <g key={`v${j}`} onMouseEnter={() => setHover({ kind: "vacant", unit: u.unitName, v, x: x0 + w / 2, y: top })}>
                        <rect x={x0} y={top} width={w} height={barH} fill={`url(#${hatchId})`} className={s.vacant} rx={2} />
                        {w > 64 && v.unrealizedLoss > 0 && (
                          <text x={x0 + w / 2} y={cy} className={s.vacantLabel} textAnchor="middle" dominantBaseline="central">
                            {inrCompact(v.unrealizedLoss)} lost
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {u.leases.map((l) => {
                    if (new Date(l.start).getTime() > t1) return null;
                    const x0 = x(l.start);
                    const x1 = l.end ? x(new Date(l.end).getTime() + DAY) : x(t1);
                    const w = Math.max(2, x1 - x0 - 1);
                    const label = `${firstName(l.tenantName)} · ${inr(l.monthlyRent)}`;
                    return (
                      <g
                        key={l.leaseId}
                        className={cx(s.lease, onLease && s.leaseBtn)}
                        onMouseEnter={() => setHover({ kind: "lease", unit: u.unitName, name: l.tenantName, start: l.start, end: l.end, rent: l.monthlyRent, state: l.state, x: x0 + w / 2, y: top })}
                        onClick={onLease ? () => onLease(l.leaseId, l.tenantName) : undefined}
                      >
                        <rect x={x0} y={top} width={w} height={barH} rx={3} className={cx(s.leaseBar, l.state === "current" && s.leaseCurrent)} />
                        {w > label.length * 6.4 + 12 ? (
                          <text x={x0 + 8} y={cy} className={s.leaseLabel} dominantBaseline="central">
                            {label}
                          </text>
                        ) : w > 54 ? (
                          <text x={x0 + 6} y={cy} className={s.leaseLabel} dominantBaseline="central">
                            {firstName(l.tenantName)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <line x1={asOfX} x2={asOfX} y1={M.t - 6} y2={H - M.b} className={s.today} />
            <rect x={asOfX - 3} y={M.t - 9} width={6} height={6} transform={`rotate(45 ${asOfX} ${M.t - 6})`} className={s.todayDot} />
          </svg>
        )}
        {hover && (
          <ChartTip
            x={hover.x}
            y={Math.max(0, hover.y - 8)}
            boxWidth={W}
            title={hover.kind === "lease" ? hover.name : `${hover.unit} empty`}
            rows={
              hover.kind === "lease"
                ? [
                    { label: "Unit", value: hover.unit },
                    { label: "Lived there", value: `${formatDate(hover.start)} – ${hover.end ? formatDate(hover.end) : "now"}` },
                    { label: "Rent", value: `${inr(hover.rent)}/mo`, color: "var(--sky)" },
                  ]
                : [
                    { label: "Empty", value: `${formatDate(hover.v.start)} – ${hover.v.ongoing ? "now" : formatDate(hover.v.lastDay)}` },
                    { label: "Days", value: String(hover.v.days) },
                    { label: "Rent lost (vacant)", value: inr(hover.v.unrealizedLoss), strong: true },
                  ]
            }
            foot={
              hover.kind === "vacant"
                ? hover.v.noRentHistory
                  ? "No lease yet, so no rent lost by rule"
                  : `${hover.v.days} days × ${inr(hover.v.rentBasis)} ÷ 30 — ${hover.v.rentBasisSource === "next-lease" ? "next tenant's" : "last tenant's"} rent`
                : hover.state === "current"
                  ? "Current lease"
                  : hover.state === "incoming"
                    ? "Starts later"
                    : "Ended"
            }
          />
        )}
      </div>
    </div>
  );
}
