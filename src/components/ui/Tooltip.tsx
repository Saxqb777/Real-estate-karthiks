"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useIsClient } from "./hooks";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
  /** ms before showing on hover (focus shows immediately) */
  delay?: number;
  /** Add aria-describedby to the child (off when the child's accessible name already equals the tip). */
  describe?: boolean;
  className?: string;
}

interface Pos {
  x: number;
  y: number;
  side: "top" | "bottom";
  arrowX: number;
}

/** Small hover/focus tooltip rendered in a portal so it never gets clipped by scroll containers. */
export function Tooltip({ content, children, placement = "top", delay = 220, describe = true, className }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const isClient = useIsClient();

  const show = useCallback(
    (immediate = false) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setOpen(true), immediate ? 0 : delay);
    },
    [delay],
  );
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!t) return;
      const w = tip?.width ?? 120;
      const h = tip?.height ?? 28;
      const side = placement === "top" && t.top < h + 14 ? "bottom" : placement === "bottom" && t.bottom + h + 14 > window.innerHeight ? "top" : placement;
      const cx0 = t.left + t.width / 2;
      const x = Math.min(Math.max(cx0, 8 + w / 2), window.innerWidth - 8 - w / 2);
      setPos({ x, y: side === "top" ? t.top - 8 : t.bottom + 8, side, arrowX: w / 2 + (cx0 - x) });
    };
    place();
    const raf = requestAnimationFrame(place); // re-measure once the tip has its real size
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, placement, hide]);

  useLayoutEffect(() => () => window.clearTimeout(timer.current), []);

  const child =
    describe && isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": open ? id : undefined })
      : children;

  return (
    <span
      ref={triggerRef}
      className={cx(styles.trigger, className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {child}
      {isClient &&
        createPortal(
          <AnimatePresence>
            {open && content && (
              <motion.div
                ref={tipRef}
                id={id}
                role="tooltip"
                className={cx(styles.tip, pos?.side === "bottom" ? styles.bottom : styles.top)}
                style={{
                  left: pos?.x ?? -9999,
                  top: pos?.y ?? -9999,
                  translate: pos?.side === "bottom" ? "-50% 0" : "-50% -100%",
                  ["--arrow-x" as string]: `${pos?.arrowX ?? 0}px`,
                }}
                initial={{ opacity: 0, y: pos?.side === "bottom" ? -4 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
