// POST /api/actions/[id]/done — body optional: {isDone?: boolean} (default true). Re-opening clears doneAt.
import { badRequest, handler, json, notFound, param } from "@/lib/api";
import { prisma } from "@/lib/db";
import { actionDoneSchema, actionInclude, doneState, toActionDTO } from "@/lib/schemas/action";

/** Empty body → {}; otherwise it must be JSON. */
async function optionalJson(req: Request): Promise<unknown> {
  const raw = (await req.text()).trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Request body must be valid JSON (or empty)");
  }
}

export const POST = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const { isDone } = actionDoneSchema.parse(await optionalJson(req));
  const action = await prisma.$transaction(async (tx) => {
    const cur = await tx.actionItem.findUnique({ where: { id }, select: { isDone: true, doneAt: true } });
    if (!cur) throw notFound("Action");
    return tx.actionItem.update({ where: { id }, data: doneState(cur, isDone), include: actionInclude });
  });
  return json(toActionDTO(action));
});
