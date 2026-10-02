import type { ReactNode } from "react";
import { cx } from "./cx";
import { Kolam } from "./Kolam";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Button(s), e.g. <Button variant="primary">Add tenant</Button> */
  action?: ReactNode;
  /** Replace the kolam with an icon/illustration. */
  art?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** Blank-slate block: kolam motif + plain, specific copy + next action. */
export function EmptyState({ title, description, action, art, compact, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, compact && styles.compact, className)}>
      <div className={styles.art}>{art ?? <Kolam />}</div>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.desc}>{description}</p>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
