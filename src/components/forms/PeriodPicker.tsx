"use client";
// The period for reports and records (owner 8/10/2026): All time · Custom dates · each FY / calendar year.
// Custom dates show From / To boxes (both inclusive); From can't be after To (the other date follows along).
import { DateInput, Select, cx } from "@/components/ui";
import { formatDate, toInputDate, todayIST } from "@/lib/dates";
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

/** Custom dates to start from: the picked year (up to today), else the last 12 months. */
function defaultRange(p: PeriodPick, mode: YearMode): { from: string; to: string } {
  const today = todayIST();
  if (p.kind === "year") {
    const m = mode === "fy" ? 3 : 0;
    const start = new Date(Date.UTC(p.year, m, 1));
    const end = new Date(Date.UTC(p.year + 1, m, 0));
    return { from: toInputDate(start), to: toInputDate(end.getTime() < today.getTime() ? end : today) };
  }
  const from = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate() + 1));
  return { from: toInputDate(from), to: toInputDate(today) };
}

export interface PeriodPickerProps {
  value: PeriodPick;
  onChange: (p: PeriodPick) => void;
  /** year keys to offer, newest first */
  years: number[];
  mode: YearMode;
  className?: string;
}

export function PeriodPicker({ value, onChange, years, mode, className }: PeriodPickerProps) {
  const selectValue = value.kind === "all" ? "all" : value.kind === "range" ? "range" : String(value.year);
  return (
    <div className={cx(s.picker, value.kind === "range" && s.withDates, className)}>
      <Select
        compact
        aria-label="Period"
        value={selectValue}
        className={s.select}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "all") onChange({ kind: "all" });
          else if (v === "range") onChange({ kind: "range", ...defaultRange(value, mode) });
          else onChange({ kind: "year", year: Number(v) });
        }}
      >
        <option value="all">All time</option>
        <option value="range">Custom dates</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {yearLabel(y, mode)}
          </option>
        ))}
      </Select>
      {value.kind === "range" && (
        <div className={s.dates}>
          <DateInput
            compact
            aria-label="From"
            value={value.from}
            className={s.date}
            onValueChange={(from) => from && onChange({ kind: "range", from, to: from > value.to ? from : value.to })}
          />
          <span className={s.dash} aria-hidden>
            –
          </span>
          <DateInput
            compact
            aria-label="To"
            value={value.to}
            className={s.date}
            onValueChange={(to) => to && onChange({ kind: "range", from: to < value.from ? to : value.from, to })}
          />
        </div>
      )}
    </div>
  );
}
