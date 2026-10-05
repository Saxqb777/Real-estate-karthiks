"use client";
// The HUD's number primitives (DATA CLARITY CONTRACT):
//   <Fig>        one figure — formatted one way everywhere, tagged by kind (cash / paper value / occupancy),
//                exact value on hover when compacted, clickable → drill-down ("Click for breakdown").
//   <FigLine>    label + figure ledger line (supporting figures).
//   <ScopeChip>  "ALL TIME" / "FY 2026-27" / "OCT 2026" / "AS OF 3/10/2026" on every number group.
//   <BucketHead> CASH FLOW · PROPERTY VALUE · OCCUPANCY section header with its scope chip.
//   <PaperTag>   "est." / "offer" tag for paper values.
import { CalendarDays, ChevronRight, CalendarRange, IndianRupee, Landmark } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedNumber, Tooltip, cx } from "@/components/ui";
import type { ExplainFormat } from "@/lib/dashboard-types";
import { BUCKETS, fmt, inr, isCompacted, type Bucket } from "./format";
import s from "./hud.module.css";

export type FigTone = "neutral" | "income" | "expense" | "signed" | "value" | "occupancy" | "dim";

export interface FigProps {
  value: number | null | undefined;
  format?: ExplainFormat;
  size?: "hero" | "lg" | "md" | "sm";
  /** Compact ₹45.2 L / ₹1.25 Cr (default for hero money). The exact value shows on hover. */
  compact?: boolean;
  /** Colour by meaning: income teal, expense coral, signed = coral when negative, value marigold underline, occupancy sky. */
  tone?: FigTone;
  /** Paper value tag — estimates never look like cash (dotted underline + tag). */
  paper?: "est." | "offer" | null;
  /** Why the value is missing ("no offer yet") — shown on hover of the "—". */
  missing?: string;
  /** Prefix such as "−" for a subtracted line (the figure itself stays positive). */
  sign?: "+" | "−";
  /** Drill-down / breakdown. */
  onClick?: () => void;
  hint?: string;
  animate?: boolean;
  className?: string;
}

/** One figure. Formatting comes from format.ts so the same number reads the same everywhere. */
export function Fig({
  value,
  format = "inr",
  size = "md",
  compact,
  tone = "neutral",
  paper = null,
  missing,
  sign,
  onClick,
  hint = "Click for breakdown",
  animate = true,
  className,
}: FigProps) {
  const useCompact = compact ?? size === "hero";
  const isMissing = value === null || value === undefined || !isFinite(value);
  const negative = !isMissing && value! < 0;
  // ₹0 is calm: no income / expense colour on a zero
  const isZero = !isMissing && value === 0 && (tone === "income" || tone === "expense" || tone === "signed");
  const toneClass = isZero
    ? undefined
    : tone === "income"
      ? s.tIncome
      : tone === "expense"
        ? s.tExpense
        : tone === "signed"
          ? negative
            ? s.tExpense
            : undefined
          : tone === "value"
            ? s.tValue
            : tone === "occupancy"
              ? s.tOcc
              : tone === "dim"
                ? s.tDim
                : undefined;
  const text = (n: number) => fmt(n, format, useCompact);
  const exact = !isMissing && useCompact && isCompacted(value, format) ? fmt(value, format) : null;
  const body = (
    <span className={cx(s.fig, s[`fig-${size}`], toneClass, paper && !isMissing && s.paper, className)}>
      {sign && <span className={s.figSign}>{sign}</span>}
      {isMissing ? (
        <span className={s.figMissing}>—</span>
      ) : animate ? (
        <AnimatedNumber value={value} format={text} flash={false} />
      ) : (
        <span>{text(value!)}</span>
      )}
      {paper && !isMissing && <PaperTag kind={paper} />}
    </span>
  );
  // the hover tip shows the exact figure only — no "click for…" instruction (owner)
  const tip = isMissing ? missing : exact || null;
  const inner = onClick ? (
    <button type="button" className={s.figBtn} onClick={onClick} aria-label={`${exact ?? (isMissing ? "—" : text(value!))} — ${hint}`}>
      {body}
    </button>
  ) : (
    body
  );
  return tip ? (
    <Tooltip content={tip} delay={300} describe={false}>
      {inner}
    </Tooltip>
  ) : (
    inner
  );
}

/** "est." / "offer" — marks a paper value. */
export function PaperTag({ kind }: { kind: "est." | "offer" }) {
  return (
    <span className={cx(s.paperTag, kind === "offer" && s.paperOffer)} title={kind === "est." ? "Estimate — not cash" : "Best offer received — not cash"}>
      {kind}
    </span>
  );
}

export interface FigLineProps extends Omit<FigProps, "size" | "className"> {
  label: ReactNode;
  /** small text under the label */
  sub?: ReactNode;
  /** colour key before the label (category colour / bucket) */
  swatch?: string;
  size?: "md" | "sm";
  /** Show a chevron (rows that lead somewhere). */
  chevron?: boolean;
  className?: string;
}

/** Ledger line: label on the left, figure right-aligned; the whole row is the click target. */
export function FigLine({ label, sub, swatch, size = "sm", chevron, onClick, hint = "Click for breakdown", className, ...fig }: FigLineProps) {
  const content = (
    <>
      <span className={s.lineLabel}>
        {swatch && <span className={s.swatch} style={{ background: swatch }} aria-hidden />}
        <span className={s.lineText}>
          <span>{label}</span>
          {sub && <span className={s.lineSub}>{sub}</span>}
        </span>
      </span>
      <span className={s.lineValue}>
        <Fig {...fig} size={size} hint={hint} />
        {(chevron ?? Boolean(onClick)) && <ChevronRight className={s.lineChevron} aria-hidden />}
      </span>
    </>
  );
  if (!onClick) return <div className={cx(s.line, className)}>{content}</div>;
  return (
    <button type="button" className={cx(s.line, s.lineBtn, className)} onClick={onClick} aria-label={typeof label === "string" ? `${label} — ${hint}` : undefined}>
      {content}
    </button>
  );
}

/** Compact cell (label over figure) for a row of 2–3 supporting figures. Wrap cells in <FigCells>. */
export function FigCell({ label, onClick, hint = "Click for breakdown", ...fig }: Omit<FigProps, "size" | "className"> & { label: ReactNode }) {
  const inner = (
    <>
      <span className={s.miniLabel}>{label}</span>
      <Fig {...fig} size="sm" compact={fig.compact ?? true} />
    </>
  );
  return onClick ? (
    <button type="button" className={s.mini} onClick={onClick} aria-label={typeof label === "string" ? `${label} — ${hint}` : undefined}>
      {inner}
    </button>
  ) : (
    <div className={s.mini}>{inner}</div>
  );
}

export function FigCells({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={s.miniGrid} style={cols === 2 ? { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } : undefined}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- scope chip

export interface ScopeChipProps {
  children: ReactNode;
  /** "asOf" chips use a range icon and turn marigold when looking back in time. */
  kind?: "period" | "asOf";
  /** true when the as-of date is not today (time scrubber) */
  past?: boolean;
  title?: string;
  className?: string;
}

/** Every number group says what period it covers. */
export function ScopeChip({ children, kind = "period", past, title, className }: ScopeChipProps) {
  const Icon = kind === "asOf" ? CalendarRange : CalendarDays;
  return (
    <span className={cx(s.scope, past && s.scopePast, className)} title={title}>
      <Icon aria-hidden />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- bucket header

const BUCKET_ICON: Record<Bucket, ReactNode> = {
  cash: <IndianRupee aria-hidden />,
  value: <Landmark aria-hidden />,
  occupancy: <CalendarDays aria-hidden />,
};

/** "₹ CASH FLOW ··········· FY 2026-27" */
export function BucketHead({ bucket, scope, right, label }: { bucket: Bucket; scope?: ReactNode; right?: ReactNode; label?: ReactNode }) {
  const b = BUCKETS[bucket];
  return (
    <div className={s.bucketHead} data-bucket={bucket}>
      <span className={s.bucketChip} title={b.note}>
        {BUCKET_ICON[bucket]}
      </span>
      <span className={s.bucketLabel}>{label ?? b.label}</span>
      <span className={s.bucketRule} aria-hidden />
      {right}
      {scope}
    </div>
  );
}

/** Bucket icon chip on its own (legends, explain headers). */
export function BucketIcon({ bucket }: { bucket: Bucket }) {
  return (
    <span className={s.bucketChip} data-bucket={bucket} title={BUCKETS[bucket].note}>
      {BUCKET_ICON[bucket]}
    </span>
  );
}

/** Exact rupees inline (tables, sentences) — whole rupees unless paise exist. */
export function Rupees({ value, tone = "neutral", className }: { value: number | null | undefined; tone?: FigTone; className?: string }) {
  const negative = typeof value === "number" && value < 0;
  const zero = value === 0;
  return (
    <span
      className={cx(
        "num",
        tone === "income" && !zero && s.tIncome,
        (tone === "expense" || (tone === "signed" && negative)) && !zero && s.tExpense,
        tone === "dim" && s.tDim,
        className,
      )}
    >
      {inr(value)}
    </span>
  );
}
