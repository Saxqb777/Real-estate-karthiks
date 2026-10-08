// Explain-key helpers — pure (unit-tested; relative imports on purpose).
import type { DashboardData, Explain } from "../../lib/dashboard-types";
import type { PeriodKind } from "./types";

/** Parse "unit:<id>:year:netCash" → { unitId, period, base }. */
export function parseExplainKey(key: string): { unitId: string | null; period: PeriodKind; base: string } {
  let rest = key;
  let unitId: string | null = null;
  if (rest.startsWith("unit:")) {
    const i = rest.indexOf(":", 5);
    unitId = rest.slice(5, i);
    rest = rest.slice(i + 1);
  }
  let period: PeriodKind = "allTime";
  if (rest.startsWith("year:")) {
    period = "year";
    rest = rest.slice(5);
  } else if (rest.startsWith("month:")) {
    period = "month";
    rest = rest.slice(6);
  }
  return { unitId, period, base: rest };
}

/** Figures a figure is made of / related to (presentation links only — the maths stays in data.explain). */
const RELATED: Record<string, string[]> = {
  netCash: ["rentCollected", "expenses"],
  collection: ["rentCollected"],
  rentCollected: ["collection"],
  totalReturn: ["gain", "rentCollected"],
  worthNow: ["bestOffer", "estimatedValue", "invested"],
  gain: ["worthNow", "invested"],
  multiplier: ["worthNow", "invested"],
  cagr: ["holdingYears", "multiplier"],
  occupancy: ["vacantDays", "rentLost"],
  vacantDays: ["rentLost", "occupancy"],
  rentLost: ["vacantDays", "occupancy"],
  overdue: ["rentRoll"],
  perSqftOffered: ["perSqftBought", "worthNow"],
  perSqftBought: ["perSqftOffered", "invested"],
};

/** Cash figures that have a "vs last year" explanation in the year and the month (`[unit:<id>:]yoy:<period>:<base>`). */
const YOY = new Set(["rentCollected", "expenses", "netCash"]);

/** Related explanations for a key, in the same scope and unit. */
export function relatedExplains(data: DashboardData, key: string): Explain[] {
  const { unitId, period, base } = parseExplainKey(key);
  const keys = RELATED[base] ?? [];
  const out: Explain[] = [];
  for (const k of keys) {
    const scoped = (p: PeriodKind) => `${unitId ? `unit:${unitId}:` : ""}${p === "year" ? "year:" : p === "month" ? "month:" : ""}${k}`;
    const e = data.explain[scoped(period)] ?? data.explain[scoped("allTime")];
    if (e && e.key !== key) out.push(e);
  }
  if (YOY.has(base) && period !== "allTime") {
    const e = data.explain[`${unitId ? `unit:${unitId}:` : ""}yoy:${period}:${base}`];
    if (e) out.push(e);
  }
  return out;
}

