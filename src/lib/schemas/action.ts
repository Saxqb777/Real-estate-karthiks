// Action items (owner's to-do list): zod schemas for /api/actions, ordering + overdue rules, response types.
// Pure — safe to import in the UI.
import type { ActionItem, Prisma } from "@prisma/client";
import { z } from "zod";
import { todayIST } from "@/lib/dates";
import { zDateOrNull, zIdOrNull, zRequiredText } from "@/lib/validation";
import type { Serialized } from "@/lib/types";
import { zFlag } from "@/lib/validation";

export const PRIORITIES = ["Low", "Medium", "High"] as const;
export type PriorityValue = (typeof PRIORITIES)[number];
export const DEFAULT_ACTION_TYPE = "Custom";
export const ACTION_STATUSES = ["pending", "done", "all"] as const;

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** "Low" | "Medium" | "High", case-insensitive ("high" → "High"). */
const zPriority = z.preprocess(
  (v) => (typeof v === "string" ? PRIORITIES.find((p) => p.toLowerCase() === v.trim().toLowerCase()) ?? v : v),
  z.enum(PRIORITIES, { message: "must be Low, Medium or High" }),
);

const actionFields = {
  title: zRequiredText("Title", 200),
  type: zRequiredText("Type", 40),
  priority: zPriority,
  dueDate: zDateOrNull,
  /** null / "" = not tied to a unit */
  unitId: zIdOrNull,
};

/** POST /api/actions. Defaults: type "Custom", priority Medium. */
export const actionCreateSchema = z.object({
  ...actionFields,
  type: z.preprocess((v) => (isBlank(v) ? DEFAULT_ACTION_TYPE : v), actionFields.type),
  priority: z.preprocess((v) => (isBlank(v) ? "Medium" : v), zPriority),
});

/** PUT /api/actions/[id]: partial. isDone may be sent here too (doneAt is kept in step). */
export const actionUpdateSchema = z.object({ ...actionFields, isDone: zFlag }).partial();

/** POST /api/actions/[id]/done — body optional; isDone defaults to true. */
export const actionDoneSchema = z.object({ isDone: z.preprocess((v) => (isBlank(v) ? true : v), zFlag) });

/** GET /api/actions?status=pending (default) | done | all */
export const actionListQuerySchema = z.object({
  status: z.preprocess(
    blankToUndefined,
    z.enum(ACTION_STATUSES, { message: "must be pending, done or all" }).default("pending"),
  ),
});

export type ActionCreate = z.output<typeof actionCreateSchema>;
export type ActionUpdate = z.output<typeof actionUpdateSchema>;
export type ActionCreateInput = z.input<typeof actionCreateSchema>;

/** Every action response: the row + unit (null = not tied to a unit) + isOverdue. */
export type ActionDTO = Serialized<ActionItem> & { unit: { id: string; name: string } | null; isOverdue: boolean };

/** Prisma include for every action response (pair with toActionDTO). */
export const actionInclude = { unit: { select: { id: true, name: true } } } satisfies Prisma.ActionItemInclude;

// ---- rules (pure; the API and UI share them so lists sort identically) -------------------------

type DateLike = Date | string;
const ms = (d: DateLike) => (typeof d === "string" ? new Date(d) : d).getTime();

export const PRIORITY_RANK: Record<PriorityValue, number> = { High: 0, Medium: 1, Low: 2 };

/** A pending action whose due date is before today (IST). Done actions are never overdue. */
export function isActionOverdue(a: { dueDate: DateLike | null; isDone: boolean }, today: Date = todayIST()): boolean {
  return !a.isDone && a.dueDate !== null && ms(a.dueDate) < today.getTime();
}

interface Sortable {
  isDone: boolean;
  dueDate: DateLike | null;
  priority: PriorityValue;
  doneAt: DateLike | null;
  createdAt: DateLike;
}

/**
 * Pending first: due date ascending (no date last), then priority High → Low, then oldest first.
 * Done after: most recently completed first.
 */
export function compareActions(a: Sortable, b: Sortable): number {
  if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
  if (a.isDone) return (b.doneAt ? ms(b.doneAt) : 0) - (a.doneAt ? ms(a.doneAt) : 0) || ms(b.createdAt) - ms(a.createdAt);
  const ad = a.dueDate ? ms(a.dueDate) : Infinity;
  const bd = b.dueDate ? ms(b.dueDate) : Infinity;
  return (
    (ad === bd ? 0 : ad < bd ? -1 : 1) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    ms(a.createdAt) - ms(b.createdAt)
  );
}

/** Response shape: the row + isOverdue. */
export function toActionDTO<A extends { dueDate: DateLike | null; isDone: boolean }>(a: A, today: Date = todayIST()) {
  return { ...a, isOverdue: isActionOverdue(a, today) };
}

/** isDone + doneAt for a (re)marking: keeps the original doneAt when it was already done, clears it when reopened. */
export function doneState(current: { isDone: boolean; doneAt: Date | null }, isDone: boolean, now: Date = new Date()) {
  return { isDone, doneAt: isDone ? (current.isDone && current.doneAt ? current.doneAt : now) : null };
}
