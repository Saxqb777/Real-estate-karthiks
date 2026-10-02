// Expense categories: zod schemas for /api/expense-categories, response types and protection messages.
// Pure — safe to import in the UI.
import type { ExpenseCategory } from "@prisma/client";
import { z } from "zod";
import "./messages";
import { sumAmounts } from "@/lib/calculations";
import { zHexColor, zRequiredText } from "@/lib/validation";
import type { Serialized } from "@/lib/types";

/** Colour used when none is given (matches the Prisma default). */
export const DEFAULT_CATEGORY_COLOR = "#8B93A7";

/** The category Property Tax rows post their auto-created expenses to (found by name, created if missing). */
export const PROPERTY_TAX_CATEGORY = { name: "Property Tax", color: "#EF4444" } as const;

/** pg_advisory_xact_lock key that serialises category name writes (names are unique ignoring case). */
export const CATEGORY_NAME_LOCK = 7_310_101;

/** #RRGGBB, stored upper-case so "#ef4444" and "#EF4444" are the same colour. */
const zColor = zHexColor.transform((c) => c.toUpperCase());

const categoryFields = {
  name: zRequiredText("Name", 60),
  color: zColor,
};

/** POST /api/expense-categories. Colour defaults to grey when missing / blank. */
export const expenseCategoryCreateSchema = z.object({
  name: categoryFields.name,
  color: z.preprocess((v) => (v === undefined || v === null || v === "" ? DEFAULT_CATEGORY_COLOR : v), zColor),
});

/** PUT /api/expense-categories/[id]: partial. Default categories accept a colour change only. */
export const expenseCategoryUpdateSchema = z.object(categoryFields).partial();

export type ExpenseCategoryCreate = z.output<typeof expenseCategoryCreateSchema>;
export type ExpenseCategoryUpdate = z.output<typeof expenseCategoryUpdateSchema>;

/** Every category response: the row + how many expenses use it and their total (sumAmounts). */
export type ExpenseCategoryDTO = Serialized<ExpenseCategory> & { expenseCount: number; total: number };

type AmountLike = number | { toNumber(): number };

/** Attach expenseCount + total (sumAmounts, so it matches every other expense total) to each category. */
export function withCategoryStats<C extends { id: string }>(
  categories: C[],
  expenses: { categoryId: string; amount: AmountLike }[],
): (C & { expenseCount: number; total: number })[] {
  const byCat = new Map<string, { amount: number }[]>();
  for (const e of expenses) {
    const list = byCat.get(e.categoryId) ?? [];
    list.push({ amount: typeof e.amount === "number" ? e.amount : e.amount.toNumber() });
    byCat.set(e.categoryId, list);
  }
  return categories.map((c) => {
    const rows = byCat.get(c.id) ?? [];
    return { ...c, expenseCount: rows.length, total: sumAmounts(rows) };
  });
}

// ---- messages (shared so the UI can warn before the API refuses) --------------------------------

export const categoryNameTakenMessage = (existingName: string) =>
  `A category called "${existingName}" already exists. Pick a different name.`;

export const defaultCategoryRenameMessage = (name: string) =>
  `"${name}" is a built-in category and can't be renamed (you can still change its colour).`;

export const defaultCategoryDeleteMessage = (name: string) => `"${name}" is a built-in category and can't be deleted.`;

export const categoryInUseMessage = (name: string, count: number) =>
  `Category "${name}" has ${count} expense${count === 1 ? "" : "s"}. Move ${count === 1 ? "it" : "them"} to another category first.`;

/** Sort: built-in categories first, then by name (case-insensitive). */
export function compareCategories(a: { isDefault: boolean; name: string }, b: { isDefault: boolean; name: string }): number {
  return Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}
