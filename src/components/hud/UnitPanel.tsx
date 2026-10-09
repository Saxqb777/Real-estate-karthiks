"use client";
// The house window (opens on a house click). Compact style (owner 9/10/2026): one column of slim rows — the tenant
// (call / WhatsApp), the next rent big with Record rent beside it (or what's owed), this house's cash (period switch in
// the title bar), value (worth now · gain · yields), occupancy, electricity (TNPDCL + Pay); Add expense / Move out at the
// bottom. Every figure still drills down.
import { Check, Copy, DoorOpen, ExternalLink, FileSignature, MessageCircle, Phone, ReceiptIndianRupee, Wallet, Zap } from "lucide-react";
import { useState } from "react";
import { Badge, Button, SegmentedBar, StatusPill, buttonClass, toast, cx } from "@/components/ui";
import type { DashboardData, UnitBreakdown } from "@/lib/dashboard-types";
import { agreementText } from "@/components/forms";
import { daysBetween, formatDate } from "@/lib/dates";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { Fig, FigCell, FigCells, FigLine, vsLastYear } from "./Figure";
import { PeriodSwitch } from "./PeriodSwitch";
import { useFormDrawer } from "./FormDrawer";
import { explainKey, firstName, inr, monthList, phoneText, positionLabel, telHref, waHref } from "./format";
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
  // ▲ / ▼ vs the same days last year (year / month); its maths is linked from each figure's breakdown
  const cmp = period === "allTime" ? null : u.comparisons[period];
  const yld = data.yields.units.find((r) => r.unitId === u.id) ?? null;
  const renew = lease ? data.renewals.find((r) => r.leaseId === lease.id) : undefined;
  const pos = positionLabel(u.position);
  const vacantNow = u.vacantPeriods.find((v) => v.ongoing);

  const recordRent = lease ? () => forms.open({ kind: "payment", props: { defaults: { leaseId: lease.id } } }) : null;
  const newLease = () => forms.open({ kind: "lease", title: `New lease · ${u.name}`, props: { defaults: { unitId: u.id } } });
  const heroAction = recordRent ? (
    <Button variant="primary" size="sm" icon={<ReceiptIndianRupee />} onClick={recordRent}>
      Record rent
    </Button>
  ) : (
    <Button variant="primary" size="sm" icon={<FileSignature />} onClick={newLease}>
      New lease
    </Button>
  );

  const actions = (
    <>
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
        tools={<PeriodSwitch data={data} period={period} />}
        pinId="unit"
        onClose={onClose}
        onOpenUnit={onOpenUnit}
        actions={actions}
        className={cx(b.compactWin, className)}
      >
        {/* compact window (owner 9/10/2026, style 1): one column of slim rows */}
        <div className={b.cw}>
          {/* ---------------- TENANT */}
          {lease ? (
            <div className={cx(b.cRow, b.cPerson)}>
              <span className={b.cAv} aria-hidden>
                {initial(lease.tenantName)}
              </span>
              <span className={b.cWho}>
                <span className={b.cName}>{lease.tenantName}</span>
                <span className={b.cMeta}>
                  since {formatDate(lease.startDate)}
                  {lease.endDate ? ` · last day ${formatDate(lease.endDate)}` : ""}
                  {" · "}
                  <button type="button" className={b.cLink} onClick={() => open("rent")}>
                    rent <span className="num">{inr(lease.monthlyRent)}</span>/month
                  </button>
                  {" · "}
                  <button type="button" className={b.cLink} onClick={() => open("depositHeld")} title="Deposits are the tenant's money — not income">
                    deposit <span className="num">{inr(u.depositHeld)}</span>
                  </button>
                  {lease.agreementEndDate && (
                    <>
                      {" · "}
                      <span className={cx(renew && (renew.state === "expired" ? b.lateText : b.soonText))}>
                        agreement {renew ? agreementText(renew.daysLeft) : `to ${formatDate(lease.agreementEndDate)}`}
                      </span>
                    </>
                  )}
                </span>
              </span>
              <ContactButtons phone={lease.tenantPhone} name={lease.tenantName} />
            </div>
          ) : u.incomingLease ? (
            <div className={cx(b.cRow, b.cPerson)}>
              <span className={b.cAv} aria-hidden>
                {initial(u.incomingLease.tenantName)}
              </span>
              <span className={b.cWho}>
                <span className={b.cName}>{u.incomingLease.tenantName}</span>
                <span className={b.cMeta}>
                  moves in {formatDate(u.incomingLease.startDate)} · {inr(u.incomingLease.monthlyRent)}/month
                </span>
              </span>
              <ContactButtons phone={u.incomingLease.tenantPhone} name={u.incomingLease.tenantName} />
            </div>
          ) : (
            <div className={cx(b.cRow, b.cHero, b.cLate)}>
              <span className={b.cWho}>
                <span className={b.cName}>{u.status === "inactive" ? "Switched off" : "Empty"}</span>
                <span className={b.cMeta}>
                  {vacantNow ? (
                    <>
                      since {formatDate(vacantNow.start)} · <span className="num">{vacantNow.days}</span> days
                    </>
                  ) : (
                    "No tenant recorded"
                  )}
                </span>
              </span>
              {u.status !== "inactive" && heroAction}
            </div>
          )}

          {/* ---------------- NEXT RENT (or what's owed) */}
          {arrears && arrears.months.length > 0 ? (
            <div className={cx(b.cRow, b.cHero, b.cLate)}>
              <div>
                <span className={b.cLabel}>
                  {firstName(lease?.tenantName ?? "Tenant")} owes · {data.scopeLabels.asOf.toLowerCase()}
                </span>
                <div className={b.cBig}>
                  <Fig value={arrears.totalWithFees} size="hero" tone="expense" compact={false} onClick={() => open("overdue")} />
                </div>
                <div className={cx(b.cSub, b.lateText)}>
                  {monthList(arrears.months.map((m) => m.label))}
                  {arrears.months.some((m) => m.paid > 0) ? " (one part-paid)" : ""}
                  {arrears.lateFees > 0 ? ` · incl. ${inr(arrears.lateFees)} late fees` : ""}
                </div>
              </div>
              {heroAction}
            </div>
          ) : np ? (
            <div className={cx(b.cRow, b.cHero, u.rentState !== "due-soon" && b.cOk)}>
              <div>
                <span className={b.cLabel}>
                  Next rent · {np.label}
                  {np.paidSoFar > 0 ? ` · ${inr(np.paidSoFar)} paid` : ""}
                </span>
                <div className={b.cBig}>
                  <Fig value={np.amountDue} size="hero" compact={false} onClick={() => open("rent")} />
                </div>
                <div className={cx(b.cSub, u.rentState === "due-soon" && b.cSoon)}>{dueText(np.dueDate, data.asOf)}</div>
              </div>
              {heroAction}
            </div>
          ) : null}

          {/* ---------------- this house's cash (the period switch is in the title bar) */}
          <FigCells>
            <FigCell label="Rent collected" value={p.rentCollected} tone="income" delta={vsLastYear(cmp, "rentCollected")} onClick={() => openScoped("rentCollected")} />
            <FigCell label="Its expenses" value={p.expenses} tone="expense" delta={vsLastYear(cmp, "expenses")} onClick={() => openScoped("expenses")} />
            <FigCell label="Net cash" value={p.net} tone="signed" delta={vsLastYear(cmp, "net")} onClick={() => openScoped("netCash")} />
          </FigCells>

          {/* ---------------- VALUE */}
          <div className={cx(b.cRow, b.cLines)}>
            <div className={s.lines}>
              <FigLine label="Worth now" value={u.valuation} compact paper={u.valuationSource === "offer" ? "offer" : "est."} onClick={() => open("worthNow")} />
              <FigLine
                label={u.purchasePrice === null ? "Gain" : `Gain on ${inr(u.purchasePrice)} invested`}
                value={u.appreciation}
                compact
                tone="value"
                paper="est."
                onClick={() => open("gain")}
              />
              {/* rental yield, last 12 months (owner 8/10): rent ÷ worth now; net = after this unit's expenses */}
              {yld && (
                <>
                  <FigLine label="Gross yield · last 12 months" value={yld.grossOnValue} format="pct" missing="No value recorded yet" onClick={yld.grossOnValue === null ? undefined : () => open("yield:grossValue")} />
                  <FigLine label="Net yield · last 12 months" value={yld.netOnValue} format="pct" missing="No value recorded yet" onClick={yld.netOnValue === null ? undefined : () => open("yield:netValue")} />
                </>
              )}
            </div>
          </div>

          {/* ---------------- OCCUPANCY (all time) */}
          <div className={cx(b.cRow, b.cOcc)}>
            <span className={b.cLabel}>Occupancy · {data.scopeLabels.allTime}</span>
            <SegmentedBar value={u.occupancyPct} tone="sky" segments={24} valueLabel={null} size="sm" aria-label="Occupancy" />
            <Fig value={u.occupancyPct} format="pct" size="md" onClick={() => open("occupancy")} />
            <span className={b.cOccSub}>
              Vacant{" "}
              <button type="button" className={b.cLink} onClick={() => open("vacantDays")}>
                <span className="num">{u.vacantDays}</span> {u.vacantDays === 1 ? "day" : "days"}
              </button>
              {" · "}rent lost{" "}
              <button type="button" className={b.cLink} onClick={() => open("rentLost")}>
                <span className="num">{inr(u.unrealizedLoss)}</span>
              </button>
            </span>
          </div>

          {/* ---------------- ELECTRICITY */}
          <Electricity unit={u} />
        </div>
      </DrillPanel>
      {forms.element}
    </>
  );
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

/** Call + WhatsApp buttons for a phone number (tenants; the revenue officer uses the same buttons). */
export function ContactButtons({ phone, name }: { phone: string | null | undefined; name: string }) {
  if (!phone) return <span className={b.noPhone}>No phone saved</span>;
  return (
    <span className={b.cActs}>
      <a className={b.tdIcon} href={telHref(phone)} aria-label={`Call ${firstName(name)}`} title={phoneText(phone)}>
        <Phone aria-hidden />
      </a>
      <a className={cx(b.tdIcon, b.tdWa)} href={waHref(phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${firstName(name)}`} title="WhatsApp">
        <MessageCircle aria-hidden />
      </a>
    </span>
  );
}

function dueText(due: string, asOf: string): string {
  const d = daysBetween(new Date(asOf), new Date(due));
  if (d < 0) return `Was due ${formatDate(due)}`;
  if (d === 0) return `Due today, ${formatDate(due)}`;
  if (d === 1) return `Due tomorrow, ${formatDate(due)}`;
  return `Due ${formatDate(due)} · in ${d} days`;
}

/** The gold "Pay bill" button (TNPDCL site; disabled when no pay link is saved) — one button for the house window and the
 *  EB pole window so they always look the same (owner, 9/10/2026). */
export function PayBillButton({ url, block }: { url: string | null; block?: boolean }) {
  return url ? (
    <a className={buttonClass({ variant: "primary", block })} href={url} target="_blank" rel="noopener noreferrer">
      <Zap aria-hidden />
      <span>Pay bill</span>
      <ExternalLink aria-hidden />
    </a>
  ) : (
    <Button variant="primary" block={block} icon={<Zap />} disabled>
      Pay bill
    </Button>
  );
}

/** TNPDCL consumer number (copy) + the gold Pay bill button (house window). */
export function Electricity({ unit, compact }: { unit: Pick<UnitBreakdown, "name" | "electricityConsumerNumber" | "electricityPayUrl">; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const no = unit.electricityConsumerNumber;
  const copy = async () => {
    if (!no) return;
    try {
      await navigator.clipboard.writeText(no);
      setCopied(true);
      toast.success(`Copied ${no}`);
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
          <span className={b.noPhone}>Not saved</span>
        )}
      </div>
      <PayBillButton url={unit.electricityPayUrl} />
    </section>
  );
}
