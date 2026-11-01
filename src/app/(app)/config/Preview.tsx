"use client";
// Live 3D preview for the Plot and Units forms: draws the UNSAVED values and lights up the dimension of the focused field.
import { useEffect, useState } from "react";
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
  // the section switch paints first; the 3D preview (geometry + shaders) mounts once the page has settled (owner
  // 31/10/2026: "a lot of lag while switching to units, plot") — and at the cheap tier: it only shows dimensions
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 380);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className={cx(s.preview, className)} aria-label="Live 3D preview">
      {ready && (
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
          quality="low"
          life={false}
        />
      )}
      <div className={s.previewTop}>
        <span className={s.liveChip}>
          <span className={s.liveDot} aria-hidden />
          Live preview
        </span>
        {dirty && <span className={s.unsavedChip}>Unsaved — not stored yet</span>}
        <span className={s.previewHint} aria-live="polite">
        {focusLabel && (
          <>
            <span className={s.hintKey}>Showing</span> {focusLabel}
          </>
        )}
        </span>
      </div>
    </section>
  );
}
