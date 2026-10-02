"use client";
// The ONE global period control: All time · <year> · <month>, plus the FY / Calendar toggle.
// Labels come from data.scopeLabels so they always match the scope chips; both choices are remembered per browser
// (period: usePeriod; year type: useYearMode from the forms — shared with the Expenses filter).
import { motion } from "motion/react";
import { useId } from "react";
import { cx } from "@/components/ui";
import { useYearMode, type YearMode } from "@/components/forms";
import { useApi } from "@/lib/client";
import type { DashboardData } from "@/lib/dashboard-types";
import { usePeriod } from "./store";
import type { PeriodKind } from "./types";
import s from "./bits.module.css";

export interface PeriodControlProps {
  data: Pick<DashboardData, "scopeLabels" | "yearMode">;
  /** controlled period (default: the remembered one) */
  period?: PeriodKind;
  onPeriodChange?: (p: PeriodKind) => void;
  /** controlled year type (default: the remembered one — refetch the dashboard with ?yearMode=) */
  yearMode?: YearMode;
  onYearModeChange?: (m: YearMode) => void;
  size?: "sm" | "md";
  className?: string;
}

export function PeriodControl({ data, period: p, onPeriodChange, yearMode: ym, onYearModeChange, size = "md", className }: PeriodControlProps) {
  const uid = useId();
  const [storedPeriod, setStoredPeriod] = usePeriod();
  const [storedMode, setStoredMode] = useYearMode();
  const period = p ?? storedPeriod;
  const mode = ym ?? storedMode;
  const setPeriod = (v: PeriodKind) => {
    setStoredPeriod(v);
    onPeriodChange?.(v);
  };
  const setMode = (m: YearMode) => {
    setStoredMode(m);
    onYearModeChange?.(m);
  };
  const items: { id: PeriodKind; label: string }[] = [
    { id: "allTime", label: data.scopeLabels.allTime },
    { id: "year", label: data.scopeLabels.year },
    { id: "month", label: data.scopeLabels.month },
  ];
  return (
    <div className={cx(s.period, size === "sm" && s.periodSm, className)}>
      <div className={s.periodSeg} role="radiogroup" aria-label="Period for the cash figures">
        {items.map((it) => {
          const on = it.id === period;
          return (
            <button key={it.id} type="button" role="radio" aria-checked={on} className={s.periodBtn} onClick={() => setPeriod(it.id)}>
              {on && <motion.span layoutId={`${uid}-plate`} className={s.periodPlate} transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
              <span className={s.periodText}>{it.label}</span>
            </button>
          );
        })}
      </div>
      <div className={s.yearType} role="radiogroup" aria-label="Year type">
        {(["fy", "calendar"] as YearMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={s.yearBtn}
            onClick={() => setMode(m)}
            title={m === "fy" ? "Financial year: 1 Apr – 31 Mar" : "Calendar year: 1 Jan – 31 Dec"}
          >
            {m === "fy" ? "FY" : "Cal"}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The dashboard in the remembered year type (and optional as-of date). Keeps showing the previous data while a new
 * year type loads, so the HUD never flashes empty.
 */
export function useHudDashboard(asOf?: string | null) {
  const [mode] = useYearMode();
  const q = new URLSearchParams({ yearMode: mode });
  if (asOf) q.set("asOf", asOf.slice(0, 10));
  return useApi<DashboardData>(`/api/dashboard?${q}`, { keepPrevious: true });
}
