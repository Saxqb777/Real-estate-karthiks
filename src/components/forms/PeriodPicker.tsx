"use client";
// The period for reports and records: one FY / calendar year (owner 1/11/2026 — All time and custom dates removed;
// the APIs still take them, so PeriodPick keeps those shapes).
import { Select, cx } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { yearLabel, type YearMode } from "./year-mode";
import s from "./period-picker.module.css";

export type PeriodPick = { kind: "all" } | { kind: "year"; year: number } | { kind: "range"; from: string; to: string };

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

export interface PeriodPickerProps {
  value: PeriodPick;
  onChange: (p: PeriodPick) => void;
  /** year keys to offer, newest first */
  years: number[];
  mode: YearMode;
  className?: string;
}

/** Years only (owner 1/11/2026: "just keep years to select clean and simple … no need of all time and custom date"). */
export function PeriodPicker({ value, onChange, years, mode, className }: PeriodPickerProps) {
  const selectValue = value.kind === "year" ? String(value.year) : String(years[0] ?? "");
  return (
    <div className={cx(s.picker, className)}>
      <Select compact aria-label="Year" value={selectValue} className={s.select} onChange={(e) => onChange({ kind: "year", year: Number(e.target.value) })}>
        {years.map((y) => (
          <option key={y} value={y}>
            {yearLabel(y, mode)}
          </option>
        ))}
      </Select>
    </div>
  );
}
