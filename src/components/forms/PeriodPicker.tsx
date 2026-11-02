"use client";
// The period for reports and records (owner 2/11/2026: "just add all time with year pill. just like the fy and
// calender pill. remove the < > feature on the year"): [ Year | All time ] then the year dropdown (Year only), then
// [ FY | Calendar ]. No custom dates and no ‹ › year stepper (the APIs still take from / to).
import { useState } from "react";
import { Select, cx } from "@/components/ui";
import { ChoiceGroup } from "./controls";
import type { PeriodKindPick, PeriodPick } from "./period-pick";
import { yearLabel, type YearMode } from "./year-mode";
import s from "./period-picker.module.css";

export { periodParams, periodText, type PeriodKindPick, type PeriodPick } from "./period-pick";

type Kind = Exclude<PeriodKindPick, "range">;
const KINDS: { value: Kind; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];

export interface PeriodPickerProps {
  value: PeriodPick;
  onChange: (p: PeriodPick) => void;
  /** year keys to offer, newest first */
  years: number[];
  mode: YearMode;
  /** shows the [ FY | Calendar ] pill (with Year; with All time too when `modeOnAll`) */
  onModeChange?: (mode: YearMode) => void;
  /** All time is grouped by year here (reports), so FY / Calendar still matters */
  modeOnAll?: boolean;
  className?: string;
}

export function PeriodPicker({ value, onChange, years, mode, onModeChange, modeOnAll, className }: PeriodPickerProps) {
  // back to Year = the year last on screen
  const [lastYear, setLastYear] = useState(value.kind === "year" ? value.year : null);
  if (value.kind === "year" && value.year !== lastYear) setLastYear(value.year);
  const kind: Kind = value.kind === "all" ? "all" : "year";
  const pickKind = (k: Kind) => {
    if (k === kind) return;
    onChange(k === "all" ? { kind: "all" } : { kind: "year", year: lastYear ?? years[0] });
  };
  const showMode = onModeChange && (kind === "year" || modeOnAll);
  return (
    <div className={cx(s.picker, className)}>
      <div className={s.kinds}>
        <ChoiceGroup<Kind> name="periodKind" aria-label="Period" size="sm" value={kind} onChange={pickKind} options={KINDS} />
      </div>
      {value.kind === "year" && (
        <Select compact aria-label="Year" value={String(value.year)} className={s.select} onChange={(e) => onChange({ kind: "year", year: Number(e.target.value) })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y, mode)}
            </option>
          ))}
        </Select>
      )}
      {showMode && (
        <div className={s.mode}>
          <ChoiceGroup<YearMode>
            name="yearMode"
            aria-label="Year type"
            size="sm"
            value={mode}
            onChange={onModeChange}
            options={[
              { value: "fy", label: "FY" },
              { value: "calendar", label: "Calendar" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
