"use client";
// Time scrubber (DESIGN.md "Time scrubber"): purchase → today. Dragging sets an "as of" date — the world shows who
// lived where on that date and every HUD figure is recomputed by /api/dashboard?asOf= (never here).
// Year ticks + lease / purchase / offer / big-expense markers come from data.timeline; ▶ plays through time month by
// month; LIVE snaps back to today. Keyboard: ←/→ one month, Shift+←/→ or PageUp/PageDown one year, Home, End = live.
import { History, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cx } from "@/components/ui";
import type { Timeline, TimelineMarker } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import s from "./scrubber.module.css";

export interface TimeScrubberProps {
  timeline: Timeline;
  /** "YYYY-MM-DD" being viewed, null = live (today) */
  asOf: string | null;
  /** debounced while dragging; null = back to live */
  onChange: (date: string | null) => void;
  /** a new as-of date is loading (previous figures stay on screen) */
  loading?: boolean;
  yearMode: "fy" | "calendar";
  /** phones: fewer labels, no small markers */
  compact?: boolean;
  /** first interaction (clears the "unexplored" dot) */
  onUse?: () => void;
  className?: string;
}

const DAY = 86_400_000;
const DEBOUNCE = 170;

const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY;
function addMonths(ms: number, n: number) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
}

const MARKER_NAME: Record<TimelineMarker["kind"], string> = {
  purchase: "Bought",
  "lease-start": "Moved in",
  "lease-end": "Last day",
  offer: "Offer",
  expense: "Big expense",
};

function tickLabel(label: string, key: number, mode: "fy" | "calendar", compact: boolean) {
  if (mode === "calendar") return compact ? `’${String(key).slice(2)}` : String(key);
  const a = String(key).slice(2);
  const b = String((key + 1) % 100).padStart(2, "0");
  return compact ? `${a}-${b}` : `FY ${a}-${b}`;
}

export function TimeScrubber({ timeline, asOf, onChange, loading, yearMode, compact = false, onUse, className }: TimeScrubberProps) {
  const start = timeline.range.start ? dayStart(Date.parse(timeline.range.start)) : null;
  const end = dayStart(Date.parse(timeline.range.end));
  const span = start !== null ? Math.max(DAY, end - start) : DAY;
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverMarker, setHoverMarker] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTrackW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [start]);

  const committed = asOf ? dayStart(Date.parse(asOf)) : end;
  const value = drag ?? committed;
  const live = drag === null ? asOf === null : drag >= end;
  const ratio = start === null ? 1 : Math.min(1, Math.max(0, (value - start) / span));

  // ---------------------------------------------------------------- commit (debounced)
  const commit = useCallback(
    (ms: number, now = false) => {
      if (timer.current) window.clearTimeout(timer.current);
      const out = ms >= end ? null : toKey(ms);
      if (now) changeRef.current(out);
      else timer.current = window.setTimeout(() => changeRef.current(out), DEBOUNCE);
    },
    [end],
  );
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const clamp = useCallback((ms: number) => (start === null ? end : Math.min(end, Math.max(start, dayStart(ms)))), [start, end]);

  const markers = useMemo(() => {
    if (start === null) return [];
    const list = compact ? timeline.markers.filter((m) => m.kind === "purchase" || m.kind === "lease-start" || m.kind === "lease-end") : timeline.markers;
    return list
      .map((m, i) => ({ m, i, r: (dayStart(Date.parse(m.date)) - start) / span }))
      .filter((x) => x.r >= 0 && x.r <= 1);
  }, [timeline.markers, start, span, compact]);

  /** px → date, with a gentle snap to markers within 6px */
  const fromClientX = useCallback(
    (clientX: number) => {
      const el = track.current;
      if (!el || start === null) return end;
      const rect = el.getBoundingClientRect();
      const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
      const near = markers.find((mk) => Math.abs(mk.r * rect.width - x) <= 6);
      if (near) return dayStart(Date.parse(near.m.date));
      if (rect.width - x <= 6) return end;
      return clamp(start + (x / rect.width) * span);
    },
    [markers, start, end, span, clamp],
  );

  // ---------------------------------------------------------------- play ▶
  const stop = useCallback(() => setPlaying(false), []);
  useEffect(() => {
    if (!playing || start === null) return;
    const months = Math.max(1, Math.round(span / (30.44 * DAY)));
    const every = Math.min(560, Math.max(170, 26_000 / months));
    let cur = asOf ? Math.min(end, dayStart(Date.parse(asOf))) : start;
    if (cur >= end) cur = start;
    changeRef.current(toKey(cur));
    const id = window.setInterval(() => {
      cur = addMonths(cur, 1);
      if (cur >= end) {
        window.clearInterval(id);
        setPlaying(false);
        changeRef.current(null);
        return;
      }
      changeRef.current(toKey(cur));
    }, every);
    return () => window.clearInterval(id);
    // asOf is read once when play starts (the interval drives it afterwards)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, start, end, span]);

  // ---------------------------------------------------------------- pointer
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (start === null || e.button > 0) return;
    e.preventDefault();
    onUse?.();
    stop();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ms = fromClientX(e.clientX);
    setDrag(ms);
    commit(ms);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    if (rect) setHoverX(e.clientX - rect.left);
    if (drag === null) return;
    const ms = fromClientX(e.clientX);
    if (ms !== drag) {
      setDrag(ms);
      commit(ms);
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const ms = fromClientX(e.clientX);
    setDrag(null);
    commit(ms, true);
  };

  // ---------------------------------------------------------------- keyboard
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (start === null) return;
    const step = (n: number) => {
      e.preventDefault();
      stop();
      onUse?.();
      commit(clamp(addMonths(committed, n)), true);
    };
    switch (e.key) {
      case "ArrowLeft":
        return step(e.shiftKey ? -12 : -1);
      case "ArrowRight":
        return step(e.shiftKey ? 12 : 1);
      case "PageDown":
        return step(-12);
      case "PageUp":
        return step(12);
      case "Home":
        e.preventDefault();
        stop();
        return commit(start, true);
      case "End":
        e.preventDefault();
        stop();
        return commit(end, true);
    }
  };

  // ---------------------------------------------------------------- render
  if (start === null)
    return (
      <div className={cx(s.scrubber, s.empty, className)}>
        <History aria-hidden className={s.emptyIcon} />
        <span>The timeline starts when your first unit is added.</span>
      </div>
    );

  // year ticks; labels are skipped where they would touch the previous one
  let lastX = -Infinity;
  const ticks = timeline.yearTicks
    .map((t) => ({ key: t.key, r: (Date.parse(t.date) - start) / span, text: tickLabel(t.label, t.key, yearMode, compact) }))
    .filter((t) => t.r > 0.005 && t.r < 0.995)
    .map((t) => {
      const x = t.r * trackW;
      const w = t.text.length * (compact ? 6.2 : 6.6) + 4;
      const show = trackW > 0 && x - lastX >= w + 6 && x + w <= trackW - 4;
      if (show) lastX = x;
      return { key: t.key, r: t.r, label: show ? t.text : null };
    });

  const valueLabel = live ? `Today ${formatDate(new Date(end))}` : `As of ${formatDate(new Date(value))}`;
  const hoverMs = hoverX !== null && drag === null && track.current ? clamp(start + (hoverX / track.current.getBoundingClientRect().width) * span) : null;
  const hm = hoverMarker !== null ? markers.find((x) => x.i === hoverMarker) : null;

  return (
    <div className={cx(s.scrubber, compact && s.compact, !live && s.past, className)} data-tour="scrubber">
      <button
        type="button"
        className={cx(s.play, playing && s.playOn)}
        onClick={() => {
          onUse?.();
          setPlaying((p) => !p);
        }}
        aria-label={playing ? "Pause" : "Play through time"}
        title={playing ? "Pause" : "Play: watch the years go by, month by month"}
      >
        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
      </button>

      <div className={s.readout} aria-live="polite">
        <span className={s.readKind}>{live ? "Today" : "As of"}</span>
        <span className={cx(s.readDate, loading && s.loading)}>{formatDate(new Date(value))}</span>
      </div>

      <div
        ref={track}
        className={cx(s.track, drag !== null && s.dragging)}
        role="slider"
        tabIndex={0}
        aria-label="As-of date"
        aria-valuemin={start}
        aria-valuemax={end}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onPointerLeave={() => setHoverX(null)}
        onKeyDown={onKeyDown}
      >
        {/* occupancy lanes, one per unit: teal = let, faint = empty */}
        <div className={s.lanes} aria-hidden>
          {timeline.units.map((u) => (
            <div key={u.unitId} className={s.lane}>
              {u.vacant.map((v, i) => {
                const a = Math.max(0, (Date.parse(v.start) - start) / span);
                const b = Math.min(1, (Date.parse(v.end) - start) / span);
                return b > a ? <span key={`v${i}`} className={s.vacant} style={seg(a, b)} /> : null;
              })}
              {u.leases.map((l) => {
                const a = Math.max(0, (Date.parse(l.start) - start) / span);
                const b = Math.min(1, ((l.end ? Date.parse(l.end) + DAY : end) - start) / span);
                return b > a ? <span key={l.leaseId} className={s.let} style={seg(a, b)} /> : null;
              })}
            </div>
          ))}
        </div>

        {ticks.map((t) => (
          <span key={t.key} className={s.tick} style={{ left: `${t.r * 100}%` }} aria-hidden>
            {t.label && <span className={s.tickLabel}>{t.label}</span>}
          </span>
        ))}

        {markers.map(({ m, i, r }) => (
          <span
            key={i}
            className={s.marker}
            data-kind={m.kind}
            style={{ left: `${r * 100}%` }}
            onPointerEnter={() => setHoverMarker(i)}
            onPointerLeave={() => setHoverMarker((h) => (h === i ? null : h))}
            aria-hidden
          />
        ))}

        {hoverMs !== null && !hm && (
          <span className={s.ghost} style={{ left: `${((hoverMs - start) / span) * 100}%` }} aria-hidden>
            <span className={s.flag}>{formatDate(new Date(hoverMs))}</span>
          </span>
        )}
        {hm && (
          <span className={s.ghost} style={{ left: `${hm.r * 100}%` }} aria-hidden>
            <span className={cx(s.flag, s.flagMarker)} data-kind={hm.m.kind}>
              <b>{MARKER_NAME[hm.m.kind]}</b> {formatDate(hm.m.date)} · {hm.m.label}
              {hm.m.amount !== null && hm.m.kind !== "lease-end" ? ` · ${formatINR(hm.m.amount)}${hm.m.kind === "lease-start" ? "/mo" : ""}` : ""}
            </span>
          </span>
        )}

        <span className={s.head} style={{ left: `${ratio * 100}%` }} aria-hidden>
          <span className={s.knob} />
          {drag !== null && <span className={cx(s.flag, s.flagHead)}>{formatDate(new Date(value))}</span>}
        </span>
      </div>

      <button
        type="button"
        className={cx(s.live, live && s.liveOn)}
        onClick={() => {
          stop();
          setDrag(null);
          commit(end, true);
        }}
        disabled={live && !playing}
        aria-label={live ? "Showing today" : "Back to today"}
        title={live ? "Showing today" : "Back to today (End)"}
      >
        <span className={s.liveDot} aria-hidden />
        Live
      </button>
    </div>
  );
}

const seg = (a: number, b: number): CSSProperties => ({ left: `${a * 100}%`, width: `${(b - a) * 100}%` });
