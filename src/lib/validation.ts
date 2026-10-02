// Reusable zod building blocks for API input. Money and numbers accept numeric strings too.
import { z } from "zod";
import { parseDateInput, todayIST } from "./dates";

/** Accepts "1,00,000", "₹ 25,000", "8.5%" etc. by stripping ₹, %, commas and spaces before coercion. */
export const cleanNumeric = (v: unknown) => (typeof v === "string" ? v.replace(/[₹%,\s]/g, "") : v);

/**
 * Strict number input: accepts numbers and plain decimal strings ("1,00,000", "₹ 25,000.50", "-3", "8.5%").
 * Rejects booleans, arrays, hex ("0x10"), exponents ("1e3") and blanks with "must be a number".
 */
const strictNumeric = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = cleanNumeric(v) as string;
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : v;
  }
  return v;
};
/** Strict finite number (see strictNumeric). */
export const zNum = z.preprocess(strictNumeric, z.number({ message: "must be a number" }).refine((n) => isFinite(n), "must be a finite number"));

/** Non-negative INR amount, up to 2 decimals (checked after rounding so it always fits the DB column). */
export const zMoney = zNum
  .refine((n) => n >= 0, "cannot be negative")
  .transform((n) => Math.round(n * 100) / 100)
  .refine((n) => n < 1e12, "is unrealistically large");

/** Strictly positive INR amount. */
export const zPositiveMoney = zMoney.refine((n) => n > 0, "must be greater than 0");

/** Date-only input: YYYY-MM-DD, D/M/YYYY or ISO. Outputs a UTC-midnight Date. */
export const zDate = z
  .union([z.string(), z.date()], { message: "must be a date (YYYY-MM-DD or D/M/YYYY)" })
  .transform((v, ctx) => {
    const d = parseDateInput(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "must be a valid date (YYYY-MM-DD or D/M/YYYY)" });
      return z.NEVER;
    }
    return d;
  });

/** Optional/nullable date: "", null or undefined → null. */
export const zDateOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : v), zDate.nullable());

/** Trimmed optional text: "" / whitespace / undefined → null. */
export const zText = (max = 2000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v === undefined ? null : v),
    z.string().max(max, `must be at most ${max} characters`).nullable(),
  );

/** Required trimmed text. */
export const zRequiredText = (label: string, max = 200) =>
  z
    .string({ error: (i) => (i.input === undefined || i.input === null ? `${label} is required` : `${label} must be text`) })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const zId = z
  .string({ error: (i) => (i.input === undefined || i.input === null ? "id is required" : "id must be text") })
  .trim()
  .min(1, "id is required");

/** Optional id that may be "" / null → null (e.g. unitId for whole plot). */
export const zIdOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : v), zId.nullable());

export const zInt = (min: number, max: number) =>
  zNum
    .refine((n) => Number.isInteger(n), "must be a whole number")
    .refine((n) => n >= min, `must be at least ${min}`)
    .refine((n) => n <= max, `must be at most ${max}`);

/** Boolean that also accepts "true" / "false" strings, with a readable message. */
export const zFlag = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean({ message: "must be true or false" }),
);
export const zBool = zFlag;

/** Missing / null / blank → "is required" (otherwise z.coerce would turn them into 0 or NaN). */
export const zRequired = <T extends z.ZodType>(schema: T, message = "is required") =>
  z.preprocess((v, ctx) => {
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return v;
  }, schema);

/** Date-only input that is today (IST) or earlier. */
export const zPastDate = zDate.refine((d) => d.getTime() <= todayIST().getTime(), "cannot be in the future");

export function isWebUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname !== "";
  } catch {
    return false;
  }
}

/** Optional http(s) link: "" / null → null. Rejects javascript:, mailto:, bare domains etc. */
export const zWebUrlOrNull = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v === undefined ? null : v),
  z
    .string({ message: "must be a web link starting with https://" })
    .max(2000, "must be at most 2000 characters")
    .refine(isWebUrl, "must be a valid web link starting with https://")
    .nullable(),
);

export const zEmailOrNull = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v === undefined ? null : v),
  z.string().trim().email("must be a valid email").nullable(),
);

export const zUrlOrNull = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v === undefined ? null : v),
  z.string().trim().url("must be a valid URL (include https://)").nullable(),
);

export const zHexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour like #4F9DFF");

/** Decimal that may be null (e.g. optional dimensions). */
export const zNumberOrNull = z.preprocess(
  (v) => (v === "" || v === undefined ? null : strictNumeric(v)),
  z.number({ message: "must be a number" }).finite().min(0, "cannot be negative").nullable(),
);

/** Optional non-negative measurement (feet / sqft): "" / null → null, rounded to 2dp. */
export const zDimension = (max: number) =>
  zNumberOrNull
    .refine((n) => n === null || n <= max, `must be at most ${max.toLocaleString("en-IN")}`)
    .transform((n) => (n === null ? null : Math.round(n * 100) / 100));
