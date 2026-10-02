// IST time → day phase (Tamil + English). Shared by the HUD clock, login greeting and 3D lighting
// so they always agree. Pure; safe on client and server.

export type DayPhase = "dawn" | "morning" | "afternoon" | "evening" | "night";

export interface DayPhaseInfo {
  phase: DayPhase;
  tamil: string;
  english: string;
  greetingTamil: string;
  /** 0..1 progress through the current phase (for smooth lighting blends) */
  progress: number;
  /** IST hours as a fraction, 0..24 */
  hourIST: number;
}

const IST_OFFSET_MIN = 330;

const PHASES: { phase: DayPhase; from: number; to: number; tamil: string; english: string; greetingTamil: string }[] = [
  { phase: "dawn", from: 4, to: 6, tamil: "அதிகாலை", english: "Dawn", greetingTamil: "காலை வணக்கம்" },
  { phase: "morning", from: 6, to: 12, tamil: "காலை", english: "Morning", greetingTamil: "காலை வணக்கம்" },
  { phase: "afternoon", from: 12, to: 16, tamil: "மதியம்", english: "Afternoon", greetingTamil: "மதிய வணக்கம்" },
  { phase: "evening", from: 16, to: 19, tamil: "மாலை", english: "Evening", greetingTamil: "மாலை வணக்கம்" },
  { phase: "night", from: 19, to: 28, tamil: "இரவு", english: "Night", greetingTamil: "இரவு வணக்கம்" }, // 19:00 → 04:00 next day
];

/** Fractional IST hour (0..24) for a given instant. */
export function hourInIST(now: Date = new Date()): number {
  const mins = (now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
  return mins / 60 + now.getUTCSeconds() / 3600;
}

export function dayPhaseAt(hourIST: number): DayPhaseInfo {
  const h = ((hourIST % 24) + 24) % 24;
  const hh = h < 4 ? h + 24 : h; // night wraps past midnight
  const p = PHASES.find((x) => hh >= x.from && hh < x.to) ?? PHASES[PHASES.length - 1];
  return {
    phase: p.phase,
    tamil: p.tamil,
    english: p.english,
    greetingTamil: p.greetingTamil,
    progress: (hh - p.from) / (p.to - p.from),
    hourIST: h,
  };
}

export function currentDayPhase(now: Date = new Date()): DayPhaseInfo {
  return dayPhaseAt(hourInIST(now));
}

/** "7:42 AM" in IST. */
export function formatTimeIST(now: Date = new Date()): string {
  const h = hourInIST(now);
  const hour = Math.floor(h);
  const min = Math.floor((h - hour) * 60);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
