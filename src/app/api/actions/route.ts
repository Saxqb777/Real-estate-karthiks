// GET /api/actions?status=pending|done|all ; POST /api/actions
// Pending: due date ascending (undated last), then High → Low. Done: most recently completed first. (compareActions)
import { handler, json, notFound, parseBody, parseQuery } from "@/lib/api";
import { todayIST } from "@/lib/dates";
import { prisma } from "@/lib/db";
import {
  actionCreateSchema,
  actionInclude,
  actionListQuerySchema,
  compareActions,
  toActionDTO,
} from "@/lib/schemas/action";

export const GET = handler(async (req) => {
  const { status } = parseQuery(req, actionListQuerySchema);
  const rows = await prisma.actionItem.findMany({
    where: status === "all" ? undefined : { isDone: status === "done" },
    include: actionInclude,
  });
  const today = todayIST();
  return json({ items: rows.sort(compareActions).map((a) => toActionDTO(a, today)) });
});

export const POST = handler(async (req) => {
  const data = await parseBody(req, actionCreateSchema);
  if (data.unitId && !(await prisma.unit.findUnique({ where: { id: data.unitId }, select: { id: true } }))) {
    throw notFound("Unit");
  }
  const action = await prisma.actionItem.create({ data, include: actionInclude });
  return json(toActionDTO(action), 201);
});
