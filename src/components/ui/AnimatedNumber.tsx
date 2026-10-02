"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { formatNumber, type NumberFormat } from "./format-number";
import styles from "./AnimatedNumber.module.css";

export interface AnimatedNumberProps {
  value: number | null | undefined;
  format?: NumberFormat;
  decimals?: number;
  /** Seconds. */
  duration?: number;
  /** Count-up starting point on first mount (default 0). */
  from?: number;
  /** "count" tweens the value; "roll" is an odometer (each digit rolls). */
  mode?: "count" | "roll";
  /** Briefly tint teal/coral when the value goes up/down after mount. */
  flash?: boolean;
  className?: string;
}

/** Live HUD number: counts up on mount and animates every change. Screen readers get the final value. */
export function AnimatedNumber({
  value,
  format = "number",
  decimals,
  duration = 0.9,
  from = 0,
  mode = "count",
  flash = true,
  className,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const final = formatNumber(value, format, decimals);
  const prev = useRef<number | null | undefined>(undefined);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = value;
    if (!flash || p === undefined || p === null || value === null || value === undefined || p === value) return;
    setDir(value > p ? "up" : "down");
    const t = window.setTimeout(() => setDir(null), 650);
    return () => window.clearTimeout(t);
  }, [value, flash]);

  const cls = cx(styles.num, dir === "up" && styles.up, dir === "down" && styles.down, className);

  if (mode === "roll") {
    return (
      <span className={cls}>
        <span className="sr-only">{final}</span>
        <Odometer text={final} animate={!reduce} duration={duration} />
      </span>
    );
  }
  return (
    <span className={cls}>
      <span className="sr-only">{final}</span>
      <CountUp value={value} format={format} decimals={decimals} duration={duration} from={from} animate={!reduce} />
    </span>
  );
}

function CountUp({
  value,
  format,
  decimals,
  duration,
  from,
  animate: shouldAnimate,
}: {
  value: number | null | undefined;
  format: NumberFormat;
  decimals?: number;
  duration: number;
  from: number;
  animate: boolean;
}) {
  const mv = useMotionValue(shouldAnimate ? from : (value ?? 0));
  const text = useTransform(mv, (v) => formatNumber(v, format, decimals));
  useEffect(() => {
    if (value === null || value === undefined || !isFinite(value)) return;
    if (!shouldAnimate) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, duration, shouldAnimate, mv]);
  if (value === null || value === undefined || !isFinite(value)) return <span aria-hidden>—</span>;
  return <motion.span aria-hidden>{text}</motion.span>;
}

function Odometer({ text, animate: shouldAnimate, duration }: { text: string; animate: boolean; duration: number }) {
  const chars = text.split("");
  return (
    <span className={styles.roll} aria-hidden>
      {chars.map((ch, i) => {
        const key = chars.length - i; // key from the right so units stay put when the length changes
        const d = ch.charCodeAt(0) - 48;
        if (d < 0 || d > 9)
          return (
            <span key={`c${key}`} className={styles.char}>
              {ch}
            </span>
          );
        return (
          <span key={`d${key}`} className={styles.roller}>
            <motion.span
              className={styles.strip}
              initial={shouldAnimate ? { y: "0%" } : false}
              animate={{ y: `${-d * 10}%` }}
              transition={{ duration: duration * 0.9, delay: shouldAnimate ? (chars.length - i) * 0.04 : 0, ease: [0.16, 1, 0.3, 1] }}
            >
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
