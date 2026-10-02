// Date-only handling. All date-only values are JS Dates at 00:00:00 UTC
// (matches Postgres DATE via Prisma). Never use local-time getters on them.

const IST_OFFSET_MIN = 330; // Asia/Kolkata, no DST

/** Build a date-only value (UTC midnight). month is 1-12. */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Today's date in India, as a date-only value. */
export function todayIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return dateOnly(ist.getUTCFullYear(), ist.getUTCMonth() + 1, ist.getUTCDate());
}

/**
 * Parse user input into a date-only value. Accepts:
 *  - YYYY-MM-DD (HTML date inputs)
 *  - D/M/YYYY or DD/MM/YYYY (Indian format; also "-" or "." separators)
 *  - full ISO datetime strings (date part is taken in UTC)
 * Returns null when invalid.
 */
export function parseDateInput(input: unknown): Date | null {
  if (input instanceof Date) return isNaN(input.getTime()) ? null : stripTime(input);
  if (typeof input !== "string") return null;
  const s = input.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validYMD(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return validYMD(+m[3], +m[2], +m[1]);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : stripTime(d);
  }
  return null;
}

function validYMD(y: number, mo: number, d: number): Date | null {
  const dt = dateOnly(y, mo, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}

function stripTime(d: Date) {
  return dateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Format a date-only value (Date or ISO string) as D/M/YYYY. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}/${dt.getUTCFullYear()}`;
}

/** YYYY-MM-DD for <input type="date"> values. */
export function toInputDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

export const MS_PER_DAY = 86_400_000;

/** Whole days from a to b (b - a), both date-only. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
