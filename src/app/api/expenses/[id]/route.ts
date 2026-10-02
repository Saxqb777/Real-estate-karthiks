// GET/PUT/DELETE /api/expenses/[id] — expenses auto-created by a Paid Property Tax row are read-only here (409).
import type { Prisma } from "@prisma/client";
import { conflict, handler, json, notFound, param, parseBody } from "@/lib/api";
import { fieldError } from "@/app/api/_lib/errors";
import { prisma } from "@/lib/db";
import { expenseInclude, expenseUpdateSchema, linkedExpenseMessage, toExpenseDTO } from "@/lib/schemas/expense";

async function loadOne(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!expense) throw notFound("Expense");
  return toExpenseDTO(expense);
}

/** 404 when missing; 409 when the expense belongs to a Property Tax row. */
async function assertEditable(tx: Prisma.TransactionClient, id: string) {
  const cur = await tx.expense.findUnique({
    where: { id },
    select: { propertyTax: { select: { year: true, unit: { select: { name: true } } } } },
  });
  if (!cur) throw notFound("Expense");
  if (cur.propertyTax) throw conflict(linkedExpenseMessage(cur.propertyTax.year, cur.propertyTax.unit.name));
}

export const GET = handler(async (_req, ctx) => json(await loadOne(await param(ctx, "id"))));

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const data = await parseBody(req, expenseUpdateSchema);
  await prisma.$transaction(async (tx) => {
    await assertEditable(tx, id);
    if (data.categoryId && !(await tx.expenseCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) {
      throw fieldError(404, "categoryId", "Expense category not found");
    }
    if (data.unitId && !(await tx.unit.findUnique({ where: { id: data.unitId }, select: { id: true } }))) {
      throw fieldError(404, "unitId", "Unit not found");
    }
    await tx.expense.update({ where: { id }, data });
  });
  return json(await loadOne(id));
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  await prisma.$transaction(async (tx) => {
    await assertEditable(tx, id);
    await tx.expense.delete({ where: { id } });
  });
  return json({ ok: true });
});
