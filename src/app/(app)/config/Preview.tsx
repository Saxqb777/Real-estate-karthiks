"use client";
// Live 3D preview for the Plot and Units forms: draws the UNSAVED values and lights up the dimension of the focused field.
import { useCallback, useEffect, useState } from "react";
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
  // CCTV power-on (owner 1/11/2026: "when the live preview load make it look like a cctv is turning on"): a white line
  // opens into static until the scene's first frame is drawn, then the static clears and the picture warms from black
  // and white into colour. Plays each time the preview mounts (Units / Plot).
  const [live, setLive] = useState(false);
  const onFirstFrame = useCallback(() => setLive(true), []);
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
          onFirstFrame={onFirstFrame}
        />
      )}
      <div className={cx(s.cctvTint, live && s.cctvTintOff)} aria-hidden />
      <div className={cx(s.cctv, live && s.cctvLive)} aria-hidden>
        <i className={s.cctvNoise} />
        <i className={s.cctvScan} />
        <i className={s.cctvRoll} />
        <i className={s.cctvLine} />
      </div>
      <div className={s.previewTop}>
        <span className={s.liveChip}>
          <span className={s.liveDot} aria-hidden />
          Live preview
        </span>
        {dirty && <span className={s.unsavedChip}>Unsaved — not stored yet</span>}
        {/* "Showing <field>" only while a field is in focus — never an empty chip (owner 1/11/2026: the grey box) */}
        {focusLabel && (
          <span className={s.previewHint} aria-live="polite">
            <span className={s.hintKey}>Showing</span> {focusLabel}
          </span>
        )}
      </div>
    </section>
  );
}
