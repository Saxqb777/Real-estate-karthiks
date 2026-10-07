"use client";
import { Lock } from "lucide-react";
import { Field, FormGrid, Input } from "@/components/ui";
import { api } from "@/lib/client";
import {
  DEFAULT_CATEGORY_COLOR,
  categoryNameTakenMessage,
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  type ExpenseCategoryDTO,
} from "@/lib/schemas/expense-category";
import { Dot, SWATCHES, Swatches } from "./controls";
import { useCategories } from "./data";
import { FormActions, FormBody, FormNote, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm, type Issue } from "./useForm";
import s from "./forms.module.css";

type Values = { name: string; color: string };

export interface CategoryFormProps extends BaseFormProps<ExpenseCategoryDTO> {
  category?: ExpenseCategoryDTO | null;
}

/** An expense category. Built-in ones keep their name (reports rely on it) but can change colour. */
export function CategoryForm({ category, onSaved, onCancel, frame = inlineFrame, submitLabel, actionsLeft }: CategoryFormProps) {
  const editing = Boolean(category);
  const locked = Boolean(category?.isDefault);
  const cats = useCategories();
  const usedColors = new Set((cats.data?.items ?? []).map((c) => c.color.toUpperCase()));
  const freshColor = SWATCHES.find((c) => !usedColors.has(c)) ?? DEFAULT_CATEGORY_COLOR;

  const rules = (v: Values): Issue[] => {
    const name = v.name.trim().toLowerCase();
    const clash = name && cats.data?.items.find((c) => c.id !== category?.id && c.name.toLowerCase() === name);
    return clash ? [{ field: "name", message: categoryNameTakenMessage(clash.name) }] : [];
  };

  const form = useForm<Values, ExpenseCategoryDTO>({
    initial: { name: category?.name ?? "", color: category?.color ?? freshColor },
    schema: editing ? expenseCategoryUpdateSchema : expenseCategoryCreateSchema,
    rules,
    toBody: (v) => (locked ? { color: v.color } : v),
    errorField: (err) => (/already exists|can't be renamed/i.test(err.message) ? "name" : undefined),
    submit: (body) =>
      category
        ? api<ExpenseCategoryDTO>(`/api/expense-categories/${category.id}`, { method: "PUT", body })
        : api<ExpenseCategoryDTO>("/api/expense-categories", { method: "POST", body }),
    success: (r) => (editing ? `Saved · ${r.name}` : `Category added · ${r.name}`),
    onSaved,
  });
  const v = form.values;

  const body = (
    <FormBody form={form}>
      <FormGrid cols={1}>
        <Field
          label="Name"
          required
          error={form.error("name")}
          aside={
            locked ? (
              <span className={s.iconLabel}>
                <Lock aria-hidden /> built-in
              </span>
            ) : undefined
          }
        >
          <Input {...form.text("name")} icon={<Dot color={v.color} size={11} />} autoComplete="off" placeholder="e.g. Plumbing" disabled={locked} data-autofocus={!locked || undefined} />
        </Field>
        <Field label="Colour" hint="Used for this category in every chart, table and legend">
          <Swatches name="color" value={v.color} onChange={(c) => form.set("color", c)} />
        </Field>
        <Field label="Custom colour" error={form.error("color")}>
          <Input name="color" value={v.color} onChange={(e) => form.set("color", e.target.value)} autoComplete="off" placeholder="#4F9DFF" maxLength={7} />
        </Field>
      </FormGrid>
      {locked && (
        <FormNote icon={<Lock aria-hidden />}>
          <b>{category?.name}</b> is a built-in category — reports and the automatic property-tax expenses use it by name, so it can&rsquo;t be renamed or
          deleted. You can still change its colour.
        </FormNote>
      )}
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} left={actionsLeft} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save category" : "Add category")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
