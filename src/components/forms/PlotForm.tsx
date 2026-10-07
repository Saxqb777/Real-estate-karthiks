"use client";
import { Image as ImageIcon, MapPinned, Ruler } from "lucide-react";
import { Button, Field, FormGrid, Input, NumberInput } from "@/components/ui";
import { api } from "@/lib/client";
import { SITE_PLAN_DEFAULTS } from "@/lib/calculations";
import { formatIndianNumber } from "@/lib/format";
import { plotAreaSqft, plotSchema, type PlotDTO } from "@/lib/schemas/plot";
import { formatFeetInches } from "@/lib/site-layout";
import { FormActions, FormBody, FormNote, FormSection, inlineFrame, type BaseFormProps } from "./FormFrame";
import { useForm } from "./useForm";

export type PlotFormValues = {
  frontWidthFt: number | null;
  backWidthFt: number | null;
  depthFt: number | null;
  areaSqft: number | null;
  townName: string;
  sitePlanImageUrl: string;
};

export interface PlotFormProps extends BaseFormProps<PlotDTO> {
  plot: PlotDTO;
  /** Live (unsaved) values for the 3D preview. */
  onValuesChange?: (values: PlotFormValues) => void;
  /** Focused field (frontWidthFt / backWidthFt / depthFt / areaSqft) for the 3D highlight. */
  onFocusField?: (field: string | null) => void;
}

const ftHint = (n: number) => (
  <>
    <b>{formatFeetInches(n)}</b>
  </>
);

/** The plot's real dimensions — the 3D model is drawn from them. Empty fields fall back to the owner's site plan. */
export function PlotForm({ plot, onSaved, onCancel, frame = inlineFrame, submitLabel, onValuesChange, onFocusField }: PlotFormProps) {
  const form = useForm<PlotFormValues, PlotDTO>({
    initial: {
      frontWidthFt: plot.frontWidthFt,
      backWidthFt: plot.backWidthFt,
      depthFt: plot.depthFt,
      areaSqft: plot.areaSqft,
      townName: plot.townName,
      sitePlanImageUrl: plot.sitePlanImageUrl ?? "",
    },
    schema: plotSchema,
    submit: (body) => api<PlotDTO>("/api/plot", { method: "PUT", body }),
    success: "Plot saved — the 3D model now uses these sizes",
    onSaved,
    onValuesChange,
    onFocusField,
  });
  const v = form.values;
  const auto = v.frontWidthFt && v.backWidthFt && v.depthFt ? plotAreaSqft(v.frontWidthFt, v.backWidthFt, v.depthFt) : null;
  const matchesSitePlan =
    v.frontWidthFt === SITE_PLAN_DEFAULTS.frontWidthFt && v.backWidthFt === SITE_PLAN_DEFAULTS.backWidthFt && v.depthFt === SITE_PLAN_DEFAULTS.depthFt;
  const empty = v.frontWidthFt === null && v.backWidthFt === null && v.depthFt === null;

  const body = (
    <FormBody form={form}>
      <FormSection
        title="Boundary"
        note={
          <Button
            size="sm"
            variant="secondary"
            icon={<Ruler />}
            disabled={matchesSitePlan}
            onClick={() => form.setMany({ ...SITE_PLAN_DEFAULTS, areaSqft: null })}
            title={`${formatFeetInches(SITE_PLAN_DEFAULTS.frontWidthFt)} front · ${formatFeetInches(SITE_PLAN_DEFAULTS.backWidthFt)} back · ${formatFeetInches(SITE_PLAN_DEFAULTS.depthFt)} deep`}
          >
            Use site-plan dimensions
          </Button>
        }
      >
        <FormGrid cols={2}>
          <Field label="Front width" error={form.error("frontWidthFt")}>
            <NumberInput {...form.number("frontWidthFt")} suffix="ft" placeholder={String(SITE_PLAN_DEFAULTS.frontWidthFt)} formatHint={ftHint} data-autofocus />
          </Field>
          <Field label="Back width" error={form.error("backWidthFt")}>
            <NumberInput {...form.number("backWidthFt")} suffix="ft" placeholder={String(SITE_PLAN_DEFAULTS.backWidthFt)} formatHint={ftHint} />
          </Field>
          <Field label="Depth" error={form.error("depthFt")}>
            <NumberInput {...form.number("depthFt")} suffix="ft" placeholder={String(SITE_PLAN_DEFAULTS.depthFt)} formatHint={ftHint} />
          </Field>
          <Field
            label="Area"
            error={form.error("areaSqft")}
            hint={
              v.areaSqft === null
                ? auto
                  ? `Worked out: (front + back) ÷ 2 × depth = ${formatIndianNumber(auto, 2)} sqft`
                  : "Leave empty to work it out from the sizes"
                : "Clear it to work it out from the sizes"
            }
          >
            <NumberInput {...form.number("areaSqft")} suffix="sqft" placeholder={auto ? formatIndianNumber(auto, 2) : "auto"} hideHint />
          </Field>
        </FormGrid>
      </FormSection>
      {empty && (
        <FormNote icon={<Ruler aria-hidden />}>
          No sizes saved yet — the 3D model is drawn from your site plan ({formatFeetInches(SITE_PLAN_DEFAULTS.frontWidthFt)} front,{" "}
          {formatFeetInches(SITE_PLAN_DEFAULTS.backWidthFt)} back, {formatFeetInches(SITE_PLAN_DEFAULTS.depthFt)} deep). Enter
          the measured sizes, or press <b>Use site-plan dimensions</b> to save those.
        </FormNote>
      )}
      <FormSection title="Place">
        <FormGrid cols={2}>
          <Field label="Town" required error={form.error("townName")} hint="Shown on receipts and the header">
            <Input {...form.text("townName")} icon={<MapPinned />} autoComplete="off" />
          </Field>
          <Field label="Site plan image" aside="optional" error={form.error("sitePlanImageUrl")} hint="A https:// link or /site-plan.png">
            <Input {...form.text("sitePlanImageUrl")} icon={<ImageIcon />} autoComplete="off" placeholder="/site-plan.png" />
          </Field>
        </FormGrid>
      </FormSection>
    </FormBody>
  );

  return frame({
    body,
    actions: <FormActions form={form} onCancel={onCancel} submitLabel={submitLabel ?? "Save plot"} />,
    onSubmit: form.handleSubmit,
    dirty: form.dirty,
    busy: form.busy,
  });
}
