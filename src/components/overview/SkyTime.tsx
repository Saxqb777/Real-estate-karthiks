"use client";
// The sun / moon in the painted sky is a world object too (owner): hover it for the time at the property (IST) and at
// home (UAE); click it for TIME TRAVEL — the as-of timeline in one floating panel.
import { ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { skyBody } from "@/components/estate/sky-body";
import { useEscape } from "@/components/hud";
import { useEpochSecond } from "@/components/shell/IstClock";
import { Button, IconButton, InspectCard } from "@/components/ui";
import { HOME_ZONE, clockAt, formatTimeIST } from "@/lib/day-phase";
import s from "./sky.module.css";

/** Invisible round target that rides on the sun / moon, with a name-tag style clock on hover. */
export function SkyTarget({ onClick, active }: { onClick: () => void; active: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<"sun" | "moon">("sun");
  const [hover, setHover] = useState(false);
  const sec = useEpochSecond();
  const now = sec ? new Date(sec * 1000) : null;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const show = skyBody.live && skyBody.vis > 0.25;
        const d = Math.max(56, skyBody.r * 2.6);
        el.style.display = show ? "block" : "none";
        el.style.left = `${skyBody.x - d / 2}px`;
        el.style.top = `${skyBody.y - d / 2}px`;
        el.style.width = el.style.height = `${d}px`;
        setKind((k) => (k === skyBody.kind ? k : skyBody.kind));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const home = now ? clockAt(now, HOME_ZONE.offsetMin) : null;
  return (
    <button
      ref={ref}
      type="button"
      className={s.target}
      data-active={active || undefined}
      aria-label={`${kind === "sun" ? "Sun" : "Moon"} — time travel`}
      onClick={onClick}
      onPointerEnter={(e) => setHover(e.pointerType === "mouse")}
      onPointerLeave={() => setHover(false)}
    >
      <AnimatePresence>
        {hover && now && home && (
          <motion.span key="tag" className={s.tag} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
            <span>
              <b className="num">{formatTimeIST(now)}</b> IST
            </span>
            <span className={s.dot} aria-hidden />
            <span>
              <b className="num">
                {home.time} {home.ampm}
              </b>{" "}
              {HOME_ZONE.label}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** The sun / moon's card (same gold card as every world object): the time at the property and at home, "Open" → time travel. */
export function SkyCard({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) {
  const sec = useEpochSecond();
  const now = sec ? new Date(sec * 1000) : null;
  const home = now ? clockAt(now, HOME_ZONE.offsetMin) : null;
  // pinned where the sun / moon was when clicked (it barely moves while the card is up)
  const anchor = useMemo(() => (open && skyBody.live ? { x: skyBody.x, y: skyBody.y } : null), [open]);
  return (
    <InspectCard
      open={open}
      anchor={anchor}
      onClose={onClose}
      onExpand={onOpen}
      eyebrow={skyBody.kind === "sun" ? "Sun" : "Moon"}
      title="Time"
      width={260}
      actions={
        <Button size="sm" variant="primary" iconRight={<ChevronRight />} onClick={onOpen} style={{ marginLeft: "auto" }}>
          Open
        </Button>
      }
    >
      {now && home && (
        <div className={s.cardRows}>
          <div>
            <span>Pattukkottai</span>
            <b className="num">{formatTimeIST(now)} IST</b>
          </div>
          <div>
            <span>Home</span>
            <b className="num">
              {home.time} {home.ampm} {HOME_ZONE.label}
            </b>
          </div>
        </div>
      )}
    </InspectCard>
  );
}

/** Floating TIME TRAVEL panel: the as-of timeline. */
export function TimePanel({ open, onClose, timeline }: { open: boolean; onClose: () => void; timeline: ReactNode }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key="time"
          className={s.panel}
          aria-label="Time travel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className={s.head}>
            <h2 className={s.title}>Time travel</h2>
            <span className={s.flex} />
            <IconButton size="sm" label="Close (Esc)" icon={<X />} onClick={onClose} />
          </header>
          <div className={s.timeline}>{timeline}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
