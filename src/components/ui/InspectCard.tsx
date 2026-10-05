"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./Button";
import { cx } from "./cx";
import { isFocusTrapActive, useIsClient } from "./hooks";
import styles from "./InspectCard.module.css";

export interface InspectCardProps {
  open: boolean;
  /** Point the card is attached to, in viewport px (e.g. a 3D object projected to the screen). */
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  /** Shows ⤢ and handles Enter — open the full side panel (depth 3). */
  onExpand?: () => void;
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Next to the title, e.g. a <StatusPill>. */
  aside?: ReactNode;
  children?: ReactNode;
  /** 2–3 primary actions. */
  actions?: ReactNode;
  width?: number;
  /** Which side of the anchor the card prefers. */
  side?: "auto" | "left" | "right";
  className?: string;
}

const GAP = 64; // horizontal distance between anchor and card
const MARGIN = 12;

interface Layout {
  left: number;
  top: number;
  side: "left" | "right";
  attachX: number;
  attachY: number;
}

/**
 * "Inspect like a game", depth 2: a card anchored to a world object with a leader line.
 * Non-modal (the world stays interactive); Esc closes it unless a dialog is open on top.
 */
export function InspectCard({
  open,
  anchor,
  onClose,
  onExpand,
  eyebrow,
  title,
  aside,
  children,
  actions,
  width = 300,
  side = "auto",
  className,
}: InspectCardProps) {
  const isClient = useIsClient();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const handlers = useRef({ onClose, onExpand });
  useEffect(() => {
    handlers.current = { onClose, onExpand };
  });

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const h = ref.current?.offsetHeight ?? 220;
      const fitsRight = anchor.x + GAP + width + MARGIN <= vw;
      const fitsLeft = anchor.x - GAP - width - MARGIN >= 0;
      const s: "left" | "right" = side === "left" ? (fitsLeft ? "left" : "right") : side === "right" ? (fitsRight ? "right" : "left") : fitsRight || !fitsLeft ? "right" : "left";
      const rawLeft = s === "right" ? anchor.x + GAP : anchor.x - GAP - width;
      const left = Math.min(Math.max(rawLeft, MARGIN), vw - width - MARGIN);
      const top = Math.min(Math.max(anchor.y - 34, 70), vh - h - MARGIN);
      setLayout({ left, top, side: s, attachX: s === "right" ? left : left + width, attachY: Math.min(Math.max(anchor.y, top + 18), top + h - 18) });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, width, side]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isFocusTrapActive()) return;
      if (e.key === "Escape") handlers.current.onClose();
      else if (e.key === "Enter" && handlers.current.onExpand) {
        const a = document.activeElement;
        if (!a || a === document.body || a === ref.current) handlers.current.onExpand();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isClient) return null;
  const show = open && anchor;
  const dir = layout?.side === "left" ? -1 : 1;
  const elbowX = layout ? layout.attachX - dir * 18 : 0;
  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {layout && (
            <motion.svg key="lines" className={styles.lines} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} aria-hidden>
              <motion.path
                className={styles.leader}
                d={`M${anchor.x} ${anchor.y} L${elbowX} ${layout.attachY} L${layout.attachX} ${layout.attachY}`}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              />
              <circle className={styles.anchorRing} cx={anchor.x} cy={anchor.y} r="6" />
              <rect className={styles.anchorDot} x={anchor.x - 3.5} y={anchor.y - 3.5} width="7" height="7" transform={`rotate(45 ${anchor.x} ${anchor.y})`} />
            </motion.svg>
          )}
          <motion.div
            key="card"
            ref={ref}
            role="dialog"
            aria-labelledby={`${id}-t`}
            tabIndex={-1}
            className={cx(styles.card, className)}
            style={{ width, left: layout?.left ?? -9999, top: layout?.top ?? -9999, transformOrigin: layout?.side === "left" ? "right center" : "left center" }}
            initial={{ opacity: 0, scale: 0.92, x: -dir * 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.head}>
              <div className={styles.titles}>
                {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
                <div className={styles.titleRow}>
                  <h3 id={`${id}-t`} className={styles.title}>
                    {title}
                  </h3>
                  {aside}
                </div>
              </div>
              <div className={styles.tools}>
                <IconButton label="Close (Esc)" icon={<X />} size="sm" onClick={onClose} />
              </div>
            </div>
            {children !== undefined && <div className={styles.body}>{children}</div>}
            {actions && <div className={styles.actions}>{actions}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
