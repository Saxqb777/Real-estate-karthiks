// Units: zod schemas for /api/units, response types, and the conflict / delete-protection messages.
// Pure — safe to import in the UI (type-only Prisma imports).
import type { Lease, Offer, Tenant, Unit } from "@prisma/client";
import { z } from "zod";
import "./messages";
import type { Serialized } from "@/lib/types";
import {
  zDimension,
  zFlag,
  zInt,
  zNum,
  zPastDate,
  zPositiveMoney,
  zRequired,
  zRequiredText,
  zText,
  zWebUrlOrNull,
} from "@/lib/validation";

// Generic helpers now live in src/lib/validation.ts and src/lib/types.ts; re-exported for older imports.
export type { Serialized } from "@/lib/types";
export { zRequired, zPastDate, zDimension, isWebUrl, zWebUrlOrNull, zFlag } from "@/lib/validation";

/** Fill a default when the value is missing / null / blank (create forms). */
const withDefault = <T extends z.ZodType>(schema: T, fallback: unknown) =>
  z.preprocess((v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? fallback : v), schema);

// ---------- unit schemas ----------

export const POSITIONS = ["front", "back"] as const;
export type UnitPosition = (typeof POSITIONS)[number];
export const DEFAULT_UNIT_TYPE = "Townhouse";

const zPosition = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.enum(POSITIONS, { message: 'must be "front", "back" or empty' }).nullable(),
);

/** Percent per year, e.g. 8.5 = 8.5%. */
const zAppreciationRate = zNum
  .refine((n) => n >= -50, "must be at least -50%")
  .refine((n) => n <= 100, "must be at most 100%")
  .transform((n) => Math.round(n * 1000) / 1000);

const zBuiltUpSqft = zNum
  .refine((n) => n > 0, "must be greater than 0")
  .refine((n) => n <= 1_000_000, "is unrealistically large")
  .transform((n) => Math.round(n * 100) / 100);

const unitFields = {
  name: zRequiredText("Name", 80),
  type: zRequiredText("Type", 40),
  address: zText(300),
  floors: zRequired(zInt(1, 10)),
  builtUpSqft: zRequired(zBuiltUpSqft),
  purchaseDate: zRequired(zPastDate),
  purchasePrice: zRequired(zPositiveMoney),
  annualAppreciationRate: zAppreciationRate,
  electricityConsumerNumber: zText(40),
  electricityPayUrl: zWebUrlOrNull,
  footprintWidthFt: zDimension(1000),
  footprintDepthFt: zDimension(1000),
  position: zPosition,
  isActive: zFlag,
};

/** POST /api/units. Defaults: type "Townhouse", floors 1, appreciation 0%, active. */
export const unitCreateSchema = z.object({
  ...unitFields,
  type: withDefault(unitFields.type, DEFAULT_UNIT_TYPE),
  floors: withDefault(unitFields.floors, 1),
  annualAppreciationRate: withDefault(unitFields.annualAppreciationRate, 0),
  isActive: withDefault(unitFields.isActive, true),
});

/** PUT /api/units/[id]: partial — only the fields sent are changed. */
export const unitUpdateSchema = z.object(unitFields).partial();

export const unitListQuerySchema = z.object({ active: zFlag.optional() });

export type UnitCreate = z.output<typeof unitCreateSchema>;
export type UnitUpdate = z.output<typeof unitUpdateSchema>;

// ---------- response types ----------

export type UnitDTO = Serialized<Unit>;
export type OfferDTO = Serialized<Offer>;
/** The unit's current lease (endDate null) with its tenant. */
export type ActiveLeaseDTO = Serialized<Lease & { tenant: Tenant }>;
export interface UnitCounts {
  offers: number;
  leases: number;
  expenses: number;
  propertyTax: number;
}
/** GET /api/units → { items: UnitListItem[] } */
export type UnitListItem = UnitDTO & { _count: UnitCounts; bestOffer: number | null; activeLease: ActiveLeaseDTO | null };
/** GET / PUT /api/units/[id] and POST /api/units. Offers sorted by amount (highest first). */
export type UnitDetail = UnitListItem & { offers: OfferDTO[] };

// ---------- position rule + messages (shared so the UI can warn before the API refuses) ----------

/** pg_advisory_xact_lock key that serialises unit position writes (rule: two ACTIVE units never share a position). */
export const UNIT_POSITION_LOCK = 7_310_001;

export function positionTakenMessage(position: UnitPosition, holderName: string): string {
  return `The ${position} position is already taken by active unit "${holderName}". Clear its position or mark it inactive first.`;
}

export function unitDeactivateBlockedMessage(unitName: string, tenantName: string): string {
  return `"${unitName}" still has an active lease (${tenantName}). Record the move-out first, then mark the unit inactive.`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** null when the unit can be deleted (offers are deleted with it). */
export function unitDeleteBlockedMessage(name: string, c: Omit<UnitCounts, "offers">): string | null {
  const parts = [
    c.leases && plural(c.leases, "lease", "leases"),
    c.expenses && plural(c.expenses, "expense", "expenses"),
    c.propertyTax && plural(c.propertyTax, "property-tax record", "property-tax records"),
  ].filter((p): p is string => !!p);
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Unit "${name}" has ${list}. Mark it inactive instead.`;
}
