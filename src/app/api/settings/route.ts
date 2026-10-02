// GET/PUT /api/settings — singleton row id=1 (created with defaults on first read).
import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { settingsUpdateSchema } from "@/lib/schemas/settings";

const ID = 1;

async function loadSettings() {
  return (
    (await prisma.settings.findUnique({ where: { id: ID } })) ??
    prisma.settings.upsert({ where: { id: ID }, update: {}, create: { id: ID } })
  );
}

export const GET = handler(async () => json(await loadSettings()));

export const PUT = handler(async (req) => {
  const data = await parseBody(req, settingsUpdateSchema);
  return json(await prisma.settings.upsert({ where: { id: ID }, update: data, create: { id: ID, ...data } }));
});
