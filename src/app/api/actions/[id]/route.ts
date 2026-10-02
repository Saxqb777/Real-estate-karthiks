// GET/PUT/DELETE /api/actions/[id] — PUT is partial; sending isDone keeps doneAt in step.
import { handler, json, notFound, param, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { actionInclude, actionUpdateSchema, doneState, toActionDTO } from "@/lib/schemas/action";

export const GET = handler(async (_req, ctx) => {
  const action = await prisma.actionItem.findUnique({ where: { id: await param(ctx, "id") }, include: actionInclude });
  if (!action) throw notFound("Action");
  return json(toActionDTO(action));
});

export const PUT = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const { isDone, ...data } = await parseBody(req, actionUpdateSchema);
  const action = await prisma.$transaction(async (tx) => {
    const cur = await tx.actionItem.findUnique({ where: { id }, select: { isDone: true, doneAt: true } });
    if (!cur) throw notFound("Action");
    if (data.unitId && !(await tx.unit.findUnique({ where: { id: data.unitId }, select: { id: true } }))) {
      throw notFound("Unit");
    }
    return tx.actionItem.update({
      where: { id },
      data: { ...data, ...(isDone !== undefined && doneState(cur, isDone)) },
      include: actionInclude,
    });
  });
  return json(toActionDTO(action));
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const { count } = await prisma.actionItem.deleteMany({ where: { id } });
  if (!count) throw notFound("Action");
  return json({ ok: true });
});
