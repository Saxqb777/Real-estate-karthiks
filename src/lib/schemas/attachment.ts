// Proof files (owner, 10/10/2026): the list query and what the API returns for each file.
import { z } from "zod";
import "./messages";
import { ATTACHMENT_OWNERS, type AttachmentOwner } from "@/lib/attachment-rules";

export type { AttachmentOwner };

const optionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().min(1).optional());

/** GET /api/attachments?paymentId= | expenseId= | leaseId= | propertyTaxId= (exactly one) */
export const attachmentListQuerySchema = z.object(Object.fromEntries(ATTACHMENT_OWNERS.map((f) => [f, optionalId])) as Record<
  (typeof ATTACHMENT_OWNERS)[number],
  typeof optionalId
>);

/** One stored file. Open it at /api/attachments/<id> (its small preview: ?v=thumb, photos only). */
export interface AttachmentDTO {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  /** a photo (has a preview) — otherwise a PDF */
  image: boolean;
  createdAt: string;
}

export interface AttachmentListResponse {
  items: AttachmentDTO[];
}

/** where to open a stored file (`thumb` = its small preview, photos only; `download` = save instead of show) */
export function attachmentUrl(id: string, opts: { thumb?: boolean; download?: boolean } = {}): string {
  const q = opts.thumb ? "?v=thumb" : opts.download ? "?dl=1" : "";
  return `/api/attachments/${id}${q}`;
}
