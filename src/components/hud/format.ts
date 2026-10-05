// Presentation helpers for the HUD: one way to print every kind of figure (DATA CLARITY CONTRACT §6),
// the three buckets, scope labels and explain-key lookup. Formatting only — no arithmetic on money.
// (relative imports: this module is unit-tested without the @ alias)
import type { DashboardData, ExplainBucket, ExplainFormat, UnitBreakdown } from "../../lib/dashboard-types";
import { formatINR, formatINRCompact, formatIndianNumber, formatPercent } from "../../lib/format";
import type { PeriodKind } from "./types";

export type Bucket = ExplainBucket;

export const BUCKETS: Record<Bucket, { label: string; tone: "teal" | "marigold" | "sky"; note: string }> = {
  cash: { label: "Cash flow", tone: "teal", note: "Real money that moved" },
  value: { label: "Property value", tone: "marigold", note: "Estimates and offers — on paper, not cash" },
  occupancy: { label: "Occupancy", tone: "sky", note: "Days let and days empty" },
};

/** Negative = a real minus sign (−), never a hyphen. */
const minus = (s: string) => (s.startsWith("-") ? `−${s.slice(1)}` : s);

/** Whole rupees unless paise exist (contract §6). */
export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return minus(formatINR(n, Math.round(n * 100) % 100 !== 0));
}

/** ₹45.2 L / ₹1.25 Cr for big HUD figures; exact value goes in the tooltip. */
export const inrCompact = (n: number | null | undefined) => minus(formatINRCompact(n));

/** Compact money only from ₹10 L up — below that the exact figure fits and reads better. */
export const COMPACT_FROM = 1e6;

/** Print a figure in its explain format. `compact` only affects money ≥ ₹10 L. */
export function fmt(value: number | null | undefined, format: ExplainFormat, compact = false): string {
  if (value === null || value === undefined || !isFinite(value)) return "—";
  switch (format) {
    case "inr":
      return compact && Math.abs(value) >= COMPACT_FROM ? inrCompact(value) : inr(value);
    case "pct":
      return minus(formatPercent(value, 1));
    case "multiplier":
      return `×${value.toFixed(2)}`;
    case "days":
      return `${formatIndianNumber(value)} ${Math.abs(value) === 1 ? "day" : "days"}`;
    case "years":
      return `${value.toFixed(1)} yrs`;
    case "count":
      return minus(formatIndianNumber(value));
    case "inrPerSqft":
      return `${inr(value)}/sqft`;
  }
}

/** true when the compact form hides digits (so the exact value is worth a tooltip). */
export const isCompacted = (value: number | null | undefined, format: ExplainFormat) =>
  format === "inr" && value !== null && value !== undefined && Math.abs(value) >= COMPACT_FROM;

/** Explain key for a figure in a period (and optionally one unit): "netCash", "year:netCash", "unit:<id>:month:netCash". */
export function explainKey(key: string, period: PeriodKind | null, unitId?: string | null): string {
  const scoped = period === "year" ? `year:${key}` : period === "month" ? `month:${key}` : key;
  return unitId ? `unit:${unitId}:${scoped}` : scoped;
}

/** Scope chip text for a period kind ("All time" / "FY 2026-27" / "Oct 2026"). */
export const scopeLabel = (data: Pick<DashboardData, "scopeLabels">, period: PeriodKind) => data.scopeLabels[period];

export const PERIOD_NOUN: Record<PeriodKind, string> = { allTime: "since you started", year: "this year", month: "this month" };

/** Owner: units are called by their door numbers everywhere (116/B7, 116/B8), never "Front" / "Back" — so no position
 *  label is shown; every caller falls back to the unit's name. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const positionLabel = (_p: "front" | "back" | null | undefined): string | null => null;

/** "Unit A · Front" */
export const unitTitle = (u: Pick<UnitBreakdown, "name" | "position">) => {
  const p = positionLabel(u.position);
  return p ? `${u.name} · ${p}` : u.name;
};

/** First name for friendly lines ("Lakshmi owes ₹29,000"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "3 days" / "1 day" */
export const days = (n: number) => `${formatIndianNumber(n)} ${n === 1 ? "day" : "days"}`;

/** "Jul, Aug, Sep 2026" style compact list of month labels ("Jul 2026", "Aug 2026" …). */
export function monthList(labels: string[]): string {
  if (labels.length === 0) return "";
  const parts = labels.map((l) => l.split(" "));
  const sameYear = parts.every((p) => p[1] === parts[0][1]);
  return sameYear ? `${parts.map((p) => p[0]).join(", ")} ${parts[0][1]}` : labels.join(", ");
}

/** "+91 90036 42871" → "tel:+919003642871" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
