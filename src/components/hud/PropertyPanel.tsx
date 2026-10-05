"use client";
// Left panel: the whole property in three buckets — CASH FLOW · PROPERTY VALUE · OCCUPANCY —
// each with one hero number and at most three supporting figures. Every figure drills down (breadcrumb inside).
import { Building2 } from "lucide-react";
import { EmptyState, LevelBadge, LinkButton, SegmentedBar, cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { Fig, FigLine, BucketHead, ScopeChip } from "./Figure";
import { explainKey, inr } from "./format";
import { LedgerBadge } from "./LedgerBadge";
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
  const past = !data.isLive;
  const asOfChip = (
    <ScopeChip kind="asOf" past={past}>
      {data.scopeLabels.asOf}
    </ScopeChip>
  );
  const noUnits = k.unitsActive === 0;
  const paper = k.unitsWithOffer > 0 && !k.bestOfferIsPartialEstimate ? "offer" : "est.";

  return (
    <DrillPanel
      data={data}
      drill={drill}
      rootLabel="Property"
      side={side}
      eyebrow={`Property · ${k.unitsActive} ${k.unitsActive === 1 ? "unit" : "units"}`}
      title={data.settings.brandName}
      pinId="property"
      onClose={onClose}
      onOpenUnit={onOpenUnit}
      className={className}
      hint={
        <>
          <LedgerBadge checks={data.checks} onClick={() => drill.push({ kind: "checks" })} />
        </>
      }
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
        <>
          {/* ---------------- CASH FLOW */}
          <section className={s.section}>
            <BucketHead bucket="cash" scope={<ScopeChip past={past}>{p.label}</ScopeChip>} />
            <div className={s.hero}>
              <div className={s.heroMain}>
                <span className={s.heroLabel}>Net cash</span>
                <Fig value={p.net} size="hero" tone="signed" onClick={() => open(explainKey("netCash", period))} />
              </div>
            </div>
            <div className={s.lines}>
              <FigLine label="Rent collected" value={p.rentCollected} sign="+" tone="income" onClick={() => open(explainKey("rentCollected", period))} />
              <FigLine label="Expenses" value={p.expenses} sign="−" tone="expense" onClick={() => open(explainKey("expenses", period))} />
              <FigLine
                label="Rent collection"
                sub={p.rentUnpaid > 0 ? `${inr(p.rentUnpaid)} of the rent due is unpaid` : p.collectionPct === null ? "No rent has fallen due yet" : "Every rupee due is in"}
                value={p.collectionPct}
                format="pct"
                missing="No rent has fallen due in this period yet"
                onClick={() => open(explainKey("collection", period))}
              />
            </div>
            {k.securityDepositsHeld > 0 && (
              <button type="button" className={b.aside} onClick={() => open("depositsHeld")}>
                Deposits held <b className="num">{inr(k.securityDepositsHeld)}</b>
              </button>
            )}
          </section>

          {/* ---------------- PROPERTY VALUE */}
          <section className={s.section}>
            <BucketHead bucket="value" scope={asOfChip} />
            <div className={s.hero}>
              <div className={s.heroMain}>
                <span className={s.heroLabel}>Worth now (est.)</span>
                <Fig value={k.bestOfferTotal} size="hero" paper={paper} onClick={() => open("worthNow")} />
              </div>
              <button type="button" className={b.lvl} onClick={() => open("multiplier")} title="Level = Worth now ÷ Invested · click for the maths">
                <LevelBadge value={k.capitalMultiplier === null ? null : `×${k.capitalMultiplier.toFixed(2)}`} size="sm" showTier={false} />
              </button>
            </div>
            <div className={s.lines}>
              <FigLine label="Invested" value={k.invested} onClick={() => open("invested")} />
              <FigLine label="Gain" value={k.appreciation} tone="value" paper="est." onClick={() => open("gain")} />
              <FigLine
                label="Growth per year"
                sub={k.cagr === null ? (k.cagrNote ?? undefined) : `Over ${k.holdingYears.toFixed(1)} years held`}
                value={k.cagr}
                format="pct"
                missing={k.cagrNote ?? "Not enough history yet"}
                onClick={k.cagr === null ? undefined : () => open("cagr")}
              />
            </div>
          </section>

          {/* ---------------- OCCUPANCY */}
          <section className={s.section}>
            <BucketHead bucket="occupancy" scope={<ScopeChip past={past}>{data.scopeLabels.allTime}</ScopeChip>} />
            <div className={s.hero}>
              <div className={cx(s.heroMain, b.grow)}>
                <span className={s.heroLabel}>Occupancy</span>
                <div className={b.occRow}>
                  <Fig value={k.occupancyPct} format="pct" size="hero" onClick={() => open("occupancy")} />
                  <span className={b.letCount}>
                    {k.unitsOccupied} of {k.unitsActive} let{k.unitsIncoming > 0 ? ` · ${k.unitsIncoming} moving in` : ""}
                  </span>
                </div>
                <SegmentedBar value={k.occupancyPct} tone="sky" segments={24} valueLabel={null} size="sm" aria-label="Occupancy" />
              </div>
            </div>
            <div className={s.lines}>
              <FigLine label="Vacant days" value={k.vacantDays} format="days" onClick={() => open("vacantDays")} />
              <FigLine label="Rent lost (vacant)" value={k.unrealizedLoss} tone="dim" onClick={() => open("rentLost")} />
            </div>
          </section>
        </>
      )}
    </DrillPanel>
  );
}
