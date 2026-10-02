"use client";
// Small hand-drawn SVG charts for the reports (screen + print). Bars start at zero, colours carry meaning:
// rent teal, expenses coral, occupancy sky, paper value marigold. Values are drawn exactly as the API sends them.
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { inr } from "@/components/hud/format";
import type { VacantPeriod } from "@/lib/dashboard-types";
import { MS_PER_DAY } from "@/lib/dates";
import { d, useDocMode } from "./parts";
import s from "./reports.module.css";

// ---------------------------------------------------------------- month bars (rent up, expenses down)

export interface MonthBar {
  key: string;
  label: string; // "Apr 2025"
  rent: number;
  expenses: number;
  net: number;
  future: boolean;
}

/** Mirrored month bars with a hover readout (defaults to the year's totals). */
export function MonthBars({ months, totals }: { months: MonthBar[]; totals: { rent: number; expenses: number; net: number; label: string } }) {
  const mode = useDocMode();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => Math.max(m.rent, m.expenses)));
  const W = 600;
  const H = mode === "print" ? 92 : 120;
  const mid = H * 0.56;
  const up = mid - 6;
  const down = H - mid - 16;
  const step = W / months.length;
  const bw = Math.min(26, step * 0.46);
  const h = hover === null ? null : months[hover];
  return (
    <div className={s.mbars}>
      <div className={s.mbarsRead} aria-live="polite">
        <span className={s.mbarsWhen}>{h ? h.label : totals.label}</span>
        {h?.future ? (
          <span className={s.calmInline}>hasn&rsquo;t happened yet</span>
        ) : (
          <>
            <span>
              <i className={s.keyInc} aria-hidden /> Rent <b className={cx("num", s.tInc)}>{inr(h ? h.rent : totals.rent)}</b>
            </span>
            <span>
              <i className={s.keyExp} aria-hidden /> Expenses <b className={cx("num", s.tExp)}>{inr(h ? h.expenses : totals.expenses)}</b>
            </span>
            <span>
              Net cash <b className={cx("num", (h ? h.net : totals.net) < 0 && s.tExp)}>{inr(h ? h.net : totals.net)}</b>
            </span>
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={s.mbarsSvg} preserveAspectRatio="none" role="img" aria-label="Rent and expenses by month" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={mid} y2={mid} className={s.axis} />
        {months.map((m, i) => {
          const cx0 = step * i + step / 2;
          const rh = (m.rent / max) * up;
          const eh = (m.expenses / max) * down;
          return (
            <g key={m.key} onMouseEnter={() => setHover(i)} className={cx(s.mcol, hover === i && s.mcolOn, m.future && s.mcolFuture)}>
              <rect x={step * i} y={0} width={step} height={H} className={s.mhit} />
              {m.rent > 0 && <rect x={cx0 - bw / 2} y={mid - rh} width={bw} height={Math.max(rh, 1)} className={s.barInc} rx={1.5} />}
              {m.expenses > 0 && <rect x={cx0 - bw / 2} y={mid + 1} width={bw} height={Math.max(eh, 1)} className={s.barExp} rx={1.5} />}
              {m.rent === 0 && m.expenses === 0 && !m.future && <rect x={cx0 - bw / 2} y={mid - 1} width={bw} height={2} className={s.barZero} />}
            </g>
          );
        })}
      </svg>
      <div className={s.mbarsAxis} aria-hidden>
        {months.map((m, i) => (
          <span key={m.key} className={cx(hover === i && s.on, m.future && s.future)}>
            {m.label.slice(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- occupancy strip

const dayOf = (iso: string) => Math.floor(new Date(iso).getTime() / MS_PER_DAY);

export interface StripSpan {
  /** first day (ISO) */
  start: string;
  /** last day, inclusive (ISO) */
  end: string;
  label?: string;
}

/**
 * One unit's days in a window: let (solid sky), empty (blueprint hatch), not owned / not yet (dashed).
 * Geometry only — the day counts printed next to it come from the API.
 */
export function OccupancyStrip({
  from,
  to,
  ownedFrom,
  through,
  vacant,
  lets,
  ticks,
}: {
  /** window start / end (inclusive, ISO) */
  from: string;
  to: string;
  /** first owned day in the window */
  ownedFrom: string;
  /** last day counted (today / year end) */
  through: string;
  vacant: Pick<VacantPeriod, "start" | "lastDay" | "ongoing">[];
  /** optional named let spans (tenants) drawn as labels on the let colour */
  lets?: StripSpan[];
  ticks?: { at: string; label: string }[];
}) {
  const pid = useId().replace(/:/g, "");
  const a = dayOf(from);
  const b = dayOf(to) + 1;
  const span = Math.max(1, b - a);
  const x = (day: number) => `${(Math.min(Math.max(day, a), b) - a) / span * 100}%`;
  const w = (s0: number, s1: number) => `${(Math.max(0, Math.min(s1, b) - Math.max(s0, a)) / span) * 100}%`;
  const own0 = Math.max(a, dayOf(ownedFrom));
  const thr = Math.min(b, dayOf(through) + 1);
  return (
    <div className={s.strip}>
      <div className={s.stripTrack}>
        {/* not owned yet */}
        {own0 > a && <span className={cx(s.seg, s.segNone)} style={{ left: 0, width: w(a, own0) }} title="Not owned yet" />}
        {/* owned and counted: let, with vacant periods on top */}
        {thr > own0 && <span className={cx(s.seg, s.segLet)} style={{ left: x(own0), width: w(own0, thr) }} />}
        {(lets ?? []).map((l, i) => {
          const l0 = Math.max(own0, dayOf(l.start));
          const l1 = Math.min(thr, dayOf(l.end) + 1);
          if (l1 <= l0) return null;
          return (
            <span key={i} className={cx(s.seg, s.segLetNamed)} style={{ left: x(l0), width: w(l0, l1) }} title={l.label}>
              {l.label && <em>{l.label}</em>}
            </span>
          );
        })}
        {vacant.map((v, i) => {
          const v0 = Math.max(own0, dayOf(v.start));
          const v1 = Math.min(thr, dayOf(v.lastDay) + 1);
          if (v1 <= v0) return null;
          return (
            <span key={i} className={cx(s.seg, s.segVacant)} style={{ left: x(v0), width: w(v0, v1) }} title={`Empty ${d(v.start)} – ${d(v.lastDay)}${v.ongoing ? " (still empty)" : ""}`}>
              <svg aria-hidden className={s.hatch}>
                <defs>
                  <pattern id={`h${pid}${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="6" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#h${pid}${i})`} />
              </svg>
            </span>
          );
        })}
        {/* after the last counted day */}
        {thr < b && <span className={cx(s.seg, s.segFuture)} style={{ left: x(thr), width: w(thr, b) }} title="Not yet" />}
      </div>
      {ticks && ticks.length > 0 && (
        <div className={s.stripTicks} aria-hidden>
          {ticks.map((t) => (
            <span key={t.at} style={{ left: x(dayOf(t.at)) }}>
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StripLegend({ notOwned, future }: { notOwned?: boolean; future?: boolean }) {
  return (
    <div className={s.legend} aria-hidden>
      <span>
        <i className={s.lgLet} /> Let
      </span>
      <span>
        <i className={s.lgVacant} /> Empty
      </span>
      {notOwned && (
        <span>
          <i className={s.lgNone} /> Not owned yet
        </span>
      )}
      {future && (
        <span>
          <i className={s.lgFuture} /> Not yet
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- value line (unit story)

export interface ValuePoint {
  date: string;
  label: string;
  estimate: number;
  offer: number | null;
}

/** Growth estimate (dashed marigold) and best offer so far (solid steps) from zero, with the price paid as a baseline. */
export function ValueChart({ points, price, legend }: { points: ValuePoint[]; price: number; legend?: ReactNode }) {
  const mode = useDocMode();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 600;
  const H = mode === "print" ? 120 : 150;
  const padT = 10;
  const padB = 4;
  const a = dayOf(points[0].date);
  const b = dayOf(points[points.length - 1].date);
  const span = Math.max(1, b - a);
  const max = Math.max(price, ...points.map((p) => Math.max(p.estimate, p.offer ?? 0))) * 1.08;
  const X = (iso: string) => ((dayOf(iso) - a) / span) * W;
  const Y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const est = points.map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)},${Y(p.estimate).toFixed(1)}`).join(" ");
  // best offer so far: step line from the first point that has one
  let offer = "";
  let last: number | null = null;
  points.forEach((p) => {
    if (p.offer === null) return;
    const px = X(p.date).toFixed(1);
    if (last === null) offer += `M${px},${Y(p.offer).toFixed(1)}`;
    else offer += ` L${px},${Y(last).toFixed(1)} L${px},${Y(p.offer).toFixed(1)}`;
    last = p.offer;
  });
  const h = hover === null ? points[points.length - 1] : points[hover];
  return (
    <div className={s.vchart}>
      <div className={s.mbarsRead}>
        <span className={s.mbarsWhen}>{h.label === "Today" ? `Today · ${d(h.date)}` : `${h.label} · ${d(h.date)}`}</span>
        <span>
          <i className={s.keyEst} aria-hidden /> Growth estimate <b className={cx("num", s.tVal)}>{inr(h.estimate)}</b>
        </span>
        <span>
          <i className={s.keyOffer} aria-hidden /> Best offer so far <b className={cx("num", s.tVal)}>{h.offer === null ? "—" : inr(h.offer)}</b>
        </span>
        {legend}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={s.vchartSvg} preserveAspectRatio="none" role="img" aria-label="Value over time" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} className={s.axis} />
        <line x1={0} x2={W} y1={Y(price)} y2={Y(price)} className={s.priceLine} />
        <path d={est} className={s.estLine} />
        {offer && <path d={offer} className={s.offerLine} />}
        {points.map((p, i) => (
          <g key={p.date} onMouseEnter={() => setHover(i)}>
            <rect x={X(p.date) - W / points.length / 2} y={0} width={W / points.length} height={H} className={s.mhit} />
            <circle cx={X(p.date)} cy={Y(p.estimate)} r={hover === i ? 3.5 : 2} className={s.estDot} />
          </g>
        ))}
      </svg>
      <div className={s.vchartAxis} aria-hidden>
        <span>{d(points[0].date)}</span>
        <span className={s.priceTag}>Price paid {inr(price)}</span>
        <span>{d(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
