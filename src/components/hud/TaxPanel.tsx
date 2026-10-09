"use client";
// Tax collector (the moped + collector on the grass; owner 9/10/2026) → the collector's name + call / WhatsApp, then
// property tax per year and unit; "Mark paid" in one step (it then appears in
// Expenses on the payment date — the API creates that expense, the HUD never adds it up itself).
import { CircleCheck, Landmark, MessageCircle, Phone, Plus, UserRound } from "lucide-react";
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
import s from "./hud.module.css";
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
  const years = [...new Set(items.map((t) => t.year))].sort((a, z) => z - a);
  const due = items.filter((t) => t.status === "Due");
  const paidRows = items.filter((t) => t.status === "Paid");
  const paidTotal = sumAmounts(paidRows);
  const dueTotal = sumAmounts(due);
  const lastPaid = [...paidRows].filter((t) => t.paymentDate).sort((a, z) => (z.paymentDate ?? "").localeCompare(a.paymentDate ?? ""))[0];
  const units = data.units.filter((u) => u.isActive);
  const maxYear = Math.max(0, ...years.map((y) => sumAmounts(items.filter((t) => t.year === y))));
  const { taxCollectorName: who, taxCollectorPhone: phone } = data.settings;

  return (
    <>
      <HudPanel
        side={side}
        eyebrow="Tax collector"
        title="Property tax"
        pinId="tax"
        onClose={onClose}
        className={className}
        accent={due.length ? "marigold" : "teal"}
        actions={
          <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => forms.open({ kind: "propertyTax" })}>
            Add a year
          </Button>
        }
      >
        {(who || phone) && (
          <section className={b.taxContact} aria-label="Tax collector">
            <UserRound aria-hidden className={b.taxContactIcon} />
            <div className={b.taxContactWho}>
              <span className={b.taxContactName}>{who ?? "Tax collector"}</span>
              {phone && <span className={cx(b.taxContactPhone, "num")}>{phoneText(phone)}</span>}
            </div>
            {phone && (
              <div className={b.taxContactActs}>
                <a className={b.call} href={telHref(phone)}>
                  <Phone aria-hidden />
                  Call
                </a>
                <a className={b.call} href={waHref(phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden />
                  WhatsApp
                </a>
              </div>
            )}
          </section>
        )}
        {tax.loading ? (
          <div className={b.taxSkel}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={40} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState compact art={<Landmark />} title="No property tax recorded" />
        ) : (
          <>
            {/* 1 · the whole picture */}
            <section className={b.taxCol}>
              <h3 className={b.taxHead}>Summary</h3>
              <span className={b.taxLabel}>Paid in total</span>
              <Rupees value={paidTotal} tone="expense" className={b.taxHero} />
              {due.length > 0 ? (
                <div className={cx(b.taxStat, b.taxStatDue)}>
                  <span>Still to pay</span>
                  <b>
                    <Rupees value={dueTotal} /> · {due.length} {due.length === 1 ? "bill" : "bills"}
                  </b>
                </div>
              ) : (
                <p className={s.calm}>
                  <CircleCheck aria-hidden />
                  <span className={s.calmStrong}>All property tax paid</span>
                </p>
              )}
              <div className={b.taxStat}>
                <span>Years recorded</span>
                <b className="num">
                  {years.length} · {years[years.length - 1]}–{years[0]}
                </b>
              </div>
              <div className={b.taxStat}>
                <span>Last paid</span>
                <b className="num">{lastPaid?.paymentDate ? `${formatDate(lastPaid.paymentDate)} · ${lastPaid.unit.name}` : "—"}</b>
              </div>
              <div className={b.taxStat}>
                <span>Average a year</span>
                <b>
                  <Rupees value={years.length ? Math.round(sumAmounts(items) / years.length) : 0} />
                </b>
              </div>
            </section>

            {/* 2 · per unit */}
            <section className={b.taxCol}>
              <h3 className={b.taxHead}>By unit</h3>
              {units.map((u) => {
                const rows = items.filter((t) => t.unitId === u.id).sort((a, z) => z.year - a.year);
                const paid = rows.filter((t) => t.status === "Paid");
                const latest = rows[0];
                return (
                  <div key={u.id} className={b.taxUnitCard}>
                    <div className={b.taxUnitTop}>
                      <span className={b.taxUnitName}>{u.name}</span>
                      {latest ? <StatusPill status={latest.status === "Paid" ? "paid" : "due"} size="sm" /> : null}
                    </div>
                    <div className={b.taxStat}>
                      <span>Paid so far</span>
                      <b>
                        <Rupees value={sumAmounts(paid)} tone="expense" />
                      </b>
                    </div>
                    <div className={b.taxStat}>
                      <span>Latest year</span>
                      <b className="num">
                        {latest ? (
                          <>
                            {latest.year} · <Rupees value={latest.amount} />
                          </>
                        ) : (
                          "—"
                        )}
                      </b>
                    </div>
                    <div className={b.taxStat}>
                      <span>Years paid</span>
                      <b className="num">
                        {paid.length} of {rows.length}
                      </b>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* 3 · year by year */}
            <section className={b.taxCol}>
              <h3 className={b.taxHead}>Year by year</h3>
              <div className={b.taxYears}>
                {years.map((y) => {
                  const rows = items.filter((t) => t.year === y).sort((a, z) => a.unit.name.localeCompare(z.unit.name));
                  const total = sumAmounts(rows);
                  return (
                    <div key={y} className={b.taxYear}>
                      <div className={b.taxYearHead}>
                        <span className="num">{y}</span>
                        <Rupees value={total} className={b.taxYearTotal} />
                      </div>
                      <div className={b.taxBar}>
                        <i style={{ width: `${maxYear ? Math.max(4, (total / maxYear) * 100) : 0}%` }} />
                      </div>
                      <ul>
                        {rows.map((t) => (
                          <TaxRow key={t.id} t={t} onMarkPaid={() => forms.open({ kind: "markTaxPaid", title: `Mark ${t.year} paid · ${t.unit.name}`, props: { tax: t } })} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </HudPanel>
      {forms.element}
    </>
  );
}

function TaxRow({ t, onMarkPaid }: { t: PropertyTaxDTO; onMarkPaid: () => void }) {
  const paid = t.status === "Paid";
  return (
    <li className={cx(b.taxRow, !paid && b.taxDue)}>
      <span className={b.taxUnit}>{t.unit.name}</span>
      <Rupees value={t.amount} tone={paid ? "expense" : "neutral"} className={b.taxAmt} />
      {paid ? (
        <span className={b.taxPaid}>
          <StatusPill status="paid" size="sm" />
          <span className={b.taxDate}>{t.paymentDate ? formatDate(t.paymentDate) : ""}</span>
        </span>
      ) : (
        <Button size="sm" variant="primary" onClick={onMarkPaid}>
          Mark paid
        </Button>
      )}
    </li>
  );
}
