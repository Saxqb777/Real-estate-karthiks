// Single source of truth for every money / KPI formula. Pure functions only.
// (Full module is built in step 4; sumAmounts is used by routes that show totals.)

/** Sum of amounts, rounded to paise. Used for every expense / payment total in the app. */
export function sumAmounts(rows: { amount: number }[]): number {
  return round2(rows.reduce((s, r) => s + r.amount, 0));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
