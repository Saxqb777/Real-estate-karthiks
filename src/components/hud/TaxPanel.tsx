"use client";
// Tax stamp on the gate pillar → property tax per year and unit; "Mark paid" in one step (it then appears in
// Expenses on the payment date — the API creates that expense, the HUD never adds it up itself).
import { CircleCheck, Landmark, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton, StatusPill, cx } from "@/components/ui";
import { usePropertyTax } from "@/components/forms";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";
import { Rupees } from "./Figure";
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

  return (
    <>
      <HudPanel
        side={side}
        eyebrow="Tax stamp · property tax"
        title="Property tax"
        pinId="tax"
        onClose={onClose}
        className={className}
        accent={due.length ? "marigold" : "teal"}
        hint="Marking a year paid adds it to Expenses on the date you paid"
        actions={
          <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => forms.open({ kind: "propertyTax" })}>
            Add a year
          </Button>
        }
      >
        {tax.loading ? (
          <div className={b.taxSkel}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={40} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState compact art={<Landmark />} title="No property tax recorded" description="Add each year's tax per unit; mark it paid when you pay the panchayat / municipality." />
        ) : (
          <>
            {due.length > 0 ? (
              <div className={b.boardHero}>
                <span className={b.boardCount}>
                  <span className="num">{due.length}</span> {due.length === 1 ? "bill" : "bills"} still to pay
                </span>
                <Badge tone="marigold" marker size="sm">
                  {[...new Set(due.map((t) => t.year))].sort().join(", ")}
                </Badge>
              </div>
            ) : (
              <p className={s.calm}>
                <CircleCheck aria-hidden />
                <span className={s.calmStrong}>All property tax paid</span>
              </p>
            )}
            <div className={b.taxYears}>
              {years.map((y) => (
                <section key={y} className={b.taxYear}>
                  <div className={b.taxYearHead}>
                    <span className="num">{y}</span>
                  </div>
                  <ul>
                    {items
                      .filter((t) => t.year === y)
                      .sort((a, z) => a.unit.name.localeCompare(z.unit.name))
                      .map((t) => (
                        <TaxRow key={t.id} t={t} onMarkPaid={() => forms.open({ kind: "markTaxPaid", title: `Mark ${t.year} paid · ${t.unit.name}`, props: { tax: t } })} />
                      ))}
                  </ul>
                </section>
              ))}
            </div>
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
      <Rupees value={t.amount} className={b.taxAmt} />
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
