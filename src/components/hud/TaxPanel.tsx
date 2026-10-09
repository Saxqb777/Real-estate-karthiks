"use client";
// Revenue officer (the tax collector + moped on the grass) → property tax, design D "compact" (owner 9/10/2026): one
// slim row per house (the oldest bill still due, else the latest year: amount, year + paid date, PAID tick or MARK PAID),
// the totals with "Add a year", and the revenue officer on one line at the bottom with call / WhatsApp. "Mark paid" is
// one step (the payment then appears in Expenses on its date — the API creates that expense, the HUD never adds it up).
import { Check, Landmark, MessageCircle, Phone, Plus } from "lucide-react";
import { Button, EmptyState, Skeleton, StatusPill, cx } from "@/components/ui";
import { usePropertyTax } from "@/components/forms";
import { sumAmounts } from "@/lib/calculations";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";
import { Rupees } from "./Figure";
import { phoneText, telHref, waHref } from "./format";
import { useFormDrawer } from "./FormDrawer";
import { HudPanel } from "./HudPanel";
import b from "./bits.module.css";

export interface TaxPanelProps {
  data: DashboardData;
  onClose?: () => void;
  side?: "right" | "inline";
  className?: string;
}

export function TaxPanel({ data, onClose, side = "right", className }: TaxPanelProps) {
  const tax = usePropertyTax();
  const forms = useFormDrawer();
  const unitIds = new Set(data.units.map((u) => u.id));
  const items = (tax.data?.items ?? []).filter((t) => unitIds.has(t.unitId));
  const due = items.filter((t) => t.status === "Due");
  const paidTotal = sumAmounts(items.filter((t) => t.status === "Paid"));
  const dueTotal = sumAmounts(due);
  const units = data.units.filter((u) => u.isActive);
  const { taxCollectorName: who, taxCollectorPhone: phone } = data.settings;
  const markPaid = (t: PropertyTaxDTO) => forms.open({ kind: "markTaxPaid", title: `Mark ${t.year} paid · ${t.unit.name}`, props: { tax: t } });

  return (
    <>
      <HudPanel
        side={side}
        eyebrow="Revenue officer"
        title="Property tax"
        pinId="tax"
        onClose={onClose}
        className={cx(b.compactWin, className)}
        accent={due.length ? "marigold" : "teal"}
      >
        <div className={b.td}>
          {tax.loading ? (
            <div className={b.tdSkel}>
              {units.map((u) => (
                <Skeleton key={u.id} height={62} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState compact art={<Landmark />} title="No property tax recorded" />
          ) : (
            units.map((u) => {
              const rows = items.filter((t) => t.unitId === u.id);
              const dueRows = rows.filter((t) => t.status === "Due").sort((a, z) => a.year - z.year);
              const show = dueRows[0] ?? [...rows].sort((a, z) => z.year - a.year)[0];
              return <TaxRow key={u.id} name={u.name} t={show} dueYears={dueRows.length} onMarkPaid={markPaid} />;
            })
          )}

          <div className={b.tdFoot}>
            <span className={b.tdTots}>
              <span className={b.tdTot}>
                <span className={b.tdLbl}>Paid in total</span>
                <Rupees value={paidTotal} tone="expense" className={b.tdTotValue} />
              </span>
              {dueTotal > 0 && (
                <span className={b.tdTot}>
                  <span className={b.tdLbl}>Still to pay</span>
                  <Rupees value={dueTotal} className={cx(b.tdTotValue, b.tdTotDue)} />
                </span>
              )}
            </span>
            <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => forms.open({ kind: "propertyTax" })}>
              Add a year
            </Button>
          </div>

          {(who || phone) && (
            <div className={b.tdOfficer}>
              <span className={b.tdAv} aria-hidden>
                {(who || "R").trim().charAt(0).toUpperCase()}
              </span>
              <span className={b.tdWho}>
                <b>{who || "Revenue officer"}</b>
                <span>
                  Revenue officer
                  {phone ? (
                    <>
                      {" · "}
                      <span className="num">{phoneText(phone)}</span>
                    </>
                  ) : null}
                </span>
              </span>
              {phone && (
                <>
                  <a className={b.tdIcon} href={telHref(phone)} aria-label="Call" title="Call">
                    <Phone aria-hidden />
                  </a>
                  <a className={cx(b.tdIcon, b.tdWa)} href={waHref(phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp">
                    <MessageCircle aria-hidden />
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </HudPanel>
      {forms.element}
    </>
  );
}

/** One house: its oldest bill still due, else its latest year. */
function TaxRow({ name, t, dueYears, onMarkPaid }: { name: string; t: PropertyTaxDTO | undefined; dueYears: number; onMarkPaid: (t: PropertyTaxDTO) => void }) {
  const paid = t?.status === "Paid";
  return (
    <div className={cx(b.tdRow, t && !paid && b.tdDue)}>
      <span className={b.tdName}>{name}</span>
      {t ? (
        <>
          <span className={b.tdAmt}>
            <Rupees value={t.amount} tone={paid ? "expense" : "neutral"} className={b.tdAmtValue} />
            <span className={b.tdSub}>
              {t.year} · {paid ? (t.paymentDate ? `paid ${formatDate(t.paymentDate)}` : "paid") : dueYears > 1 ? `due · ${dueYears} years due` : "due"}
            </span>
          </span>
          <StatusPill status={paid ? "paid" : "due"} size="sm" />
          {paid ? (
            <span className={b.tdCheck} aria-hidden>
              <Check />
            </span>
          ) : (
            <Button size="sm" variant="primary" onClick={() => onMarkPaid(t)}>
              Mark paid
            </Button>
          )}
        </>
      ) : (
        <span className={b.tdNone}>No tax recorded</span>
      )}
    </div>
  );
}
