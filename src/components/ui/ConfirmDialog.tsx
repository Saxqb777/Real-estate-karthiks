"use client";

import { TriangleAlert } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import styles from "./ConfirmDialog.module.css";

export interface ConfirmOptions {
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = destructive (coral button + warning mark). */
  tone?: "danger" | "primary";
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onClose: () => void;
  /** May return a promise — the button shows a spinner until it settles; the dialog closes on success. */
  onConfirm: () => void | Promise<unknown>;
}

/** Controlled confirmation dialog. For one-off checks prefer `await confirmDialog({...})`. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // caller surfaces the error (e.g. useMutation toasts it); keep the dialog open
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      role="alertdialog"
      eyebrow={tone === "danger" ? "Confirm — can't be undone" : "Confirm"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={run} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && (
        <div className={styles.row}>
          {tone === "danger" && (
            <span className={styles.mark} aria-hidden>
              <TriangleAlert />
            </span>
          )}
          <div className={styles.msg}>{message}</div>
        </div>
      )}
    </Modal>
  );
}

// ---- imperative API: `if (await confirmDialog({ title: "Delete unit?", tone: "danger" })) …`

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...options, resolve };
    emit();
  });
}

/** Mounted once by the app shell; renders requests from confirmDialog(). */
export function ConfirmHost() {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
    () => null,
  );
  const [last, setLast] = useState<Pending | null>(null);
  if (current && current !== last) setLast(current); // keep content during the exit animation
  const shown = current ?? last;
  const settle = (ok: boolean) => {
    if (!pending) return;
    pending.resolve(ok);
    pending = null;
    emit();
  };
  return (
    <ConfirmDialog
      open={Boolean(current)}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={shown?.title ?? ""}
      message={shown?.message}
      confirmLabel={shown?.confirmLabel}
      cancelLabel={shown?.cancelLabel}
      tone={shown?.tone}
    />
  );
}
