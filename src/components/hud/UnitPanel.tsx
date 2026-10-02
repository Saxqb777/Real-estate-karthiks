"use client";
// Right panel for one house (opens on a house click / inspect-card expand). Sections:
// tenant (tap-to-call) · rent (state, next due, arrears) + its cash · value (worth now / best offer / gain) ·
// occupancy · electricity (TNPDCL + Pay) · quick actions opening the real forms in a Drawer.
import { Check, Copy, DoorOpen, ExternalLink, FileSignature, Phone, ReceiptIndianRupee, Wallet, Zap } from "lucide-react";
import { useState } from "react";
import { Badge, Button, LevelBadge, SegmentedBar, StatusPill, toast, cx } from "@/components/ui";
import type { DashboardData, UnitBreakdown } from "@/lib/dashboard-types";
import { daysBetween, formatDate } from "@/lib/dates";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { BucketHead, Fig, FigCell, FigCells, ScopeChip } from "./Figure";
import { useFormDrawer } from "./FormDrawer";
import { explainKey, firstName, inr, monthList, positionLabel, telHref } from "./format";
import type { PeriodKind } from "./types";
import s from "./hud.module.css";
import b from "./bits.module.css";

export interface UnitPanelProps {
  data: DashboardData;
  unitId: string;
  period: PeriodKind;
  onClose?: () => void;
  /** a different unit was clicked inside a breakdown */
  onOpenUnit?: (unitId: string) => void;
  side?: "right" | "inline";
  drill?: DrillStack;
  className?: string;
}

/** Occupied / Moving in / Vacant / Inactive — one status language (matches the 3D rings). */
export function UnitStatusPill({ unit, size = "sm" }: { unit: Pick<UnitBreakdown, "status" | "incomingLease">; size?: "sm" | "md" }) {
  if (unit.status === "incoming")
    return (
      <Badge tone="sky" marker size={size}>
        {unit.incomingLease ? `Moving in ${shortDate(unit.incomingLease.startDate)}` : "Moving in"}
      </Badge>
    );
  return <StatusPill status={unit.status} size={size} />;
}

/** Paid / Due soon / Overdue N days (nothing when there is no lease). */
export function RentStatePill({ unit, size = "sm" }: { unit: Pick<UnitBreakdown, "rentState" | "nextPayment">; size?: "sm" | "md" }) {
  if (unit.rentState === "none") return null;
  if (unit.rentState === "overdue") {
    const n = unit.nextPayment?.arrears.months.length ?? 0;
    return <StatusPill status="overdue" size={size} label={n > 1 ? `${n} months late` : `${unit.nextPayment?.daysOverdue ?? 0} days late`} />;
  }
  return <StatusPill status={unit.rentState} size={size} label={unit.rentState === "paid" ? "Rent paid" : undefined} />;
}

/** "5/11" */
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};

export function UnitPanel(props: UnitPanelProps) {
  // a different house = a fresh drill-down
  return <UnitPanelInner key={props.unitId} {...props} />;
}

function UnitPanelInner({ data, unitId, period, onClose, onOpenUnit, side = "right", drill: external, className }: UnitPanelProps) {
  const own = useDrillStack();
  const drill = external ?? own;
  const forms = useFormDrawer();
  const u = data.units.find((x) => x.id === unitId);
  if (!u) return null;

  const open = (key: string) => drill.push({ kind: "metric", key: `unit:${u.id}:${key}` });
  const openScoped = (key: string) => drill.push({ kind: "metric", key: explainKey(key, period, u.id) });
  const lease = u.activeLease;
  const np = u.nextPayment;
  const arrears = np?.arrears;
  const p = u.periods[period];
  const pos = positionLabel(u.position);
  const past = !data.isLive;
  const vacantNow = u.vacantPeriods.find((v) => v.ongoing);

  const actions = (
    <>
      {lease ? (
        <Button variant="primary" size="sm" icon={<ReceiptIndianRupee />} onClick={() => forms.open({ kind: "payment", props: { defaults: { leaseId: lease.id } } })}>
          Record rent
        </Button>
      ) : (
        <Button variant="primary" size="sm" icon={<FileSignature />} onClick={() => forms.open({ kind: "lease", title: `New lease · ${u.name}`, props: { defaults: { unitId: u.id } } })}>
          New lease
        </Button>
      )}
      <Button variant="secondary" size="sm" icon={<Wallet />} onClick={() => forms.open({ kind: "expense", props: { defaults: { unitId: u.id } } })}>
        Add expense
      </Button>
      {lease && (
        <Button
          variant="ghost"
          size="sm"
          icon={<DoorOpen />}
          onClick={() =>
            forms.open({
              kind: "moveOut",
              title: `Move out · ${lease.tenantName}`,
              props: { lease: { id: lease.id, startDate: lease.startDate, securityDeposit: lease.securityDeposit, unit: { name: u.name }, tenant: { name: lease.tenantName } } },
            })
          }
        >
          Move out
        </Button>
      )}
    </>
  );

  return (
    <>
      <DrillPanel
        data={data}
        drill={drill}
        rootLabel={u.name}
        side={side}
        eyebrow={`${pos ? `${pos} unit` : "Unit"} · ${u.type}`}
        title={u.name}
        aside={
          <span className={b.pills}>
            <UnitStatusPill unit={u} />
            <RentStatePill unit={u} />
          </span>
        }
        pinId="unit"
        onClose={onClose}
        onOpenUnit={onOpenUnit}
        actions={actions}
        className={className}
      >
        {/* ---------------- TENANT */}
        <section className={b.tenant}>
          {lease ? (
            <>
              <div className={b.tenantTop}>
                <div className={b.tenantWho}>
                  <span className={b.tenantName}>{lease.tenantName}</span>
                  <span className={b.tenantMeta}>
                    since {formatDate(lease.startDate)}
                    {lease.endDate ? ` · last day ${formatDate(lease.endDate)}` : ""}
                  </span>
                </div>
                {lease.tenantPhone ? (
                  <a className={b.call} href={telHref(lease.tenantPhone)} title={`Call ${firstName(lease.tenantName)}`}>
                    <Phone aria-hidden />
                    <span className="num">{lease.tenantPhone}</span>
                  </a>
                ) : (
                  <span className={b.noPhone}>No phone saved</span>
                )}
              </div>
              <div className={b.tenantFacts}>
                <button type="button" className={b.fact} onClick={() => open("rent")}>
                  <span>Rent</span>
                  <b className="num">{inr(lease.monthlyRent)}</b>
                  <span className={b.factUnit}>/month</span>
                </button>
                <button type="button" className={b.fact} onClick={() => open("depositHeld")} title="Deposits are the tenant's money — not income">
                  <span>Deposit held</span>
                  <b className="num">{inr(u.depositHeld)}</b>
                </button>
              </div>
            </>
          ) : u.incomingLease ? (
            <div className={b.tenantTop}>
              <div className={b.tenantWho}>
                <span className={b.tenantName}>{u.incomingLease.tenantName}</span>
                <span className={b.tenantMeta}>
                  moves in {formatDate(u.incomingLease.startDate)} · {inr(u.incomingLease.monthlyRent)}/month
                </span>
              </div>
              {u.incomingLease.tenantPhone && (
                <a className={b.call} href={telHref(u.incomingLease.tenantPhone)}>
                  <Phone aria-hidden />
                  <span className="num">{u.incomingLease.tenantPhone}</span>
                </a>
              )}
            </div>
          ) : (
            <div className={b.vacant}>
              <span className={b.vacantBig}>{u.status === "inactive" ? "Switched off" : "Empty"}</span>
              <span className={b.tenantMeta}>
                {vacantNow ? (
                  <>
                    since {formatDate(vacantNow.start)} · <span className="num">{vacantNow.days}</span> days
                  </>
                ) : (
                  "No tenant recorded"
                )}
              </span>
            </div>
          )}
        </section>

        {/* ---------------- RENT + this unit's cash */}
        <section className={s.section}>
          <BucketHead bucket="cash" label="Rent & cash" scope={<ScopeChip past={past}>{p.label}</ScopeChip>} />
          {arrears && arrears.months.length > 0 ? (
            <div className={cx(b.rentState, b.rentOverdue)}>
              <div className={s.heroMain}>
                <span className={s.heroLabel}>
                  {firstName(lease?.tenantName ?? "Tenant")} owes · {data.scopeLabels.asOf.toLowerCase()}
                </span>
                <Fig value={arrears.totalWithFees} size="lg" tone="expense" compact={false} onClick={() => open("overdue")} />
              </div>
              <p className={b.rentLine}>
                {monthList(arrears.months.map((m) => m.label))}
                {arrears.months.some((m) => m.paid > 0) ? " (one part-paid)" : ""}
                {arrears.lateFees > 0 ? ` · incl. ${inr(arrears.lateFees)} late fees` : ""}
              </p>
            </div>
          ) : np ? (
            <div className={b.rentState}>
              <div className={s.heroMain}>
                <span className={s.heroLabel}>
                  Next rent · {np.label}
                  {np.paidSoFar > 0 ? ` · ${inr(np.paidSoFar)} paid` : ""}
                </span>
                <Fig value={np.amountDue} size="lg" compact={false} onClick={() => open("rent")} />
              </div>
              <p className={b.rentLine}>
                <Check aria-hidden className={b.okIcon} />
                {dueText(np.dueDate, data.asOf)}
              </p>
            </div>
          ) : (
            <p className={s.calm}>No rent expected — nobody lives here {data.isLive ? "now" : "on this date"}.</p>
          )}
          <FigCells>
            <FigCell label="Rent collected" value={p.rentCollected} tone="income" onClick={() => openScoped("rentCollected")} />
            <FigCell label="Its expenses" value={p.expenses} tone="expense" onClick={() => openScoped("expenses")} />
            <FigCell label="Net cash" value={p.net} tone="signed" onClick={() => openScoped("netCash")} />
          </FigCells>
        </section>

        {/* ---------------- VALUE */}
        <section className={s.section}>
          <BucketHead bucket="value" scope={<ScopeChip kind="asOf" past={past}>{data.scopeLabels.asOf}</ScopeChip>} />
          <div className={s.hero}>
            <div className={s.heroMain}>
              <span className={s.heroLabel}>Worth now (est.){u.valuationSource === "offer" ? " — best offer" : " — growth estimate"}</span>
              <Fig value={u.valuation} size="hero" paper={u.valuationSource === "offer" ? "offer" : "est."} onClick={() => open("worthNow")} />
            </div>
            <button type="button" className={b.lvl} onClick={() => open("multiplier")} title="Level = Worth now ÷ Invested">
              <LevelBadge value={u.capitalMultiplier === null ? null : `×${u.capitalMultiplier.toFixed(2)}`} size="sm" showTier={false} />
            </button>
          </div>
          <FigCells>
            <FigCell label="Invested" value={u.purchasePrice} onClick={() => drill.push({ kind: "metric", key: "invested" })} />
            <FigCell
              label={u.offersCount > 0 ? `Best offer (${u.offersCount})` : "Best offer"}
              value={u.bestOffer}
              paper={u.bestOffer === null ? null : "offer"}
              missing="No offer yet — worth now uses the growth estimate"
              onClick={u.bestOffer === null ? undefined : () => open("bestOffer")}
            />
            <FigCell label="Gain" value={u.appreciation} tone="value" paper="est." onClick={() => open("gain")} />
          </FigCells>
        </section>

        {/* ---------------- OCCUPANCY */}
        <section className={s.section}>
          <BucketHead bucket="occupancy" scope={<ScopeChip past={past}>{data.scopeLabels.allTime}</ScopeChip>} />
          <div className={b.occLine}>
            <Fig value={u.occupancyPct} format="pct" size="lg" onClick={() => open("occupancy")} />
            <SegmentedBar value={u.occupancyPct} tone="sky" segments={18} valueLabel={null} size="sm" aria-label="Occupancy" className={b.grow} />
          </div>
          <FigCells cols={2}>
            <FigCell label="Vacant days" value={u.vacantDays} format="days" onClick={() => open("vacantDays")} />
            <FigCell label="Rent lost (vacant)" value={u.unrealizedLoss} tone="dim" onClick={() => open("rentLost")} />
          </FigCells>
        </section>

        {/* ---------------- ELECTRICITY */}
        <Electricity unit={u} />
      </DrillPanel>
      {forms.element}
    </>
  );
}

function dueText(due: string, asOf: string): string {
  const d = daysBetween(new Date(asOf), new Date(due));
  if (d < 0) return `Was due ${formatDate(due)}`;
  if (d === 0) return `Due today, ${formatDate(due)}`;
  if (d === 1) return `Due tomorrow, ${formatDate(due)}`;
  return `Due ${formatDate(due)} · in ${d} days`;
}

/** TNPDCL consumer number (copy) + "Pay electricity" — also used by the pole panel. */
export function Electricity({ unit, compact }: { unit: Pick<UnitBreakdown, "name" | "electricityConsumerNumber" | "electricityPayUrl">; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const no = unit.electricityConsumerNumber;
  const copy = async () => {
    if (!no) return;
    try {
      await navigator.clipboard.writeText(no);
      setCopied(true);
      toast.success(`Copied ${no}`, { description: "Paste it on the TNPDCL payment page." });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.info(no, { description: "Couldn't copy — note this consumer number." });
    }
  };
  return (
    <section className={cx(b.elec, compact && b.elecCompact)}>
      <Zap className={b.elecIcon} aria-hidden />
      <div className={b.elecText}>
        <span className={b.elecLabel}>TNPDCL consumer no.</span>
        {no ? (
          <button type="button" className={b.elecNo} onClick={copy} title="Copy the consumer number">
            <span className="num">{no}</span>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          </button>
        ) : (
          <span className={b.noPhone}>Not saved — add it in Config → Units</span>
        )}
      </div>
      {unit.electricityPayUrl && (
        <a className={b.payLink} href={unit.electricityPayUrl} target="_blank" rel="noopener noreferrer">
          Pay electricity
          <ExternalLink aria-hidden />
        </a>
      )}
    </section>
  );
}
