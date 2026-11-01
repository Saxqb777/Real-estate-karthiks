"use client";
// The period for cash figures, right where they're shown: just the YEAR (owner 1/11/2026: "just keep years to select
// clean and simple … no need of all time … remove the months"). A small year dropdown; an earlier year shows every
// figure as it stood at the end of that year (the overview's as-of date), the current year shows today.
import { Select, cx } from "@/components/ui";
import { yearLabel, yearOf } from "@/components/forms/year-mode";
import type { DashboardData } from "@/lib/dashboard-types";
import { useSetAsOf } from "./year-jump";
import s from "./hud.module.css";

export interface PeriodSwitchProps {
  data: Pick<DashboardData, "yearMode" | "today" | "asOf" | "monthlyByYear">;
  className?: string;
}

/** The last day of a year (FY: 31 March after it), as YYYY-MM-DD. */
function yearEnd(year: number, mode: DashboardData["yearMode"]): string {
  return mode === "fy" ? `${year + 1}-03-31` : `${year}-12-31`;
}

export function PeriodSwitch({ data, className }: PeriodSwitchProps) {
  const setAsOf = useSetAsOf();
  const mode = data.yearMode;
  const now = yearOf(data.today, mode);
  const shown = yearOf(data.asOf, mode);
  const years = [...new Set([now, shown, ...data.monthlyByYear.map((y) => y.year)])].filter((y) => y <= now).sort((a, b) => b - a);
  if (!setAsOf || years.length < 2) return <span className={cx(s.pyear, className)}>{yearLabel(shown, mode)}</span>;
  return (
    <Select
      compact
      aria-label="Year"
      value={String(shown)}
      className={cx(s.pyearSelect, className)}
      onChange={(e) => {
        const y = Number(e.target.value);
        setAsOf(y >= now ? null : yearEnd(y, mode));
      }}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {yearLabel(y, mode)}
        </option>
      ))}
    </Select>
  );
}
