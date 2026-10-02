"use client";
import { ListTodo } from "lucide-react";
import { DateInput, Field, FormGrid, Input, Select, Toggle } from "@/components/ui";
import { api } from "@/lib/client";
import { toInputDate } from "@/lib/dates";
import { DEFAULT_ACTION_TYPE, actionCreateSchema, actionUpdateSchema, type ActionDTO, type PriorityValue } from "@/lib/schemas/action";
import { ChoiceGroup } from "./controls";
import { unitOptions, useUnits } from "./data";
import { FormActions, FormBody, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";

type Values = { title: string; type: string; priority: PriorityValue; dueDate: string; unitId: string; isDone: boolean };

export interface ActionFormProps extends BaseFormProps<ActionDTO> {
  action?: ActionDTO | null;
  defaults?: Partial<Values>;
}

export const ACTION_TYPES = ["Repair", "Rent", "Lease", "Tax", "Electricity", "Water", "Cleaning", "Paperwork", DEFAULT_ACTION_TYPE];

/** Something to do for the property (repairs, renewals, paperwork). */
export function ActionForm({ action, defaults, onSaved, onCancel, frame = inlineFrame, submitLabel }: ActionFormProps) {
  const editing = Boolean(action);
  const units = useUnits();
  const form = useForm<Values, ActionDTO>({
    initial: {
      title: action?.title ?? defaults?.title ?? "",
      type: action?.type ?? defaults?.type ?? DEFAULT_ACTION_TYPE,
      priority: action?.priority ?? defaults?.priority ?? "Medium",
      dueDate: toInputDate(action?.dueDate) || defaults?.dueDate || "",
      unitId: action ? (action.unitId ?? "") : (defaults?.unitId ?? ""),
      isDone: action?.isDone ?? false,
    },
    schema: editing ? actionUpdateSchema : actionCreateSchema,
    toBody: (v) => {
      const body: Record<string, unknown> = { title: v.title, type: v.type, priority: v.priority, dueDate: v.dueDate || null, unitId: v.unitId || null };
      if (editing) body.isDone = v.isDone;
      return body;
    },
    submit: (body) =>
      action ? api<ActionDTO>(`/api/actions/${action.id}`, { method: "PUT", body }) : api<ActionDTO>("/api/actions", { method: "POST", body }),
    success: (r) => (editing ? "To-do saved" : `To-do added · ${r.title}`),
    onSaved,
  });
  const v = form.values;

  const body = (
    <FormBody form={form}>
      <FormGrid cols={2}>
        <Field label="What needs doing?" required span="full" error={form.error("title")}>
          <Input {...form.text("title")} icon={<ListTodo />} autoComplete="off" placeholder="e.g. Fix the back unit's overhead tank float" data-autofocus />
        </Field>
        <Field label="Due by" aside="optional" error={form.error("dueDate")}>
          <DateInput {...form.date("dueDate")} />
        </Field>
        <Field label="For" error={form.error("unitId")}>
          <Select {...form.select("unitId")} options={[{ value: "", label: "Whole property" }, ...unitOptions(units.data?.items, { keepId: action?.unitId })]} />
        </Field>
        <Field label="Priority" error={form.error("priority")}>
          <ChoiceGroup
            name="priority"
            value={v.priority}
            onChange={(p) => form.set("priority", p)}
            options={[
              { value: "Low", label: "Low", tone: "sky" },
              { value: "Medium", label: "Medium", tone: "marigold" },
              { value: "High", label: "High", tone: "coral" },
            ]}
            block
          />
        </Field>
        <Field label="Kind" error={form.error("type")}>
          <Input {...form.text("type")} autoComplete="off" list="pe-action-types" placeholder={DEFAULT_ACTION_TYPE} />
          <datalist id="pe-action-types">
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        {editing && (
          <Field label="Status" span="full">
            <div data-field="isDone">
              <Toggle checked={v.isDone} onChange={(c) => form.set("isDone", c)} label={v.isDone ? "Done" : "Still to do"} />
            </div>
          </Field>
        )}
      </FormGrid>
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save to-do" : "Add to-do")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
