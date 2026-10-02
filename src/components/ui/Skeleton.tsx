import type { CSSProperties } from "react";
import { cx } from "./cx";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  /** Render N text lines (last one shorter). */
  lines?: number;
  /** Larger rounded block (charts, panels). */
  block?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Shimmering placeholder while data loads. */
export function Skeleton({ width, height, lines, block, className, style }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <span className={cx(styles.lines, className)} aria-hidden style={{ width, ...style }}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={cx(styles.sk, styles.text)} style={{ width: i === lines - 1 ? "62%" : `${92 - ((i * 13) % 20)}%` }} />
        ))}
      </span>
    );
  }
  return <span className={cx(styles.sk, !height && styles.text, block && styles.block, className)} style={{ width: width ?? "100%", height, ...style }} aria-hidden />;
}
