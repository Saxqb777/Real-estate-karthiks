"use client";
import { Banknote, Building, CircleEllipsis, Smartphone } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DateInput, Field, FormGrid, Input, NumberInput, Select, toast } from "@/components/ui";
import { api } from "@/lib/client";
import type { NextPayment } from "@/lib/dashboard-types";
import { MONTH_NAMES, formatDate, periodLabel, toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { LeaseListItem } from "@/lib/schemas/lease";
import {
  leasePeriodBounds,
  paymentCreateSchema,
  paymentPeriodError,
  periodIndex,
  type PaymentListItem,
  type PaymentMethodValue,
  type Period,
} from "@/lib/schemas/payment";
import { ChoiceGroup } from "./controls";
import { leaseLabel, leasePhase, useDashboard, useLeases } from "./data";
import { FormActions, FormBody, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm, type Issue } from "./useForm";
import s from "./forms.module.css";

type Values = {
  leaseId: string;
  periodMonth: number | null;
  periodYear: number | null;
  amount: number | null;
  paymentDate: string;
  method: PaymentMethodValue;
  notes: string;
};

export interface PaymentFormProps extends BaseFormProps<PaymentListItem> {
  defaults?: Partial<Pick<Values, "leaseId" | "periodMonth" | "periodYear" | "amount" | "method">>;
}

const nextPeriod = (p: Period): Period => (p.month === 12 ? { month: 1, year: p.year + 1 } : { month: p.month + 1, year: p.year });

/** Rent still owed for the suggested month, WITHOUT any late fee (the fee is offered as a separate chip). */
function rentStillOwed(next: NextPayment): number {
  return next.arrears.months.find((m) => m.year === next.periodYear && m.month === next.periodMonth)?.outstanding ?? next.amountDue;
}

/** The oldest month with rent still to pay (from the dashboard's own rent schedule), else the month after the last payment. */
function suggestion(lease: LeaseListItem | undefined, next: NextPayment | undefined): { period: Period; amount: number } | null {
  if (!lease) return null;
  if (next) return { period: { month: next.periodMonth, year: next.periodYear }, amount: rentStillOwed(next) };
  const { first, last } = leasePeriodBounds(lease);
  let p = lease.lastPaidPeriod ? nextPeriod(lease.lastPaidPeriod) : first;
  if (last && periodIndex(p) > periodIndex(last)) p = last;
  return { period: p, amount: lease.monthlyRent };
}

/** Record rent received. Defaults: the oldest unpaid month, what is still owed for it, paid today. */
export function PaymentForm({ defaults, onSaved, onCancel, frame = inlineFrame, submitLabel }: PaymentFormProps) {
  const leases = useLeases();
  const dash = useDashboard();
  const leaseById = useMemo(() => new Map((leases.data?.items ?? []).map((l) => [l.id, l])), [leases.data]);
  const nextByLease = useMemo(() => {
    const m = new Map<string, NextPayment>();
    for (const u of dash.data?.units ?? []) if (u.nextPayment) m.set(u.nextPayment.leaseId, u.nextPayment);
    return m;
  }, [dash.data]);

  const firstLease = useMemo(() => {
    const items = leases.data?.items ?? [];
    return items.find((l) => leasePhase(l) === "current") ?? items[0];
  }, [leases.data]);

  const rules = (v: Values): Issue[] => {
    const lease = leaseById.get(v.leaseId);
    if (!lease || !v.periodMonth || !v.periodYear) return [];
    const err = paymentPeriodError(lease, { month: v.periodMonth, year: v.periodYear });
    return err ? [{ field: "periodMonth", message: err }] : [];
  };

  const form = useForm<Values, PaymentListItem>({
    initial: {
      leaseId: defaults?.leaseId ?? "",
      periodMonth: defaults?.periodMonth ?? null,
      periodYear: defaults?.periodYear ?? null,
      amount: defaults?.amount ?? null,
      paymentDate: toInputDate(todayIST()),
      method: defaults?.method ?? "cash",
      notes: "",
    },
    schema: paymentCreateSchema,
    rules,
    aliases: { periodYear: "periodMonth" },
    submit: (body) => api<PaymentListItem>("/api/payments", { method: "POST", body }),
    success: () => null,
    onSaved: (p) => {
      toast.coin(`Rent collected · ${p.lease.unit.name}`, {
        amount: p.amount,
        description: `${periodLabel({ month: p.periodMonth, year: p.periodYear })} · ${p.lease.tenant.name} · ${p.invoiceNumber}`,
        action: { label: "Receipt", onClick: () => window.open(`/invoice/${p.id}`, "_blank", "noopener") },
      });
      onSaved?.(p);
    },
  });
  const v = form.values;
  const { dirty, reset } = form;

  // Fill the smart defaults once leases (and the rent schedule) have loaded — until the owner starts typing.
  useEffect(() => {
    if (dirty || !leases.data) return;
    const leaseId = v.leaseId || firstLease?.id || "";
    const sug = suggestion(leaseById.get(leaseId), nextByLease.get(leaseId));
    if (!sug) return;
    const want = {
      ...v,
      leaseId,
      periodMonth: defaults?.periodMonth ?? sug.period.month,
      periodYear: defaults?.periodYear ?? sug.period.year,
      amount: defaults?.amount ?? sug.amount,
    };
    if (want.leaseId !== v.leaseId || want.periodMonth !== v.periodMonth || want.periodYear !== v.periodYear || want.amount !== v.amount) reset(want);
  }, [dirty, leases.data, dash.data, firstLease, leaseById, nextByLease, defaults, reset, v]);

  const pickLease = (id: string) => {
    const sug = suggestion(leaseById.get(id), nextByLease.get(id));
    form.setMany({ leaseId: id, ...(sug && { periodMonth: sug.period.month, periodYear: sug.period.year, amount: sug.amount }) });
  };

  const lease = leaseById.get(v.leaseId);
  const next = nextByLease.get(v.leaseId);
  const isSuggested = next && v.periodMonth === next.periodMonth && v.periodYear === next.periodYear;

  const groups = useMemo(() => {
    const items = leases.data?.items ?? [];
    return {
      current: items.filter((l) => leasePhase(l) !== "past"),
      past: items.filter((l) => leasePhase(l) === "past"),
    };
  }, [leases.data]);

  const years = useMemo(() => {
    const thisYear = todayIST().getUTCFullYear();
    const from = lease ? new Date(lease.startDate).getUTCFullYear() : thisYear - 1;
    const to = Math.max(thisYear, v.periodYear ?? thisYear);
    const out: number[] = [];
    for (let y = to; y >= Math.min(from, v.periodYear ?? from); y--) out.push(y);
    return out;
  }, [lease, v.periodYear]);

  let periodHint: string | undefined;
  if (isSuggested && next) {
    periodHint = next.isOverdue
      ? `Oldest unpaid month · ${next.daysOverdue} day${next.daysOverdue === 1 ? "" : "s"} overdue`
      : `Next month due · ${formatDate(next.dueDate)}`;
    if (next.paidSoFar > 0) periodHint += ` · ${formatINR(next.paidSoFar)} already paid`;
  }

  const body = (
    <FormBody form={form}>
      <FormGrid cols={2}>
        <Field label="Lease" required span="full" error={form.error("leaseId")} hint={lease ? `${formatINR(lease.monthlyRent)} a month · ${lease.tenant.phone ?? "no phone"}` : undefined}>
          <Select name="leaseId" value={v.leaseId} onChange={(e) => pickLease(e.target.value)} placeholder={leases.data?.items.length ? "Choose whose rent" : "Sign a lease first"}>
            {groups.current.length > 0 && (
              <optgroup label="Current">
                {groups.current.map((l) => (
                  <option key={l.id} value={l.id}>
                    {leaseLabel(l)}
                    {leasePhase(l) === "incoming" ? ` (starts ${formatDate(l.startDate)})` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {groups.past.length > 0 && (
              <optgroup label="Past leases">
                {groups.past.map((l) => (
                  <option key={l.id} value={l.id}>
                    {leaseLabel(l)} (ended {formatDate(l.endDate)})
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        <Field label="Rent for" required span="full" error={form.error("periodMonth")} hint={periodHint}>
          <div className={s.periodRow} data-field="periodMonth">
            <Select
              name="periodMonth"
              aria-label="Month"
              value={v.periodMonth ? String(v.periodMonth) : ""}
              onChange={(e) => form.set("periodMonth", e.target.value ? Number(e.target.value) : null)}
              options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
              placeholder="Month"
            />
            <Select
              name="periodYear"
              aria-label="Year"
              value={v.periodYear ? String(v.periodYear) : ""}
              onChange={(e) => form.set("periodYear", e.target.value ? Number(e.target.value) : null)}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              placeholder="Year"
            />
          </div>
        </Field>

        <Field label="Amount received" required error={form.error("amount")}>
          <NumberInput {...form.number("amount")} currency placeholder="18,000" data-autofocus />
          {lease && (
            <div className={s.quick}>
              <button type="button" className={s.quickChip} data-on={v.amount === lease.monthlyRent || undefined} onClick={() => form.set("amount", lease.monthlyRent)}>
                Full rent {formatINR(lease.monthlyRent)}
              </button>
              {isSuggested && next && rentStillOwed(next) !== lease.monthlyRent && (
                <button type="button" className={s.quickChip} data-on={v.amount === rentStillOwed(next) || undefined} onClick={() => form.set("amount", rentStillOwed(next))}>
                  Still owed {formatINR(rentStillOwed(next))}
                </button>
              )}
              {isSuggested && next?.lateFeeApplied && (
                <button type="button" className={s.quickChip} data-on={v.amount === next.amountDue || undefined} onClick={() => form.set("amount", next.amountDue)}>
                  With {formatINR(next.lateFee)} late fee {formatINR(next.amountDue)}
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="Received on" required error={form.error("paymentDate")}>
          <DateInput {...form.date("paymentDate")} max={toInputDate(todayIST())} />
        </Field>

        <Field label="Paid by" span="full" error={form.error("method")}>
          <ChoiceGroup
            name="method"
            value={v.method}
            onChange={(m) => form.set("method", m)}
            options={[
              { value: "cash", label: "Cash", icon: <Banknote aria-hidden /> },
              { value: "upi", label: "UPI", icon: <Smartphone aria-hidden /> },
              { value: "bank", label: "Bank", icon: <Building aria-hidden /> },
              { value: "other", label: "Other", icon: <CircleEllipsis aria-hidden /> },
            ]}
          />
        </Field>
        <Field label="Note" aside="optional" span="full" error={form.error("notes")}>
          <Input {...form.text("notes")} autoComplete="off" placeholder="e.g. UPI ref 4821 · paid by his brother" />
        </Field>
      </FormGrid>
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? "Record rent"} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
