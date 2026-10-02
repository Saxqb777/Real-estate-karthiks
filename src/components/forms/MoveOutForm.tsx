"use client";
import { DoorOpen } from "lucide-react";
import { DateInput, Field, FormGrid, NumberInput, Textarea } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDate, toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { leaseMoveOutSchema, leaseRuleIssues, type LeaseDetail } from "@/lib/schemas/lease";
import { FormActions, FormBody, FormNote, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";

type Values = { endDate: string; depositRefundedAmount: number | null; depositRefundDate: string; moveOutNotes: string };

export interface MoveOutFormProps extends BaseFormProps<LeaseDetail> {
  lease: {
    id: string;
    startDate: string;
    securityDeposit: number;
    depositRefundedAmount?: number | null;
    unit: { name: string };
    tenant: { name: string };
  };
}

/** Record that a tenant has left: their last day, and what happened to the deposit. */
export function MoveOutForm({ lease, onSaved, onCancel, frame = inlineFrame, submitLabel }: MoveOutFormProps) {
  const today = toInputDate(todayIST());
  const form = useForm<Values, LeaseDetail>({
    initial: {
      endDate: today,
      depositRefundedAmount: lease.depositRefundedAmount ?? (lease.securityDeposit > 0 ? lease.securityDeposit : null),
      depositRefundDate: lease.securityDeposit > 0 ? today : "",
      moveOutNotes: "",
    },
    schema: leaseMoveOutSchema,
    rules: (v) =>
      leaseRuleIssues({
        startDate: lease.startDate,
        endDate: v.endDate || null,
        securityDeposit: lease.securityDeposit,
        depositRefundedAmount: v.depositRefundedAmount,
        depositRefundDate: v.depositRefundDate || null,
      }).filter((i) => v.endDate || i.field !== "endDate"),
    toBody: (v) => ({
      endDate: v.endDate,
      depositRefundedAmount: v.depositRefundedAmount,
      depositRefundDate: v.depositRefundDate || null,
      moveOutNotes: v.moveOutNotes,
    }),
    submit: (body) => api<LeaseDetail>(`/api/leases/${lease.id}/move-out`, { method: "POST", body }),
    success: () => `Moved out · ${lease.tenant.name} left ${lease.unit.name}`,
    onSaved,
  });
  const v = form.values;

  const body = (
    <FormBody form={form} intro={<>{lease.tenant.name} has lived in {lease.unit.name} since {formatDate(lease.startDate)}.</>}>
      <FormGrid cols={2}>
        <Field label="Last day of tenancy" required span="full" error={form.error("endDate")} hint="Their last day in the house — rent is counted up to and including this month">
          <DateInput {...form.date("endDate")} max={today} data-autofocus />
        </Field>
        <Field
          label="Deposit refunded"
          error={form.error("depositRefundedAmount")}
          hint={lease.securityDeposit > 0 ? `Deposit held: ${formatINR(lease.securityDeposit)}` : "No deposit was taken"}
        >
          <NumberInput {...form.number("depositRefundedAmount")} currency placeholder="0" max={lease.securityDeposit || undefined} />
        </Field>
        <Field label="Refunded on" error={form.error("depositRefundDate")} aside={v.depositRefundedAmount ? undefined : "optional"}>
          <DateInput {...form.date("depositRefundDate")} max={today} />
        </Field>
        <Field label="Notes" aside="optional" span="full" error={form.error("moveOutNotes")}>
          <Textarea {...form.text("moveOutNotes")} placeholder="e.g. ₹3,000 kept for repainting the hall" />
        </Field>
      </FormGrid>
      <FormNote icon={<DoorOpen aria-hidden />}>
        The unit shows as <b>vacant</b> from the next day and rent reminders for this lease switch off. The deposit is money you held for the
        tenant — refunding it is not an expense.
      </FormNote>
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? "Record move-out"} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
