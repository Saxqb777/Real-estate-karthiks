"use client";
// Proof files on a record (owner, 10/10/2026: "attach images with transactions"): a row of small thumbnails and a "+"
// tile. Tap a thumbnail to see it full screen; "+" opens the phone's camera / photos / files (or drop files on the row).
// ProofStrip works on a saved record; usePendingProofs + PendingProofStrip hold files in a form until the record is
// saved, then upload them onto it.
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cx, toast } from "@/components/ui";
import type { AttachmentOwner } from "@/lib/attachment-rules";
import { invalidate, useApi } from "@/lib/client";
import { attachmentUrl, type AttachmentDTO, type AttachmentListResponse } from "@/lib/schemas/attachment";
import { ACCEPT, prepareProof, proofErrorText, uploadProof, type PreparedProof } from "./prepare";
import { ProofViewer } from "./ProofViewer";
import s from "./proof.module.css";

const ownerQuery = (owner: AttachmentOwner) =>
  Object.entries(owner)
    .filter(([, id]) => id)
    .map(([field, id]) => `${field}=${encodeURIComponent(id!)}`)
    .join("&");

let seq = 0;
const nextId = () => `p${++seq}`;

/** A clean paperclip button (owner, 10/10/2026): the phone's picker (camera, photos, files); several files at once. */
function AddTile({
  onFiles,
  label = "Attach a photo or PDF",
  inline,
}: {
  onFiles: (files: File[]) => void;
  label?: string;
  inline?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={inline ? s.clip : s.attach} aria-label={label} title="Attach" onClick={() => input.current?.click()}>
        <Paperclip aria-hidden />
      </button>
      <input
        ref={input}
        className={s.input}
        type="file"
        accept={ACCEPT}
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ""; // the same file can be picked again
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/** The row, with drop-to-add on desktop. */
function Strip({
  onFiles,
  small,
  end,
  children,
}: {
  onFiles: (files: File[]) => void;
  small?: boolean;
  end?: boolean;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  return (
    <div
      className={cx(s.strip, small && s.small, end && s.end)}
      data-over={over || undefined}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      {children}
    </div>
  );
}

function Thumb({ a, onOpen }: { a: AttachmentDTO; onOpen: () => void }) {
  return (
    <button type="button" className={s.tile} onClick={onOpen} aria-label={`Open ${a.fileName}`} title={a.fileName}>
      {a.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- private file behind the login, not an optimisable asset
        <img src={attachmentUrl(a.id, { thumb: true })} alt="" draggable={false} />
      ) : (
        <span className={s.doc}>
          <FileText aria-hidden />
          PDF
        </span>
      )}
    </button>
  );
}

function BusyTile({ preview }: { preview?: string | null }) {
  return (
    <span className={cx(s.tile, s.busy)} aria-label="Uploading" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview (object URL) */}
      {preview && <img src={preview} alt="" />}
      <Loader2 className={s.spin} aria-hidden />
    </span>
  );
}

/** The files on a saved record and adding more (each uploaded straight away). null = no record yet (nothing loads). */
export function useProofFiles(owner: AttachmentOwner | null) {
  const list = useApi<AttachmentListResponse>(owner ? `/api/attachments?${ownerQuery(owner)}` : null);
  const items = list.data?.items ?? [];
  const [busy, setBusy] = useState<{ id: string; preview: string | null }[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  const add = useCallback(async (files: File[]) => {
    for (const f of files) {
      const owner = ownerRef.current;
      if (!owner) return;
      const id = nextId();
      setBusy((b) => [...b, { id, preview: null }]);
      let preview: string | null = null;
      try {
        const p = await prepareProof(f);
        if (p.thumb) {
          preview = URL.createObjectURL(p.thumb);
          setBusy((b) => b.map((x) => (x.id === id ? { ...x, preview } : x)));
        }
        await uploadProof(owner, p);
        invalidate("/api/");
      } catch (err) {
        toast.error(proofErrorText(err, f.name));
      } finally {
        setBusy((b) => b.filter((x) => x.id !== id));
        if (preview) URL.revokeObjectURL(preview);
      }
    }
  }, []);

  return { items, busy, add, open, setOpen };
}

export type ProofFiles = ReturnType<typeof useProofFiles>;

function Files({ files }: { files: ProofFiles }) {
  const { items, busy, open, setOpen } = files;
  const shown = open !== null && open < items.length ? open : null;
  return (
    <>
      {items.map((a, i) => (
        <Thumb key={a.id} a={a} onOpen={() => setOpen(i)} />
      ))}
      {busy.map((b) => (
        <BusyTile key={b.id} preview={b.preview} />
      ))}
      {shown !== null && <ProofViewer items={items} index={shown} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The proof files on a saved record — shown, opened full screen, added (uploaded straight away) and deleted. */
export function ProofStrip({ owner }: { owner: AttachmentOwner }) {
  const files = useProofFiles(owner);
  return (
    <Strip onFiles={files.add}>
      <Files files={files} />
      <AddTile onFiles={files.add} />
    </Strip>
  );
}

/** Just the clip (inside the Ref no. box, or beside a value): opens the picker. */
export function ProofClip({ onFiles }: { onFiles: (files: File[]) => void }) {
  return <AddTile onFiles={onFiles} inline />;
}

/**
 * A record's files as small thumbnails under the line its clip is on (tap = full screen); nothing when there are none.
 * `end`: lined up on the right, under a right-aligned value (the details lists).
 */
export function ProofThumbs({ files, end = true }: { files: ProofFiles; end?: boolean }) {
  if (!files.items.length && !files.busy.length) return null;
  return (
    <Strip onFiles={files.add} small end={end}>
      <Files files={files} />
    </Strip>
  );
}

interface PendingItem {
  id: string;
  name: string;
  preview: string | null;
  /** null while it is being prepared */
  prepared: PreparedProof | null;
}

/**
 * Files picked in a form before its record exists (Record rent, Add expense). They are prepared straight away (so a
 * problem shows at once) and uploaded by uploadTo() once the record has been saved.
 */
export function usePendingProofs() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // previews are object URLs: let them go when the form closes
  useEffect(() => () => itemsRef.current.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []);

  const add = useCallback(async (files: File[]) => {
    for (const f of files) {
      const id = nextId();
      setItems((xs) => [...xs, { id, name: f.name, preview: null, prepared: null }]);
      try {
        const prepared = await prepareProof(f);
        const preview = prepared.thumb ? URL.createObjectURL(prepared.thumb) : null;
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, prepared, preview } : x)));
      } catch (err) {
        toast.error(proofErrorText(err, f.name));
        setItems((xs) => xs.filter((x) => x.id !== id));
      }
    }
  }, []);

  const remove = useCallback((id: string) => {
    setItems((xs) => {
      const gone = xs.find((x) => x.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return xs.filter((x) => x.id !== id);
    });
  }, []);

  /** Upload every ready file onto the saved record (one at a time). Keeps going if the form has closed. */
  const uploadTo = useCallback(async (owner: AttachmentOwner) => {
    const ready = itemsRef.current.filter((i) => i.prepared);
    for (const i of ready) {
      try {
        await uploadProof(owner, i.prepared!);
      } catch (err) {
        toast.error(proofErrorText(err, i.name));
      }
    }
    if (ready.length) invalidate("/api/");
  }, []);

  return { items, add, remove, uploadTo, count: items.length };
}

export type PendingProofs = ReturnType<typeof usePendingProofs>;

/** The form's row of picked files (✕ takes one out again). `thumbsOnly`: no clip in the row (it sits in a box above). */
export function PendingProofStrip({ pending, thumbsOnly }: { pending: PendingProofs; thumbsOnly?: boolean }) {
  if (thumbsOnly && !pending.items.length) return null;
  return (
    <Strip onFiles={pending.add} small={thumbsOnly}>
      {pending.items.map((i) =>
        i.prepared ? (
          <span key={i.id} className={s.tile} title={i.name}>
            {i.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview (object URL)
              <img src={i.preview} alt="" />
            ) : (
              <span className={s.doc}>
                <FileText aria-hidden />
                PDF
              </span>
            )}
            <button type="button" className={s.remove} onClick={() => pending.remove(i.id)} aria-label={`Remove ${i.name}`}>
              <X aria-hidden />
            </button>
          </span>
        ) : (
          <BusyTile key={i.id} />
        ),
      )}
      {!thumbsOnly && <AddTile onFiles={pending.add} />}
    </Strip>
  );
}

/** 📎 on a list row that has proof files (with the count when more than one). */
export function ProofMark({ count }: { count: number | undefined }) {
  if (!count) return null;
  const label = `${count} file${count === 1 ? "" : "s"}`;
  return (
    <span className={s.mark} title={label} aria-label={label}>
      <Paperclip aria-hidden />
      {count > 1 && count}
    </span>
  );
}

/** The 📎 column's header in the Data tables. */
export function ProofHead() {
  return (
    <span className={s.head} title="Attachment">
      <Paperclip aria-hidden />
      <span className="sr-only">Attachment</span>
    </span>
  );
}

/** how many proof files a list row has (lists include `_count.attachments`) */
export const proofCount = (row: { _count?: { attachments: number } }) => row._count?.attachments ?? 0;
