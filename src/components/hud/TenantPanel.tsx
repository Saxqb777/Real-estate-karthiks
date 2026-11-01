"use client";
// The tenant window (opens on a tenant click). Owner 9/10/2026: the tenant and the house each get their own window —
// this one holds the person (their house, call / WhatsApp; owner 1/11/2026: no since / rent / deposit / phone line), the next rent big with Record rent
// beside it (or what they owe) and the month-by-month breakdown of what's owed. The house's money, value, occupancy and
// electricity stay in the house window (UnitPanel). Every figure still drills down.
import { ReceiptIndianRupee } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { agreementText } from "@/components/forms";
import type { DashboardData } from "@/lib/dashboard-types";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { Fig, FigLine } from "./Figure";
import { useFormDrawer } from "./FormDrawer";
import { monthList } from "./format";
import { ContactButtons, RentStatePill, dueText } from "./UnitPanel";
import s from "./hud.module.css";
import b from "./bits.module.css";

export interface TenantPanelProps {
  data: DashboardData;
  /** the house the tenant rents (its current lease) */
  unitId: string;
  onClose?: () => void;
  /** opens the house window (the house name in the tenant row, units in a breakdown) */
  onOpenUnit?: (unitId: string) => void;
  side?: "right" | "inline";
  drill?: DrillStack;
  className?: string;
}

export function TenantPanel(props: TenantPanelProps) {
  // a different tenant = a fresh drill-down
  return <TenantPanelInner key={props.unitId} {...props} />;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"} late`;

function TenantPanelInner({ data, unitId, onClose, onOpenUnit, side = "right", drill: external, className }: TenantPanelProps) {
  const own = useDrillStack();
  const drill = external ?? own;
  const forms = useFormDrawer();
  const u = data.units.find((x) => x.id === unitId);
  const lease = u?.activeLease;
  if (!u || !lease) return null;

  const open = (key: string) => drill.push({ kind: "metric", key: `unit:${u.id}:${key}` });
  const np = u.nextPayment;
  const owed = np && np.arrears.months.length > 0 ? np.arrears : null;
  const partPaid = owed ? owed.months.filter((m) => m.paid > 0).length : 0;
  const renew = data.renewals.find((r) => r.leaseId === lease.id);
  const recordRent = (
    <Button variant="primary" size="sm" icon={<ReceiptIndianRupee />} onClick={() => forms.open({ kind: "payment", props: { defaults: { leaseId: lease.id } } })}>
      Record rent
    </Button>
  );

  return (
    <>
      <DrillPanel
        data={data}
        drill={drill}
        rootLabel={lease.tenantName}
        side={side}
        eyebrow={`Tenant · ${u.name}`}
        title={lease.tenantName}
        aside={<RentStatePill unit={u} />}
        pinId="tenant"
        onClose={onClose}
        onOpenUnit={onOpenUnit}
        className={cx(b.compactWin, className)}
      >
        <div className={b.cw}>
          {/* ---------------- WHO: the house (→ house window), since, rent, deposit, agreement, phone */}
          <div className={cx(b.cRow, b.cPerson)}>
            <span className={b.cAv} aria-hidden>
              {lease.tenantName.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className={b.cWho}>
              <span className={b.cName}>
                {onOpenUnit ? (
                  <button type="button" className={b.cLink} onClick={() => onOpenUnit(u.id)} title={`Open ${u.name}`}>
                    {u.name}
                  </button>
                ) : (
                  u.name
                )}
              </span>
              {/* nothing else here (owner 1/11/2026: "no need to mention all this") — only an agreement that needs renewing */}
              {renew && <span className={cx(b.cMeta, renew.state === "expired" ? b.lateText : b.soonText)}>Agreement {agreementText(renew.daysLeft)}</span>}
            </span>
            <ContactButtons phone={lease.tenantPhone} name={lease.tenantName} />
          </div>

          {/* ---------------- NEXT RENT (or what's owed) */}
          {owed ? (
            <div className={cx(b.cRow, b.cHero, b.cLate)}>
              <div>
                <span className={b.cLabel}>Owes</span>
                <div className={b.cBig}>
                  <Fig value={owed.totalWithFees} size="hero" tone="expense" compact={false} onClick={() => open("overdue")} />
                </div>
                <div className={cx(b.cSub, b.lateText)}>
                  {monthList(owed.months.map((m) => m.label))}
                  {partPaid === 1 ? " (one part-paid)" : partPaid > 1 ? ` (${partPaid} part-paid)` : ""}
                </div>
              </div>
              {recordRent}
            </div>
          ) : np ? (
            <div className={cx(b.cRow, b.cHero, u.rentState !== "due-soon" && b.cOk)}>
              <div>
                <span className={b.cLabel}>Next rent · {np.label}</span>
                <div className={b.cBig}>
                  <Fig value={np.amountDue} size="hero" compact={false} onClick={() => open("rent")} />
                </div>
                <div className={cx(b.cSub, u.rentState === "due-soon" && b.cSoon)}>{dueText(np.dueDate, data.asOf)}</div>
              </div>
              {recordRent}
            </div>
          ) : null}

          {/* ---------------- WHAT'S OWED, month by month */}
          {owed && (
            <div className={cx(b.cRow, b.cLines)}>
              <div className={s.lines}>
                {owed.months.map((m) => (
                  <FigLine
                    key={m.key}
                    label={m.label}
                    sub={m.paid > 0 ? `${days(m.daysOverdue)} · part-paid` : days(m.daysOverdue)}
                    value={m.outstanding}
                    tone="expense"
                    onClick={() => open("overdue")}
                  />
                ))}
                {owed.lateFees > 0 && <FigLine label="Late fees" value={owed.lateFees} tone="expense" onClick={() => open("overdue")} />}
              </div>
            </div>
          )}
        </div>
      </DrillPanel>
      {forms.element}
    </>
  );
}
