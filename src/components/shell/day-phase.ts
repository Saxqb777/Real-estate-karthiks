// IST clock helpers shared by the HUD clock (and usable by the 3D scene for day/dusk/night lighting).

export type DayPhase = "dawn" | "day" | "dusk" | "night";

const IST_OFFSET_MS = 330 * 60_000;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface IstTime {
  hours: number;
  minutes: number;
  seconds: number;
  /** hours + minutes/60 — e.g. 17.5 for 5:30 pm */
  fractional: number;
  weekday: (typeof WEEKDAYS)[number];
  day: number;
  month: (typeof MONTHS)[number];
  year: number;
}

/** Wall-clock time in India (Asia/Kolkata, UTC+5:30, no DST). */
export function istTime(now: Date = new Date()): IstTime {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  return {
    hours,
    minutes,
    seconds: d.getUTCSeconds(),
    fractional: hours + minutes / 60,
    weekday: WEEKDAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
}

/** Pattukottai (10.4°N) light: dawn 5:00–6:30 · day 6:30–17:30 · dusk 17:30–19:00 · night. */
export function dayPhaseAt(fractionalHour: number): DayPhase {
  if (fractionalHour >= 5 && fractionalHour < 6.5) return "dawn";
  if (fractionalHour >= 6.5 && fractionalHour < 17.5) return "day";
  if (fractionalHour >= 17.5 && fractionalHour < 19) return "dusk";
  return "night";
}

export function dayPhase(now: Date = new Date()): DayPhase {
  return dayPhaseAt(istTime(now).fractional);
}

export const PHASE_LABEL: Record<DayPhase, string> = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" };
