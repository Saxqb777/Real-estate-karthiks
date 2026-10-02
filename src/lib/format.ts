// Indian number formatting (lakhs / crores). Safe for client and server.

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹12,34,567 (whole rupees). Pass decimals=true for paise. */
export function formatINR(n: number | null | undefined, decimals = false): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${(decimals ? inrFmt2 : inrFmt).format(Math.abs(n))}`;
}

/** Compact Indian units: ₹45.2 L, ₹1.25 Cr, ₹8,500. */
export function formatINRCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)} Cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)} L`;
  return `${sign}₹${inrFmt.format(a)}`;
}

function trim(x: number) {
  return x.toFixed(2).replace(/\.?0+$/, "");
}

/** 12,34,567 without currency symbol. */
export function formatIndianNumber(n: number | null | undefined, maxFractionDigits = 0): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
