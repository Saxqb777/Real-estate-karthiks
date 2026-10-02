// GET/PUT/DELETE /api/expense-categories/[id] — built-in categories: colour change only, never deleted.
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  CATEGORY_NAME_LOCK,
  categoryInUseMessage,
  categoryNameTakenMessage,
  defaultCategoryDeleteMessage,
  defaultCategoryRenameMessage,
  expenseCategoryUpdateSchema,
  withCategoryStats,
} from "@/lib/schemas/expense-category";

/** Category + expenseCount + total. */
async function loadOne(id: string) {
  const category = await prisma.expenseCategory.findUnique({
    where: { id },
    include: { expenses: { select: { categoryId: true, amount: true } } },
  });
  if (!category) throw notFound("Expense category");
  const { expenses, ...rest } = category;
  return withCategoryStats([rest], expenses)[0];
}

export const GET = handler(async (_req, ctx) => json(await loadOne(await param(ctx, "id"))));

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const data = await parseBody(req, expenseCategoryUpdateSchema);
  await prisma.$transaction(async (tx) => {
    const cur = await tx.expenseCategory.findUnique({ where: { id }, select: { name: true, isDefault: true } });
    if (!cur) throw notFound("Expense category");
    if (data.name !== undefined && data.name !== cur.name) {
      if (cur.isDefault) throw conflict(defaultCategoryRenameMessage(cur.name));
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATEGORY_NAME_LOCK}::bigint)`;
      const clash = await tx.expenseCategory.findFirst({
        where: { name: { equals: data.name, mode: "insensitive" }, id: { not: id } },
        select: { name: true },
      });
      if (clash) throw conflict(categoryNameTakenMessage(clash.name));
    }
    await tx.expenseCategory.update({ where: { id }, data });
  });
  return json(await loadOne(id));
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  await prisma.$transaction(async (tx) => {
    const cur = await tx.expenseCategory.findUnique({
      where: { id },
      select: { name: true, isDefault: true, _count: { select: { expenses: true } } },
    });
    if (!cur) throw notFound("Expense category");
    if (cur.isDefault) throw conflict(defaultCategoryDeleteMessage(cur.name));
    if (cur._count.expenses) throw conflict(categoryInUseMessage(cur.name, cur._count.expenses));
    await tx.expenseCategory.delete({ where: { id } });
  });
  return json({ ok: true });
});
