// Settings (singleton row id=1): zod schemas for PUT /api/settings + response type. Safe to import in the UI.
import type { Settings } from "@prisma/client";
import { z } from "zod";
import "./messages";
import type { Serialized } from "@/lib/types";
import { zEmailOrNull, zFlag, zInt, zMoney, zRequired, zRequiredText, zText } from "@/lib/validation";

export const DATE_FORMATS = ["D/M/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

/** Every editable setting (what a full settings form submits). */
export const settingsSchema = z.object({
  brandName: zRequiredText("Brand name", 80),
  subtitle: zText(160),
  ownerEmail: zEmailOrNull,
  currency: z
    .string({ message: "must be a 3-letter currency code like INR" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "must be a 3-letter currency code like INR"),
  dateFormat: z.enum(DATE_FORMATS, { message: `must be one of ${DATE_FORMATS.join(", ")}` }),
  rentDueDay: zRequired(zInt(1, 31)),
  lateFeeEnabled: zFlag,
  lateFeeAmount: zMoney,
  lateFeeGraceDays: zRequired(zInt(0, 60)),
  /** remind this many days before a rental agreement ends (owner 8/10/2026) */
  renewalReminderDays: zRequired(zInt(1, 180)),
});

/** PUT body: partial — only the fields sent are changed. */
export const settingsUpdateSchema = settingsSchema.partial();

export type SettingsUpdate = z.output<typeof settingsUpdateSchema>;
/** GET/PUT /api/settings response. */
export type SettingsDTO = Serialized<Settings>;
