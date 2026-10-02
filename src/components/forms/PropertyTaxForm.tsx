"use client";
import { ReceiptText } from "lucide-react";
import { DateInput, Field, FormGrid, NumberInput, Select } from "@/components/ui";
import { api } from "@/lib/client";
import { toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import {
  propertyTaxCreateSchema,
  propertyTaxExistsMessage,
  propertyTaxRuleIssues,
  propertyTaxUpdateSchema,
  type PropertyTaxDTO,
  type TaxStatusValue,
} from "@/lib/schemas/property-tax";
import { ChoiceGroup } from "./controls";
import { unitOptions, usePropertyTax, useUnits } from "./data";
import { FormActions, FormBody, FormNote, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm, type Issue } from "./useForm";

type Values = { unitId: string; year: number | null; amount: number | null; status: TaxStatusValue; paymentDate: string };

export interface PropertyTaxFormProps extends BaseFormProps<PropertyTaxDTO> {
  tax?: PropertyTaxDTO | null;
  defaults?: Partial<Values>;
}

const taxNote = (amount: number | null) =>
  amount ? (
    <>
      Marking it <b>Paid</b> adds a <b>{formatINR(amount, amount % 1 !== 0)}</b> expense under Property Tax automatically — don&rsquo;t add it again in
      Expenses.
    </>
  ) : (
    <>
      Marking it <b>Paid</b> adds the amount as an expense under Property Tax automatically.
    </>
  );

/** Property tax for one unit and year. Due → Paid creates the matching expense; Paid → Due removes it. */
export function PropertyTaxForm({ tax, defaults, onSaved, onCancel, frame = inlineFrame, submitLabel }: PropertyTaxFormProps) {
  const editing = Boolean(tax);
  const units = useUnits();
  const list = usePropertyTax();
  const thisYear = todayIST().getUTCFullYear();

  const rules = (v: Values): Issue[] => {
    const out: Issue[] = propertyTaxRuleIssues({ status: v.status, paymentDate: v.paymentDate || null });
    if (v.unitId && v.year) {
      const dupe = list.data?.items.find((t) => t.unitId === v.unitId && t.year === v.year && t.id !== tax?.id);
      if (dupe) out.push({ field: "year", message: propertyTaxExistsMessage(v.year, dupe.unit.name) });
    }
    return out;
  };

  const form = useForm<Values, PropertyTaxDTO>({
    initial: {
      unitId: tax?.unitId ?? defaults?.unitId ?? "",
      year: tax?.year ?? defaults?.year ?? thisYear,
      amount: tax?.amount ?? defaults?.amount ?? null,
      status: tax?.status ?? defaults?.status ?? "Due",
      paymentDate: toInputDate(tax?.paymentDate) || defaults?.paymentDate || "",
    },
    schema: editing ? propertyTaxUpdateSchema : propertyTaxCreateSchema,
    rules,
    toBody: (v) => ({ ...v, paymentDate: v.status === "Paid" ? v.paymentDate || null : null }),
    errorField: (err) => (/already recorded/i.test(err.message) ? "year" : undefined),
    submit: (body) =>
      tax ? api<PropertyTaxDTO>(`/api/property-tax/${tax.id}`, { method: "PUT", body }) : api<PropertyTaxDTO>("/api/property-tax", { method: "POST", body }),
    success: (r) => `Property tax ${r.year} · ${r.unit.name} · ${r.status === "Paid" ? "paid" : "due"}`,
    onSaved,
  });
  const v = form.values;

  const years: number[] = [];
  for (let y = thisYear + 1; y >= Math.min(thisYear - 12, v.year ?? thisYear); y--) years.push(y);

  const body = (
    <FormBody form={form}>
      <FormGrid cols={2}>
        <Field label="Unit" required error={form.error("unitId")}>
          <Select {...form.select("unitId")} placeholder="Choose a unit" options={unitOptions(units.data?.items, { keepId: tax?.unitId })} />
        </Field>
        <Field label="Tax year" required error={form.error("year")}>
          <Select
            name="year"
            value={v.year ? String(v.year) : ""}
            onChange={(e) => form.set("year", e.target.value ? Number(e.target.value) : null)}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </Field>
        <Field label="Amount" required error={form.error("amount")}>
          <NumberInput {...form.number("amount")} currency placeholder="4,820" data-autofocus />
        </Field>
        <Field label="Status" error={form.error("status")}>
          <ChoiceGroup
            name="status"
            value={v.status}
            onChange={(st) => form.setMany({ status: st, paymentDate: st === "Paid" ? v.paymentDate || toInputDate(todayIST()) : "" })}
            options={[
              { value: "Due", label: "Due", tone: "marigold" },
              { value: "Paid", label: "Paid", tone: "teal" },
            ]}
            block
          />
        </Field>
        {v.status === "Paid" && (
          <Field label="Paid on" required span="full" error={form.error("paymentDate")}>
            <DateInput {...form.date("paymentDate")} max={toInputDate(todayIST())} />
          </Field>
        )}
      </FormGrid>
      {(v.status === "Paid" && tax?.status !== "Paid") || !editing ? (
        <FormNote icon={<ReceiptText aria-hidden />}>{taxNote(v.amount)}</FormNote>
      ) : tax?.status === "Paid" && v.status === "Due" ? (
        <FormNote tone="warn">Setting it back to Due removes the matching expense from your Expenses.</FormNote>
      ) : null}
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save" : "Add property tax")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}

type PaidValues = { paymentDate: string };

/** One-step "Mark paid" for a Due row: just the payment date. */
export function MarkTaxPaidForm({ tax, onSaved, onCancel, frame = inlineFrame }: BaseFormProps<PropertyTaxDTO> & { tax: PropertyTaxDTO }) {
  const form = useForm<PaidValues, PropertyTaxDTO>({
    initial: { paymentDate: toInputDate(todayIST()) },
    schema: propertyTaxUpdateSchema,
    rules: (v) => propertyTaxRuleIssues({ status: "Paid", paymentDate: v.paymentDate || null }),
    toBody: (v) => ({ status: "Paid", paymentDate: v.paymentDate || null }),
    submit: (body) => api<PropertyTaxDTO>(`/api/property-tax/${tax.id}`, { method: "PUT", body }),
    success: (r) => `Property tax ${r.year} paid · ${r.unit.name} · ${formatINR(r.amount)}`,
    onSaved,
  });
  const body = (
    <FormBody form={form}>
      <Field label="Paid on" required error={form.error("paymentDate")}>
        <DateInput {...form.date("paymentDate")} max={toInputDate(todayIST())} data-autofocus />
      </Field>
      <FormNote icon={<ReceiptText aria-hidden />}>{taxNote(tax.amount)}</FormNote>
    </FormBody>
  );
  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel="Mark paid" />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
