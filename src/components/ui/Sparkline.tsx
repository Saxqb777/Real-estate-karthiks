"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

const TONES = {
  marigold: "var(--marigold)",
  teal: "var(--teal)",
  coral: "var(--coral)",
  sky: "var(--sky)",
  plaster: "var(--plaster)",
} as const;

export interface SparklineProps {
  data: number[];
  tone?: keyof typeof TONES;
  height?: number;
  /** Area fill under the line. */
  fill?: boolean;
  /** Draw a hairline at this value (e.g. 0). */
  baseline?: number;
  /** Accessible summary, e.g. "Net income, last 12 months". */
  label?: string;
  className?: string;
}

/** Tiny trend line that stretches to its container width. */
export function Sparkline({ data, tone = "marigold", height = 36, fill = true, baseline, label, className }: SparklineProps) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  if (data.length < 2) return <div style={{ height }} className={className} aria-hidden />;
  const W = 100;
  const pad = 3;
  const min = Math.min(...data, baseline ?? Infinity);
  const max = Math.max(...data, baseline ?? -Infinity);
  const span = max - min || 1;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const pts = data.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ");
  const area = `${line} L${W} ${height} L0 ${height} Z`;
  const color = TONES[tone];
  const last = pts[pts.length - 1];
  return (
    <div className={className} style={{ position: "relative", height }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`sc${id}`}>
            <motion.rect
              x={-2}
              y={-4}
              height={height + 8}
              initial={{ width: 0 }}
              animate={{ width: W + 4 }}
              transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
            />
          </clipPath>
        </defs>
        {baseline !== undefined && (
          <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} stroke="var(--line-strong)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        )}
        <g clipPath={`url(#sc${id})`}>
          {fill && <path d={area} fill={`url(#sg${id})`} />}
          <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <motion.span
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { delay: 1, duration: 0.25 }}
        style={{
          position: "absolute",
          left: `${(last[0] / W) * 100}%`,
          top: last[1],
          width: 5,
          height: 5,
          translate: "-50% -50%",
          rotate: "45deg",
          background: color,
          boxShadow: "0 0 0 2px var(--bg-1)",
        }}
      />
    </div>
  );
}
