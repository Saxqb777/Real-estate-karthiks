// GET/POST /api/expense-categories — built-ins first, then by name; each with expenseCount + total (sumAmounts).
import { conflict, handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  CATEGORY_NAME_LOCK,
  categoryNameTakenMessage,
  compareCategories,
  expenseCategoryCreateSchema,
  withCategoryStats,
} from "@/lib/schemas/expense-category";

export const GET = handler(async () => {
  const [categories, expenses] = await Promise.all([
    prisma.expenseCategory.findMany(),
    prisma.expense.findMany({ select: { categoryId: true, amount: true } }),
  ]);
  return json({ items: withCategoryStats(categories, expenses).sort(compareCategories) });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, expenseCategoryCreateSchema);
  const category = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATEGORY_NAME_LOCK}::bigint)`;
    const clash = await tx.expenseCategory.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" } },
      select: { name: true },
    });
    if (clash) throw conflict(categoryNameTakenMessage(clash.name));
    return tx.expenseCategory.create({ data });
  });
  return json({ ...category, expenseCount: 0, total: 0 }, 201);
});
