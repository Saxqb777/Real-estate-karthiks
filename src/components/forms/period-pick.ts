// The period a report / record list shows (owner 2/11/2026: Year · All time; custom dates only through the APIs). Pure
// — tested in __tests__/period-pick.test.ts; the PeriodPicker control re-exports these.
import { formatDate } from "../../lib/dates";
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
