"use client";
import { Landmark, Lock } from "lucide-react";
import { PendingProofClip, ProofClip, usePendingProofs } from "@/components/proof";
import { Button, DateInput, Field, FormGrid, NumberInput, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/client";
import { toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { PROPERTY_TAX_CATEGORY } from "@/lib/schemas/expense-category";
import { expenseCreateSchema, expenseUpdateSchema, type ExpenseDTO } from "@/lib/schemas/expense";
import { Dot } from "./controls";
import { unitOptions, useCategories, useUnits } from "./data";
import { FormActions, FormBody, FormNote, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";
import s from "./forms.module.css";

type Values = { expenseDate: string; amount: number | null; categoryId: string; unitId: string; description: string };

export interface ExpenseFormProps extends BaseFormProps<ExpenseDTO> {
  expense?: ExpenseDTO | null;
  defaults?: Partial<Values>;
}

/** Money already spent on the property (cash basis) — for one unit or the whole plot. */
export function ExpenseForm({ expense, defaults, onSaved, onCancel, frame = inlineFrame, submitLabel }: ExpenseFormProps) {
  const editing = Boolean(expense);
  const linked = Boolean(expense?.propertyTaxId);
  const units = useUnits();
  const cats = useCategories();
  // the bill picked while adding — uploaded once the expense is saved (a saved one's clip uploads straight away)
  const pending = usePendingProofs();
  const form = useForm<Values, ExpenseDTO>({
    initial: {
      expenseDate: toInputDate(expense?.expenseDate) || defaults?.expenseDate || toInputDate(todayIST()),
      amount: expense?.amount ?? defaults?.amount ?? null,
      categoryId: expense?.categoryId ?? defaults?.categoryId ?? "",
      unitId: expense ? (expense.unitId ?? "") : (defaults?.unitId ?? ""),
      description: expense?.description ?? defaults?.description ?? "",
    },
    schema: editing ? expenseUpdateSchema : expenseCreateSchema,
    toBody: (v) => ({ ...v, unitId: v.unitId || null }),
    submit: (body) =>
      expense ? api<ExpenseDTO>(`/api/expenses/${expense.id}`, { method: "PUT", body }) : api<ExpenseDTO>("/api/expenses", { method: "POST", body }),
    success: (r) => (editing ? "Expense saved" : `Expense added · ${formatINR(r.amount, r.amount % 1 !== 0)} ${r.category.name}`),
    onSaved: (r) => {
      if (!editing) void pending.uploadTo({ expenseId: r.id });
      onSaved?.(r);
    },
  });
  const v = form.values;
  const category = cats.data?.items.find((c) => c.id === v.categoryId);
  const isTaxCategory = category?.name === PROPERTY_TAX_CATEGORY.name;

  const body = (
    <FormBody form={form}>
      {linked && (
        <FormNote tone="warn" icon={<Lock aria-hidden />}>
          This expense was added automatically when property tax was marked <b>Paid</b>. Change it in <b>Data → Property tax</b>.
        </FormNote>
      )}
      <fieldset disabled={linked} className={s.fieldset}>
        <FormGrid cols={2}>
          <Field label="Amount" required error={form.error("amount")}>
            <NumberInput {...form.number("amount")} currency placeholder="2,500" data-autofocus />
          </Field>
          <Field label="Paid on" required error={form.error("expenseDate")} hint="Planned work goes in To-dos">
            <DateInput {...form.date("expenseDate")} max={toInputDate(todayIST())} />
          </Field>
          <Field label="Category" required error={form.error("categoryId")}>
            <Select
              {...form.select("categoryId")}
              placeholder="Choose a category"
              icon={category ? <Dot color={category.color} /> : undefined}
              options={(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="For" error={form.error("unitId")} hint={v.unitId ? undefined : "Shared costs: compound wall, borewell, legal fees"}>
            <Select {...form.select("unitId")} options={[{ value: "", label: "Whole plot (shared)" }, ...unitOptions(units.data?.items, { keepId: expense?.unitId })]} />
          </Field>
          <Field label="What was it for?" aside="optional" span="full" error={form.error("description")}>
            {/* the clip (owner, 10/10/2026: clip only, no files showing) in the corner of the "What for" box */}
            <Textarea
              {...form.text("description")}
              placeholder="e.g. Plumber — kitchen tap and tank float valve"
              suffix={linked ? undefined : expense ? <ProofClip owner={{ expenseId: expense.id }} /> : <PendingProofClip pending={pending} />}
            />
          </Field>
        </FormGrid>
      </fieldset>
      {isTaxCategory && !linked && (
        <FormNote icon={<Landmark aria-hidden />}>
          Property tax is easier to track in <b>Data → Property tax</b>: marking a year <b>Paid</b> adds this expense for you, so it is never counted twice.
        </FormNote>
      )}
    </FormBody>
  );

  return frame({
    body,
    actions: linked ? (
      onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          Close
        </Button>
      )
    ) : (
      <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save expense" : "Add expense")} />
    ),
    onSubmit: linked ? (e) => e?.preventDefault() : form.handleSubmit,
    dirty: form.dirty || pending.count > 0,
    busy: form.busy,
  });
}
