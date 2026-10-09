"use client";
// The side-panel frame every HUD panel uses (depth 3 of "inspect like a game"):
// near-solid panel over the world, corner brackets, eyebrow + title, 📌 pin (remembered), ✕, breadcrumb when drilled,
// a body that scrolls inside, an optional action bar and a next-step hint line. Esc closes it unless pinned.
import { ChevronLeft, ChevronRight, Pin, PinOff, X } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { IconButton, cx } from "@/components/ui";
import { useEscape, usePinned } from "./store";
import s from "./hud.module.css";

export interface Crumb {
  label: string;
  onClick?: () => void;
}

export interface HudPanelProps {
  /** Which edge it slides in from; "inline" = no slide (gallery, mobile sheet). */
  side?: "left" | "right" | "inline";
  eyebrow?: ReactNode;
  title: ReactNode;
  /** next to the title, e.g. a status pill */
  aside?: ReactNode;
  /** extra controls in the title bar, left of 📌 / ✕ (e.g. the ALL TIME · year · month switch) */
  tools?: ReactNode;
  /** Shows the 📌 pin; pinned panels stay open (remembered per browser under this id). */
  pinId?: string;
  /** ✕ button and Esc (Esc is ignored while pinned). */
  onClose?: () => void;
  /** Breadcrumb trail, root first; the last crumb is the current view. */
  crumbs?: Crumb[];
  onBack?: () => void;
  /** Sticky action bar at the bottom (2–3 primary actions). */
  actions?: ReactNode;
  /** Next-step hint at the very bottom ("Click a number for its breakdown"). */
  hint?: ReactNode;
  /** Corner-bracket colour (one accent per panel). */
  accent?: "marigold" | "teal" | "coral" | "sky";
  /** Changes re-animate the body (drill-down steps). */
  bodyKey?: string;
  /** Body without padding/scroll (for views that scroll themselves, e.g. inline forms). */
  bodyFlush?: boolean;
  width?: number;
  className?: string;
  children: ReactNode;
}

export function HudPanel({
  side = "right",
  eyebrow,
  title,
  aside,
  tools,
  pinId,
  onClose,
  crumbs,
  onBack,
  actions,
  hint,
  accent = "marigold",
  bodyKey,
  bodyFlush,
  width,
  className,
  children,
}: HudPanelProps) {
  const [pinned, setPinned] = usePinned(pinId ?? "_none");
  const canPin = Boolean(pinId);
  useEscape(Boolean(onClose) && !(canPin && pinned), () => onClose?.());
  const dx = side === "left" ? -28 : side === "right" ? 28 : 0;
  const drilled = crumbs && crumbs.length > 1;

  return (
    <motion.aside
      className={cx(s.panel, s[`accent-${accent}`], side === "inline" && s.panelInline, className)}
      style={width ? { width } : undefined}
      initial={{ opacity: 0, x: dx }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: dx, transition: { duration: 0.16 } }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <header className={s.panelHead}>
        <div className={s.panelTitles}>
          {eyebrow && (
            <div className={s.panelEyebrow}>
              <span className={s.pip} aria-hidden />
              {eyebrow}
            </div>
          )}
          <div className={s.panelTitleRow}>
            <h2 className={s.panelTitle}>{title}</h2>
            {aside}
          </div>
        </div>
        {tools && <div className={s.panelHeadTools}>{tools}</div>}
        <div className={s.panelTools}>
          {canPin && (
            <IconButton
              size="sm"
              label={pinned ? "Unpin — closes with Esc again" : "Pin — keep this panel open"}
              icon={pinned ? <PinOff /> : <Pin />}
              className={cx(s.pinBtn, pinned && s.pinOn)}
              aria-pressed={pinned}
              onClick={() => setPinned(!pinned)}
            />
          )}
          {onClose && <IconButton size="sm" label={pinned ? "Close" : "Close (Esc)"} icon={<X />} onClick={onClose} />}
        </div>
      </header>

      {drilled && (
        <nav className={s.crumbs} aria-label="Breadcrumb">
          {onBack && (
            <button type="button" className={s.crumbBack} onClick={onBack} aria-label="Back one step">
              <ChevronLeft aria-hidden />
            </button>
          )}
          <ol>
            {crumbs!.map((c, i) => {
              const last = i === crumbs!.length - 1;
              return (
                <li key={i}>
                  {i > 0 && <ChevronRight className={s.crumbSep} aria-hidden />}
                  {last || !c.onClick ? (
                    <span className={cx(s.crumb, last && s.crumbCurrent)} aria-current={last ? "page" : undefined}>
                      {c.label}
                    </span>
                  ) : (
                    <button type="button" className={cx(s.crumb, s.crumbLink)} onClick={c.onClick}>
                      {c.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <motion.div
        key={bodyKey}
        className={cx(s.panelBody, bodyFlush && s.panelBodyFlush)}
        initial={bodyKey !== undefined ? { opacity: 0, x: 10 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>

      {actions && <div className={s.panelActions}>{actions}</div>}
      {/* no instruction lines (owner): only a non-text footer such as the ledger badge renders here */}
      {hint != null && typeof hint !== "string" && (
        <div className={s.panelHint}>
          {hint}
        </div>
      )}
    </motion.aside>
  );
}

/** Titled group inside a panel body. */
export function PanelSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx(s.section, className)}>{children}</section>;
}
