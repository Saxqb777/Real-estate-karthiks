// GET/PUT /api/plot — singleton row id=1 (created with defaults on first read).
// areaSqft: a number is stored as given; null / "" means "auto" = (front + back) / 2 × depth when all three
// are known. When areaSqft is omitted it is recomputed only if this update touched a dimension (or no area
// is stored yet), so a manually entered area survives unrelated edits such as renaming the town.
import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { plotAreaSqft, plotUpdateSchema } from "@/lib/schemas/plot";

const ID = 1;

async function loadPlot() {
  return (
    (await prisma.plot.findUnique({ where: { id: ID } })) ??
    prisma.plot.upsert({ where: { id: ID }, update: {}, create: { id: ID } })
  );
}

export const GET = handler(async () => json(await loadPlot()));

export const PUT = handler(async (req) => {
  const input = await parseBody(req, plotUpdateSchema);
  const current = await loadPlot();
  const num = (next: number | null | undefined, stored: { toNumber(): number } | null) =>
    next !== undefined ? next : (stored?.toNumber() ?? null);
  const front = num(input.frontWidthFt, current.frontWidthFt);
  const back = num(input.backWidthFt, current.backWidthFt);
  const depth = num(input.depthFt, current.depthFt);
  const computed = front !== null && back !== null && depth !== null ? plotAreaSqft(front, back, depth) : null;

  const data = { ...input };
  if (input.areaSqft === null) data.areaSqft = computed;
  else if (input.areaSqft === undefined && computed !== null) {
    const touchedDims = [input.frontWidthFt, input.backWidthFt, input.depthFt].some((v) => v !== undefined);
    if (touchedDims || current.areaSqft === null) data.areaSqft = computed;
  }
  return json(await prisma.plot.update({ where: { id: ID }, data }));
});
