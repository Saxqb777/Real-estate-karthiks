"use client";
// Small controls the UI kit doesn't have yet, styled to match it:
// ChoiceGroup (segmented radio), Stepper (whole numbers), Swatches (category colours), Facts (detail list), ScopeChip.
import { CalendarDays, Minus, Plus } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Badge, cx, useField } from "@/components/ui";
import s from "./forms.module.css";

// ---------------------------------------------------------------- ChoiceGroup

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Colour cue for the selected plate (status-like choices: Paid = teal, Due = marigold, High = coral). */
  tone?: "teal" | "marigold" | "coral" | "sky";
  disabled?: boolean;
}

/** Segmented radio group — one tap per option, arrow keys move. Use inside <Field> (it picks up the label). */
export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  size = "md",
  block,
  "aria-label": ariaLabel,
}: {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: Choice<T>[];
  size?: "sm" | "md";
  /** Stretch the options to fill the row. */
  block?: boolean;
  "aria-label"?: string;
}) {
  const field = useField();
  const ref = useRef<HTMLDivElement>(null);
  const enabled = options.filter((o) => !o.disabled);
  const onKey = (e: KeyboardEvent) => {
    const i = enabled.findIndex((o) => o.value === value);
    let next: Choice<T> | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = enabled[(i + 1) % enabled.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = enabled[(i - 1 + enabled.length) % enabled.length];
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus());
  };
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={field?.describedBy}
      data-field={name}
      className={cx(s.choices, size === "sm" && s.choicesSm, block && s.choicesBlock)}
      onKeyDown={onKey}
    >
      {options.map((o, idx) => {
        const on = o.value === value;
        const focusable = on || (value === null && idx === 0);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-value={o.value}
            data-tone={o.tone}
            id={idx === 0 ? field?.id : undefined}
            tabIndex={focusable ? 0 : -1}
            disabled={o.disabled}
            className={s.choice}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Stepper

/** − 2 + for small whole numbers (floors). */
export function Stepper({
  name,
  value,
  onChange,
  min = 1,
  max = 10,
  suffix,
}: {
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: (n: number) => ReactNode;
}) {
  const field = useField();
  const n = value ?? min;
  return (
    <div className={s.stepper} data-field={name}>
      <button type="button" aria-label="Fewer" disabled={n <= min} onClick={() => onChange(Math.max(min, n - 1))}>
        <Minus aria-hidden />
      </button>
      <output id={field?.id} name={name} className={cx(s.stepValue, "num")} aria-live="polite" tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            onChange(Math.min(max, n + 1));
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            onChange(Math.max(min, n - 1));
          }
        }}
      >
        {n}
        {suffix && <span className={s.stepSuffix}>{suffix(n)}</span>}
      </output>
      <button type="button" aria-label="More" disabled={n >= max} onClick={() => onChange(Math.min(max, n + 1))}>
        <Plus aria-hidden />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Swatches

/** Earthy palette that sits well on the warm-dark HUD (category colours). */
export const SWATCHES = [
  "#EF4444",
  "#FF8A3D",
  "#FFB547",
  "#D4A72C",
  "#3FA66B",
  "#2DD4BF",
  "#60A5FA",
  "#8B93A7",
  "#A78BFA",
  "#C8693F",
  "#B5532E",
  "#E879A6",
];

export function Swatches({ name, value, onChange }: { name: string; value: string; onChange: (hex: string) => void }) {
  const field = useField();
  return (
    <div className={s.swatches} role="radiogroup" aria-describedby={field?.describedBy} data-field={name}>
      {SWATCHES.map((hex, i) => {
        const on = value.toUpperCase() === hex;
        return (
          <button
            key={hex}
            id={i === 0 ? field?.id : undefined}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={hex}
            className={s.swatch}
            style={{ ["--sw" as string]: hex }}
            onClick={() => onChange(hex)}
          />
        );
      })}
    </div>
  );
}

/** Colour dot used in lists and tables (category colour). */
export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className={s.dot} style={{ ["--dot" as string]: color, width: size, height: size }} aria-hidden />;
}

// ---------------------------------------------------------------- Facts

export interface Fact {
  label: ReactNode;
  value: ReactNode;
  /** Right-aligned Rajdhani figure. */
  num?: boolean;
  hint?: ReactNode;
}

/** Label / value rows for detail panels. */
export function Facts({ items, className }: { items: (Fact | false | null | undefined)[]; className?: string }) {
  return (
    <dl className={cx(s.facts, className)}>
      {items.filter(Boolean).map((f, i) => {
        const fact = f as Fact;
        return (
          <div key={i} className={s.fact}>
            <dt>{fact.label}</dt>
            <dd className={cx(fact.num && "num", fact.num && s.factNum)}>
              {fact.value}
              {fact.hint && <span className={s.factHint}>{fact.hint}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// ---------------------------------------------------------------- ScopeChip

/** "ALL TIME" / "FY 2025-26" / "OCT 2026" — every total says what period it covers (data clarity contract). */
export function ScopeChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Badge size="sm" icon={<CalendarDays aria-hidden />} title={title} className={s.scope}>
      {children}
    </Badge>
  );
}
