"use client";
// Dock tab 3 — Front vs Back: the units side by side in the three buckets. Unit columns are each unit's own figures;
// the last column is the property figure (whole-plot expenses included there, so it can exceed the unit sum — said so).
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import type { DashboardData, ExplainFormat, UnitBreakdown } from "@/lib/dashboard-types";
import { BucketIcon, PaperTag } from "../Figure";
import { BUCKETS, explainKey, fmt, positionLabel, type Bucket } from "../format";
import type { PeriodKind } from "../types";
import s from "./charts.module.css";

export interface UnitsCompareProps {
  data: DashboardData;
  period: PeriodKind;
  /** a cell was clicked → its explanation key */
  onDrill?: (key: string) => void;
  onOpenUnit?: (unitId: string) => void;
  className?: string;
}

interface Row {
  label: string;
  format: ExplainFormat;
  unit: (u: UnitBreakdown) => number | null;
  total: number | null;
  /** explain key base for unit cells ("rentCollected"); scoped = follows the period */
  key?: string;
  totalKey?: string;
  scoped?: boolean;
  tone?: "income" | "expense" | "signed" | "dim";
  paper?: boolean;
  /** compact ₹ L / Cr for the whole row (big paper values); other rows show exact rupees */
  compact?: boolean;
  note?: string;
}

export function UnitsCompare({ data, period, onDrill, onOpenUnit, className }: UnitsCompareProps) {
  // same order as the tab title ("116/B8 vs 116/B7": back first — dockTabLabel)
  const units = data.units.filter((u) => u.isActive).sort((a, b) => (a.position === "back" ? -1 : b.position === "back" ? 1 : 0));
  const k = data.kpis;
  const p = data.periods[period];
  if (units.length === 0) return <div className={s.empty}>Build a unit to compare front and back.</div>;
  // rental yield, last 12 months (owner 8/10): rent ÷ worth now; net = after expenses
  const yieldOf = (u: UnitBreakdown) => data.yields.units.find((r) => r.unitId === u.id) ?? null;
  const py = data.yields.property;

  const groups: { bucket: Bucket; scope: string; rows: Row[] }[] = [
    {
      bucket: "cash",
      scope: p.label,
      rows: [
        { label: "Rent collected", format: "inr", unit: (u) => u.periods[period].rentCollected, total: p.rentCollected, key: "rentCollected", scoped: true, tone: "income" },
        { label: "Expenses", format: "inr", unit: (u) => u.periods[period].expenses, total: p.expenses, key: "expenses", scoped: true, tone: "expense", note: "Property column includes whole-plot expenses" },
        { label: "Net cash", format: "inr", unit: (u) => u.periods[period].net, total: p.net, key: "netCash", scoped: true, tone: "signed" },
      ],
    },
    {
      bucket: "value",
      scope: data.scopeLabels.asOf,
      rows: [
        { label: "Invested", format: "inr", unit: (u) => u.purchasePrice, total: k.invested, totalKey: "invested" },
        { label: "Worth now (est.)", format: "inr", unit: (u) => u.valuation, total: k.bestOfferTotal, key: "worthNow", paper: true },
        { label: "Gain", format: "inr", unit: (u) => u.appreciation, total: k.appreciation, key: "gain", paper: true },
        { label: "Level (×)", format: "multiplier", unit: (u) => u.capitalMultiplier, total: k.capitalMultiplier, key: "multiplier" },
        { label: "Gross yield", format: "pct", unit: (u) => yieldOf(u)?.grossOnValue ?? null, total: py.grossOnValue, key: "yield:grossValue" },
        { label: "Net yield", format: "pct", unit: (u) => yieldOf(u)?.netOnValue ?? null, total: py.netOnValue, key: "yield:netValue" },
      ],
    },
    {
      bucket: "occupancy",
      scope: data.scopeLabels.allTime,
      rows: [
        { label: "Occupancy", format: "pct", unit: (u) => u.occupancyPct, total: k.occupancyPct, key: "occupancy" },
        { label: "Vacant days", format: "days", unit: (u) => u.vacantDays, total: k.vacantDays, key: "vacantDays" },
        { label: "Rent lost (vacant)", format: "inr", unit: (u) => u.unrealizedLoss, total: k.unrealizedLoss, key: "rentLost", tone: "dim" },
      ],
    },
  ];

  const cellKey = (r: Row, u: UnitBreakdown | null) => {
    if (u) return r.key ? explainKey(r.key, r.scoped ? period : null, u.id) : null;
    const base = r.totalKey ?? r.key;
    return base ? explainKey(base, r.scoped ? period : null) : null;
  };
  const cell = (r: Row, v: number | null, key: string | null, strong?: boolean): ReactNode => {
    const text = fmt(v, r.format, Boolean(r.compact));
    const neg = typeof v === "number" && v < 0;
    const zero = v === 0;
    const inner = (
      <span
        className={cx(
          "num",
          s.cmpNum,
          (r.tone === "income" || (r.tone === "signed" && !neg)) && !zero && s.tIncome,
          (r.tone === "expense" || (r.tone === "signed" && neg)) && !zero && s.tExpense,
          r.tone === "dim" && s.tDimNum,
          strong && s.cmpStrong,
        )}
      >
        {text}
      </span>
    );
    const exact = r.compact && v !== null ? fmt(v, "inr") : undefined;
    return key && onDrill && data.explain[key] ? (
      <button type="button" className={s.cmpBtn} onClick={() => onDrill(key)} title={exact ? `${exact} · Click for breakdown` : "Click for breakdown"}>
        {inner}
      </button>
    ) : (
      <span className={s.cmpStatic} title={exact}>
        {inner}
      </span>
    );
  };

  return (
    <div className={cx(s.cmp, className)}>
      {groups.map((g) => (
        <section key={g.bucket} className={s.cmpGroup} data-bucket={g.bucket}>
          <header className={s.cmpHead}>
            <BucketIcon bucket={g.bucket} />
            <span className={s.cmpTitle}>{BUCKETS[g.bucket].label}</span>
            <span className={s.cmpScope}>{g.scope}</span>
            {g.bucket === "value" && <PaperTag kind="est." />}
          </header>
          <table className={s.cmpTable}>
            <thead>
              <tr>
                <th scope="col" />
                {units.map((u) => (
                  <th key={u.id} scope="col">
                    {onOpenUnit ? (
                      <button type="button" className={s.cmpUnit} onClick={() => onOpenUnit(u.id)}>
                        {positionLabel(u.position) ?? u.name}
                      </button>
                    ) : (
                      (positionLabel(u.position) ?? u.name)
                    )}
                  </th>
                ))}
                <th scope="col" className={s.cmpTotalHead}>
                  Property
                </th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" title={r.note}>
                    {r.label}
                  </th>
                  {units.map((u) => (
                    <td key={u.id}>{cell(r, r.unit(u), cellKey(r, u))}</td>
                  ))}
                  <td className={s.cmpTotal}>{cell(r, r.total, cellKey(r, null), true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
