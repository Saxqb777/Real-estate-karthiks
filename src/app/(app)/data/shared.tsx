"use client";
// Building blocks shared by the Data tabs: the panel, view/edit record drawer, delete button, totals footer label.
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Drawer, Panel, Skeleton, confirmDialog } from "@/components/ui";
import { ScopeChip, type FormFrame } from "@/components/forms";
import { api, useMutation } from "@/lib/client";
import { MONTHS_SHORT } from "@/lib/dates";
import s from "./data.module.css";

// ---------------------------------------------------------------- media

const narrowQuery = "(max-width: 767px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(narrowQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** true on phones — tables switch to a compact column set. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(narrowQuery).matches, () => false);
}

// ---------------------------------------------------------------- panel

export function DataPanel({
  eyebrow,
  title,
  actions,
  toolbar,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  /** Filters row under the header. */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  // Phones: the header keeps only the title; buttons move into the toolbar row so nothing gets squeezed.
  const narrow = useNarrow();
  return (
    <Panel fill padding="none" eyebrow={eyebrow} title={title} actions={narrow ? undefined : actions} className={s.panel}>
      {(toolbar || (narrow && actions)) && (
        <div className={s.toolbar}>
          {narrow && actions && <div className={s.toolbarActions}>{actions}</div>}
          {toolbar}
        </div>
      )}
      {children}
    </Panel>
  );
}

/** "TOTAL · [FY 2026-27] · 12 payments" for table footers. */
export function TotalLabel({ scope, count, noun }: { scope: ReactNode; count: number; noun: [string, string] }) {
  return (
    <span className={s.totalLabel}>
      <span>Total</span>
      <ScopeChip>{scope}</ScopeChip>
      <span className={s.totalCount}>
        {count} {count === 1 ? noun[0] : noun[1]}
      </span>
    </span>
  );
}

/** Two-line cell: primary text + faint secondary line. */
export function Stack2({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  return (
    <span className={s.stack2}>
      <span className={s.top}>{top}</span>
      {bottom && <span className={s.bottom}>{bottom}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- record drawer (view ⇄ edit in one panel)

/**
 * Frame for editing a record INSIDE an open drawer: the form replaces the details in the drawer body and its
 * buttons stick to the bottom edge, so the drawer itself never re-mounts when switching view ⇄ edit.
 */
export const editInDrawer: FormFrame = ({ body, actions, onSubmit }) => (
  <form noValidate onSubmit={onSubmit} className={s.editForm}>
    {body}
    <div className={s.editActions}>{actions}</div>
  </form>
);

/** Details drawer: `view` + footer actions, or `edit` (a form using editInDrawer) while editing. */
export function RecordDrawer({
  open,
  onClose,
  eyebrow,
  title,
  editing,
  view,
  edit,
  viewActions,
  width = 540,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: ReactNode;
  title: ReactNode;
  editing: boolean;
  view: ReactNode;
  edit: ReactNode;
  viewActions: ReactNode;
  width?: number;
}) {
  return (
    <Drawer open={open} onClose={onClose} eyebrow={eyebrow} title={title} width={width} footer={editing || !viewActions ? undefined : <div className={s.footRow}>{viewActions}</div>} closeOnBackdrop={!editing}>
      {editing ? edit : view}
    </Drawer>
  );
}

/** Focus the first field after switching a drawer to edit mode. */
export function focusFirstField() {
  requestAnimationFrame(() => {
    const dlg = document.querySelector<HTMLElement>('[role="dialog"]:last-of-type');
    dlg?.querySelector<HTMLElement>("[data-autofocus], input:not([disabled]), select, textarea")?.focus();
  });
}

export function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="primary" icon={<Pencil />} onClick={onClick}>
      {label}
    </Button>
  );
}

/**
 * Delete with a confirmation. When `blocked` holds a reason (the same message the API would send), the button is
 * disabled and the reason is shown instead — the owner learns why before trying.
 */
export function DeleteButton({
  path,
  what,
  confirmMessage,
  blocked,
  onDeleted,
  success,
}: {
  path: string;
  what: string;
  confirmMessage?: ReactNode;
  blocked?: string | null;
  onDeleted?: () => void;
  success?: string;
}) {
  const del = useMutation(() => api(path, { method: "DELETE" }), { success: success ?? `Deleted ${what}`, onSuccess: () => onDeleted?.() });
  const run = async () => {
    const ok = await confirmDialog({ title: `Delete ${what}?`, message: confirmMessage, confirmLabel: "Delete", tone: "danger" });
    if (ok) await del.run();
  };
  return (
    <Button variant="ghost" icon={<Trash2 />} onClick={run} loading={del.loading} disabled={Boolean(blocked)} title={blocked ?? undefined} className={s.deleteBtn}>
      Delete
    </Button>
  );
}

/** Spacer that pushes later footer buttons to the right. */
export const Spacer = () => <span className={s.spacer} aria-hidden />;

// ---------------------------------------------------------------- detail blocks

export function DetailHero({ label, value, tone, scope, sub }: { label: ReactNode; value: ReactNode; tone?: "teal" | "coral" | "marigold"; scope?: ReactNode; sub?: ReactNode }) {
  return (
    <div className={s.hero} data-tone={tone}>
      <div className={s.heroLabel}>
        <span>{label}</span>
        {scope && <ScopeChip>{scope}</ScopeChip>}
      </div>
      <div className={`${s.heroValue} num`}>{value}</div>
      {sub && <div className={s.heroSub}>{sub}</div>}
    </div>
  );
}

export function DetailSection({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.dsection}>
      <header className={s.dsectionHead}>
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Blocked-action explanation inside a drawer. */
export function BlockedNote({ children }: { children: ReactNode }) {
  return <p className={s.blocked}>{children}</p>;
}

// ---------------------------------------------------------------- selection

/**
 * Which record's drawer is open (+ edit mode). `shown` keeps the last id while the drawer slides out.
 * `openId` lets another tab ask this one to open a record ("Open lease" from a tenant).
 */
export function useSelection(openId?: string | null, onOpened?: () => void) {
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const select = useCallback((id: string | null) => {
    setSelected(id);
    setEditing(false);
    if (id) setShown(id);
  }, []);
  const opened = useRef(onOpened);
  useEffect(() => {
    opened.current = onOpened;
  });
  useEffect(() => {
    if (!openId) return;
    select(openId);
    opened.current?.();
  }, [openId, select]);
  const close = useCallback(() => select(null), [select]);
  const edit = useCallback(() => {
    setEditing(true);
    focusFirstField();
  }, []);
  return { selected, shown, open: selected !== null, editing, setEditing, select, close, edit };
}

/** Create-drawer state: `key` changes on every open so the form starts fresh. */
export function useCreate() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return {
    open,
    key,
    start: useCallback(() => {
      setKey((k) => k + 1);
      setOpen(true);
    }, []),
    close: useCallback(() => setOpen(false), []),
  };
}

/** Run `fn` whenever the N-key signal increments (not on mount). */
export function useNewSignal(signal: number, fn: () => void) {
  const first = useRef(signal);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (signal !== first.current) latest.current();
  }, [signal]);
}

/** "Oct 2026" from a payment ({periodMonth, periodYear}) or a period ({month, year}). */
export function shortPeriod(p: { periodMonth: number; periodYear: number } | { month: number; year: number }): string {
  const [m, y] = "periodMonth" in p ? [p.periodMonth, p.periodYear] : [p.month, p.year];
  return `${MONTHS_SHORT[m - 1] ?? "?"} ${y}`;
}

/** Placeholder while a record loads (or the reason it couldn't). */
export function DrawerLoading({ error }: { error?: string }) {
  if (error) return <p className={s.blocked}>{error}</p>;
  return (
    <div className={s.detail} aria-busy="true">
      <Skeleton block height={92} />
      <Skeleton lines={4} />
      <Skeleton block height={140} />
    </div>
  );
}
