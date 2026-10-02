// Shared number formatting for HUD readouts (server-safe; no "use client").
import { formatINR, formatINRCompact, formatIndianNumber, formatPercent } from "@/lib/format";

export type NumberFormat =
  | "inr" // ₹12,34,567
  | "inr-paise" // ₹12,34,567.50
  | "inr-compact" // ₹45.2 L / ₹1.25 Cr
  | "number" // 12,34,567 (Indian grouping)
  | "percent" // fraction → 82.4%
  | "multiplier" // 1.42×
  | ((n: number) => string);

/** Format a number the way every HUD readout does. */
export function formatNumber(n: number | null | undefined, format: NumberFormat = "number", decimals?: number): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  if (typeof format === "function") return format(n);
  switch (format) {
    case "inr":
      return formatINR(n);
    case "inr-paise":
      return formatINR(n, true);
    case "inr-compact":
      return formatINRCompact(n);
    case "percent":
      return formatPercent(n, decimals ?? 1);
    case "multiplier":
      return `${n.toFixed(decimals ?? 2)}×`;
    default:
      return formatIndianNumber(n, decimals ?? 0);
  }
}
