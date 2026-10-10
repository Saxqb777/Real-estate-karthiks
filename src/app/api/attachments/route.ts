// Proof files (owner, 10/10/2026): list a record's files, or upload one (a photo — already shrunk on the device — with
// its small preview, or a PDF). Every file is checked by its first bytes; only JPEG / PNG / WebP photos and PDFs are kept.
import { randomUUID } from "node:crypto";
import { fieldError } from "@/app/api/_lib/errors";
import { ApiError, badRequest, handler, json, parseQuery } from "@/lib/api";
import {
  MAX_FILES_PER_RECORD,
  MAX_FILE_BYTES,
  MAX_THUMB_BYTES,
  cleanFileName,
  FILE_TYPES,
  fileKeyFor,
  ownerOf,
  sizeText,
  sniffFile,
  thumbKeyFor,
} from "@/lib/attachment-rules";
import { assertOwner, toAttachmentDTO } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { removeFiles, saveFile } from "@/lib/files";
import { attachmentListQuerySchema } from "@/lib/schemas/attachment";

/** The files on one record, oldest first. */
export const GET = handler(async (req) => {
  const owner = ownerOf(parseQuery(req, attachmentListQuerySchema));
  if ("error" in owner) throw badRequest(owner.error);
  const rows = await prisma.attachment.findMany({ where: { [owner.field]: owner.id }, orderBy: { createdAt: "asc" } });
  return json({ items: rows.map(toAttachmentDTO) });
});

/** multipart/form-data: one of paymentId / expenseId / leaseId / propertyTaxId, `file`, optional `thumb` (photos), `name`. */
export const POST = handler(async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send the file as a form upload");
  }
  const owner = ownerOf(Object.fromEntries(form.entries()));
  if ("error" in owner) throw badRequest(owner.error);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw fieldError(400, "file", "Choose a photo or PDF");
  if (file.size > MAX_FILE_BYTES) throw fieldError(413, "file", `is too big (${sizeText(file.size)}) — up to ${sizeText(MAX_FILE_BYTES)}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFile(bytes);
  if (!kind) throw fieldError(415, "file", "must be a photo (JPG, PNG, WebP) or a PDF");

  // a photo's small preview (made on the device); a PDF has none
  let thumb: Uint8Array | null = null;
  const t = form.get("thumb");
  if (kind !== "pdf" && t instanceof File && t.size > 0) {
    if (t.size > MAX_THUMB_BYTES) throw fieldError(413, "thumb", "preview is too big");
    thumb = new Uint8Array(await t.arrayBuffer());
    if (sniffFile(thumb) !== "jpeg") throw fieldError(415, "thumb", "preview must be a JPEG");
  }

  await assertOwner(owner.field, owner.id);
  const count = await prisma.attachment.count({ where: { [owner.field]: owner.id } });
  if (count >= MAX_FILES_PER_RECORD) throw new ApiError(409, `This record already has ${MAX_FILES_PER_RECORD} files`);

  const folder = randomUUID();
  const fileKey = fileKeyFor(folder, kind);
  const thumbKey = thumb ? thumbKeyFor(folder) : null;
  const name = form.get("name");
  await saveFile(fileKey, bytes, FILE_TYPES[kind].contentType);
  try {
    if (thumb && thumbKey) await saveFile(thumbKey, thumb, "image/jpeg");
    const row = await prisma.attachment.create({
      data: {
        [owner.field]: owner.id,
        fileName: cleanFileName(typeof name === "string" && name ? name : file.name, kind),
        contentType: FILE_TYPES[kind].contentType,
        size: bytes.byteLength,
        fileKey,
        thumbKey,
      },
    });
    return json(toAttachmentDTO(row), 201);
  } catch (err) {
    await removeFiles([fileKey, thumbKey]);
    throw err;
  }
});
