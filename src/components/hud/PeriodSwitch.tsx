"use client";
// The period for cash figures, right where they're shown (owner 8/10: every money view can show ALL TIME):
// ALL TIME · FY 2026-27 · OCT 2026. It replaces the scope chip on cash sections and charts. One remembered choice
// (usePeriod) — switching it anywhere switches every cash figure, chart and scope chip together.
import { cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { usePeriod } from "./store";
import type { PeriodKind } from "./types";
import s from "./hud.module.css";

const ORDER: PeriodKind[] = ["allTime", "year", "month"];

export interface PeriodSwitchProps {
  data: Pick<DashboardData, "scopeLabels" | "isLive">;
  /** controlled (default: the remembered period) */
  period?: PeriodKind;
  onChange?: (p: PeriodKind) => void;
  className?: string;
}

export function PeriodSwitch({ data, period: controlled, onChange, className }: PeriodSwitchProps) {
  const [stored, setStored] = usePeriod();
  const period = controlled ?? stored;
  return (
    <div className={cx(s.pswitch, !data.isLive && s.pswitchPast, className)} role="radiogroup" aria-label="Period">
      {ORDER.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === period}
          className={s.pswitchBtn}
          onClick={() => {
            setStored(p);
            onChange?.(p);
          }}
        >
          {data.scopeLabels[p]}
        </button>
      ))}
    </div>
  );
}
