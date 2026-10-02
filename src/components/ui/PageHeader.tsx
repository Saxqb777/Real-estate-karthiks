import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Left-aligned page title block with an eyebrow rule and right-side actions. */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.head, className)}>
      <div className={styles.titles}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
