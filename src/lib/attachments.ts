// Proof files on records (owner, 10/10/2026) — server helpers shared by /api/attachments and the routes that delete
// records with files (payments, expenses, property tax, leases). Server-only (Prisma + storage).
import type { Attachment, Prisma } from "@prisma/client";
import { ApiError, notFound } from "@/lib/api";
import type { AttachmentOwnerField } from "@/lib/attachment-rules";
import { prisma } from "@/lib/db";
import type { AttachmentDTO } from "@/lib/schemas/attachment";

export function toAttachmentDTO(a: Attachment): AttachmentDTO {
  return {
    id: a.id,
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
    image: a.contentType.startsWith("image/"),
    createdAt: a.createdAt.toISOString(),
  };
}

/** The record must exist; an expense made automatically by a paid property tax keeps its proof on the tax entry. */
export async function assertOwner(field: AttachmentOwnerField, id: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  switch (field) {
    case "paymentId":
      if (!(await db.payment.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Payment");
      return;
    case "leaseId":
      if (!(await db.lease.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Lease");
      return;
    case "propertyTaxId":
      if (!(await db.propertyTax.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Property tax entry");
      return;
    case "expenseId": {
      const e = await db.expense.findUnique({ where: { id }, select: { propertyTax: { select: { id: true } } } });
      if (!e) throw notFound("Expense");
      if (e.propertyTax) throw new ApiError(409, "This expense comes from property tax — add the file to the property tax entry");
      return;
    }
  }
}

/**
 * Storage keys of the files on these records — read them BEFORE deleting the records (the file rows go with ON DELETE
 * CASCADE), then pass them to removeFiles (lib/files) once the delete has gone through.
 */
export async function fileKeysOf(where: Prisma.AttachmentWhereInput): Promise<string[]> {
  const rows = await prisma.attachment.findMany({ where, select: { fileKey: true, thumbKey: true } });
  return rows.flatMap((r) => (r.thumbKey ? [r.fileKey, r.thumbKey] : [r.fileKey]));
}
