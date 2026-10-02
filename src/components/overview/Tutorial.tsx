"use client";
// First-run tour (DESIGN.md "Discoverability & hints"): six coach marks with a spotlight — the world, a house,
// the mailbox, the HUD numbers, the dock + time scrubber, ⌘K. Next / Back / Skip; ←/→/Enter/Esc work too.
// Remembered per browser (pe.overview.tour); replay from the "?" help or ⌘K.
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ObjectScreenFn, SceneInsets } from "@/components/estate/EstateSceneLazy";
import { Button, Kbd, cx, useIsClient } from "@/components/ui";
import type { UnitBreakdown } from "@/lib/dashboard-types";
import s from "./tour.module.css";

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

interface Step {
  id: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  find: () => Hole | null;
}

export interface TutorialProps {
  open: boolean;
  onClose: () => void;
  locate: ObjectScreenFn | null;
  units: UnitBreakdown[];
  insets: SceneInsets;
  rootEl: HTMLElement | null;
}

const CARD_W = 340;
const PAD = 16;

function rectHole(el: Element | null, pad = 8): Hole | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, r: 8 };
}
const circle = (p: { x: number; y: number } | null, radius: number, dy = 0): Hole | null =>
  p ? { x: p.x - radius, y: p.y + dy - radius, w: radius * 2, h: radius * 2, r: radius } : null;

export function Tutorial({ open, onClose, locate, units, insets, rootEl }: TutorialProps) {
  const isClient = useIsClient();
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [card, setCard] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const house = units.find((u) => u.activeLease) ?? units[0];
  const steps: Step[] = [
    {
      id: "world",
      eyebrow: "Your estate",
      title: "This is your plot, live",
      body: (
        <>
          Both houses, the street and the palms — on Pattukottai time. The ring around a house is its rent: <b className={s.teal}>teal</b> paid,{" "}
          <b className={s.marigold}>marigold</b> due soon, <b className={s.coral}>coral</b> late.
        </>
      ),
      find: () => {
        if (!rootEl) return null;
        const r = rootEl.getBoundingClientRect();
        const l = r.left + insets.left;
        const t = r.top + insets.top;
        const w = r.width - insets.left - insets.right;
        const h = r.height - insets.top - insets.bottom;
        const size = Math.min(w * 0.62, h * 0.86);
        return { x: l + (w - size) / 2, y: t + (h - size) / 2, w: size, h: size, r: size / 2 };
      },
    },
    {
      id: "house",
      eyebrow: "Click a house",
      title: house ? `${house.name} — click it` : "Click a house",
      body: (
        <>
          Opens its tenant, rent and what it&rsquo;s worth. <b>Right-click</b> it (press and hold on a phone) for quick actions like Record rent.
        </>
      ),
      find: () => circle(house ? (locate?.("unit", house.id) ?? null) : null, 92, 70),
    },
    {
      id: "mailbox",
      eyebrow: "Things at the gate",
      title: "The mailbox takes rent",
      body: (
        <>
          Click it to record rent and see receipts. The <b>notice board</b> holds your to-dos, the <b>pole</b> has the electricity numbers, and the
          stamp on the gate pillar is <b>property tax</b>.
        </>
      ),
      find: () => circle(locate?.("mailbox") ?? null, 54, 14),
    },
    {
      id: "chips",
      eyebrow: "The numbers",
      title: "What needs you, first",
      body: (
        <>
          These chips show what needs attention. <Kbd>P</Kbd> opens the whole property — click any number there to see exactly how it&rsquo;s worked out.
        </>
      ),
      find: () => rectHole(document.querySelector('[data-tour="chips"]'), 6),
    },
    {
      id: "dock",
      eyebrow: "Charts and time",
      title: "Charts, and the time machine",
      body: (
        <>
          Charts open from this tray (keys <Kbd>1</Kbd>–<Kbd>6</Kbd>). Drag the timeline to any past date — the houses and every number go back with it. <b>Live</b> returns to today.
        </>
      ),
      find: () => rectHole(document.querySelector('[data-tour="bottom"]'), 6),
    },
    {
      id: "cmdk",
      eyebrow: "Anywhere, fast",
      title: "Press Ctrl K",
      body: (
        <>
          Record rent, add an expense or jump to any screen by typing. Press <Kbd>?</Kbd> any time for help and every shortcut.
        </>
      ),
      find: () => rectHole(document.querySelector('[aria-label="Open command palette"]') ?? document.querySelector('[aria-label="Commands"]'), 6),
    },
  ];
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // follow the target (the camera glides; panels animate)
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const h = stepsRef.current[Math.min(i, stepsRef.current.length - 1)].find();
      setHole((p) => (p && h && Math.abs(p.x - h.x) < 1 && Math.abs(p.y - h.y) < 1 && Math.abs(p.w - h.w) < 1 ? p : h));
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ch = cardRef.current?.offsetHeight ?? 210;
      const cw = Math.min(CARD_W, vw - PAD * 2);
      let left = vw / 2 - cw / 2;
      let top = vh / 2 - ch / 2;
      if (h) {
        left = Math.min(Math.max(h.x + h.w / 2 - cw / 2, PAD), vw - cw - PAD);
        if (h.y + h.h + 14 + ch <= vh - PAD) top = h.y + h.h + 14;
        else if (h.y - 14 - ch >= PAD) top = h.y - 14 - ch;
        else {
          top = Math.min(Math.max(h.y + h.h / 2 - ch / 2, PAD), vh - ch - PAD);
          left = h.x + h.w + 16 + cw <= vw - PAD ? h.x + h.w + 16 : Math.max(PAD, h.x - 16 - cw);
        }
      }
      setCard((p) => (p && Math.abs(p.left - left) < 1 && Math.abs(p.top - top) < 1 ? p : { left, top }));
    };
    place();
    const id = window.setInterval(place, 220);
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", place);
    };
  }, [open, i, rootEl, insets, locate]);

  useEffect(() => {
    if (open) nextRef.current?.focus({ preventScroll: true });
  }, [open, i]);

  const next = useCallback(() => (last ? onClose() : setI((n) => n + 1)), [last, onClose]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, next, back, onClose]);

  if (!isClient) return null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const hl = hole ?? { x: vw / 2, y: vh / 2, w: 0, h: 0, r: 0 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className={s.tour}
          role="dialog"
          aria-modal="true"
          aria-label="Tour"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.3 }}
        >
          <svg className={s.shade} width="100%" height="100%" aria-hidden>
            <defs>
              <mask id="pe-tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <motion.rect
                  fill="black"
                  initial={false}
                  animate={{ x: hl.x, y: hl.y, width: hl.w, height: hl.h, rx: hl.r }}
                  transition={{ type: "spring", stiffness: 170, damping: 26 }}
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" className={s.dim} mask="url(#pe-tour-mask)" />
            {hole && (
              <motion.rect
                className={s.ring}
                initial={false}
                animate={{ x: hl.x, y: hl.y, width: hl.w, height: hl.h, rx: hl.r }}
                transition={{ type: "spring", stiffness: 170, damping: 26 }}
              />
            )}
          </svg>

          <motion.div
            ref={cardRef}
            className={s.card}
            style={{ width: Math.min(CARD_W, vw - PAD * 2) }}
            initial={false}
            animate={card ? { left: card.left, top: card.top, opacity: 1 } : { opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          >
            <div className={s.head}>
              <span className={s.eyebrow}>{step.eyebrow}</span>
              <span className={s.count}>
                {i + 1} / {steps.length}
              </span>
            </div>
            <motion.div key={step.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <h2 className={s.title}>{step.title}</h2>
              <p className={s.body}>{step.body}</p>
            </motion.div>
            <div className={s.pips} aria-hidden>
              {steps.map((st, n) => (
                <span key={st.id} className={cx(s.pip, n === i && s.pipOn, n < i && s.pipDone)} />
              ))}
            </div>
            <div className={s.actions}>
              <button type="button" className={s.skip} onClick={onClose}>
                {last ? "Close" : "Skip tour"}
              </button>
              <span className={s.flex} />
              {i > 0 && (
                <Button size="sm" variant="ghost" icon={<ArrowLeft />} onClick={back}>
                  Back
                </Button>
              )}
              <Button ref={nextRef} size="sm" variant="primary" iconRight={last ? undefined : <ArrowRight />} onClick={next}>
                {last ? "Start playing" : "Next"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
