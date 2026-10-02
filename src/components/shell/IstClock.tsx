"use client";

import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui";
import { dayPhaseAt, istTime, PHASE_LABEL, type DayPhase } from "./day-phase";
import styles from "./Shell.module.css";

const subscribeSecond = (cb: () => void) => {
  const t = window.setInterval(cb, 1000);
  return () => window.clearInterval(t);
};
const nowSecond = () => Math.floor(Date.now() / 1000);
const serverSecond = () => 0;

/** Current epoch second, ticking once per second; 0 during SSR/hydration. */
export function useEpochSecond(): number {
  return useSyncExternalStore(subscribeSecond, nowSecond, serverSecond);
}

const ICON: Record<DayPhase, typeof Sun> = { dawn: Sunrise, day: Sun, dusk: Sunset, night: Moon };
const pad = (n: number) => String(n).padStart(2, "0");

/** Live IST clock with day-phase icon and a 24-segment "time of day" meter. */
export function IstClock({ compact = false }: { compact?: boolean }) {
  const sec = useEpochSecond();
  const t = sec ? istTime(new Date(sec * 1000)) : null;
  const phase: DayPhase = t ? dayPhaseAt(t.fractional) : "day";
  const Icon = ICON[phase];
  const label = t ? `${pad(t.hours)}:${pad(t.minutes)} IST, ${t.weekday} ${t.day} ${t.month} — ${PHASE_LABEL[phase]}` : "India time";
  return (
    <div className={cx(styles.clock, compact && styles.clockCompact)} data-phase={phase} role="timer" aria-label={label}>
      <span className={styles.phaseIcon} aria-hidden>
        <Icon />
      </span>
      <div className={styles.clockText} aria-hidden>
        <div className={styles.time}>
          {t ? (
            <>
              {pad(t.hours)}
              <span className={styles.colon}>:</span>
              {pad(t.minutes)}
              {!compact && <span className={styles.secs}>{pad(t.seconds)}</span>}
            </>
          ) : (
            "--:--"
          )}
          {!compact && <span className={styles.tz}>IST</span>}
        </div>
        {!compact && (
          <div className={styles.date}>
            {t ? `${t.weekday} ${t.day} ${t.month}` : "—"}
            <span className={styles.dot} />
            {PHASE_LABEL[phase]}
          </div>
        )}
        {!compact && <DayMeter hour={t ? t.fractional : -1} />}
      </div>
    </div>
  );
}

function DayMeter({ hour }: { hour: number }) {
  return (
    <div className={styles.meter}>
      {Array.from({ length: 24 }, (_, h) => (
        <span
          key={h}
          data-p={dayPhaseAt(h + 0.5)}
          data-now={hour >= h && hour < h + 1 ? "" : undefined}
          data-past={hour >= h + 1 ? "" : undefined}
        />
      ))}
    </div>
  );
}
