// GET /api/expenses?year=&unitId=(id|plot)&categoryId= → { items, total, count } (newest first) ; POST /api/expenses
import type { Prisma } from "@prisma/client";
import { handler, json, notFound, parseBody, parseQuery } from "@/lib/api";
import { sumAmounts } from "@/lib/calculations";
import { dateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import {
  WHOLE_PLOT,
  expenseCreateSchema,
  expenseInclude,
  expenseListQuerySchema,
  toExpenseDTO,
} from "@/lib/schemas/expense";

export const GET = handler(async (req) => {
  const { year, unitId, categoryId } = parseQuery(req, expenseListQuerySchema);
  const where: Prisma.ExpenseWhereInput = {
    ...(year !== undefined && { expenseDate: { gte: dateOnly(year, 1, 1), lt: dateOnly(year + 1, 1, 1) } }),
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
  if (!category) throw notFound("Expense category");
  if (!unit) throw notFound("Unit");
  const expense = await prisma.expense.create({ data, include: expenseInclude });
  return json(toExpenseDTO(expense), 201);
});
