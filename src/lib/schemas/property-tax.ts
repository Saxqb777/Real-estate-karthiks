// Property tax: zod schemas for /api/property-tax, the Paid-needs-a-date rule, response types and messages.
// Pure — safe to import in the UI. The Paid ⇄ linked Expense logic lives in src/lib/property-tax.ts (server).
import type { PropertyTax } from "@prisma/client";
import { z } from "zod";
import { todayIST } from "@/lib/dates";
import { zDateOrNull, zId, zInt, zPositiveMoney } from "@/lib/validation";
import type { Serialized } from "@/lib/types";
import { zRequired } from "@/lib/validation";

export const TAX_STATUSES = ["Paid", "Due"] as const;
export type TaxStatusValue = (typeof TAX_STATUSES)[number];

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

/** "Paid" | "Due", case-insensitive ("paid" → "Paid"). */
const zStatus = z.preprocess(
  (v) => (typeof v === "string" ? TAX_STATUSES.find((s) => s.toLowerCase() === v.trim().toLowerCase()) ?? v : v),
  z.enum(TAX_STATUSES, { message: "must be Paid or Due" }),
);

/** Payment date: "" / null → null; a paid tax can't be paid in the future. */
const zPaymentDate = zDateOrNull.refine(
  (d) => d === null || d.getTime() <= todayIST().getTime(),
  "can't be in the future — keep the tax as Due until it's paid",
);

const taxFields = {
  unitId: zRequired(zId, "Choose a unit"),
  year: zRequired(zInt(2000, 2100)),
  amount: zRequired(zPositiveMoney),
  status: zStatus,
  /** Required when status is Paid; always cleared when the tax is Due. */
  paymentDate: zPaymentDate,
};

/** Field problems with a tax row's own values (the same rule runs on the merged row for PUT). */
export function propertyTaxRuleIssues(t: { status: TaxStatusValue; paymentDate: Date | string | null }) {
  return t.status === "Paid" && !t.paymentDate
    ? [{ field: "paymentDate", message: "is required when the tax is marked Paid" }]
    : [];
}

/** POST /api/property-tax. Status defaults to Due. */
export const propertyTaxCreateSchema = z
  .object({ ...taxFields, status: z.preprocess((v) => blankToUndefined(v) ?? "Due", zStatus) })
  .superRefine((t, ctx) => {
    for (const i of propertyTaxRuleIssues(t)) ctx.addIssue({ code: "custom", path: [i.field], message: i.message });
  });

/**
 * PUT /api/property-tax/[id]: partial. Mark Paid with {status:"Paid", paymentDate}; mark Due with {status:"Due"}
 * (that also clears paymentDate and removes the linked expense).
 */
export const propertyTaxUpdateSchema = z.object(taxFields).partial();

/** GET /api/property-tax?unitId=&year= */
export const propertyTaxListQuerySchema = z.object({
  unitId: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  year: z.preprocess(blankToUndefined, zInt(2000, 2100).optional()),
});

export type PropertyTaxCreate = z.output<typeof propertyTaxCreateSchema>;
export type PropertyTaxUpdate = z.output<typeof propertyTaxUpdateSchema>;
export type PropertyTaxCreateInput = z.input<typeof propertyTaxCreateSchema>;

/** Every property-tax response. expense = the auto-created Expense while Paid. */
export type PropertyTaxDTO = Serialized<PropertyTax> & {
  unit: { id: string; name: string };
  expense: { id: string } | null;
};

export const propertyTaxExistsMessage = (year: number, unitName: string) =>
  `Property tax ${year} is already recorded for ${unitName}. Edit that entry instead.`;

/** Description written on the auto-created expense. */
export const propertyTaxExpenseDescription = (year: number) => `Property tax ${year}`;
