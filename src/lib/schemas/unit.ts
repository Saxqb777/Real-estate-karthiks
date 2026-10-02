// Units: zod schemas for /api/units, response types, and the conflict / delete-protection messages.
// Also hosts a few generic helpers used by the other schema files (zRequired, zPastDate, zDimension,
// zWebUrlOrNull, zFlag, Serialized). Pure — safe to import in the UI (type-only Prisma imports).
import type { Lease, Offer, Prisma, Tenant, Unit } from "@prisma/client";
import { z } from "zod";
import { todayIST } from "@/lib/dates";
import { zDate, zInt, zNumberOrNull, zPositiveMoney, zRequiredText, zText } from "@/lib/validation";

// ---------- generic helpers ----------

/** JSON shape of a Prisma row after serialize(): Decimal → number, Date → ISO string. */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

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

/** Optional non-negative measurement (feet / sqft): "" / null → null, rounded to 2dp. */
export const zDimension = (max: number) =>
  zNumberOrNull
    .refine((n) => n === null || n <= max, `must be at most ${max.toLocaleString("en-IN")}`)
    .transform((n) => (n === null ? null : Math.round(n * 100) / 100));

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

/** Boolean that also accepts "true" / "false" strings, with a readable message. */
export const zFlag = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean({ message: "must be true or false" }),
);

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
const zAppreciationRate = z.coerce
  .number({ message: "must be a number" })
  .min(-50, "must be at least -50%")
  .max(100, "must be at most 100%")
  .transform((n) => Math.round(n * 1000) / 1000);

const zBuiltUpSqft = z.coerce
  .number({ message: "must be a number" })
  .positive("must be greater than 0")
  .max(1_000_000, "is unrealistically large")
  .transform((n) => Math.round(n * 100) / 100);

const unitFields = {
  name: zRequiredText("Name", 80),
  type: zRequiredText("Type", 40),
  address: zText(300),
  floors: zInt(1, 10),
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
