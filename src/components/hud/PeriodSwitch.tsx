"use client";
// The period for cash figures, right where they're shown (owner 2/11/2026: "add all time and custom date like this
// in every page where dates are present", two pills): [ Year | All time | Custom ] then the year dropdown (an earlier
// year shows every figure as it stood at the end of that year, the current year shows today) or From – To dates.
// One period for the whole 3D view — the windows and the side charts share it (SpanContext from the overview).
import { DateInput, Select, cx } from "@/components/ui";
import { ChoiceGroup } from "@/components/forms/controls";
import { defaultRange, keepOrder, type PeriodKindPick } from "@/components/forms/period-pick";
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

const KINDS: { value: PeriodKindPick; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
  { value: "range", label: "Custom" },
];

export function PeriodSwitch({ data, className }: PeriodSwitchProps) {
  const api = useSpan();
  const mode = data.yearMode;
  const now = yearOf(data.today, mode);
  const shown = yearOf(data.asOf, mode);
  const years = yearChoices(now, shown, data.monthlyByYear.map((y) => y.year));
  if (!api) return <span className={cx(s.pyear, className)}>{yearLabel(shown, mode)}</span>;
  const { span, setSpan, setAsOf } = api;
  const today = data.today.slice(0, 10);
  const pickYear = (y: number) => setAsOf(y >= now ? null : yearEnd(y, mode));
  const pickKind = (k: PeriodKindPick) => {
    if (k === span.kind) return;
    if (k === "year") setSpan({ kind: "year" });
    else if (k === "all") setSpan({ kind: "all" });
    else {
      // start from the year on screen (up to today), or the last 12 months from All time
      const r = defaultRange(span.kind === "all" ? { kind: "all" } : { kind: "year", year: shown }, mode, new Date(`${today}T00:00:00.000Z`));
      setSpan({ kind: "range", ...r });
    }
  };
  // From can't be after today (nothing to show yet); To may run past it (counted up to today)
  const setRange = (r: { from: string; to: string }) => setSpan({ kind: "range", from: r.from > today ? today : r.from, to: r.to });
  return (
    <div className={cx(s.pswitch, className)}>
      <div className={s.pkinds}>
        <ChoiceGroup<PeriodKindPick> name="hudPeriod" aria-label="Period" size="sm" value={span.kind} onChange={pickKind} options={KINDS} />
      </div>
      {span.kind === "year" && years.length > 1 && (
        <Select compact aria-label="Year" value={String(shown)} className={s.pyearSelect} onChange={(e) => pickYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y, mode)}
            </option>
          ))}
        </Select>
      )}
      {span.kind === "year" && years.length <= 1 && <span className={s.pyear}>{yearLabel(shown, mode)}</span>}
      {span.kind === "range" && (
        <div className={s.pdates}>
          <DateInput compact aria-label="From" value={span.from} className={s.pdate} onValueChange={(from) => from && setRange(keepOrder({ from, to: span.to }, "from"))} />
          <span className={s.pdash} aria-hidden>
            –
          </span>
          <DateInput compact aria-label="To" value={span.to} className={s.pdate} onValueChange={(to) => to && setRange(keepOrder({ from: span.from, to }, "to"))} />
        </div>
      )}
    </div>
  );
}
