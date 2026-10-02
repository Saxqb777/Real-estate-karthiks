// Reusable zod building blocks for API input. Money and numbers accept numeric strings too.
import { z } from "zod";
import { parseDateInput } from "./dates";

/** Non-negative INR amount, up to 2 decimals. */
export const zMoney = z.coerce
  .number({ message: "must be a number" })
  .refine((n) => isFinite(n), "must be a finite number")
  .refine((n) => n >= 0, "cannot be negative")
  .refine((n) => n <= 1e12, "is unrealistically large")
  .transform((n) => Math.round(n * 100) / 100);

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
    .string({ message: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const zId = z.string({ message: "id is required" }).trim().min(1, "id is required");

/** Optional id that may be "" / null → null (e.g. unitId for whole plot). */
export const zIdOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : v), zId.nullable());

export const zInt = (min: number, max: number) =>
  z.coerce
    .number({ message: "must be a number" })
    .int("must be a whole number")
    .min(min, `must be at least ${min}`)
    .max(max, `must be at most ${max}`);

export const zBool = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());

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
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number({ message: "must be a number" }).finite().min(0, "cannot be negative").nullable(),
);
