"use client";
// Property manager walking round the plot → to-dos: tick one off (with Undo), tap one to edit, add a new one.
import { Check, ListPlus } from "lucide-react";
import { Badge, Button, EmptyState, toast, cx, type BadgeTone } from "@/components/ui";
import { useActions } from "@/components/forms";
import { api, useMutation } from "@/lib/client";
import type { DashboardData } from "@/lib/dashboard-types";
import { daysBetween, formatDate } from "@/lib/dates";
import type { ActionDTO, PriorityValue } from "@/lib/schemas/action";
import { HudPanel } from "./HudPanel";
import { useFormDrawer } from "./FormDrawer";
import b from "./bits.module.css";

export interface NoticeBoardPanelProps {
  data: DashboardData;
  onClose?: () => void;
  side?: "right" | "inline";
  className?: string;
}

const PRIORITY_TONE: Record<PriorityValue, BadgeTone> = { High: "coral", Medium: "marigold", Low: "grey" };

function due(a: { dueDate: string | null; isOverdue: boolean }, today: string): { text: string; late: boolean } | null {
  if (!a.dueDate) return null;
  const d = daysBetween(new Date(today), new Date(a.dueDate));
  if (d < 0) return { text: `${-d} ${d === -1 ? "day" : "days"} late`, late: true };
  if (d === 0) return { text: "due today", late: false };
  if (d === 1) return { text: "due tomorrow", late: false };
  if (d <= 14) return { text: `in ${d} days`, late: false };
  return { text: `by ${formatDate(a.dueDate)}`, late: false };
}

export function NoticeBoardPanel({ data, onClose, side = "right", className }: NoticeBoardPanelProps) {
  const live = useActions("pending");
  const forms = useFormDrawer();
  const unitName = new Map(data.units.map((u) => [u.id, u.name]));
  const items =
    live.data?.items ??
    data.actions.pending.map((a) => ({ ...a, unit: a.unitId ? { id: a.unitId, name: unitName.get(a.unitId) ?? "Unit" } : null }) as unknown as ActionDTO);
  const late = items.filter((a) => a.isOverdue).length;

  return (
    <>
      <HudPanel
        side={side}
        eyebrow="Property manager · to-dos"
        title="Things to do"
        pinId="noticeboard"
        onClose={onClose}
        className={className}
        actions={
          <Button variant="primary" size="sm" icon={<ListPlus />} onClick={() => forms.open({ kind: "action" })}>
            Add a to-do
          </Button>
        }
      >
        <div className={b.boardHero}>
          <span className={b.boardCount}>
            <span className="num">{items.length}</span> {items.length === 1 ? "thing" : "things"} to do
          </span>
          {late > 0 ? <Badge tone="coral" marker size="sm">{late} late</Badge> : items.length > 0 ? <Badge tone="teal" marker size="sm">None late</Badge> : null}
        </div>
        {items.length === 0 ? (
          <EmptyState compact title="Nothing to do" />
        ) : (
          <ul className={b.todos}>
            {items.map((a) => (
              <Todo
                key={a.id}
                a={a}
                today={data.today}
                onEdit={() => forms.open({ kind: "action", title: "Edit to-do", props: { action: a } })}
              />
            ))}
          </ul>
        )}
      </HudPanel>
      {forms.element}
    </>
  );
}

function Todo({ a, today, onEdit }: { a: ActionDTO; today: string; onEdit: () => void }) {
  const m = useMutation((isDone: boolean) => api<ActionDTO>(`/api/actions/${a.id}/done`, { method: "POST", body: { isDone } }), {
    onSuccess: (r, isDone) =>
      toast.success(isDone ? `Done · ${r.title}` : `Back on the board · ${r.title}`, {
        action: isDone ? { label: "Undo", onClick: () => void m.run(false) } : undefined,
      }),
  });
  const d = due(a, today);
  return (
    <li className={cx(b.todo, a.isOverdue && b.todoLate)}>
      <button
        type="button"
        className={b.tick}
        aria-label={`Mark “${a.title}” done`}
        title="Mark done"
        disabled={m.loading}
        onClick={() => void m.run(true)}
      >
        <Check aria-hidden />
      </button>
      <button type="button" className={b.todoMain} onClick={onEdit}>
        <span className={b.todoTitle}>{a.title}</span>
        <span className={b.todoMeta}>
          {a.unit?.name ?? "Whole property"}
          {d && <span className={cx(d.late && b.lateText)}> · {d.text}</span>}
        </span>
      </button>
      {a.priority === "High" && (
        <Badge size="sm" tone={PRIORITY_TONE[a.priority]}>
          High
        </Badge>
      )}
    </li>
  );
}
