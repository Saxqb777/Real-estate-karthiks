// Property tax ⇄ Expense linkage (server-only). A Paid tax row owns exactly one Expense in the "Property Tax"
// category (amount, unit, date = paymentDate, "Property tax <year>"); a Due row owns none. Every write runs in one
// transaction with the tax row locked, so expense totals (always read from the Expense table) never drift.
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { conflict, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { PROPERTY_TAX_CATEGORY } from "@/lib/schemas/expense-category";
import {
  propertyTaxExistsMessage,
  propertyTaxExpenseDescription,
  propertyTaxRuleIssues,
  type PropertyTaxCreate,
  type PropertyTaxUpdate,
  type TaxStatusValue,
} from "@/lib/schemas/property-tax";

type Tx = Prisma.TransactionClient;

/** Shape of every property-tax response (see PropertyTaxDTO). */
export const propertyTaxInclude = {
  unit: { select: { id: true, name: true } },
  expense: { select: { id: true } },
} satisfies Prisma.PropertyTaxInclude;

interface TaxState {
  unitId: string;
  year: number;
  amount: number;
  status: TaxStatusValue;
  paymentDate: Date | null;
}

/** The "Property Tax" category id — created as a built-in (#EF4444) if it's missing. */
export async function propertyTaxCategoryId(tx: Tx): Promise<string> {
  const { name } = PROPERTY_TAX_CATEGORY;
  const found =
    (await tx.expenseCategory.findUnique({ where: { name }, select: { id: true } })) ??
    (await tx.expenseCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } }));
  if (found) return found.id;
  const created = await tx.expenseCategory.upsert({
    where: { name },
    update: {},
    create: { ...PROPERTY_TAX_CATEGORY, isDefault: true },
    select: { id: true },
  });
  return created.id;
}

async function unitName(tx: Tx, unitId: string): Promise<string> {
  const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { name: true } });
  if (!unit) throw notFound("Unit");
  return unit.name;
}

async function assertYearFree(tx: Tx, t: TaxState, name: string, excludeId?: string) {
  const clash = await tx.propertyTax.findFirst({
    where: { unitId: t.unitId, year: t.year, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true },
  });
  if (clash) throw conflict(propertyTaxExistsMessage(t.year, name));
}

/** Row-lock a tax record for the rest of the transaction (serialises concurrent Paid/Due flips). */
async function lockTax(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM property_tax WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw notFound("Property tax record");
}

function assertRules(t: TaxState) {
  const issues = propertyTaxRuleIssues(t);
  if (issues.length) {
    throw new ZodError(issues.map((i) => ({ code: "custom" as const, path: [i.field], message: i.message, input: undefined })));
  }
}

/** Due rows never keep a payment date. */
const normalize = (t: TaxState): TaxState => (t.status === "Due" ? { ...t, paymentDate: null } : t);

/** A concurrent insert can still beat the pre-check — report it the same way. */
async function mapUniqueViolation<T>(t: TaxState, name: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict(propertyTaxExistsMessage(t.year, name));
    }
    throw err;
  }
}

/**
 * Make the linked expense match the tax row and return the expenseId the row should store:
 * Paid → create or update it; Due → delete it (null).
 */
async function syncExpense(tx: Tx, t: TaxState, expenseId: string | null): Promise<string | null> {
  if (t.status !== "Paid" || !t.paymentDate) {
    // ON DELETE SET NULL also clears property_tax.expense_id; the caller writes null explicitly as well.
    if (expenseId) await tx.expense.deleteMany({ where: { id: expenseId } });
    return null;
  }
  const want = {
    unitId: t.unitId,
    expenseDate: t.paymentDate,
    amount: t.amount,
    description: propertyTaxExpenseDescription(t.year),
  };
  if (expenseId) {
    const cur = await tx.expense.findUnique({ where: { id: expenseId } });
    if (cur) {
      const same =
        cur.unitId === want.unitId &&
        cur.expenseDate.getTime() === want.expenseDate.getTime() &&
        cur.amount.toNumber() === want.amount &&
        cur.description === want.description;
      if (!same) await tx.expense.update({ where: { id: expenseId }, data: want });
      return expenseId;
    }
  }
  const created = await tx.expense.create({
    data: { ...want, categoryId: await propertyTaxCategoryId(tx) },
    select: { id: true },
  });
  return created.id;
}

export async function createPropertyTax(input: PropertyTaxCreate) {
  const t = normalize(input);
  assertRules(t);
  return prisma.$transaction(async (tx) => {
    const name = await unitName(tx, t.unitId); // 404 when the unit doesn't exist
    await assertYearFree(tx, t, name);
    const expenseId = await syncExpense(tx, t, null);
    return mapUniqueViolation(t, name, () =>
      tx.propertyTax.create({ data: { ...t, expenseId }, include: propertyTaxInclude }),
    );
  });
}

/** Partial update; the merged row is re-validated and the linked expense follows it. */
export async function updatePropertyTax(id: string, input: PropertyTaxUpdate) {
  return prisma.$transaction(async (tx) => {
    await lockTax(tx, id);
    const cur = await tx.propertyTax.findUniqueOrThrow({ where: { id } });
    const t = normalize({
      unitId: input.unitId ?? cur.unitId,
      year: input.year ?? cur.year,
      amount: input.amount ?? cur.amount.toNumber(),
      status: input.status ?? cur.status,
      paymentDate: input.paymentDate !== undefined ? input.paymentDate : cur.paymentDate,
    });
    assertRules(t);
    const name = await unitName(tx, t.unitId);
    if (t.unitId !== cur.unitId || t.year !== cur.year) await assertYearFree(tx, t, name, id);
    const expenseId = await syncExpense(tx, t, cur.expenseId);
    return mapUniqueViolation(t, name, () =>
      tx.propertyTax.update({ where: { id }, data: { ...t, expenseId }, include: propertyTaxInclude }),
    );
  });
}

/** Deletes the tax row and its linked expense (if any). */
export async function deletePropertyTax(id: string) {
  await prisma.$transaction(async (tx) => {
    await lockTax(tx, id);
    const { expenseId } = await tx.propertyTax.delete({ where: { id }, select: { expenseId: true } });
    if (expenseId) await tx.expense.deleteMany({ where: { id: expenseId } });
  });
}
