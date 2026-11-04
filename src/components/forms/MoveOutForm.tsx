"use client";
import { DoorOpen } from "lucide-react";
import { PendingProofClip, usePendingProofs } from "@/components/proof";
import { DateInput, Field, FormGrid, Input, NumberInput, Textarea } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDate, toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { leaseMoveOutSchema, leaseRuleIssues, refundIssues, type LeaseDetail } from "@/lib/schemas/lease";
import { FormActions, FormBody, FormNote, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";
import s from "./forms.module.css";

type Values = { endDate: string; refundAmount: number | null; refundDate: string; refundReference: string; moveOutNotes: string };

/** move-out response: the lease + the refund just recorded (its files are uploaded onto it), if any */
type MovedOut = LeaseDetail & { refundId: string | null };

export interface MoveOutFormProps extends BaseFormProps<LeaseDetail> {
  lease: {
    id: string;
    startDate: string;
    securityDeposit: number;
    unit: { name: string };
    tenant: { name: string };
  };
}

/**
 * Record that a tenant has left: their last day, and the deposit refunded then (with its ref no. + 📎). More refunds can be
 * added later on the lease (Data → Leases → Deposit refunds) — owner, 4/11/2026.
 */
export function MoveOutForm({ lease, onSaved, onCancel, frame = inlineFrame, submitLabel }: MoveOutFormProps) {
  const today = toInputDate(todayIST());
  const pending = usePendingProofs();
  const form = useForm<Values, MovedOut>({
    initial: {
      endDate: today,
      refundAmount: lease.securityDeposit > 0 ? lease.securityDeposit : null,
      refundDate: lease.securityDeposit > 0 ? today : "",
      refundReference: "",
      moveOutNotes: "",
    },
    schema: leaseMoveOutSchema,
    rules: (v) => [
      ...leaseRuleIssues({ startDate: lease.startDate, endDate: v.endDate || null, securityDeposit: lease.securityDeposit }).filter(
        (i) => v.endDate || i.field !== "endDate",
      ),
      ...(v.refundAmount === null
        ? []
        : refundIssues({
            startDate: lease.startDate,
            securityDeposit: lease.securityDeposit,
            otherRefunds: 0,
            otherCount: 0,
            amount: v.refundAmount,
            refundDate: v.refundDate || null,
          }).map((i) => ({ ...i, field: i.field === "amount" ? "refundAmount" : "refundDate" }))),
    ],
    toBody: (v) => ({
      endDate: v.endDate,
      refundAmount: v.refundAmount,
      refundDate: v.refundDate || null,
      refundReference: v.refundReference || null,
      moveOutNotes: v.moveOutNotes,
    }),
    submit: (body) => api<MovedOut>(`/api/leases/${lease.id}/move-out`, { method: "POST", body }),
    success: () => `Moved out · ${lease.tenant.name} left ${lease.unit.name}`,
    onSaved: (r) => {
      if (r.refundId) void pending.uploadTo({ depositRefundId: r.refundId });
      onSaved?.(r);
    },
  });
  const hasDeposit = lease.securityDeposit > 0;

  const body = (
    <FormBody form={form} intro={<>{lease.tenant.name} has lived in {lease.unit.name} since {formatDate(lease.startDate)}.</>}>
      <FormGrid cols={2}>
        <Field label="Last day of tenancy" required span="full" error={form.error("endDate")} hint="Their last day in the house — rent is counted up to and including this month">
          <DateInput {...form.date("endDate")} max={today} data-autofocus />
        </Field>
        <Field
          label="Deposit refunded"
          error={form.error("refundAmount")}
          hint={hasDeposit ? `Deposit held: ${formatINR(lease.securityDeposit)}` : "No deposit was taken"}
        >
          <NumberInput {...form.number("refundAmount")} currency placeholder="0" max={lease.securityDeposit || undefined} />
        </Field>
        <Field label="Refunded on" error={form.error("refundDate")}>
          <DateInput {...form.date("refundDate")} max={today} />
        </Field>
        {hasDeposit && (
          // the refund's clip (owner 4/11/2026: a receipt for the refund) at the right end of its ref no. box
          <Field label="Refund ref no. (UTR)" span="full" error={form.error("refundReference")}>
            <Input
              {...form.text("refundReference")}
              className={s.refInput}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              suffix={<PendingProofClip pending={pending} />}
            />
          </Field>
        )}
        <Field label="Notes" span="full" error={form.error("moveOutNotes")}>
          <Textarea {...form.text("moveOutNotes")} />
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
