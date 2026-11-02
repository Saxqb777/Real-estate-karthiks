// The period a report / record list shows (owner 2/11/2026: Year · All time · Custom dates). Pure — tested in
// __tests__/period-pick.test.ts; the PeriodPicker control re-exports these.
import { formatDate, toInputDate, todayIST } from "../../lib/dates";
import { yearLabel, type YearMode } from "./year-mode";

export type PeriodPick = { kind: "all" } | { kind: "year"; year: number } | { kind: "range"; from: string; to: string };
export type PeriodKindPick = PeriodPick["kind"];

/** Query params for the APIs: nothing (all time) · year + yearMode · from + to. */
export function periodParams(p: PeriodPick, mode: YearMode): Record<string, string> {
  if (p.kind === "year") return { year: String(p.year), yearMode: mode };
  if (p.kind === "range") return { from: p.from, to: p.to };
  return {};
}

/** "All time" · "FY 2025-26" · "1/4/2026 – 30/9/2026" (the scope chip / total label text). */
export function periodText(p: PeriodPick, mode: YearMode): string {
  if (p.kind === "year") return yearLabel(p.year, mode);
  if (p.kind === "range") return `${formatDate(p.from)} – ${formatDate(p.to)}`;
  return "All time";
}

/** Custom dates to start from: the year on screen (up to today), else the last 12 months. */
export function defaultRange(p: PeriodPick, mode: YearMode, today: Date = todayIST()): { from: string; to: string } {
  if (p.kind === "range") return { from: p.from, to: p.to };
  if (p.kind === "year") {
    const m = mode === "fy" ? 3 : 0;
    const start = new Date(Date.UTC(p.year, m, 1));
    const end = new Date(Date.UTC(p.year + 1, m, 0));
    const to = end.getTime() < today.getTime() ? end : today;
    return { from: toInputDate(start.getTime() <= to.getTime() ? start : to), to: toInputDate(to) };
  }
  const from = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate() + 1));
  return { from: toInputDate(from), to: toInputDate(today) };
}

/** Keep From ≤ To: whichever date was just moved, the other follows when it would cross. */
export function keepOrder(r: { from: string; to: string }, moved: "from" | "to"): { from: string; to: string } {
  if (r.from <= r.to) return r;
  return moved === "from" ? { from: r.from, to: r.from } : { from: r.to, to: r.to };
}
