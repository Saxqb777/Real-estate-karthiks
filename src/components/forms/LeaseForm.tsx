"use client";
import { BellRing, CalendarPlus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { DateInput, Field, FormGrid, Input, NumberInput, Select, Textarea, Toggle } from "@/components/ui";
import { PendingProofClip, ProofClip, usePendingProofs } from "@/components/proof";
import { api } from "@/lib/client";
import { formatDate, toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import {
  leaseConflictMessage,
  leaseCreateSchema,
  leaseRuleIssues,
  leaseUpdateSchema,
  type LeaseDTO,
  type LeaseDetail,
  type LeaseListItem,
} from "@/lib/schemas/lease";
import { elevenMonthsFrom, tenantOptions, unitOptions, useLeases, useSettings, useTenants, useUnits } from "./data";
import { FormActions, FormBody, FormNote, FormSection, inlineFrame, modalFrame, type BaseFormProps } from "./FormFrame";
import { TenantForm } from "./TenantForm";
import { useForm, type Issue } from "./useForm";
import s from "./forms.module.css";

type Values = {
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number | null;
  rentTiming: "advance" | "arrears";
  rentDueDay: number | null;
  securityDeposit: number | null;
  /** bank / UPI ref no. (UTR) of the deposit transfer */
  depositReference: string;
  agreementEndDate: string;
  reminderEnabled: boolean;
  depositRefundedAmount: number | null;
  depositRefundDate: string;
  moveOutNotes: string;
};

export type LeaseSaved = LeaseListItem | LeaseDetail;

export interface LeaseFormProps extends BaseFormProps<LeaseSaved> {
  lease?: LeaseDTO | null;
  defaults?: Partial<Pick<Values, "unitId" | "tenantId" | "startDate" | "monthlyRent" | "securityDeposit">>;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** Sign a lease: who lives in which unit, from when, for how much. */
export function LeaseForm({ lease, defaults, onSaved, onCancel, frame = inlineFrame, submitLabel }: LeaseFormProps) {
  const editing = Boolean(lease);
  const units = useUnits();
  const tenants = useTenants();
  const leases = useLeases();
  const settings = useSettings();
  const [addingTenant, setAddingTenant] = useState(false);
  const [tenantKey, setTenantKey] = useState(0);
  const openNewTenant = () => {
    setTenantKey((k) => k + 1);
    setAddingTenant(true);
  };

  // Smart default: the unit's previous rent and deposit.
  const previousOn = (unitId: string) =>
    leases.data?.items
      .filter((l) => l.unit.id === unitId && l.id !== lease?.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const prev = !editing && defaults?.unitId ? previousOn(defaults.unitId) : undefined;

  const rules = (v: Values): Issue[] => {
    const out: Issue[] = [...leaseRuleIssues({
      startDate: v.startDate || "1970-01-01",
      endDate: v.endDate || null,
      securityDeposit: v.securityDeposit ?? 0,
      depositRefundedAmount: v.depositRefundedAmount,
      depositRefundDate: v.depositRefundDate || null,
      agreementEndDate: v.agreementEndDate || null,
    })].filter((i) => v.startDate || (i.field !== "endDate" && i.field !== "agreementEndDate"));
    if (v.unitId && v.startDate && leases.data) {
      const others = leases.data.items.filter((l) => l.unit.id === v.unitId && l.id !== lease?.id);
      const unitName = units.data?.items.find((u) => u.id === v.unitId)?.name ?? "This unit";
      const clash = leaseConflictMessage({ startDate: v.startDate, endDate: v.endDate || null }, others, unitName);
      if (clash) out.push({ field: "startDate", message: clash });
    }
    return out;
  };

  // the deposit statement picked while signing — uploaded once the lease is saved (a saved one's clip uploads straight away)
  const pending = usePendingProofs();
  const form = useForm<Values, LeaseSaved>({
    initial: {
      unitId: lease?.unitId ?? defaults?.unitId ?? "",
      tenantId: lease?.tenantId ?? defaults?.tenantId ?? "",
      startDate: toInputDate(lease?.startDate) || defaults?.startDate || toInputDate(todayIST()),
      endDate: toInputDate(lease?.endDate),
      monthlyRent: lease?.startingRent ?? lease?.monthlyRent ?? defaults?.monthlyRent ?? prev?.monthlyRent ?? null,
      rentTiming: lease?.rentTiming === "arrears" ? "arrears" : "advance",
      rentDueDay: lease?.rentDueDay ?? null,
      securityDeposit: lease?.securityDeposit ?? defaults?.securityDeposit ?? prev?.securityDeposit ?? null,
      depositReference: lease?.depositReference ?? "",
      agreementEndDate: toInputDate(lease?.agreementEndDate),
      reminderEnabled: lease?.reminderEnabled ?? true,
      depositRefundedAmount: lease?.depositRefundedAmount ?? null,
      depositRefundDate: toInputDate(lease?.depositRefundDate),
      moveOutNotes: lease?.moveOutNotes ?? "",
    },
    schema: editing ? leaseUpdateSchema : leaseCreateSchema,
    rules,
    toBody: (v) => {
      const base = {
        unitId: v.unitId,
        tenantId: v.tenantId,
        startDate: v.startDate,
        endDate: v.endDate || null,
        monthlyRent: v.monthlyRent,
        rentTiming: v.rentTiming,
        rentDueDay: v.rentDueDay,
        securityDeposit: v.securityDeposit ?? 0,
        depositReference: v.depositReference,
        agreementEndDate: v.agreementEndDate || null,
        reminderEnabled: v.reminderEnabled,
      };
      return editing
        ? { ...base, depositRefundedAmount: v.depositRefundedAmount, depositRefundDate: v.depositRefundDate || null, moveOutNotes: v.moveOutNotes }
        : base;
    },
    submit: (body) =>
      lease ? api<LeaseDetail>(`/api/leases/${lease.id}`, { method: "PUT", body }) : api<LeaseListItem>("/api/leases", { method: "POST", body }),
    success: (r) => (editing ? `Lease saved · ${r.tenant.name}` : `Lease signed · ${r.tenant.name} in ${r.unit.name}`),
    onSaved: (r) => {
      if (!editing) void pending.uploadTo({ leaseId: r.id });
      onSaved?.(r);
    },
  });
  const v = form.values;

  // Leases load after the form opens: prefill the unit's previous rent + deposit once they arrive (until the owner types).
  const loadedLeases = leases.data;
  const { dirty, reset } = form;
  useEffect(() => {
    if (editing || dirty || !loadedLeases || !v.unitId || v.monthlyRent !== null) return;
    const p = loadedLeases.items.filter((l) => l.unit.id === v.unitId).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    if (p) reset({ ...v, monthlyRent: p.monthlyRent, securityDeposit: v.securityDeposit ?? p.securityDeposit });
  }, [loadedLeases, editing, dirty, reset, v]);

  const dueDay = settings.data?.rentDueDay;
  const ended = Boolean(v.endDate);
  const unitPrev = !editing && v.unitId ? previousOn(v.unitId) : undefined;

  const body = (
    <FormBody form={form}>
      <FormGrid cols={2}>
        <Field label="Unit" required error={form.error("unitId")}>
          <Select
            {...form.select("unitId")}
            onChange={(e) => {
              const id = e.target.value;
              const p = editing ? undefined : previousOn(id);
              form.setMany({
                unitId: id,
                ...(p && v.monthlyRent === null && { monthlyRent: p.monthlyRent }),
                ...(p && v.securityDeposit === null && { securityDeposit: p.securityDeposit }),
              });
            }}
            placeholder="Choose a unit"
            options={unitOptions(units.data?.items, { keepId: lease?.unitId })}
          />
        </Field>
        <Field
          label="Tenant"
          required
          error={form.error("tenantId")}
          aside={
            <button type="button" className={s.linkBtn} onClick={openNewTenant}>
              <UserPlus aria-hidden /> New tenant
            </button>
          }
        >
          <Select {...form.select("tenantId")} placeholder={tenants.data?.items.length ? "Choose a tenant" : "Add a tenant first →"} options={tenantOptions(tenants.data?.items)} />
        </Field>
        <Field label="First day" required error={form.error("startDate")} hint={editing ? undefined : "The day they move in (can be in the future)"}>
          <DateInput {...form.date("startDate")} />
        </Field>
        <Field label="Last day of tenancy" aside="optional" error={form.error("endDate")} hint="Leave empty while they live there">
          <DateInput {...form.date("endDate")} />
        </Field>
        <Field
          label={lease?.rentChanges?.length ? "Starting rent" : "Monthly rent"}
          required
          error={form.error("monthlyRent")}
          hint={unitPrev && v.monthlyRent === unitPrev.monthlyRent ? `Same as ${unitPrev.tenant.name}'s rent` : dueDay ? `Due on the ${ordinal(dueDay)} of each month` : undefined}
        >
          <NumberInput {...form.number("monthlyRent")} currency placeholder="18,000" />
        </Field>
        <Field label="Rent billing" error={form.error("rentTiming")}>
          <Select
            value={v.rentTiming}
            onChange={(e) => form.set("rentTiming", e.target.value === "arrears" ? "arrears" : "advance")}
            options={[
              { value: "advance", label: "IN ADVANCE" },
              { value: "arrears", label: "IN ARREARS" },
            ]}
          />
        </Field>
        <Field label="Due on day" error={form.error("rentDueDay")}>
          <NumberInput {...form.number("rentDueDay")} decimals={0} min={1} max={31} placeholder={dueDay ? String(dueDay) : "5"} hideHint />
        </Field>
        <Field label="Security deposit" error={form.error("securityDeposit")} hint="Held for the tenant — not income">
          <NumberInput {...form.number("securityDeposit")} currency placeholder="0" />
        </Field>
        {/* rental agreement (usually 11 months, owner 8/10): a reminder shows before it ends */}
        <Field
          label="Agreement ends"
          error={form.error("agreementEndDate")}
          aside={
            v.startDate ? (
              <button type="button" className={s.linkBtn} onClick={() => form.set("agreementEndDate", elevenMonthsFrom(v.startDate))}>
                <CalendarPlus aria-hidden /> 11 months
              </button>
            ) : undefined
          }
        >
          <DateInput {...form.date("agreementEndDate")} />
        </Field>
        {/* under Security deposit in the 2-column grid */}
        <Field label="Deposit ref no. (UTR)" error={form.error("depositReference")}>
          <Input
            {...form.text("depositReference")}
            className={s.refInput}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            suffix={lease ? <ProofClip owner={{ leaseId: lease.id }} /> : <PendingProofClip pending={pending} />}
          />
        </Field>
        <Field label="Reminders">
          <div data-field="reminderEnabled">
            <Toggle
              checked={v.reminderEnabled}
              onChange={(c) => form.set("reminderEnabled", c)}
              label={
                <span className={s.iconLabel}>
                  <BellRing aria-hidden /> Rent reminders
                </span>
              }
            />
          </div>
        </Field>
      </FormGrid>

      {editing && ended && (
        <FormSection title="Move-out & deposit">
          <FormGrid cols={2}>
            <Field label="Deposit refunded" error={form.error("depositRefundedAmount")} hint={lease ? `Deposit was ${formatINR(v.securityDeposit ?? lease.securityDeposit)}` : undefined}>
              <NumberInput {...form.number("depositRefundedAmount")} currency placeholder="0" />
            </Field>
            <Field label="Refunded on" error={form.error("depositRefundDate")}>
              <DateInput {...form.date("depositRefundDate")} />
            </Field>
            <Field label="Move-out notes" aside="optional" span="full" error={form.error("moveOutNotes")}>
              <Textarea {...form.text("moveOutNotes")} placeholder="e.g. ₹3,000 kept for repainting" />
            </Field>
          </FormGrid>
        </FormSection>
      )}

      {!editing && unitPrev && !unitPrev.endDate && v.unitId === unitPrev.unit.id && !form.error("startDate") && (
        <FormNote tone="warn">
          {unitPrev.tenant.name} still lives in {unitPrev.unit.name} (from {formatDate(unitPrev.startDate)}). Record their last day of tenancy first
          (Leases → Move out).
        </FormNote>
      )}

      <TenantForm
        frame={modalFrame({ open: addingTenant, onClose: () => setAddingTenant(false), title: "New tenant", eyebrow: "Tenants", size: "md" })}
        onCancel={() => setAddingTenant(false)}
        onSaved={(t) => {
          setAddingTenant(false);
          form.set("tenantId", t.id);
        }}
        key={tenantKey}
      />
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save lease" : "Sign lease")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty || pending.count > 0,
    busy: form.busy,
  });
}

