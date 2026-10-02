"use client";
// The status strip over the clean world: at most 3 chips, prioritised overdue > due soon > tax / to-dos > vacancy,
// "+N more" for the rest, and a calm "All rent paid ✓" when nothing needs attention (the 3-second test).
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { daysBetween } from "@/lib/dates";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";
import { inr, positionLabel } from "./format";
import type { ChipTarget } from "./types";
import s from "./bits.module.css";

export type ChipTone = "coral" | "marigold" | "sky" | "teal" | "neutral";

export interface StatusChip {
  id: string;
  tone: ChipTone;
  text: string;
  /** small second part, e.g. the amount */
  detail?: string;
  target: ChipTarget;
  /** lower = more urgent */
  rank: number;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
};

/** Build every chip that applies, most urgent first (pure — handy for tests and the "?" overlay). */
export function buildStatusChips(data: DashboardData, taxes?: PropertyTaxDTO[] | null): StatusChip[] {
  const out: StatusChip[] = [];
  const name = (u: { name: string; position: "front" | "back" | null }) => {
    const p = positionLabel(u.position);
    return p ? `${p} unit` : u.name;
  };
  for (const u of data.units) {
    if (!u.isActive) continue;
    const np = u.nextPayment;
    if (u.rentState === "overdue" && np) {
      const n = np.arrears.months.length;
      out.push({
        id: `overdue:${u.id}`,
        tone: "coral",
        text: n > 1 ? `${name(u)} · ${n} months late` : `${name(u)} · ${np.daysOverdue} ${np.daysOverdue === 1 ? "day" : "days"} late`,
        detail: inr(np.arrears.totalWithFees),
        target: { kind: "unit", unitId: u.id },
        rank: 0,
      });
    } else if (u.rentState === "due-soon" && np) {
      out.push({ id: `due:${u.id}`, tone: "marigold", text: `Rent due ${dayMonth(np.dueDate)} — ${u.name}`, detail: inr(np.amountDue), target: { kind: "unit", unitId: u.id }, rank: 1 });
    }
  }
  const thisYear = new Date(data.asOf).getUTCFullYear();
  const unitIds = new Set(data.units.map((u) => u.id));
  const taxDue = (taxes ?? []).filter((t) => t.status === "Due" && t.year <= thisYear && unitIds.has(t.unitId));
  if (taxDue.length) {
    const years = [...new Set(taxDue.map((t) => t.year))].sort();
    out.push({ id: "tax", tone: "marigold", text: `Property tax ${years.join(", ")} due`, detail: `${taxDue.length} ${taxDue.length === 1 ? "bill" : "bills"}`, target: { kind: "tax" }, rank: 2 });
  }
  const pending = data.actions.pending;
  const late = pending.filter((a) => a.isOverdue);
  if (late.length) out.push({ id: "todo-late", tone: "marigold", text: late.length === 1 ? `To-do late: ${late[0].title}` : `${late.length} to-dos late`, target: { kind: "noticeboard" }, rank: 3 });
  for (const u of data.units) {
    if (!u.isActive) continue;
    if (u.status === "incoming" && u.incomingLease)
      out.push({ id: `incoming:${u.id}`, tone: "sky", text: `${name(u)} · moving in ${dayMonth(u.incomingLease.startDate)}`, target: { kind: "unit", unitId: u.id }, rank: 4 });
    else if (u.status === "vacant") {
      const v = u.vacantPeriods.find((p) => p.ongoing);
      const d = v ? v.days : daysBetween(new Date(u.purchaseDate), new Date(data.asOf));
      out.push({ id: `vacant:${u.id}`, tone: "sky", text: `${name(u)} vacant ${d} ${d === 1 ? "day" : "days"}`, target: { kind: "unit", unitId: u.id }, rank: 5 });
    }
  }
  const notLate = pending.length - late.length;
  if (notLate > 0) out.push({ id: "todos", tone: "neutral", text: `${notLate} ${notLate === 1 ? "to-do" : "to-dos"} on the board`, target: { kind: "noticeboard" }, rank: 6 });
  return out.sort((a, z) => a.rank - z.rank);
}

export interface StatusChipsProps {
  data: DashboardData;
  /** /api/property-tax items (optional — adds the "Property tax due" chip) */
  taxes?: PropertyTaxDTO[] | null;
  /** chips shown before "+N more" (default 3) */
  max?: number;
  onSelect: (target: ChipTarget) => void;
  className?: string;
}

export function StatusChips({ data, taxes, max = 3, onSelect, className }: StatusChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const all = buildStatusChips(data, taxes);
  const occupied = data.units.some((u) => u.isActive && u.activeLease);
  const anyRentIssue = all.some((c) => c.rank <= 1);
  const calm: StatusChip | null =
    !anyRentIssue && occupied
      ? { id: "calm", tone: "teal", text: data.isLive ? "All rent paid" : "All rent paid on this date", target: { kind: "mailbox" }, rank: -1 }
      : null;
  const list = calm ? [calm, ...all] : all;
  const shown = expanded ? list : list.slice(0, max);
  const more = list.length - shown.length;

  if (list.length === 0)
    return (
      <div className={cx(s.chips, className)} role="status">
        <span className={cx(s.chip, s.chipCalm)} data-tone="teal">
          <Check aria-hidden className={s.chipCheck} />
          Nothing needs you today
        </span>
      </div>
    );

  return (
    <div className={cx(s.chips, expanded && s.chipsExpanded, className)} role="status" aria-label="What needs attention">
      {shown.map((c) => (
        <button key={c.id} type="button" className={cx(s.chip, c.id === "calm" && s.chipCalm)} data-tone={c.tone} onClick={() => onSelect(c.target)}>
          {c.id === "calm" ? <Check aria-hidden className={s.chipCheck} /> : <span className={cx(s.chipMark, c.tone === "coral" && s.chipPulse)} aria-hidden />}
          <span className={s.chipText}>{c.text}</span>
          {c.detail && <span className={s.chipDetail}>{c.detail}</span>}
        </button>
      ))}
      {more > 0 && (
        <button type="button" className={cx(s.chip, s.chipMore)} onClick={() => setExpanded(true)} aria-expanded={false}>
          +{more} more
          <ChevronDown aria-hidden />
        </button>
      )}
      {expanded && list.length > max && (
        <button type="button" className={cx(s.chip, s.chipMore)} onClick={() => setExpanded(false)} aria-expanded>
          Less
          <ChevronUp aria-hidden />
        </button>
      )}
    </div>
  );
}
