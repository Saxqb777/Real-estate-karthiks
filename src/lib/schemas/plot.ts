// Plot (singleton row id=1): zod schemas for PUT /api/plot, area helper + response type. Safe to import in the UI.
import type { Plot } from "@prisma/client";
import { z } from "zod";
import { zRequiredText } from "@/lib/validation";
import { isWebUrl, zDimension, type Serialized } from "./unit";

/** https:// link or a site path like /site-plan.png; "" / null → null. */
const zImageRef = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v === undefined ? null : v),
  z
    .string({ message: "must be a https:// link or a site path like /site-plan.png" })
    .max(2000, "must be at most 2000 characters")
    .refine((v) => /^\/(?!\/)\S*$/.test(v) || isWebUrl(v), "must be a https:// link or a site path like /site-plan.png")
    .nullable(),
);

export const plotSchema = z.object({
  frontWidthFt: zDimension(10_000),
  backWidthFt: zDimension(10_000),
  depthFt: zDimension(10_000),
  /** Send null / "" to auto-compute from the widths and depth. */
  areaSqft: zDimension(10_000_000),
  sitePlanImageUrl: zImageRef,
  townName: zRequiredText("Town name", 80),
});

/** PUT body: partial — only the fields sent are changed. */
export const plotUpdateSchema = plotSchema.partial();

export type PlotUpdate = z.output<typeof plotUpdateSchema>;
/** GET/PUT /api/plot response. */
export type PlotDTO = Serialized<Plot>;

/**
 * Trapezoid plot area: (front + back) / 2 × depth, rounded to 2dp.
 * Works in integer hundredths so 22.25 / 23.25 / 76.66 → 1744.02 exactly (no float drift).
 */
export function plotAreaSqft(frontWidthFt: number, backWidthFt: number, depthFt: number): number {
  const c = (n: number) => Math.round(n * 100);
  return Math.round(((c(frontWidthFt) + c(backWidthFt)) * c(depthFt)) / 200) / 100;
}
