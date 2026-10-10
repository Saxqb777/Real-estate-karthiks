// One proof file (owner, 10/10/2026): stream it to the signed-in owner (the store itself is private), or delete it.
import { handler, json, notFound, param } from "@/lib/api";
import { contentDisposition } from "@/lib/attachment-rules";
import { prisma } from "@/lib/db";
import { readFile, removeFiles } from "@/lib/files";

/** The file (?v=thumb → its small preview for photos; ?dl=1 → saved instead of shown). Never changes, so cached long. */
export const GET = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const q = new URL(req.url).searchParams;
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a) throw notFound("File");
  const thumb = q.get("v") === "thumb" && Boolean(a.thumbKey);
  const stream = await readFile(thumb ? a.thumbKey! : a.fileKey);
  if (!stream) throw notFound("File");
  return new Response(stream, {
    headers: {
      "Content-Type": thumb ? "image/jpeg" : a.contentType,
      "Content-Disposition": contentDisposition(a.fileName, q.get("dl") === "1"),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const a = await prisma.attachment.findUnique({ where: { id }, select: { fileKey: true, thumbKey: true } });
  if (!a) throw notFound("File");
  await prisma.attachment.delete({ where: { id } });
  await removeFiles([a.fileKey, a.thumbKey]);
  return json({ ok: true });
});
