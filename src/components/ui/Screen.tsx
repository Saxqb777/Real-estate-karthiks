import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Screen.module.css";

export interface ScreenProps extends HTMLAttributes<HTMLDivElement> {
  /** Cap the width at --page-max (1440px) and centre it (default true). */
  contained?: boolean;
  /** No padding — for full-bleed layouts like the 3D overview. */
  flush?: boolean;
  children: ReactNode;
}

/**
 * Root of a page inside the app shell. Fills the space under the HUD bar exactly (ONE-SCREEN RULE):
 * lay out panels inside with flex/grid and let them scroll internally (<ScrollArea>, <Panel fill>).
 */
export function Screen({ contained = true, flush = false, className, children, ...rest }: ScreenProps) {
  return (
    <div className={cx(styles.screen, contained && styles.contained, flush && styles.flush, className)} {...rest}>
      {children}
    </div>
  );
}

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Soft fade at the top/bottom edges. */
  fade?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

/** A region that scrolls internally (flex: 1; min-height: 0). */
export function ScrollArea({ fade, className, children, ...rest }: ScrollAreaProps) {
  return (
    <div className={cx(styles.scroll, fade && styles.fade, className)} {...rest}>
      {children}
    </div>
  );
}
