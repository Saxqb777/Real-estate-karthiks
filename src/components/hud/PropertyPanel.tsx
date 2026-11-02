"use client";
// The property window (plot marker / P). Compact style (owner 9/10/2026): one column of slim rows — net cash (period
// switch in the title bar), worth now, the next 12 months (est.) and occupancy, each big figure with its parts written
// beneath; every figure and part drills down (breadcrumb inside). The ledger check sits next to the title.
import { Building2 } from "lucide-react";
import { EmptyState, LevelBadge, LinkButton, SegmentedBar, cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { Fig, vsLastYear } from "./Figure";
import { PeriodSwitch } from "./PeriodSwitch";
import { explainKey, fmt, yoyKey } from "./format";
import type { PeriodKind } from "./types";
import s from "./hud.module.css";
import b from "./bits.module.css";

export interface PropertyPanelProps {
  data: DashboardData;
  /** the global period control (All time · Year · Month) — drives the CASH FLOW bucket */
  period: PeriodKind;
  onClose?: () => void;
  /** a unit was clicked inside a breakdown */
  onOpenUnit?: (unitId: string) => void;
  /** "left" over the world (default) or "inline" (mobile sheet, gallery) */
  side?: "left" | "right" | "inline";
  /** control the drill-down from outside (optional) */
  drill?: DrillStack;
  className?: string;
}

export function PropertyPanel({ data, period, onClose, onOpenUnit, side = "left", drill: external, className }: PropertyPanelProps) {
  const own = useDrillStack();
  const drill = external ?? own;
  const k = data.kpis;
  const p = data.periods[period];
  const open = (key: string) => drill.push({ kind: "metric", key });
  const noUnits = k.unitsActive === 0;
  // ▲ / ▼ vs the same days last year (the year and the month; all time has nothing before it)
  const cmp = period === "allTime" ? null : data.comparisons[period];
  const yoy = (field: "rentCollected" | "expenses" | "net") =>
    period === "allTime" ? null : vsLastYear(cmp, field, () => open(yoyKey(field === "net" ? "netCash" : field, period)));
  const y = data.yields.property;
  const f = data.forecast;

  // an amount inside a sentence that opens its breakdown
  const amt = (value: number, key: string, tone: "income" | "expense" | "neutral" | "value" = "neutral", compact = false) => (
    <button type="button" className={b.cLink} onClick={() => open(key)}>
      <span className={cx("num", tone === "income" && value !== 0 && s.tIncome, tone === "expense" && value !== 0 && s.tExpense, tone === "value" && s.tValue)}>
        {fmt(value, "inr", compact)}
      </span>
    </button>
  );

  return (
    <DrillPanel
      data={data}
      drill={drill}
      rootLabel="Property"
      side={side}
      eyebrow="Property"
      title={data.settings.brandName}
      tools={noUnits ? undefined : <PeriodSwitch data={data} />}
      pinId="property"
      onClose={onClose}
      onOpenUnit={onOpenUnit}
      className={cx(b.compactWin, b.compactWide, className)}
    >
      {noUnits ? (
        <EmptyState
          compact
          title="No units yet"
          action={
            <LinkButton href="/config#units" variant="primary" size="sm" icon={<Building2 />}>
              Build a unit
            </LinkButton>
          }
        />
      ) : (
        /* compact window (owner 9/10/2026, style 1): one column of slim rows, each big figure with its parts beneath */
        <div className={b.cw}>
          {/* minimal (owner 1/11/2026: "keep the website minimal … like the EB pole and revenue officer"): each block = a label,
              the big figure and ONE short line of its parts — no est. tags, no side sentences */}
          {/* ---------------- CASH FLOW (the year picker is in the title bar) */}
          <div className={cx(b.cRow, b.cHero, p.net < 0 ? b.cLate : b.cOk)}>
            <div>
              <span className={b.cLabel}>Net cash</span>
              <div className={b.cBig}>
                <Fig value={p.net} size="hero" tone="signed" onClick={() => open(explainKey("netCash", period))} />
                {yoy("net")}
              </div>
              <div className={b.cSub}>
                Rent {amt(p.rentCollected, explainKey("rentCollected", period), "income")}
                {/* a deposit kept back at move-out: income, inside net cash (owner 2/11/2026) */}
                {p.depositsKept > 0 && (
                  <>
                    {" · "}Deposit kept {amt(p.depositsKept, explainKey("depositsKept", period), "income")}
                  </>
                )}
                {" · "}Expenses {amt(p.expenses, explainKey("expenses", period), "expense")}
              </div>
            </div>
            <div className={b.cSide}>
              <button type="button" className={cx(b.cPill, p.rentUnpaid > 0 && b.cPillWarn)} onClick={() => open(explainKey("collection", period))}>
                {p.collectionPct === null ? "Nothing due yet" : `${fmt(p.collectionPct, "pct")} collected`}
              </button>
            </div>
          </div>

          {/* ---------------- PROPERTY VALUE (as of the as-of date) */}
          <div className={cx(b.cRow, b.cHero, b.cGold)}>
            <div>
              <span className={b.cLabel}>Worth now</span>
              <div className={b.cBig}>
                <Fig value={k.bestOfferTotal} size="hero" onClick={() => open("worthNow")} />
              </div>
              <div className={b.cSub}>
                Gain {amt(k.appreciation, "gain", "value", true)}
                {y.grossOnValue !== null && (
                  <>
                    {" · "}Yield{" "}
                    <button type="button" className={b.cLink} onClick={() => open("yield:grossValue")}>
                      <span className="num">{fmt(y.grossOnValue, "pct")}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            <button type="button" className={b.lvl} onClick={() => open("multiplier")} title="Level = Worth now ÷ Invested">
              <LevelBadge value={k.capitalMultiplier === null ? null : `×${k.capitalMultiplier.toFixed(2)}`} size="sm" showTier={false} />
            </button>
          </div>

          {/* ---------------- NEXT 12 MONTHS (owner 8/10): rent that will fall due − tax due − usual costs */}
          <div className={cx(b.cRow, b.cHero, b.cSky)}>
            <div>
              <span className={b.cLabel}>Next 12 months</span>
              <div className={b.cBig}>
                <Fig value={f.net} size="hero" tone="signed" onClick={() => open("forecast:net")} />
              </div>
              <div className={b.cSub}>
                Rent {amt(f.rent, "forecast:rent", "income")}
                {" · "}Costs {amt(f.costs, "forecast:costs", "expense")}
                {" · "}Tax {amt(f.tax, "forecast:tax", "expense")}
              </div>
            </div>
          </div>

          {/* ---------------- OCCUPANCY (all time) */}
          <div className={cx(b.cRow, b.cOcc)}>
            <span className={b.cLabel}>Occupancy</span>
            <SegmentedBar value={k.occupancyPct} tone="sky" segments={24} valueLabel={null} size="sm" aria-label="Occupancy" />
            <Fig value={k.occupancyPct} format="pct" size="md" onClick={() => open("occupancy")} />
            <span className={b.cOccSub}>
              Vacant{" "}
              <button type="button" className={b.cLink} onClick={() => open("vacantDays")}>
                <span className="num">{k.vacantDays}</span> {k.vacantDays === 1 ? "day" : "days"}
              </button>
              {" · "}Rent lost {amt(k.unrealizedLoss, "rentLost")}
            </span>
          </div>
        </div>
      )}
    </DrillPanel>
  );
}
