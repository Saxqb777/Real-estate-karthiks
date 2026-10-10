// Get a file ready to keep as proof (owner, 10/10/2026), in the browser, before it is uploaded:
// photos are redrawn as a JPEG of at most ~4 MP (sharp enough to read a bill or a payment screenshot, a few hundred KB,
// turned the right way up, location data left behind) plus a small preview; PDFs go as they are.
import { MAX_FILE_BYTES, sizeText, type AttachmentOwner } from "@/lib/attachment-rules";
import { api } from "@/lib/client";
import { PHOTO_MAX_PIXELS, PHOTO_MAX_SIDE, THUMB_MAX_SIDE, fitWithin } from "@/lib/image-fit";
import type { AttachmentDTO } from "@/lib/schemas/attachment";

export interface PreparedProof {
  /** the name the file had on the phone / computer */
  name: string;
  file: Blob;
  /** photos only */
  thumb: Blob | null;
  image: boolean;
}

/** A problem with one file, worded for the owner (shown as a toast). */
export class ProofError extends Error {}

export const ACCEPT = "image/*,application/pdf";

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(f.name);

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
  } catch {
    // some browsers only read a format (e.g. iPhone HEIC in Safari) through an <img>
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new ProofError(`${file.name} — this photo can't be opened here`);
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
}

function toJpeg(src: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  if (!g) return Promise.reject(new ProofError("This browser can't prepare photos"));
  g.fillStyle = "#ffffff"; // see-through screenshots turn white, not black
  g.fillRect(0, 0, width, height);
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new ProofError("This photo couldn't be prepared"))), "image/jpeg", quality),
  );
}

export async function prepareProof(file: File): Promise<PreparedProof> {
  if (isPdf(file)) {
    if (file.size > MAX_FILE_BYTES) throw new ProofError(`${file.name} is too big (${sizeText(file.size)}) — up to ${sizeText(MAX_FILE_BYTES)}`);
    return { name: file.name, file, thumb: null, image: false };
  }
  if (!isImage(file)) throw new ProofError(`${file.name} — only photos and PDFs`);
  const d = await decode(file);
  try {
    const big = fitWithin(d.width, d.height, PHOTO_MAX_PIXELS, PHOTO_MAX_SIDE);
    let out = await toJpeg(d.source, big.width, big.height, 0.86);
    if (out.size > MAX_FILE_BYTES) out = await toJpeg(d.source, big.width, big.height, 0.7);
    const small = fitWithin(d.width, d.height, Infinity, THUMB_MAX_SIDE);
    const thumb = await toJpeg(d.source, small.width, small.height, 0.74);
    return { name: file.name, file: out, thumb, image: true };
  } finally {
    d.release();
  }
}

/** Upload a prepared file onto one record. */
export function uploadProof(owner: AttachmentOwner, p: PreparedProof): Promise<AttachmentDTO> {
  const body = new FormData();
  for (const [field, id] of Object.entries(owner)) if (id) body.append(field, id);
  body.append("file", p.file, p.image ? "photo.jpg" : "document.pdf");
  if (p.thumb) body.append("thumb", p.thumb, "thumb.jpg");
  body.append("name", p.name);
  return api<AttachmentDTO>("/api/attachments", { method: "POST", body });
}

/** The words for a failed file: our own message, or the server's ("… is too big"). */
export function proofErrorText(err: unknown, name: string): string {
  if (err instanceof ProofError) return err.message;
  const e = err as { message?: string; fieldErrors?: Record<string, string> };
  const field = e?.fieldErrors?.file;
  return field ? `${name} ${field}` : (e?.message ?? `${name} couldn't be added`);
}
