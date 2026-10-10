// Proof files (owner, 10/10/2026: "attach images with transactions" — bills, payment screenshots, deposit and bank
// statements). Pure rules shared by the upload API and its tests: which record a file belongs to, what a file really is
// (from its first bytes — never the browser's word), size limits, storage keys and the download headers.

/** A file belongs to exactly one of these records (DB CHECK attachment_one_owner). leaseId = the lease's security deposit. */
export const ATTACHMENT_OWNERS = ["paymentId", "expenseId", "leaseId", "propertyTaxId"] as const;
export type AttachmentOwnerField = (typeof ATTACHMENT_OWNERS)[number];
export type AttachmentOwner = { [K in AttachmentOwnerField]?: string };

/** The record a request names, or why it can't be used (none, or more than one). */
export function ownerOf(input: Record<string, unknown>): { field: AttachmentOwnerField; id: string } | { error: string } {
  const given = ATTACHMENT_OWNERS.flatMap((field) => {
    const v = input[field];
    return typeof v === "string" && v.trim() ? [{ field, id: v.trim() }] : [];
  });
  if (given.length === 0) return { error: "Say which payment, expense, deposit or property tax the file is for" };
  if (given.length > 1) return { error: "A file can belong to only one record" };
  return given[0];
}

export type FileKind = "jpeg" | "png" | "webp" | "pdf";

export const FILE_TYPES: Record<FileKind, { contentType: string; ext: string }> = {
  jpeg: { contentType: "image/jpeg", ext: "jpg" },
  png: { contentType: "image/png", ext: "png" },
  webp: { contentType: "image/webp", ext: "webp" },
  pdf: { contentType: "application/pdf", ext: "pdf" },
};

/** What the file really is, from its first bytes: a JPEG, PNG or WebP photo, or a PDF — anything else is refused. */
export function sniffFile(b: Uint8Array): FileKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return "pdf";
  return null;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** One upload must fit a Vercel Function request (4.5 MB); photos are shrunk on the device well below this first. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** the small preview sent with a photo */
export const MAX_THUMB_BYTES = 400 * 1024;
export const MAX_FILES_PER_RECORD = 20;

export const sizeText = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Storage keys: one folder per file, named by a random id (never by anything the owner typed). */
export const fileKeyFor = (folder: string, kind: FileKind) => `attachments/${folder}/file.${FILE_TYPES[kind].ext}`;
export const thumbKeyFor = (folder: string) => `attachments/${folder}/thumb.jpg`;
export const isStorageKey = (key: string) => /^attachments\/[a-z0-9-]{8,64}\/(file\.(jpg|png|webp|pdf)|thumb\.jpg)$/.test(key);

/**
 * The name to keep for the file: no folders, no control characters, at most 120 characters, and an extension that
 * matches what the file really is ("Screenshot 2026-10-10.png" stays; "bill" from a JPEG becomes "bill.jpg").
 */
export function cleanFileName(name: string | null | undefined, kind: FileKind): string {
  const ext = FILE_TYPES[kind].ext;
  let base = (name ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  base = base.replace(/\.[a-z0-9]{1,5}$/i, "").trim() || (kind === "pdf" ? "document" : "photo");
  return `${base.slice(0, 120 - ext.length - 1)}.${ext}`;
}

/** Content-Disposition for a stored file: shown in the browser ("inline") or saved ("attachment"), with its name. */
export function contentDisposition(fileName: string, download = false): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
