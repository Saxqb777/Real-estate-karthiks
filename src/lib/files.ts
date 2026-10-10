// Private file storage for proof files (owner, 10/10/2026). Server-only.
// Production: a PRIVATE Vercel Blob store — the files have no public address; the app streams them only to the
// signed-in owner (/api/attachments/[id]). Credentials come from the project (BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID
// with Vercel OIDC). Without them — local development and tests — files go to a folder on disk (.data/files, ignored
// by git). On Vercel without a store the upload is refused with a clear message instead of writing to a temporary disk.
import { del, get, put } from "@vercel/blob";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { ApiError } from "@/lib/api";
import { isStorageKey } from "@/lib/attachment-rules";

const blobStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(process.cwd(), ".data", "files");

function localPath(key: string): string {
  if (!isStorageKey(key)) throw new ApiError(400, "Bad file key");
  return path.join(LOCAL_DIR, key);
}

function noStore(): never {
  throw new ApiError(503, "File storage is not set up yet");
}

/** Save a file under `key` (keys are made by the server and never reused). */
export async function saveFile(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (blobStore()) {
    await put(key, Buffer.from(body), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
    return;
  }
  if (process.env.VERCEL) noStore();
  const file = localPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, { flag: "wx" });
}

/** The file's bytes as a stream, or null when it isn't there. */
export async function readFile(key: string): Promise<ReadableStream<Uint8Array> | null> {
  if (blobStore()) {
    const res = await get(key, { access: "private" });
    return res?.statusCode === 200 ? res.stream : null;
  }
  if (process.env.VERCEL) noStore();
  const file = localPath(key);
  try {
    await fs.access(file);
  } catch {
    return null;
  }
  return Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
}

/**
 * Remove files after their records are gone. Best effort: a file that can't be removed is only left unreachable in
 * the private store (no record points at it any more), so the delete the owner asked for still succeeds.
 */
export async function removeFiles(keys: (string | null | undefined)[]): Promise<void> {
  const list = keys.filter((k): k is string => Boolean(k));
  if (!list.length) return;
  try {
    if (blobStore()) {
      await del(list);
      return;
    }
    if (process.env.VERCEL) return;
    await Promise.all(list.map((k) => fs.rm(localPath(k), { force: true })));
    await Promise.all(list.map((k) => fs.rmdir(path.dirname(localPath(k))).catch(() => {})));
  } catch (err) {
    console.error("removeFiles failed", list, err);
  }
}
