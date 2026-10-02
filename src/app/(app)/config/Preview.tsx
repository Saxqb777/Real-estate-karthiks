"use client";
// Live 3D preview for the Plot and Units forms: draws the UNSAVED values and lights up the dimension of the focused field.
import { MousePointerClick } from "lucide-react";
import EstateSceneLazy, { type EstateSceneProps } from "@/components/estate/EstateSceneLazy";
import { cx } from "@/components/ui";
import s from "./config.module.css";

export interface LivePreviewProps {
  plot: EstateSceneProps["plot"];
  units: EstateSceneProps["units"];
  /** Highlight key for the 3D scene (frontWidthFt, footprintWidthFt:<id>, floors:<id> …). */
  highlight: string | null;
  /** Plain name of the focused field ("Front width"). */
  focusLabel: string | null;
  dirty: boolean;
  selectedUnitId?: string | null;
  onSelectUnit?: (id: string | null) => void;
  onEmptySlotClick?: (slot: "front" | "back") => void;
  className?: string;
}

export function LivePreview({ plot, units, highlight, focusLabel, dirty, selectedUnitId, onSelectUnit, onEmptySlotClick, className }: LivePreviewProps) {
  return (
    <section className={cx(s.preview, className)} aria-label="Live 3D preview">
      <EstateSceneLazy
        className={s.scene}
        mode="preview"
        plot={plot}
        units={units}
        showDimensions
        showLabels
        highlightField={highlight}
        selectedUnitId={selectedUnitId}
        onSelectUnit={onSelectUnit}
        onEmptySlotClick={onEmptySlotClick}
        intro={false}
        hud={false}
      />
      <div className={s.previewTop}>
        <span className={s.liveChip}>
          <span className={s.liveDot} aria-hidden />
          Live preview
        </span>
        {dirty && <span className={s.unsavedChip}>Unsaved — not stored yet</span>}
        <span className={s.previewHint} aria-live="polite">
        {focusLabel ? (
          <>
            <span className={s.hintKey}>Showing</span> {focusLabel}
          </>
        ) : (
          <>
            <MousePointerClick aria-hidden /> Click into a field — its measurement lights up on the model
          </>
        )}
        </span>
      </div>
    </section>
  );
}
