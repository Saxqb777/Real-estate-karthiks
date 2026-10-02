"use client";
// Mailbox at the gate → payments: who pays next (record rent in one tap), recent receipts, rent collected in scope.
import { ExternalLink, ReceiptIndianRupee } from "lucide-react";
import { Button, EmptyState, cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { BucketHead, Fig, FigCell, FigCells, Rupees, ScopeChip } from "./Figure";
import { useFormDrawer } from "./FormDrawer";
import { explainKey, firstName, inr } from "./format";
import { RentStatePill } from "./UnitPanel";
import type { PeriodKind } from "./types";
import s from "./hud.module.css";
import b from "./bits.module.css";

export interface MailboxPanelProps {
  data: DashboardData;
  period: PeriodKind;
  onClose?: () => void;
  onOpenUnit?: (unitId: string) => void;
  side?: "right" | "inline";
  drill?: DrillStack;
  className?: string;
}

export function MailboxPanel({ data, period, onClose, onOpenUnit, side = "right", drill: external, className }: MailboxPanelProps) {
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
        pinId="mailbox"
        onClose={onClose}
        onOpenUnit={onOpenUnit}
        className={className}
        accent="teal"
        actions={
          <Button variant="primary" size="sm" icon={<ReceiptIndianRupee />} onClick={() => forms.open({ kind: "payment" })}>
            Record rent
          </Button>
        }
      >
        <section className={s.section}>
          <BucketHead bucket="cash" scope={<ScopeChip past={!data.isLive}>{p.label}</ScopeChip>} />
          <div className={s.hero}>
            <div className={s.heroMain}>
              <span className={s.heroLabel}>Rent collected</span>
              <Fig value={p.rentCollected} size="hero" tone="income" onClick={() => open(explainKey("rentCollected", period))} />
            </div>
          </div>
          <FigCells cols={2}>
            <FigCell label="Overdue now" value={k.overdueAmount} tone={k.overdueAmount > 0 ? "expense" : "neutral"} compact={false} onClick={() => open("overdue")} />
            <FigCell label="Rent each month" value={k.monthlyRentRoll} compact={false} onClick={() => open("rentRoll")} />
          </FigCells>
        </section>

        <section className={s.section}>
          <div className={b.subHead}>
            <span>Who pays next</span>
          </div>
          {tenants.length === 0 ? (
            <p className={s.calm}>No current tenants — nothing to collect.</p>
          ) : (
            <ul className={b.payers}>
              {tenants.map((u) => {
                const np = u.nextPayment;
                const late = u.rentState === "overdue";
                return (
                  <li key={u.id} className={cx(b.payer, late && b.payerLate)}>
                    <button type="button" className={b.payerMain} onClick={() => onOpenUnit?.(u.id)} disabled={!onOpenUnit} title={onOpenUnit ? `Open ${u.name}` : undefined}>
                      <span className={b.payerName}>
                        {firstName(u.activeLease!.tenantName)} <span className={b.payerUnit}>· {u.name}</span>
                      </span>
                      <span className={b.payerDue}>
                        {np ? (late ? `${np.arrears.months.length} months owed · ${inr(np.arrears.totalWithFees)}` : `${np.label} · due ${formatDate(np.dueDate)}`) : "Up to date"}
                      </span>
                    </button>
                    <RentStatePill unit={u} />
                    <Button
                      size="sm"
                      variant={late ? "primary" : "secondary"}
                      onClick={() => forms.open({ kind: "payment", title: `Record rent · ${u.name}`, props: { defaults: { leaseId: u.activeLease!.id } } })}
                    >
                      Record
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={s.section}>
          <div className={b.subHead}>
            <span>Recent receipts</span>
            <span className={b.subHeadNote}>latest {data.recentPayments.length}</span>
          </div>
          {data.recentPayments.length === 0 ? (
            <EmptyState compact title="No rent recorded yet" description="Record the first payment and its receipt appears here." />
          ) : (
            <ul className={b.receipts}>
              {data.recentPayments.map((r) => (
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
        </section>
      </DrillPanel>
      {forms.element}
    </>
  );
}
