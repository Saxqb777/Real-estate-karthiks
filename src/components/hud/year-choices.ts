// The years the year dropdown (PeriodSwitch) offers. Owner 2/11/2026: "when 2024 is selected 2025 disappears" — the list
// was built from the figures, and with 2024 picked the figures stop at the end of 2024 (the as-of date), so only 2024
// and this year were left. Now: every year from the earliest one with records (or the one shown) up to this year, newest
// first, with no gaps — whichever year is picked.

/** At most this many years back (guards against a stray very old date). */
const MAX_YEARS = 30;

export function yearChoices(now: number, shown: number, dataYears: number[]): number[] {
  const first = Math.max(now - MAX_YEARS + 1, Math.min(now, shown, ...dataYears.filter((y) => y <= now)));
  return Array.from({ length: now - first + 1 }, (_, i) => now - i);
}
