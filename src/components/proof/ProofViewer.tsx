"use client";
// Full-screen view of a record's attached files (owner, 10/10/2026): the photo as large as the screen allows (or a PDF
// card that opens the PDF), ‹ › / arrow keys / swipe between files, and round gold buttons: Attach more · Save · Open ·
// Delete · Close. Works for saved files and for files picked in a form that is not saved yet.
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass, confirmDialog, cx, toast, useFocusTrap, useScrollLock } from "@/components/ui";
import { sizeText } from "@/lib/attachment-rules";
import { attachmentUrl, type AttachmentDTO } from "@/lib/schemas/attachment";
import { ACCEPT } from "./prepare";
import s from "./proof.module.css";

/** One file in the view: a saved attachment, or a file picked in a form (a local object URL). */
export interface ViewItem {
  id: string;
  fileName: string;
  image: boolean;
  size: number;
  src: string;
  /** saved files only */
  saveHref?: string;
  openHref: string;
}

export const viewItem = (a: AttachmentDTO): ViewItem => ({
  id: a.id,
  fileName: a.fileName,
  image: a.image,
  size: a.size,
  src: attachmentUrl(a.id),
  saveHref: attachmentUrl(a.id, { download: true }),
  openHref: attachmentUrl(a.id),
});

export function ProofViewer({
  items,
  index,
  onIndex,
  onClose,
  onDelete,
  confirmDelete = true,
  onAttach,
  attaching,
}: {
  items: ViewItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** take the file away (the viewer asks first when confirmDelete) */
  onDelete: (item: ViewItem) => Promise<void> | void;
  confirmDelete?: boolean;
  /** add more files from here */
  onAttach?: (files: File[]) => void;
  attaching?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useFocusTrap(ref, true, onClose);
  useScrollLock(true);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const swipe = useRef<{ x: number; moved: boolean } | null>(null);
  const a = items[index];
  if (!a) return null;
  const many = items.length > 1;
  const go = (step: number) => many && onIndex((index + step + items.length) % items.length);

  const remove = async () => {
    if (confirmDelete) {
      const ok = await confirmDialog({
        title: a.image ? "Delete this photo?" : "Delete this PDF?",
        confirmLabel: "Delete",
        tone: "danger",
      });
      if (!ok) return;
    }
    setDeleting(true);
    try {
      await onDelete(a);
      if (items.length === 1) onClose();
      else if (index === items.length - 1) onIndex(index - 1);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      ref={ref}
      className={s.viewer}
      role="dialog"
      aria-modal="true"
      aria-label={a.fileName}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        else if (e.key === "ArrowRight") go(1);
      }}
    >
      <div className={s.bar}>
        <div className={s.title}>
          {many && (
            <span className={s.count}>
              {index + 1} / {items.length}
            </span>
          )}
          <span className={s.name}>{a.fileName}</span>
        </div>
        <div className={s.tools}>
          {onAttach && (
            <>
              <button
                type="button"
                className={s.round}
                onClick={() => picker.current?.click()}
                disabled={attaching}
                aria-label="Attach more files"
                title="Attach"
              >
                {attaching ? <Loader2 className={s.spinIcon} aria-hidden /> : <Paperclip aria-hidden />}
              </button>
              <input
                ref={picker}
                className={s.input}
                type="file"
                accept={ACCEPT}
                multiple
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length) onAttach(files);
                }}
              />
            </>
          )}
          {a.saveHref && (
            <a className={s.round} href={a.saveHref} aria-label="Save this file" title="Save">
              <Download aria-hidden />
            </a>
          )}
          <a className={s.round} href={a.openHref} target="_blank" rel="noopener" aria-label="Open in a new tab" title="Open">
            <ExternalLink aria-hidden />
          </a>
          <button type="button" className={s.round} onClick={remove} disabled={deleting} aria-label="Delete this file" title="Delete">
            <Trash2 aria-hidden />
          </button>
          <button type="button" className={s.round} onClick={onClose} aria-label="Close" title="Close">
            <X aria-hidden />
          </button>
        </div>
      </div>

      <div
        className={s.stage}
        onPointerDown={(e) => (swipe.current = { x: e.clientX, moved: false })}
        onPointerMove={(e) => {
          if (swipe.current && Math.abs(e.clientX - swipe.current.x) > 10) swipe.current.moved = true;
        }}
        onPointerUp={(e) => {
          const sw = swipe.current;
          if (sw && Math.abs(e.clientX - sw.x) > 60) go(e.clientX < sw.x ? 1 : -1);
        }}
        onClick={(e) => {
          // a tap on the dark space around the file closes the view (not the end of a swipe)
          if (e.target === e.currentTarget && !swipe.current?.moved) onClose();
          swipe.current = null;
        }}
      >
        {a.image ? (
          <>
            {loadedId !== a.id && <Loader2 className={s.spin} aria-hidden />}
            {/* eslint-disable-next-line @next/next/no-img-element -- private file behind the login */}
            <img
              key={a.id}
              src={a.src}
              alt={a.fileName}
              draggable={false}
              className={s.photo}
              data-loaded={loadedId === a.id || undefined}
              onLoad={() => setLoadedId(a.id)}
            />
          </>
        ) : (
          <div className={s.pdf}>
            <FileText aria-hidden />
            <span className={s.pdfName}>{a.fileName}</span>
            <span className={s.pdfSize}>PDF · {sizeText(a.size)}</span>
            {/* a plain link (not next/link): the PDF is a file, never prefetched */}
            <a className={buttonClass({ variant: "primary" })} href={a.openHref} target="_blank" rel="noopener">
              <ExternalLink aria-hidden />
              Open PDF
            </a>
          </div>
        )}
        {many && (
          <>
            <button type="button" className={cx(s.round, s.nav, s.prev)} onClick={() => go(-1)} aria-label="Previous file">
              <ChevronLeft aria-hidden />
            </button>
            <button type="button" className={cx(s.round, s.nav, s.next)} onClick={() => go(1)} aria-label="Next file">
              <ChevronRight aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
