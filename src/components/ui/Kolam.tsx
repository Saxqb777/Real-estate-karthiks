"use client";

import { motion, useReducedMotion } from "motion/react";

const AXIS = "M40 40 C 31 33, 31 12, 40 12 C 49 12, 49 33, 40 40";
const DIAG = "M40 40 C 29 31, 30 6, 40 6 C 50 6, 51 31, 40 40";
const DOTS = [24, 40, 56].flatMap((y) => [24, 40, 56].map((x) => [x, y] as const));

/**
 * Lotus pulli-kolam (rice-flour doorstep drawing) — the app's empty/blank-slate motif.
 * Lines draw themselves in on mount.
 */
export function Kolam({ size = 80, className, animate = true }: { size?: number; className?: string; animate?: boolean }) {
  const reduce = useReducedMotion();
  const draw = animate && !reduce;
  const petals = [
    ...[0, 90, 180, 270].map((r) => ({ d: AXIS, r })),
    ...[45, 135, 225, 315].map((r) => ({ d: DIAG, r })),
  ];
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className={className} aria-hidden fill="none">
      <circle cx="40" cy="40" r="37" stroke="var(--line-strong)" strokeDasharray="2 4" />
      {petals.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          transform={`rotate(${p.r} 40 40)`}
          stroke="var(--plaster)"
          strokeOpacity={p.d === AXIS ? 0.8 : 0.45}
          strokeWidth={1.4}
          strokeLinecap="round"
          initial={draw ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.65, 0, 0.35, 1] }}
        />
      ))}
      {DOTS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={x === 40 && y === 40 ? 2.6 : 1.9} fill="var(--marigold)" />
      ))}
    </svg>
  );
}
