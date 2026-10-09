"use client";
// Mailbox at the gate → payments. Compact style (owner 9/10/2026): rent collected big with Record rent beside it, who pays
// next (record in one tap), the latest receipts (all of them in Data → Payments). Every figure still drills down.
import { ExternalLink, ReceiptIndianRupee } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { Fig, PaperTag, Rupees, vsLastYear } from "./Figure";
import { PeriodSwitch } from "./PeriodSwitch";
import { useFormDrawer } from "./FormDrawer";
import { explainKey, firstName, inr, yoyKey } from "./format";
import type { PeriodKind } from "./types";
import s from "./hud.module.css";
import b from "./bits.module.css";

export interface MailboxPanelProps {
  data: DashboardData;
  period: PeriodKind;
  onClose?: () => void;
  onOpenUnit?: (unitId: string) => void;
  /** a payer row opens that house's tenant window (falls back to the house window) */
  onOpenTenant?: (unitId: string) => void;
  side?: "right" | "inline";
  drill?: DrillStack;
  className?: string;
}

export function MailboxPanel({ data, period, onClose, onOpenUnit, onOpenTenant, side = "right", drill: external, className }: MailboxPanelProps) {
  const openPayer = onOpenTenant ?? onOpenUnit;
  const own = useDrillStack();
  const drill = external ?? own;
  const forms = useFormDrawer();
  const p = data.periods[period];
  const k = data.kpis;
  const open = (key: string) => drill.push({ kind: "metric", key });
  const tenants = data.units.filter((u) => u.activeLease && u.isActive);

  return (
    <>
      <DrillPanel
        data={data}
        drill={drill}
        rootLabel="Mailbox"
        side={side}
        eyebrow="Mailbox · payments"
        title="Rent & receipts"
        tools={<PeriodSwitch data={data} period={period} />}
        pinId="mailbox"
        onClose={onClose}
        onOpenUnit={onOpenUnit}
        className={cx(b.compactWin, className)}
        accent="teal"
      >
        {/* compact window (owner 9/10/2026, style 1): one column of slim rows */}
        <div className={b.cw}>
          <div className={cx(b.cRow, b.cHero, b.cOk)}>
            <div>
              <span className={b.cLabel}>Rent collected · {data.scopeLabels[period]}</span>
              <div className={b.cBig}>
                <Fig value={p.rentCollected} size="hero" tone="income" onClick={() => open(explainKey("rentCollected", period))} />
                {period !== "allTime" && vsLastYear(data.comparisons[period], "rentCollected", () => open(yoyKey("rentCollected", period)))}
              </div>
              <div className={b.cSub}>
                Overdue now{" "}
                <button type="button" className={b.cLink} onClick={() => open("overdue")}>
                  <Rupees value={k.overdueAmount} tone={k.overdueAmount > 0 ? "expense" : "neutral"} />
                </button>
                {" · "}rent each month{" "}
                <button type="button" className={b.cLink} onClick={() => open("rentRoll")}>
                  <Rupees value={k.monthlyRentRoll} />
                </button>
                {" · "}next 12 months{" "}
                <button type="button" className={b.cLink} onClick={() => open("forecast:rent")}>
                  <Rupees value={data.forecast.rent} tone="income" />
                </button>{" "}
                <PaperTag kind="est." />
              </div>
            </div>
            <Button variant="primary" size="sm" icon={<ReceiptIndianRupee />} onClick={() => forms.open({ kind: "payment" })}>
              Record rent
            </Button>
          </div>

          <div className={b.cSecHead}>
            <span>Who pays next</span>
          </div>
          {tenants.length === 0 ? (
            <p className={s.calm}>No current tenants — nothing to collect.</p>
          ) : (
            tenants.map((u) => {
              const np = u.nextPayment;
              const late = u.rentState === "overdue";
              return (
                <div key={u.id} className={cx(b.cRow, b.cHero, late ? b.cLate : u.rentState !== "due-soon" && b.cOk)}>
                  <button type="button" className={b.cPayer} onClick={() => openPayer?.(u.id)} disabled={!openPayer} title={openPayer ? `Open ${u.activeLease!.tenantName}` : undefined}>
                    <span className={b.cPayerName}>
                      {firstName(u.activeLease!.tenantName)} <span>· {u.name}</span>
                    </span>
                    <span className={cx(b.cSub, late ? b.lateText : u.rentState === "due-soon" && b.cSoon)}>
                      {np ? (late ? `${np.arrears.months.length} months owed · ${inr(np.arrears.totalWithFees)}` : `${np.label} · due ${formatDate(np.dueDate)}`) : "Up to date"}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant={late ? "primary" : "secondary"}
                    onClick={() => forms.open({ kind: "payment", title: `Record rent · ${u.name}`, props: { defaults: { leaseId: u.activeLease!.id } } })}
                  >
                    Record
                  </Button>
                </div>
              );
            })
          )}

          <div className={b.cSecHead}>
            <span>Recent receipts</span>
            <Link href="/data#payments">All receipts ›</Link>
          </div>
          {data.recentPayments.length === 0 ? (
            <EmptyState compact title="No rent recorded yet" />
          ) : (
            <ul className={b.receipts}>
              {data.recentPayments.slice(0, 4).map((r) => (
                <li key={r.id} className={b.receipt}>
                  <button type="button" className={b.receiptMain} onClick={() => drill.push({ kind: "payment", id: r.id, label: r.invoiceNumber })}>
                    <span className={b.receiptDate}>{formatDate(r.paymentDate)}</span>
                    <span className={b.receiptWho}>
                      {firstName(r.tenantName)} · {r.unitName}
                    </span>
                    <Rupees value={r.amount} tone="income" className={b.receiptAmt} />
                  </button>
                  <a className={b.receiptLink} href={`/invoice/${r.id}`} target="_blank" rel="noopener" title={`Open receipt ${r.invoiceNumber}`} aria-label={`Open receipt ${r.invoiceNumber}`}>
                    <ExternalLink aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrillPanel>
      {forms.element}
    </>
  );
}
