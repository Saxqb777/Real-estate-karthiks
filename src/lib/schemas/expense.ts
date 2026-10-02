// Expenses: zod schemas for /api/expenses, response types and the linked-expense message. Safe to import in the UI.
import type { Expense, Prisma } from "@prisma/client";
import { z } from "zod";
import { zDate, zId, zIdOrNull, zInt, zPositiveMoney, zText } from "@/lib/validation";
import type { Serialized } from "@/lib/types";
import { zRequired } from "@/lib/validation";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

/** ?unitId=plot → only whole-plot expenses (unitId null). */
export const WHOLE_PLOT = "plot";

const expenseFields = {
  /** null / "" / missing = whole plot */
  unitId: zIdOrNull,
  categoryId: zRequired(zId, "Choose a category"),
  expenseDate: zRequired(zDate),
  amount: zRequired(zPositiveMoney),
  description: zText(500),
};

/** POST /api/expenses */
export const expenseCreateSchema = z.object(expenseFields);

/** PUT /api/expenses/[id]: partial — only the fields sent are changed. */
export const expenseUpdateSchema = z.object(expenseFields).partial();

/** GET /api/expenses?year=&unitId=(id|plot)&categoryId= */
export const expenseListQuerySchema = z.object({
  year: z.preprocess(blankToUndefined, zInt(2000, 2100).optional()),
  unitId: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  categoryId: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
});

export type ExpenseCreate = z.output<typeof expenseCreateSchema>;
export type ExpenseUpdate = z.output<typeof expenseUpdateSchema>;
export type ExpenseCreateInput = z.input<typeof expenseCreateSchema>;

/** One expense in every response: category + unit (null = whole plot) + propertyTaxId when auto-created by Property Tax. */
export type ExpenseDTO = Serialized<Expense> & {
  category: { id: string; name: string; color: string };
  unit: { id: string; name: string } | null;
  propertyTaxId: string | null;
};

/** GET /api/expenses → total is sumAmounts() over the filtered items. */
export interface ExpenseListResponse {
  items: ExpenseDTO[];
  total: number;
  count: number;
}

/** Prisma include for every expense response (pair with toExpenseDTO). */
export const expenseInclude = {
  category: { select: { id: true, name: true, color: true } },
  unit: { select: { id: true, name: true } },
  propertyTax: { select: { id: true } },
} satisfies Prisma.ExpenseInclude;

/** Flatten the linked property-tax row to propertyTaxId (null when entered by hand). */
export function toExpenseDTO<E extends { propertyTax: { id: string } | null }>({ propertyTax, ...e }: E) {
  return { ...e, propertyTaxId: propertyTax?.id ?? null };
}

/** Why an expense created by a Property Tax row can't be edited / deleted directly. */
export const linkedExpenseMessage = (year: number, unitName: string) =>
  `Created by Property Tax ${year} for ${unitName} — change it there`;
