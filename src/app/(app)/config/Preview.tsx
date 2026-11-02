"use client";
// Live 3D preview for the Plot and Units forms: draws the UNSAVED values and lights up the dimension of the focused field.
import { useCallback, useEffect, useState } from "react";
import EstateSceneLazy, { type EstateSceneProps } from "@/components/estate/EstateSceneLazy";
import { cx } from "@/components/ui";
import s from "./config.module.css";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const two = (n: number) => String(n).padStart(2, "0");
/** CCTV stamp in property time (IST, UTC+5:30, no DST): "01-11-2026 SUN 21:42:07". */
function cctvStamp(now: Date): { date: string; time: string } {
  const d = new Date(now.getTime() + 330 * 60_000);
  return {
    date: `${two(d.getUTCDate())}-${two(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${DAYS[d.getUTCDay()]}`,
    time: `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`,
  };
}

/** The camera's on-screen clock, ticking every second (starts after mount, so server and browser agree). */
function useCctvClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = new Date();
      setNow(n);
      t = setTimeout(tick, 1000 - (n.getTime() % 1000) + 5); // on the second, like a real camera clock
    };
    t = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(t);
  }, []);
  return now;
}

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
  // CCTV footage (owner 1/11/2026: "instead of live preview make it look like a cctv footage with date and time"): the
  // "Live preview" chip is gone — the picture carries a camera's on-screen display instead: the property's date and time
  // (IST, ticking) top-left, a blinking ● REC top-right, the camera name bottom-right, faint scan lines + a vignette
  const now = useCctvClock();
  const stamp = now ? cctvStamp(now) : null;
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
      <div className={cx(s.cctvFeed, live && s.cctvFeedOn)} aria-hidden />
      <div className={cx(s.osd, live && s.osdOn)} aria-hidden>
        <span className={s.osdClock}>
          {stamp && (
            <>
              <span>{stamp.date}</span>
              <span>{stamp.time}</span>
            </>
          )}
        </span>
        <span className={s.osdRec}>
          <i className={s.osdRecDot} />
          REC
        </span>
        <span className={s.osdCam}>CAM 01</span>
      </div>
      <div className={s.previewTop}>
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
