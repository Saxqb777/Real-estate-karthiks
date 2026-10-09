"use client";
import { Mail, Phone, Type, UserRound } from "lucide-react";
import { Field, FormGrid, Input, NumberInput, Select, Toggle } from "@/components/ui";
import { api } from "@/lib/client";
import { formatINR } from "@/lib/format";
import { DATE_FORMATS, settingsSchema, type SettingsDTO } from "@/lib/schemas/settings";
import { FormActions, FormBody, FormSection, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";
import s from "./forms.module.css";

type Values = {
  brandName: string;
  subtitle: string;
  ownerEmail: string;
  currency: string;
  dateFormat: string;
  rentDueDay: number | null;
  lateFeeEnabled: boolean;
  lateFeeAmount: number | null;
  lateFeeGraceDays: number | null;
  renewalReminderDays: number | null;
  taxCollectorName: string;
  taxCollectorPhone: string;
};

export interface SettingsFormProps extends BaseFormProps<SettingsDTO> {
  settings: SettingsDTO;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** App-wide settings: name on receipts, when rent is due, late fees, where to-do emails go. */
export function SettingsForm({ settings, onSaved, onCancel, frame = inlineFrame, submitLabel }: SettingsFormProps) {
  const form = useForm<Values, SettingsDTO>({
    initial: {
      brandName: settings.brandName,
      subtitle: settings.subtitle ?? "",
      ownerEmail: settings.ownerEmail ?? "",
      currency: settings.currency,
      dateFormat: settings.dateFormat,
      rentDueDay: settings.rentDueDay,
      lateFeeEnabled: settings.lateFeeEnabled,
      lateFeeAmount: settings.lateFeeAmount,
      lateFeeGraceDays: settings.lateFeeGraceDays,
      renewalReminderDays: settings.renewalReminderDays,
      taxCollectorName: settings.taxCollectorName ?? "",
      taxCollectorPhone: settings.taxCollectorPhone ?? "",
    },
    schema: settingsSchema,
    toBody: (v) => ({ ...v, lateFeeAmount: v.lateFeeAmount ?? 0 }),
    submit: (body) => api<SettingsDTO>("/api/settings", { method: "PUT", body }),
    success: "Settings saved",
    onSaved,
  });
  const v = form.values;

  const lateSummary =
    v.lateFeeEnabled && v.lateFeeAmount && v.rentDueDay
      ? `${formatINR(v.lateFeeAmount)} is added once rent is more than ${v.lateFeeGraceDays ?? 0} day${v.lateFeeGraceDays === 1 ? "" : "s"} past the ${ordinal(v.rentDueDay)}.`
      : "No late fee is charged.";

  const body = (
    <FormBody form={form}>
      <FormSection title="Name on receipts">
        <FormGrid cols={2}>
          <Field label="Brand name" required error={form.error("brandName")}>
            <Input {...form.text("brandName")} icon={<Type />} autoComplete="off" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Rent rules" note="Drives due dates and overdue alerts">
        <FormGrid cols={3}>
          <Field label="Rent due on" required error={form.error("rentDueDay")} hint={v.rentDueDay ? `The ${ordinal(v.rentDueDay)} of every month` : "Day of the month"}>
            <NumberInput {...form.number("rentDueDay")} decimals={0} min={1} max={31} suffix="day" hideHint />
          </Field>
          <Field label="Late fee" span={2} hint={lateSummary}>
            <div data-field="lateFeeEnabled">
              <Toggle checked={v.lateFeeEnabled} onChange={(c) => form.set("lateFeeEnabled", c)} label={v.lateFeeEnabled ? "Charge a late fee" : "Off"} />
            </div>
          </Field>
          {v.lateFeeEnabled && (
            <>
              <Field label="Late fee amount" error={form.error("lateFeeAmount")}>
                <NumberInput {...form.number("lateFeeAmount")} currency placeholder="500" />
              </Field>
              <Field label="Grace days" required error={form.error("lateFeeGraceDays")} hint="Days after the due date before it applies">
                <NumberInput {...form.number("lateFeeGraceDays")} decimals={0} min={0} max={60} suffix="days" hideHint />
              </Field>
            </>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Agreements">
        <FormGrid cols={3}>
          <Field label="Renewal reminder" required error={form.error("renewalReminderDays")}>
            <NumberInput {...form.number("renewalReminderDays")} decimals={0} min={1} max={180} suffix="days before" hideHint />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Tax collector">
        <FormGrid cols={2}>
          <Field label="Name" aside="optional" error={form.error("taxCollectorName")}>
            <Input {...form.text("taxCollectorName")} icon={<UserRound />} autoComplete="off" />
          </Field>
          <Field label="Phone" aside="optional" error={form.error("taxCollectorPhone")}>
            <Input {...form.text("taxCollectorPhone")} icon={<Phone />} type="tel" autoComplete="off" placeholder="+91 98765 43210" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Email">
        <FormGrid cols={2}>
          <Field label="Your email" aside="optional" span="full" error={form.error("ownerEmail")} hint="“Email me” on the To-dos list sends your pending to-dos here">
            <Input {...form.text("ownerEmail")} icon={<Mail />} type="email" autoComplete="email" placeholder="you@example.com" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Formats">
        <FormGrid cols={2}>
          <Field label="Currency" error={form.error("currency")} hint="Amounts use Indian grouping: ₹12,34,567">
            <Input {...form.text("currency")} autoComplete="off" maxLength={3} className={s.upper} />
          </Field>
          <Field label="Date format" error={form.error("dateFormat")}>
            <Select {...form.select("dateFormat")} options={DATE_FORMATS.map((f) => ({ value: f, label: f }))} />
          </Field>
        </FormGrid>
      </FormSection>
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? "Save settings"} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
