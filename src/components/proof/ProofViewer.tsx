"use client";
// Full-screen view of a record's proof files (owner, 10/10/2026): the photo as large as the screen allows (or a PDF card
// that opens the PDF), ‹ › / arrow keys / swipe between files, and Save · Open · Delete · Close as round gold buttons.
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass, confirmDialog, cx, toast, useFocusTrap, useScrollLock } from "@/components/ui";
import { sizeText } from "@/lib/attachment-rules";
import { api, invalidate } from "@/lib/client";
import { attachmentUrl, type AttachmentDTO } from "@/lib/schemas/attachment";
import s from "./proof.module.css";

export function ProofViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: AttachmentDTO[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
    const ok = await confirmDialog({ title: a.image ? "Delete this photo?" : "Delete this PDF?", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    setDeleting(true);
    try {
      await api(`/api/attachments/${a.id}`, { method: "DELETE" });
      if (items.length === 1) onClose();
      else if (index === items.length - 1) onIndex(index - 1);
      invalidate("/api/");
      toast.success(a.image ? "Photo deleted" : "PDF deleted");
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
          <a className={s.round} href={attachmentUrl(a.id, { download: true })} aria-label="Save this file" title="Save">
            <Download aria-hidden />
          </a>
          <a className={s.round} href={attachmentUrl(a.id)} target="_blank" rel="noopener" aria-label="Open in a new tab" title="Open">
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
              src={attachmentUrl(a.id)}
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
            <a className={buttonClass({ variant: "primary" })} href={attachmentUrl(a.id)} target="_blank" rel="noopener">
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
