"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatNumber, type NumberFormat } from "./format-number";
import { cx } from "./cx";
import styles from "./StatTile.module.css";

export interface StatDelta {
  value: number;
  format?: NumberFormat;
  decimals?: number;
  /** Text after the delta, e.g. "vs last year". */
  label?: ReactNode;
  /** Which direction is good (colours teal); default "up". */
  goodWhen?: "up" | "down";
}

export interface StatTileProps {
  label: ReactNode;
  value: number | null | undefined;
  format?: NumberFormat;
  decimals?: number;
  /** Odometer digits instead of count-up. */
  roll?: boolean;
  /** Small icon inline with the label (no circle). */
  icon?: ReactNode;
  /** Right side of the label row (e.g. a StatusPill). */
  aside?: ReactNode;
  delta?: StatDelta;
  /** Supporting line under the number, e.g. "of ₹1.25 Cr invested". */
  caption?: ReactNode;
  /** Sparkline or any small chart. */
  sparkline?: ReactNode;
  footer?: ReactNode;
  /** sm/md/lg for supporting figures, hero for the one dominant number in a section. */
  size?: "sm" | "md" | "lg" | "hero";
  tone?: "default" | "marigold" | "teal" | "coral";
  /** panel = framed tile; rail = unframed readout with left tick; plain = no chrome. */
  variant?: "panel" | "rail" | "plain";
  href?: string;
  className?: string;
}

/** KPI readout: tracked label, big animated number, delta, optional sparkline. */
export function StatTile({
  label,
  value,
  format = "number",
  decimals,
  roll,
  icon,
  aside,
  delta,
  caption,
  sparkline,
  footer,
  size = "md",
  tone = "default",
  variant = "panel",
  href,
  className,
}: StatTileProps) {
  const toneClass = { default: styles.toneDefault, marigold: styles.toneMarigold, teal: styles.toneTeal, coral: styles.toneCoral }[tone];
  const body = (
    <>
      <div className={styles.head}>
        <span className={styles.label}>
          {icon}
          {label}
        </span>
        {aside}
      </div>
      <div className={styles.valueRow}>
        <AnimatedNumber className={styles.value} value={value} format={format} decimals={decimals} mode={roll ? "roll" : "count"} />
        {delta && <Delta {...delta} />}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
      {sparkline && <div className={styles.spark}>{sparkline}</div>}
      {footer && <div className={styles.foot}>{footer}</div>}
    </>
  );
  const cls = cx(styles.tile, styles[variant], styles[size], toneClass, href && styles.link, className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Delta({ value, format = "percent", decimals, label, goodWhen = "up" }: StatDelta) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const quality = dir === "flat" ? styles.flat : dir === goodWhen ? styles.good : styles.bad;
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const text = formatNumber(Math.abs(value), format, decimals);
  return (
    <span className={cx(styles.delta, quality)}>
      <Icon aria-hidden />
      <span className="sr-only">{dir === "up" ? "up" : dir === "down" ? "down" : "unchanged"}</span>
      {text}
      {label && <span className={styles.deltaLabel}>{label}</span>}
    </span>
  );
}
