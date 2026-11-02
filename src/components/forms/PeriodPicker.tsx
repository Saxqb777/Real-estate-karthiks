"use client";
// The period for reports and records (owner 2/11/2026: "add all time and custom date like this in every page where
// dates are present", picked TWO PILLS): [ Year | All time | Custom ] then the year dropdown (Year) or From – To boxes
// (Custom, both days included; From can't pass To — the other date follows along), then [ FY | Calendar ].
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { DateInput, IconButton, Select, cx } from "@/components/ui";
import { ChoiceGroup } from "./controls";
import { defaultRange, keepOrder, type PeriodKindPick, type PeriodPick } from "./period-pick";
import { yearLabel, type YearMode } from "./year-mode";
import s from "./period-picker.module.css";

export { defaultRange, keepOrder, periodParams, periodText, type PeriodKindPick, type PeriodPick } from "./period-pick";

const KINDS: { value: PeriodKindPick; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
  { value: "range", label: "Custom" },
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
  /** ‹ › beside the year dropdown */
  arrows?: boolean;
  className?: string;
}

export function PeriodPicker({ value, onChange, years, mode, onModeChange, modeOnAll, arrows, className }: PeriodPickerProps) {
  // back to Year = the year last on screen
  const [lastYear, setLastYear] = useState(value.kind === "year" ? value.year : null);
  if (value.kind === "year" && value.year !== lastYear) setLastYear(value.year);
  const year = value.kind === "year" ? value.year : (lastYear ?? years[0]);
  const newest = years[0];
  const oldest = years[years.length - 1];
  const pickKind = (k: PeriodKindPick) => {
    if (k === value.kind) return;
    if (k === "all") onChange({ kind: "all" });
    else if (k === "range") onChange({ kind: "range", ...defaultRange(value, mode) });
    else onChange({ kind: "year", year: year ?? newest });
  };
  const showMode = onModeChange && (value.kind === "year" || (value.kind === "all" && modeOnAll));
  return (
    <div className={cx(s.picker, value.kind === "range" && s.withDates, className)}>
      <div className={s.kinds}>
        <ChoiceGroup<PeriodKindPick> name="periodKind" aria-label="Period" size="sm" value={value.kind} onChange={pickKind} options={KINDS} />
      </div>
      {value.kind === "year" && (
        <div className={s.year}>
          {arrows && (
            <IconButton size="sm" variant="ghost" label="Previous year" icon={<ChevronLeft />} disabled={value.year <= oldest} onClick={() => onChange({ kind: "year", year: value.year - 1 })} />
          )}
          <Select compact aria-label="Year" value={String(value.year)} className={s.select} onChange={(e) => onChange({ kind: "year", year: Number(e.target.value) })}>
            {years.map((y) => (
              <option key={y} value={y}>
                {yearLabel(y, mode)}
              </option>
            ))}
          </Select>
          {arrows && (
            <IconButton size="sm" variant="ghost" label="Next year" icon={<ChevronRight />} disabled={value.year >= newest} onClick={() => onChange({ kind: "year", year: value.year + 1 })} />
          )}
        </div>
      )}
      {value.kind === "range" && (
        <div className={s.dates}>
          <DateInput
            compact
            aria-label="From"
            value={value.from}
            className={s.date}
            onValueChange={(from) => from && onChange({ kind: "range", ...keepOrder({ from, to: value.to }, "from") })}
          />
          <span className={s.dash} aria-hidden>
            –
          </span>
          <DateInput
            compact
            aria-label="To"
            value={value.to}
            className={s.date}
            onValueChange={(to) => to && onChange({ kind: "range", ...keepOrder({ from: value.from, to }, "to") })}
          />
        </div>
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
