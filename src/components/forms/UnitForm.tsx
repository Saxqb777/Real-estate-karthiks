"use client";
import { Building2, ExternalLink, Hash, MapPin, Zap } from "lucide-react";
import { DateInput, Field, FormGrid, Input, NumberInput, Toggle } from "@/components/ui";
import { api } from "@/lib/client";
import { toInputDate, todayIST } from "@/lib/dates";
import { SITE_DEFAULTS, formatFeetInches } from "@/lib/site-layout";
import {
  DEFAULT_UNIT_TYPE,
  positionTakenMessage,
  unitCreateSchema,
  unitUpdateSchema,
  type UnitDTO,
  type UnitDetail,
  type UnitListItem,
  type UnitPosition,
} from "@/lib/schemas/unit";
import { ChoiceGroup, Stepper } from "./controls";
import { FormActions, FormBody, FormSection, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm, type Issue } from "./useForm";

export type UnitFormValues = {
  name: string;
  type: string;
  address: string;
  position: "" | UnitPosition;
  floors: number | null;
  builtUpSqft: number | null;
  footprintWidthFt: number | null;
  footprintDepthFt: number | null;
  purchaseDate: string;
  purchasePrice: number | null;
  annualAppreciationRate: number | null;
  electricityConsumerNumber: string;
  electricityPayUrl: string;
  isActive: boolean;
};

export interface UnitFormProps extends BaseFormProps<UnitDetail> {
  unit?: UnitDTO | null;
  defaults?: Partial<UnitFormValues>;
  /** Other units — used to warn before a position clash. */
  units?: Pick<UnitListItem, "id" | "name" | "position" | "isActive">[];
  /** Live values (unsaved) for the 3D preview. */
  onValuesChange?: (values: UnitFormValues) => void;
  /** Focused field name (footprintWidthFt, floors, …) for the 3D highlight. */
  onFocusField?: (field: string | null) => void;
}

const ftHint = (n: number) => <b>{formatFeetInches(n)}</b>;

export function unitFormValues(unit?: UnitDTO | null, defaults?: Partial<UnitFormValues>): UnitFormValues {
  return {
    name: unit?.name ?? defaults?.name ?? "",
    type: unit?.type ?? defaults?.type ?? DEFAULT_UNIT_TYPE,
    address: unit?.address ?? defaults?.address ?? "",
    position: unit ? (unit.position ?? "") : (defaults?.position ?? ""),
    floors: unit?.floors ?? defaults?.floors ?? 1,
    builtUpSqft: unit?.builtUpSqft ?? defaults?.builtUpSqft ?? null,
    footprintWidthFt: unit?.footprintWidthFt ?? defaults?.footprintWidthFt ?? null,
    footprintDepthFt: unit?.footprintDepthFt ?? defaults?.footprintDepthFt ?? null,
    purchaseDate: toInputDate(unit?.purchaseDate) || (defaults?.purchaseDate ?? ""),
    purchasePrice: unit?.purchasePrice ?? defaults?.purchasePrice ?? null,
    annualAppreciationRate: unit?.annualAppreciationRate ?? defaults?.annualAppreciationRate ?? null,
    electricityConsumerNumber: unit?.electricityConsumerNumber ?? defaults?.electricityConsumerNumber ?? "",
    electricityPayUrl: unit?.electricityPayUrl ?? defaults?.electricityPayUrl ?? "",
    isActive: unit?.isActive ?? defaults?.isActive ?? true,
  };
}

/** Build or edit a unit (one townhouse). Position, footprint and floors shape the 3D model. */
export function UnitForm({ unit, defaults, units, onSaved, onCancel, frame = inlineFrame, submitLabel, actionsLeft, onValuesChange, onFocusField }: UnitFormProps) {
  const editing = Boolean(unit);

  const rules = (v: UnitFormValues): Issue[] => {
    if (!v.position || !v.isActive) return [];
    const holder = units?.find((u) => u.id !== unit?.id && u.isActive && u.position === v.position);
    return holder ? [{ field: "position", message: positionTakenMessage(v.position, holder.name) }] : [];
  };

  const form = useForm<UnitFormValues, UnitDetail>({
    initial: unitFormValues(unit, defaults),
    schema: editing ? unitUpdateSchema : unitCreateSchema,
    rules,
    toBody: (v) => ({ ...v, position: v.position || null, annualAppreciationRate: v.annualAppreciationRate ?? 0 }),
    errorField: (err) => (/position is already taken/i.test(err.message) ? "position" : /active lease/i.test(err.message) ? "isActive" : undefined),
    submit: (body) =>
      unit ? api<UnitDetail>(`/api/units/${unit.id}`, { method: "PUT", body }) : api<UnitDetail>("/api/units", { method: "POST", body }),
    success: (r) => (editing ? `Saved · ${r.name}` : `Built · ${r.name}`),
    onSaved,
    onValuesChange,
    onFocusField,
  });
  const v = form.values;

  const body = (
    <FormBody form={form}>
      <FormSection title="The unit">
        <FormGrid cols={2}>
          <Field label="Name" required error={form.error("name")} hint="What you call it, e.g. Unit A">
            <Input {...form.text("name")} icon={<Building2 />} autoComplete="off" placeholder="Unit A" data-autofocus />
          </Field>
          <Field label="Type" error={form.error("type")}>
            <Input {...form.text("type")} autoComplete="off" placeholder={DEFAULT_UNIT_TYPE} list="pe-unit-types" />
            <datalist id="pe-unit-types">
              <option value="Townhouse" />
              <option value="House" />
              <option value="Flat" />
              <option value="Shop" />
            </datalist>
          </Field>
          <Field label="Address" aside="optional" span="full" error={form.error("address")}>
            <Input {...form.text("address")} icon={<MapPin />} autoComplete="off" placeholder="Door no., street, Pattukottai" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="On the plot" note="Shapes the 3D model">
        <FormGrid cols={2}>
          <Field label="Position" error={form.error("position")} span="full" hint="Front faces the street; back sits behind the courtyard">
            <ChoiceGroup
              name="position"
              value={v.position}
              onChange={(p) => form.set("position", p)}
              options={[
                { value: "front", label: "Front" },
                { value: "back", label: "Back" },
                { value: "", label: "Not placed" },
              ]}
            />
          </Field>
          <Field label="Floors" error={form.error("floors")}>
            <Stepper name="floors" value={v.floors} onChange={(n) => form.set("floors", n)} min={1} max={10} suffix={(n) => (n === 1 ? "floor" : "floors")} />
          </Field>
          <Field label="Built-up area" required error={form.error("builtUpSqft")} hint="All floors together">
            <NumberInput {...form.number("builtUpSqft")} suffix="sqft" decimals={2} placeholder="1,120" hideHint />
          </Field>
          <Field label="Footprint width" error={form.error("footprintWidthFt")} hint={v.footprintWidthFt ? undefined : `Empty = site plan (${SITE_DEFAULTS.footprintWidthFt} ft)`}>
            <NumberInput {...form.number("footprintWidthFt")} suffix="ft" placeholder={String(SITE_DEFAULTS.footprintWidthFt)} formatHint={ftHint} />
          </Field>
          <Field label="Footprint depth" error={form.error("footprintDepthFt")} hint={v.footprintDepthFt ? undefined : `Empty = site plan (${SITE_DEFAULTS.footprintDepthFt} ft)`}>
            <NumberInput {...form.number("footprintDepthFt")} suffix="ft" placeholder={String(SITE_DEFAULTS.footprintDepthFt)} formatHint={ftHint} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Purchase" note="What you paid">
        <FormGrid cols={2}>
          <Field label="Purchase date" required error={form.error("purchaseDate")}>
            <DateInput {...form.date("purchaseDate")} max={toInputDate(todayIST())} />
          </Field>
          <Field label="Purchase price" required error={form.error("purchasePrice")} hint="Including registration">
            <NumberInput {...form.number("purchasePrice")} currency placeholder="38,50,000" />
          </Field>
          <Field
            label="Growth per year"
            span="full"
            error={form.error("annualAppreciationRate")}
            hint="Used for “Worth now (est.)” while the unit has no offer"
          >
            <NumberInput {...form.number("annualAppreciationRate")} suffix="% / yr" decimals={3} allowNegative min={-50} max={100} placeholder="7.5" hideHint />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Electricity" note="TNPDCL">
        <FormGrid cols={2}>
          <Field label="Consumer number" aside="optional" error={form.error("electricityConsumerNumber")}>
            <Input {...form.text("electricityConsumerNumber")} icon={<Hash />} autoComplete="off" placeholder="04-123-456-789" />
          </Field>
          <Field label="Pay link" aside="optional" error={form.error("electricityPayUrl")} hint="Opens from the pole in the 3D view">
            <Input {...form.text("electricityPayUrl")} icon={<Zap />} type="url" autoComplete="off" placeholder="https://www.tnebltd.gov.in/…" suffix={v.electricityPayUrl ? <ExternalLink width={14} height={14} /> : undefined} />
          </Field>
        </FormGrid>
      </FormSection>

      {editing && (
        <FormSection title="Status">
          <Field label="In use" error={form.error("isActive")}>
            <div data-field="isActive">
              <Toggle
                checked={v.isActive}
                onChange={(c) => form.set("isActive", c)}
                label={v.isActive ? "Active" : "Inactive"}
              />
            </div>
          </Field>
        </FormSection>
      )}
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} left={actionsLeft} onCancel={onCancel} submitLabel={submitLabel ?? (editing ? "Save unit" : "Build unit")} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
