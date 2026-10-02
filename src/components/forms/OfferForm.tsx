"use client";
import { DateInput, Field, FormGrid, NumberInput, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/client";
import { toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { offerCreateSchema, offerUpdateSchema, type OfferDTO } from "@/lib/schemas/offer";
import { useUnits, unitOptions } from "./data";
import { FormActions, FormBody, FormNote, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";

type Values = { unitId: string; amount: number | null; offerDate: string; notes: string };

export interface OfferFormProps extends BaseFormProps<OfferDTO> {
  offer?: OfferDTO | null;
  /** Fixes the unit (hides the picker). */
  unitId?: string;
  /** Shown as context: "Bought for ₹38,50,000". */
  purchasePrice?: number | null;
}

/** A purchase offer someone made for a unit — paper value, never cash. The highest one becomes "Best offer". */
export function OfferForm({ offer, unitId, purchasePrice, onSaved, onCancel, frame = inlineFrame, submitLabel, actionsLeft }: OfferFormProps) {
  const editing = Boolean(offer);
  const units = useUnits();
  const fixedUnit = offer?.unitId ?? unitId;
  const form = useForm<Values, OfferDTO>({
    initial: {
      unitId: fixedUnit ?? "",
      amount: offer?.amount ?? null,
      offerDate: toInputDate(offer?.offerDate ?? todayIST()),
      notes: offer?.notes ?? "",
    },
    schema: editing ? offerUpdateSchema : offerCreateSchema,
    toBody: (v) => (editing ? { amount: v.amount, offerDate: v.offerDate, notes: v.notes } : v),
    submit: (body) =>
      offer ? api<OfferDTO>(`/api/offers/${offer.id}`, { method: "PUT", body }) : api<OfferDTO>("/api/offers", { method: "POST", body }),
    success: (r) => (editing ? "Offer updated" : `Offer recorded · ${formatINR(r.amount)}`),
    onSaved,
  });

  const body = (
    <FormBody form={form}>
      <FormGrid cols={2}>
        {!fixedUnit && (
          <Field label="Unit" required span="full" error={form.error("unitId")}>
            <Select {...form.select("unitId")} placeholder="Choose a unit" options={unitOptions(units.data?.items)} />
          </Field>
        )}
        <Field label="Offer amount" required error={form.error("amount")}>
          <NumberInput {...form.number("amount")} currency placeholder="45,00,000" data-autofocus />
        </Field>
        <Field label="Offered on" required error={form.error("offerDate")}>
          <DateInput {...form.date("offerDate")} max={toInputDate(todayIST())} />
        </Field>
        <Field label="Who offered / notes" aside="optional" span="full" error={form.error("notes")}>
          <Textarea {...form.text("notes")} placeholder="e.g. Neighbour Mr. Raman, cash buyer, valid till Diwali" />
        </Field>
      </FormGrid>
      {purchasePrice ? (
        <FormNote>
          Offers are <b>paper value</b> — no money moves. You bought this unit for <b>{formatINR(purchasePrice)}</b>; the highest offer
          becomes its <b>Best offer</b> and its &ldquo;Worth now (est.)&rdquo;.
        </FormNote>
      ) : null}
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} left={actionsLeft} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save offer" : "Record offer")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
