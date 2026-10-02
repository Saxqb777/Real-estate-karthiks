// Status-strip chips, most urgent first — pure (unit-tested; relative imports on purpose).
import type { DashboardData } from "../../lib/dashboard-types";
import { daysBetween } from "../../lib/dates";
import { inr, positionLabel } from "./format";
import type { ChipTarget } from "./types";

/** The fields of a property-tax row the chips need (PropertyTaxDTO satisfies it). */
export interface TaxLike {
  unitId: string;
  year: number;
  status: string;
}

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
export function buildStatusChips(data: DashboardData, taxes?: TaxLike[] | null): StatusChip[] {
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

