// GET /api/expenses?year=&yearMode=calendar|fy&from=&to=&unitId=(id|plot)&categoryId= → { items, total, count } (newest first) ; POST /api/expenses
import type { Prisma } from "@prisma/client";
import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { sumAmounts } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import {
  WHOLE_PLOT,
  expenseCreateSchema,
  expenseInclude,
  expenseListQuerySchema,
  toExpenseDTO,
  yearRange,
} from "@/lib/schemas/expense";

export const GET = handler(async (req) => {
  const { year, yearMode, from, to, unitId, categoryId } = parseQuery(req, expenseListQuerySchema);
  // custom dates (inclusive) win over a year
  const yr = year !== undefined ? yearRange(year, yearMode) : null;
  const range = from && to ? { gte: from, lte: to } : yr ? { gte: yr.from, lt: yr.to } : null;
  const where: Prisma.ExpenseWhereInput = {
    ...(range && { expenseDate: range }),
    ...(unitId !== undefined && { unitId: unitId === WHOLE_PLOT ? null : unitId }),
    ...(categoryId !== undefined && { categoryId }),
  };
  const rows = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  });
  return json({
    items: rows.map(toExpenseDTO),
    total: sumAmounts(rows.map((r) => ({ amount: r.amount.toNumber() }))),
    count: rows.length,
  });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, expenseCreateSchema);
  const [category, unit] = await Promise.all([
    prisma.expenseCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }),
    data.unitId ? prisma.unit.findUnique({ where: { id: data.unitId }, select: { id: true } }) : true,
  ]);
  if (!category) throw fieldError(404, "categoryId", "Expense category not found");
  if (!unit) throw fieldError(404, "unitId", "Unit not found");
  const expense = await prisma.expense.create({ data, include: expenseInclude });
  return json(toExpenseDTO(expense), 201);
});
