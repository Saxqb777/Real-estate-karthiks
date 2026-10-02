"use client";
import { IdCard, Mail, Phone, UserRound } from "lucide-react";
import { Field, FormGrid, Input } from "@/components/ui";
import { api } from "@/lib/client";
import { tenantCreateSchema, tenantUpdateSchema, type TenantDTO, type TenantListItem } from "@/lib/schemas/tenant";
import { FormActions, FormBody, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";

type Values = { name: string; phone: string; email: string; idProofRef: string };

export interface TenantFormProps extends BaseFormProps<TenantListItem> {
  tenant?: Pick<TenantDTO, "id" | "name" | "phone" | "email" | "idProofRef"> | null;
  defaults?: Partial<Values>;
}

/** Add or edit a tenant (the person). Leases link tenants to units. */
export function TenantForm({ tenant, defaults, onSaved, onCancel, frame = inlineFrame, submitLabel }: TenantFormProps) {
  const editing = Boolean(tenant);
  const form = useForm<Values, TenantListItem>({
    initial: {
      name: tenant?.name ?? defaults?.name ?? "",
      phone: tenant?.phone ?? defaults?.phone ?? "",
      email: tenant?.email ?? defaults?.email ?? "",
      idProofRef: tenant?.idProofRef ?? defaults?.idProofRef ?? "",
    },
    schema: editing ? tenantUpdateSchema : tenantCreateSchema,
    submit: (body) =>
      tenant ? api<TenantListItem>(`/api/tenants/${tenant.id}`, { method: "PUT", body }) : api<TenantListItem>("/api/tenants", { method: "POST", body }),
    success: (r) => (editing ? `Saved · ${r.name}` : `Tenant added · ${r.name}`),
    onSaved,
  });

  const body = (
    <FormBody form={form}>
      <FormGrid cols={2}>
        <Field label="Full name" required span="full" error={form.error("name")} hint="As written on the rental agreement">
          <Input {...form.text("name")} icon={<UserRound />} autoComplete="off" placeholder="e.g. R. Senthil Kumar" data-autofocus />
        </Field>
        <Field label="Phone" aside="optional" error={form.error("phone")} hint="Tap-to-call from the tenant card">
          <Input {...form.text("phone")} icon={<Phone />} type="tel" inputMode="tel" autoComplete="off" placeholder="98765 43210" />
        </Field>
        <Field label="Email" aside="optional" error={form.error("email")}>
          <Input {...form.text("email")} icon={<Mail />} type="email" autoComplete="off" placeholder="name@example.com" />
        </Field>
        <Field label="ID proof" aside="optional" span="full" error={form.error("idProofRef")} hint="Which document you hold, e.g. Aadhaar ending 4821">
          <Input {...form.text("idProofRef")} icon={<IdCard />} autoComplete="off" placeholder="Aadhaar ••••4821" />
        </Field>
      </FormGrid>
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save tenant" : "Add tenant")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
