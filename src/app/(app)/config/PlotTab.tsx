"use client";
import { useMemo, useState } from "react";
import { Panel, Skeleton } from "@/components/ui";
import { PlotForm, useDashboard, usePlot, type PlotFormValues } from "@/components/forms";
import { sceneUnitsFromBreakdown } from "@/lib/site-layout";
import { LivePreview } from "./Preview";
import s from "./config.module.css";

const LABELS: Record<string, string> = {
  frontWidthFt: "Front width — the street side",
  backWidthFt: "Back width — the rear wall",
  depthFt: "Depth — front to back",
  areaSqft: "Area of the whole plot",
};

/** Plot dimensions on the left, the 3D plot redrawn from the unsaved values on the right. */
export function PlotTab() {
  const plot = usePlot();
  const dash = useDashboard();
  const [values, setValues] = useState<PlotFormValues | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const units = useMemo(() => sceneUnitsFromBreakdown(dash.data?.units ?? []), [dash.data]);
  const v = values ?? (plot.data ? { frontWidthFt: plot.data.frontWidthFt, backWidthFt: plot.data.backWidthFt, depthFt: plot.data.depthFt, areaSqft: plot.data.areaSqft, townName: plot.data.townName } : null);
  const [front, back, depth, area, town] = [v?.frontWidthFt, v?.backWidthFt, v?.depthFt, v?.areaSqft, v?.townName];
  const scenePlot = useMemo(
    () => ({ frontWidthFt: front ?? undefined, backWidthFt: back ?? undefined, depthFt: depth ?? undefined, areaSqft: area ?? undefined, townName: town ?? "Pattukottai" }),
    [front, back, depth, area, town],
  );
  const highlight = focused && focused in LABELS ? focused : null;

  return (
    <div className={s.split}>
      <Panel fill padding="none" eyebrow="The land" title="Plot" className={s.formPanel}>
        {plot.data ? (
          <PlotForm
            plot={plot.data}
            onValuesChange={(nv) => {
              setValues(nv);
              const p = plot.data!;
              setDirty(
                nv.frontWidthFt !== p.frontWidthFt ||
                  nv.backWidthFt !== p.backWidthFt ||
                  nv.depthFt !== p.depthFt ||
                  nv.areaSqft !== p.areaSqft ||
                  nv.townName !== p.townName ||
                  nv.sitePlanImageUrl !== (p.sitePlanImageUrl ?? ""),
              );
            }}
            onFocusField={setFocused}
            onSaved={() => setDirty(false)}
          />
        ) : (
          <div className={s.loading}>
            <Skeleton lines={6} />
          </div>
        )}
      </Panel>
      <LivePreview plot={scenePlot} units={units} highlight={highlight} focusLabel={highlight ? LABELS[highlight] : null} dirty={dirty} />
    </div>
  );
}
