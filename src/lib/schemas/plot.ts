// Plot (singleton row id=1): zod schemas for PUT /api/plot, area helper + response type. Safe to import in the UI.
import type { Plot } from "@prisma/client";
import { z } from "zod";
import "./messages";
import { zRequiredText } from "@/lib/validation";
import type { Serialized } from "@/lib/types";
import { isWebUrl, zDimension } from "@/lib/validation";

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

/** Trapezoid plot area — the formula lives in calculations.ts (single source of truth). */
export { trapezoidArea as plotAreaSqft } from "@/lib/calculations";
