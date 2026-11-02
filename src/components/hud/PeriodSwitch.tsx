"use client";
// The period for cash figures, right where they're shown (owner 2/11/2026: "just add all time with year pill. just like
// the fy and calender pill"): [ Year | All time ] then the year dropdown (Year only). An earlier year shows every
// figure as it stood at the end of that year, the current year shows today; All time = everything up to today.
// One period for the whole 3D view — the windows and the side charts share it (SpanContext from the overview).
import { Select, cx } from "@/components/ui";
import { ChoiceGroup } from "@/components/forms/controls";
import { yearLabel, yearOf } from "@/components/forms/year-mode";
import type { DashboardData } from "@/lib/dashboard-types";
import { yearChoices } from "./year-choices";
import { useSpan } from "./year-jump";
import s from "./hud.module.css";

export interface PeriodSwitchProps {
  data: Pick<DashboardData, "yearMode" | "today" | "asOf" | "monthlyByYear">;
  className?: string;
}

/** The last day of a year (FY: 31 March after it), as YYYY-MM-DD. */
function yearEnd(year: number, mode: DashboardData["yearMode"]): string {
  return mode === "fy" ? `${year + 1}-03-31` : `${year}-12-31`;
}

type Kind = "year" | "all";
const KINDS: { value: Kind; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];

export function PeriodSwitch({ data, className }: PeriodSwitchProps) {
  const api = useSpan();
  const mode = data.yearMode;
  const now = yearOf(data.today, mode);
  const shown = yearOf(data.asOf, mode);
  const years = yearChoices(now, shown, data.monthlyByYear.map((y) => y.year));
  if (!api) return <span className={cx(s.pyear, className)}>{yearLabel(shown, mode)}</span>;
  const { span, setSpan, setAsOf } = api;
  const kind: Kind = span.kind === "all" ? "all" : "year";
  const pickYear = (y: number) => setAsOf(y >= now ? null : yearEnd(y, mode));
  return (
    <div className={cx(s.pswitch, className)}>
      <div className={s.pkinds}>
        <ChoiceGroup<Kind> name="hudPeriod" aria-label="Period" size="sm" value={kind} onChange={(k) => k !== kind && setSpan({ kind: k })} options={KINDS} />
      </div>
      {kind === "year" && years.length > 1 && (
        <Select compact aria-label="Year" value={String(shown)} className={s.pyearSelect} onChange={(e) => pickYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y, mode)}
            </option>
          ))}
        </Select>
      )}
      {kind === "year" && years.length <= 1 && <span className={s.pyear}>{yearLabel(shown, mode)}</span>}
    </div>
  );
}
