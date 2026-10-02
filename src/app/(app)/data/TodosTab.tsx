"use client";
import { Check, ListTodo, Mail, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, EmptyState, Modal, StatusPill, Table, toast, type BadgeTone, type Column } from "@/components/ui";
import { ActionForm, ChoiceGroup, Facts, drawerFrame, useActions } from "@/components/forms";
import { api, useApi, useMutation, type ApiClientError } from "@/lib/client";
import { daysBetween, formatDate, todayIST } from "@/lib/dates";
import type { ActionDTO, PriorityValue } from "@/lib/schemas/action";
import { DataPanel, DeleteButton, DrawerLoading, DetailHero, EditButton, RecordDrawer, Spacer, Stack2, editInDrawer, useCreate, useNarrow, useNewSignal, useSelection } from "./shared";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

type Status = "pending" | "done" | "all";
const PRIORITY_TONE: Record<PriorityValue, BadgeTone> = { High: "coral", Medium: "marigold", Low: "grey" };

type EmailResult = { sent: true; id: string } | { sent: false; skipped: true; reason: string; preview: { to: string; subject: string; text: string } };

function dueText(a: ActionDTO): { text: string; overdue: boolean } | null {
  if (!a.dueDate) return null;
  if (a.isDone) return { text: formatDate(a.dueDate), overdue: false };
  const d = daysBetween(todayIST(), new Date(a.dueDate));
  if (d < 0) return { text: `${-d} day${d === -1 ? "" : "s"} late`, overdue: true };
  if (d === 0) return { text: "today", overdue: false };
  if (d === 1) return { text: "tomorrow", overdue: false };
  return { text: formatDate(a.dueDate), overdue: false };
}

/** Round check button: mark done / reopen, with undo in the toast. */
function DoneToggle({ a }: { a: ActionDTO }) {
  const m = useMutation((isDone: boolean) => api<ActionDTO>(`/api/actions/${a.id}/done`, { method: "POST", body: { isDone } }), {
    onSuccess: (r, isDone) =>
      toast.success(isDone ? `Done · ${r.title}` : `Back on the list · ${r.title}`, {
        action: { label: "Undo", onClick: () => void m.run(!isDone) },
      }),
  });
  return (
    <button
      type="button"
      className={s.check}
      data-on={a.isDone || undefined}
      aria-pressed={a.isDone}
      aria-label={a.isDone ? `Reopen “${a.title}”` : `Mark “${a.title}” done`}
      title={a.isDone ? "Reopen" : "Mark done"}
      disabled={m.loading}
      onClick={(e) => {
        e.stopPropagation();
        void m.run(!a.isDone);
      }}
    >
      <Check aria-hidden />
    </button>
  );
}

export function TodosTab({ openId, onOpened, newSignal }: TabProps) {
  const [status, setStatus] = useState<Status>("pending");
  const actions = useActions(status);
  const pending = useActions("pending");
  const narrow = useNarrow();
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);
  const router = useRouter();
  const [emailPreview, setEmailPreview] = useState<Extract<EmailResult, { sent: false }> | null>(null);

  const email = useMutation(() => api<EmailResult>("/api/actions/email-me", { method: "POST" }), {
    invalidate: false,
    toastError: false,
    onSuccess: (r) => {
      if (r.sent) toast.success("Email sent", { description: "Your pending to-dos are on their way to your inbox." });
      else setEmailPreview(r);
    },
    onError: (err: ApiClientError) => {
      if (/Settings/i.test(err.message)) toast.error(err.message, { action: { label: "Open Settings", onClick: () => router.push("/config#settings") } });
      else toast.error(err.message);
    },
  });

  const rows = actions.data?.items;
  const overdue = (pending.data?.items ?? []).filter((a) => a.isOverdue).length;
  const pendingCount = pending.data?.items.length ?? 0;

  const titleCell = (a: ActionDTO) => <Stack2 top={<span className={a.isDone ? s.doneText : s.strong}>{a.title}</span>} bottom={a.type !== "Custom" ? a.type : undefined} />;
  const due = (a: ActionDTO) => {
    const d = dueText(a);
    if (!d) return <span className="faint">—</span>;
    return d.overdue ? <StatusPill status="overdue" label={d.text} size="sm" /> : <span className="num">{d.text}</span>;
  };
  const priority = (a: ActionDTO) => (
    <Badge size="sm" tone={PRIORITY_TONE[a.priority]}>
      {a.priority}
    </Badge>
  );
  const footer = rows?.length ? (
    <span className={s.totalLabel}>
      {rows.length} {status === "done" ? "done" : status === "pending" ? "to do" : rows.length === 1 ? "to-do" : "to-dos"}
      {status !== "done" && overdue > 0 && <span className="neg"> · {overdue} late</span>}
    </span>
  ) : undefined;

  const columns: Column<ActionDTO>[] = narrow
    ? [
        { key: "check", header: "", width: 44, cell: (a) => <DoneToggle a={a} /> },
        { key: "title", header: "To-do", wrap: true, cell: (a) => <Stack2 top={<span className={a.isDone ? s.doneText : s.strong}>{a.title}</span>} bottom={[a.unit?.name ?? "Whole property", dueText(a)?.text].filter(Boolean).join(" · ")} />, footer },
        { key: "prio", header: "", align: "right", cell: priority },
      ]
    : [
        { key: "check", header: "", width: 48, cell: (a) => <DoneToggle a={a} /> },
        { key: "title", header: "To-do", wrap: true, cell: titleCell, footer },
        { key: "unit", header: "For", sortValue: (a) => a.unit?.name ?? "", cell: (a) => a.unit?.name ?? <span className="dim">Whole property</span> },
        { key: "due", header: "Due", sortValue: (a) => a.dueDate ?? "9999", cell: due },
        { key: "prio", header: "Priority", sortValue: (a) => ({ High: 0, Medium: 1, Low: 2 })[a.priority], cell: priority },
      ];

  return (
    <>
      <DataPanel
        eyebrow={pendingCount ? `${pendingCount} to do${overdue ? ` · ${overdue} late` : ""}` : "All clear"}
        title="To-dos"
        actions={
          <>
            <ChoiceGroup
              name="todoFilter"
              aria-label="Show"
              size="sm"
              value={status}
              onChange={setStatus}
              options={[
                { value: "pending", label: `To do ${pendingCount}` },
                { value: "done", label: "Done" },
                { value: "all", label: "All" },
              ]}
            />
            <Button size="sm" variant="secondary" icon={<Mail />} loading={email.loading} onClick={() => void email.run()} title="Email your pending to-dos to the address in Settings">
              Email me
            </Button>
            <Button variant="primary" size="sm" icon={<Plus />} onClick={create.start}>
              Add to-do
            </Button>
          </>
        }
      >
        <Table
          fill
          columns={columns}
          rows={rows}
          loading={actions.loading}
          rowKey={(a) => a.id}
          onRowClick={(a) => sel.select(a.id)}
          selectedKey={sel.selected}
          caption="To-dos"
          empty={
            <EmptyState
              compact={status !== "pending"}
              title={status === "pending" ? "Nothing to do — all clear" : status === "done" ? "Nothing finished yet" : "No to-dos yet"}
              description={status === "pending" ? "Repairs, renewals and paperwork you note down appear here, soonest first." : undefined}
              action={
                <Button size="sm" variant="primary" icon={<ListTodo />} onClick={create.start}>
                  Add to-do
                </Button>
              }
            />
          }
        />
      </DataPanel>

      <ActionForm
        key={`new-${create.key}`}
        frame={drawerFrame({ open: create.open, onClose: create.close, eyebrow: "To-dos", title: "Add a to-do" })}
        onCancel={create.close}
        onSaved={create.close}
      />
      <TodoDrawer sel={sel} />

      <Modal
        open={emailPreview !== null}
        onClose={() => setEmailPreview(null)}
        eyebrow="Email me"
        title="Nothing was sent"
        description={emailPreview?.reason}
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setEmailPreview(null)}>
            OK
          </Button>
        }
      >
        {emailPreview && (
          <div className={s.emailPreview}>
            <Facts
              items={[
                { label: "To", value: emailPreview.preview.to },
                { label: "Subject", value: emailPreview.preview.subject },
              ]}
            />
            <pre>{emailPreview.preview.text}</pre>
          </div>
        )}
      </Modal>
    </>
  );
}

function TodoDrawer({ sel }: { sel: ReturnType<typeof useSelection> }) {
  const detail = useApi<ActionDTO>(sel.shown ? `/api/actions/${sel.shown}` : null);
  const a = detail.data?.id === sel.shown ? detail.data : undefined;
  const d = a ? dueText(a) : null;
  const done = useMutation((isDone: boolean) => api<ActionDTO>(`/api/actions/${a!.id}/done`, { method: "POST", body: { isDone } }), {
    success: (r) => (r.isDone ? `Done · ${r.title}` : `Back on the list · ${r.title}`),
  });

  const view = a ? (
    <div className={s.detail}>
      <DetailHero
        label={a.isDone ? "Done" : d?.overdue ? "Late" : "To do"}
        tone={a.isDone ? "teal" : d?.overdue ? "coral" : "marigold"}
        value={<span className={s.heroText}>{a.title}</span>}
        sub={a.isDone && a.doneAt ? `Finished ${formatDate(a.doneAt)}` : d ? `Due ${d.text}` : "No due date"}
      />
      <Facts
        items={[
          { label: "For", value: a.unit?.name ?? "Whole property" },
          { label: "Due", value: a.dueDate ? formatDate(a.dueDate) : <span className="faint">no date</span>, num: Boolean(a.dueDate) },
          {
            label: "Priority",
            value: (
              <Badge size="sm" tone={PRIORITY_TONE[a.priority]}>
                {a.priority}
              </Badge>
            ),
          },
          { label: "Kind", value: a.type },
          { label: "Added", value: formatDate(a.createdAt), num: true },
        ]}
      />
    </div>
  ) : (
    <DrawerLoading error={detail.error?.message} />
  );

  return (
    <RecordDrawer
      open={sel.open}
      onClose={sel.close}
      eyebrow="To-do"
      title={a?.title ?? "To-do"}
      editing={sel.editing && Boolean(a)}
      view={view}
      edit={a && <ActionForm key={a.id} action={a} frame={editInDrawer} onCancel={() => sel.setEditing(false)} onSaved={() => sel.setEditing(false)} />}
      viewActions={
        a && (
          <>
            <DeleteButton path={`/api/actions/${a.id}`} what="this to-do" onDeleted={sel.close} confirmMessage={`“${a.title}”`} />
            <Spacer />
            <Button variant="secondary" icon={a.isDone ? <RotateCcw /> : <Check />} loading={done.loading} onClick={() => void done.run(!a.isDone)}>
              {a.isDone ? "Reopen" : "Mark done"}
            </Button>
            <EditButton onClick={sel.edit} />
          </>
        )
      }
    />
  );
}
