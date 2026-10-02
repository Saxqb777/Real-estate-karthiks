import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Panel.module.css";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  /** Buttons / filters shown at the right of the header. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** default = solid textured panel; strong = raised; sunken = well; glass = ONLY over the 3D scene. */
  variant?: "default" | "strong" | "sunken" | "glass";
  /** Corner-bracket colour. */
  accent?: "none" | "marigold" | "teal" | "coral" | "laterite";
  /** Body padding. "none" for flush tables/charts. */
  padding?: "none" | "sm" | "md" | "lg";
  brackets?: boolean;
  /** Chettinad tile frieze on the top edge — use for one hero panel per page. */
  band?: boolean;
  /** Hover affordance for clickable panels. */
  interactive?: boolean;
  as?: "section" | "div" | "article" | "aside";
  titleAs?: "h2" | "h3";
}

/** Solid HUD panel with corner brackets and an optional eyebrow / title / actions header. */
export function Panel({
  title,
  eyebrow,
  actions,
  footer,
  variant = "default",
  accent = "none",
  padding = "md",
  brackets = variant !== "sunken",
  band = false,
  interactive = false,
  as: Tag = "section",
  titleAs: Title = "h2",
  className,
  children,
  ...rest
}: PanelProps) {
  const hasHead = Boolean(title || eyebrow || actions);
  return (
    <Tag
      className={cx(
        styles.panel,
        variant !== "default" && styles[variant],
        accent !== "none" && styles[`accent-${accent}`],
        brackets && styles.brackets,
        band && styles.band,
        interactive && styles.interactive,
        padding === "none" && styles.flush,
        padding === "sm" && styles["pad-sm"],
        padding === "lg" && styles["pad-lg"],
        className,
      )}
      {...rest}
    >
      {band && <span className={styles.bandStrip} aria-hidden />}
      {hasHead && (
        <header className={styles.head}>
          <div className={styles.titles}>
            {eyebrow && (
              <div className={styles.eyebrow}>
                <span className={styles.pip} aria-hidden />
                {eyebrow}
              </div>
            )}
            {title && <Title className={styles.title}>{title}</Title>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.foot}>{footer}</footer>}
    </Tag>
  );
}
