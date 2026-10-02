import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./LevelBadge.module.css";

export type Tier = "loss" | "bronze" | "silver" | "gold";

/** Capital-multiplier tiers: <1× loss · 1–1.25× bronze · 1.25–2× silver · ≥2× gold. */
export function tierFor(multiplier: number | null | undefined): Tier {
  if (multiplier === null || multiplier === undefined || !isFinite(multiplier)) return "silver";
  if (multiplier < 1) return "loss";
  if (multiplier < 1.25) return "bronze";
  if (multiplier < 2) return "silver";
  return "gold";
}

const TIER_LABEL: Record<Tier, string> = { loss: "Below cost", bronze: "Bronze", silver: "Silver", gold: "Gold" };

export interface LevelBadgeProps {
  /** Number shown in the hex (e.g. capital multiplier 1.42). */
  value: number | string | null | undefined;
  /** Tiny text above the value inside the hex (default "LVL"). */
  label?: string;
  /** Decimals when value is a number (default 2). */
  decimals?: number;
  /** Suffix after numeric values (default "×"). */
  suffix?: string;
  tier?: Tier;
  title?: ReactNode;
  caption?: ReactNode;
  /** Show the tier name under the title. */
  showTier?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Hexagonal "level" badge — used for the capital multiplier. */
export function LevelBadge({
  value,
  label = "LVL",
  decimals = 2,
  suffix = "×",
  tier,
  title,
  caption,
  showTier = true,
  size = "md",
  className,
}: LevelBadgeProps) {
  const t = tier ?? (typeof value === "number" ? tierFor(value) : "silver");
  const text =
    value === null || value === undefined ? "—" : typeof value === "number" ? `${value.toFixed(decimals)}${suffix}` : value;
  return (
    <div className={cx(styles.root, styles[t], size !== "md" && styles[size], className)}>
      <div className={styles.hex} role="img" aria-label={`${label} ${text}${showTier ? `, ${TIER_LABEL[t]} tier` : ""}`}>
        <span className={styles.inner} aria-hidden>
          <span className={styles.lvl}>{label}</span>
          <span className={styles.val}>{text}</span>
        </span>
        <span className={styles.shine} aria-hidden />
      </div>
      {(title || caption || showTier) && (title || caption) && (
        <div className={styles.text}>
          {title && <span className={styles.title}>{title}</span>}
          {showTier && <span className={styles.tierName}>{TIER_LABEL[t]} tier</span>}
          {caption && <span className={styles.caption}>{caption}</span>}
        </div>
      )}
    </div>
  );
}
