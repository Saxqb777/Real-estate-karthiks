"use client";
// Attached files on a record (owner, 10/10/2026: "attach images with transactions" → "just keep a clean clip" → "the
// clip … without the file being visible"). Everywhere it is JUST the gold paperclip, beside the line it belongs to (the
// ref no., a date, "What for"): with no files it opens the phone's camera / photos / files; with files it shows how many
// and opens them full screen, where more can be attached or one deleted.
// ProofClip works on a saved record (uploads straight away); usePendingProofs + PendingProofClip hold files in a form
// until its record is saved, then upload them onto it.
import { Loader2, Paperclip } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui";
import type { AttachmentOwner } from "@/lib/attachment-rules";
import { api, invalidate, useApi } from "@/lib/client";
import type { AttachmentListResponse } from "@/lib/schemas/attachment";
import { ACCEPT, prepareProof, proofErrorText, uploadProof, type PreparedProof } from "./prepare";
import { ProofViewer, viewItem, type ViewItem } from "./ProofViewer";
import s from "./proof.module.css";

const ownerQuery = (owner: AttachmentOwner) =>
  Object.entries(owner)
    .filter(([, id]) => id)
    .map(([field, id]) => `${field}=${encodeURIComponent(id!)}`)
    .join("&");

let seq = 0;
const nextId = () => `p${++seq}`;

/** The phone's picker (camera, photos, files), several files at once, opened from a button. */
function usePicker(onFiles: (files: File[]) => void) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
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
  );
  return { open: () => input.current?.click(), element };
}

/** The clip itself: gold paperclip + how many files (none → opens the picker, some → opens them). */
function Clip({ count, busy, onPick, onOpen }: { count: number; busy: boolean; onPick: () => void; onOpen: () => void }) {
  const label = count ? `${count} attached file${count === 1 ? "" : "s"}` : "Attach a photo or PDF";
  return (
    <button type="button" className={s.clip} onClick={count ? onOpen : onPick} aria-label={label} title={count ? label : "Attach"}>
      {busy ? <Loader2 className={s.spinIcon} aria-hidden /> : <Paperclip aria-hidden />}
      {count > 0 && <span className={s.clipCount}>{count}</span>}
    </button>
  );
}

/** While the full-screen view is open, jump to a file that has just been added. */
function useShowNewest(count: number, open: number | null, setOpen: (i: number) => void) {
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current && open !== null) setOpen(count - 1);
    seen.current = count;
  }, [count, open, setOpen]);
}

/** Delete a saved file (the viewer has already asked). */
async function deleteSaved(item: ViewItem) {
  await api(`/api/attachments/${item.id}`, { method: "DELETE" });
  invalidate("/api/");
  toast.success(item.image ? "Photo deleted" : "PDF deleted");
}

/** The clip on a saved record: its files, opened full screen; added files are uploaded straight away. */
export function ProofClip({ owner }: { owner: AttachmentOwner }) {
  const list = useApi<AttachmentListResponse>(`/api/attachments?${ownerQuery(owner)}`);
  const items = list.data?.items ?? [];
  const [uploading, setUploading] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  const add = useCallback(async (files: File[]) => {
    for (const f of files) {
      setUploading((n) => n + 1);
      try {
        await uploadProof(ownerRef.current, await prepareProof(f));
        invalidate("/api/");
      } catch (err) {
        toast.error(proofErrorText(err, f.name));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }, []);
  const picker = usePicker(add);
  useShowNewest(items.length, open, setOpen);
  const shown = open !== null && open < items.length ? open : null;
  return (
    <>
      <Clip count={items.length} busy={uploading > 0} onPick={picker.open} onOpen={() => setOpen(0)} />
      {picker.element}
      {shown !== null && (
        <ProofViewer
          items={items.map(viewItem)}
          index={shown}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDelete={deleteSaved}
          onAttach={add}
          attaching={uploading > 0}
        />
      )}
    </>
  );
}

interface PendingItem {
  id: string;
  name: string;
  /** the whole prepared file as an object URL (to look at it before saving); null while it is being prepared */
  src: string | null;
  prepared: PreparedProof | null;
}

/**
 * Files picked in a form before its record exists (Record rent, Add expense, Sign lease). They are prepared straight
 * away (so a problem shows at once) and uploaded by uploadTo() once the record has been saved.
 */
export function usePendingProofs() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // the files are held as object URLs: let them go when the form closes
  useEffect(() => () => itemsRef.current.forEach((i) => i.src && URL.revokeObjectURL(i.src)), []);

  const add = useCallback(async (files: File[]) => {
    for (const f of files) {
      const id = nextId();
      setItems((xs) => [...xs, { id, name: f.name, src: null, prepared: null }]);
      try {
        const prepared = await prepareProof(f);
        const src = URL.createObjectURL(prepared.file);
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, prepared, src } : x)));
      } catch (err) {
        toast.error(proofErrorText(err, f.name));
        setItems((xs) => xs.filter((x) => x.id !== id));
      }
    }
  }, []);

  const remove = useCallback((id: string) => {
    setItems((xs) => {
      const gone = xs.find((x) => x.id === id);
      if (gone?.src) URL.revokeObjectURL(gone.src);
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

/** The clip in a form: the files picked so far; ✕ (Delete) in the full-screen view takes one out again. */
export function PendingProofClip({ pending }: { pending: PendingProofs }) {
  const picker = usePicker(pending.add);
  const [open, setOpen] = useState<number | null>(null);
  const ready = pending.items.filter((i) => i.prepared && i.src);
  const items: ViewItem[] = ready.map((i) => ({
    id: i.id,
    fileName: i.prepared!.name,
    image: i.prepared!.image,
    size: i.prepared!.file.size,
    src: i.src!,
    openHref: i.src!,
  }));
  const busy = pending.items.length > ready.length;
  useShowNewest(items.length, open, setOpen);
  const shown = open !== null && open < items.length ? open : null;
  return (
    <>
      <Clip count={items.length} busy={busy} onPick={picker.open} onOpen={() => setOpen(0)} />
      {picker.element}
      {shown !== null && (
        <ProofViewer
          items={items}
          index={shown}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDelete={(item) => pending.remove(item.id)}
          confirmDelete={false}
          onAttach={pending.add}
          attaching={busy}
        />
      )}
    </>
  );
}

/** 📎 on a list row that has attached files (with the count when more than one). */
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

/** how many attached files a list row has (lists include `_count.attachments`) */
export const proofCount = (row: { _count?: { attachments: number } }) => row._count?.attachments ?? 0;
