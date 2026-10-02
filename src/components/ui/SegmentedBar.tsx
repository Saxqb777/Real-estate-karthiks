"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { cx } from "./cx";
import styles from "./SegmentedBar.module.css";

export interface SegmentedBarProps {
  value: number;
  /** value / max is the fill ratio (default max = 1, i.e. value is a fraction). */
  max?: number;
  segments?: number;
  tone?: "marigold" | "teal" | "coral" | "sky";
  label?: ReactNode;
  /** Right-hand readout; defaults to the percentage. Pass null to hide. */
  valueLabel?: ReactNode | null;
  /** Target marker (same units as value). */
  marker?: number;
  /** 0 · 25 · 50 · 75 · 100 scale under the bar. */
  ticks?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

/** XP-style segmented progress bar (occupancy, quest progress, collection rate). */
export function SegmentedBar({
  value,
  max = 1,
  segments = 20,
  tone = "marigold",
  label,
  valueLabel,
  marker,
  ticks,
  size = "md",
  className,
  ...aria
}: SegmentedBarProps) {
  const reduce = useReducedMotion();
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const lit = ratio * segments;
  const leading = Math.min(Math.ceil(lit) - 1, segments - 1);
  const readout = valueLabel === undefined ? formatPercent(ratio, ratio < 0.1 && ratio > 0 ? 1 : 0) : valueLabel;
  return (
    <div className={cx(styles.root, tone !== "marigold" && styles[tone], size !== "md" && styles[size], className)}>
      {(label || readout !== null) && (
        <div className={styles.head}>
          {label ? <span className={styles.label}>{label}</span> : <span />}
          {readout !== null && <span className={styles.value}>{readout}</span>}
        </div>
      )}
      <div
        className={styles.track}
        style={{ ["--n" as string]: segments }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={typeof readout === "string" ? readout : formatPercent(ratio, 0)}
        aria-label={aria["aria-label"] ?? (typeof label === "string" ? label : undefined)}
      >
        {Array.from({ length: segments }, (_, i) => {
          const f = Math.min(Math.max(lit - i, 0), 1);
          return (
            <span key={i} className={cx(styles.seg, i === leading && ratio < 1 && styles.leading)}>
              <motion.span
                className={styles.fill}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: f }}
                transition={{ duration: 0.28, delay: reduce ? 0 : i * 0.025, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          );
        })}
        {marker !== undefined && max > 0 && (
          <span className={styles.marker} style={{ left: `calc(3px + (100% - 6px) * ${Math.min(Math.max(marker / max, 0), 1)})` }} aria-hidden />
        )}
      </div>
      {ticks && (
        <div className={styles.ticks} aria-hidden>
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>
            75<span>100</span>
          </span>
        </div>
      )}
    </div>
  );
}
