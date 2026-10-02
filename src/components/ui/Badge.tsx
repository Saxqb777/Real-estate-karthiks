import type { ReactNode } from "react";
import type { RentState, UnitStatus } from "@/lib/dashboard-types";
import { cx } from "./cx";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "marigold" | "teal" | "coral" | "sky" | "laterite" | "grey" | "ghost";

export interface BadgeProps {
  tone?: BadgeTone;
  /** Diamond status marker before the text. */
  marker?: boolean;
  icon?: ReactNode;
  pulse?: boolean;
  size?: "sm" | "md";
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Small squared HUD tag. */
export function Badge({ tone = "neutral", marker = false, icon, pulse, size = "md", title, className, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], size === "sm" && styles.sm, pulse && styles.pulse, className)} title={title}>
      {marker && <span className={styles.marker} aria-hidden />}
      {icon}
      {children}
    </span>
  );
}

export type StatusKind = UnitStatus | RentState | "due" | "pending" | "done" | "active" | "past";

const STATUS: Record<StatusKind, { tone: BadgeTone; label: string; pulse?: boolean }> = {
  occupied: { tone: "teal", label: "Occupied" },
  paid: { tone: "teal", label: "Paid" },
  "due-soon": { tone: "marigold", label: "Due soon" },
  overdue: { tone: "coral", label: "Overdue", pulse: true },
  vacant: { tone: "ghost", label: "Vacant" },
  inactive: { tone: "grey", label: "Inactive" },
  none: { tone: "grey", label: "No lease" },
  due: { tone: "marigold", label: "Due" },
  pending: { tone: "marigold", label: "Pending" },
  done: { tone: "grey", label: "Done" },
  active: { tone: "teal", label: "Active" },
  past: { tone: "grey", label: "Ended" },
};

export interface StatusPillProps {
  status: StatusKind;
  /** Override the default label (e.g. "Overdue 6 days"). */
  label?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/**
 * The one status language used everywhere (matches the 3D world):
 * occupied/paid teal · due-soon marigold · overdue coral pulse · vacant blueprint ghost · inactive grey.
 */
export function StatusPill({ status, label, size, className }: StatusPillProps) {
  const s = STATUS[status] ?? STATUS.none;
  return (
    <Badge tone={s.tone} marker pulse={s.pulse} size={size} className={className}>
      {label ?? s.label}
    </Badge>
  );
}
