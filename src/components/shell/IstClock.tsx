"use client";

import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui";
import { dayPhaseAt, formatTimeIST, hourInIST, type DayPhase } from "@/lib/day-phase";
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Fri 2 Oct" in IST. */
function istDateLabel(now: Date): string {
  const d = new Date(now.getTime() + 330 * 60_000);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * Sun/moon arc: the sun travels 06:00→18:00, the moon 18:00→06:00, across a small horizon arc.
 * `hour` is the fractional IST hour (0..24).
 */
function SkyArc({ hour, phase }: { hour: number; phase: DayPhase }) {
  const isDay = hour >= 6 && hour < 18;
  const t = isDay ? (hour - 6) / 12 : (((hour - 18 + 24) % 24) / 12);
  const angle = Math.PI * (1 - t); // left horizon → right horizon
  const cx0 = 20 + Math.cos(angle) * 15;
  const cy0 = 19 - Math.sin(angle) * 14;
  return (
    <svg viewBox="0 0 40 24" className={styles.arc} data-phase={phase} aria-hidden>
      <path d="M5 19 A15 14 0 0 1 35 19" className={styles.arcPath} />
      <path d="M1 19.5 H39" className={styles.horizon} />
      {isDay ? (
        <g className={styles.sun}>
          <circle cx={cx0} cy={cy0} r="3.6" />
          <circle cx={cx0} cy={cy0} r="6" className={styles.sunHalo} />
        </g>
      ) : (
        <g className={styles.moon}>
          <circle cx={cx0} cy={cy0} r="3.6" />
          <circle cx={cx0 + 1.8} cy={cy0 - 1.3} r="3" className={styles.moonCut} />
        </g>
      )}
    </svg>
  );
}

/** Live IST clock: Tamil time-of-day word (shared with the 3D lighting), English + time, sun/moon arc. */
export function IstClock() {
  const sec = useEpochSecond();
  const now = sec ? new Date(sec * 1000) : null;
  const info = now ? dayPhaseAt(hourInIST(now)) : null;
  const phase: DayPhase = info?.phase ?? "morning";
  const [time, ampm] = now ? formatTimeIST(now).split(" ") : ["--:--", ""];
  const [hh, mm] = time.split(":");
  const label = info && now ? `${info.tamil} · ${info.english} · ${time} ${ampm} IST, ${istDateLabel(now)}` : "India time";
  return (
    <div className={styles.clock} data-phase={phase} role="timer" aria-label={label}>
      <SkyArc hour={info?.hourIST ?? 9} phase={phase} />
      <div className={styles.clockText} aria-hidden>
        <div className={styles.clockTop}>
          <span className={cx("tamil", styles.tamilPhase)} lang="ta">
            {info?.tamil ?? " "}
          </span>
          <span className={styles.time}>
            {hh}
            <span className={styles.colon}>:</span>
            {mm}
            <span className={styles.ampm}>{ampm}</span>
          </span>
        </div>
        <div className={styles.date}>
          {info?.english ?? "—"}
          <span className={styles.dot} />
          {now ? istDateLabel(now) : "IST"}
          <span className={styles.tz}>IST</span>
        </div>
      </div>
    </div>
  );
}
