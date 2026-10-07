"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { daysBetween, formatDate, parseDateInput, todayIST } from "@/lib/dates";
import { formatINR, formatINRCompact, formatIndianNumber } from "@/lib/format";
import { cx } from "./cx";
import { useField } from "./Field";
import styles from "./Input.module.css";

/** Merge the surrounding <Field>'s a11y wiring into a control's props. */
function useFieldProps(id?: string, describedBy?: string, invalid?: ComponentProps<"input">["aria-invalid"], required?: boolean) {
  const field = useField();
  const ids = [describedBy, field?.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    id: id ?? field?.id,
    "aria-describedby": ids,
    "aria-invalid": invalid ?? (field?.invalid || undefined),
    required: required ?? field?.required,
    invalid: invalid === true || invalid === "true" || Boolean(field?.invalid),
  };
}

// ---------------------------------------------------------------- Input

export interface InputProps extends ComponentProps<"input"> {
  /** Leading icon (lucide element). */
  icon?: ReactNode;
  /** Trailing unit / text, e.g. "ft", "sqft", "%". */
  suffix?: ReactNode;
  compact?: boolean;
}

export function Input({ icon, suffix, compact, className, id, disabled, required, ...rest }: InputProps) {
  const { invalid, ...a11y } = useFieldProps(id, rest["aria-describedby"], rest["aria-invalid"], required);
  return (
    <div className={cx(styles.control, compact && styles.compact, className)} data-invalid={invalid} data-disabled={disabled}>
      {icon && <span className={styles.lead}>{icon}</span>}
      <input className={styles.input} disabled={disabled} {...rest} {...a11y} />
      {suffix && <span className={styles.trail}>{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- NumberInput

export interface NumberInputProps
  extends Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "min" | "max"> {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  /** ₹ prefix + live Indian-format hint ("₹45,20,000 · ₹45.2 L"). */
  currency?: boolean;
  suffix?: ReactNode;
  /** Max decimals accepted (default 2). */
  decimals?: number;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  /** Custom live hint under the input; return null to hide. Defaults to INR hint when `currency`. */
  formatHint?: (n: number) => ReactNode;
  /** Hide the live hint row. */
  hideHint?: boolean;
  compact?: boolean;
}

const toText = (n: number | null | undefined, decimals: number) =>
  n === null || n === undefined || !isFinite(n) ? "" : formatIndianNumber(n, decimals);

function parseNumber(text: string): number | null {
  const s = text.replace(/[,\s₹]/g, "");
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/**
 * Numeric text input that accepts "45,20,000" / "4520000" / "45.5", formats with Indian
 * grouping on blur, and shows a live INR hint below. Emits numbers (or null when empty).
 */
export function NumberInput({
  value,
  onValueChange,
  currency = false,
  suffix,
  decimals = 2,
  min,
  max,
  allowNegative = false,
  formatHint,
  hideHint = true, // owner 7/10: nothing under the boxes (uniform rows) — opt in with hideHint={false}
  compact,
  className,
  id,
  disabled,
  required,
  onBlur,
  placeholder,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(() => toText(value, decimals));
  const [prevValue, setPrevValue] = useState(value);
  // Sync when the parent changes the value (e.g. form reset) without clobbering what the user is typing.
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseNumber(text) !== (value ?? null)) setText(toText(value, decimals));
  }

  const field = useField();
  const baseId = id ?? field?.id;
  const hintId = baseId ? `${baseId}-live` : undefined;
  const { invalid, ...a11y } = useFieldProps(id, [rest["aria-describedby"], hideHint ? undefined : hintId].filter(Boolean).join(" ") || undefined, rest["aria-invalid"], required);

  const n = parseNumber(text);
  const outOfRange = n !== null && ((min !== undefined && n < min) || (max !== undefined && n > max));

  const pattern = allowNegative ? /^-?[\d,]*(\.\d*)?$/ : /^[\d,]*(\.\d*)?$/;

  let hint: ReactNode = null;
  if (!hideHint && n !== null) {
    if (formatHint) hint = formatHint(n);
    else if (currency)
      hint = (
        <>
          <b className={styles.accent}>{formatINR(n, n % 1 !== 0)}</b>
          {Math.abs(n) >= 1e5 && (
            <>
              <span className={styles.sep} aria-hidden />
              <b>{formatINRCompact(n)}</b>
            </>
          )}
        </>
      );
  }

  return (
    <div className={className}>
      <div className={cx(styles.control, compact && styles.compact)} data-invalid={invalid || outOfRange} data-disabled={disabled}>
        {currency && (
          <span className={styles.rupee} aria-hidden>
            ₹
          </span>
        )}
        <input
          className={cx(styles.input, styles.numeric)}
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder ?? (currency ? "0" : undefined)}
          {...rest}
          {...a11y}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            if (!pattern.test(raw)) return;
            const dot = raw.indexOf(".");
            if (dot >= 0 && raw.length - dot - 1 > decimals) return;
            setText(raw);
            onValueChange(parseNumber(raw));
          }}
          onBlur={(e) => {
            if (n !== null) setText(toText(n, decimals));
            onBlur?.(e);
          }}
        />
        {suffix && <span className={styles.trail}>{suffix}</span>}
      </div>
      {!hideHint && (
        <div id={hintId} className={styles.below}>
          {outOfRange ? (
            <span className="neg">
              {min !== undefined && max !== undefined
                ? `Between ${formatIndianNumber(min)} and ${formatIndianNumber(max)}`
                : min !== undefined
                  ? `At least ${formatIndianNumber(min)}`
                  : `At most ${formatIndianNumber(max)}`}
            </span>
          ) : (
            hint
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- DateInput

export interface DateInputProps extends Omit<ComponentProps<"input">, "type" | "value"> {
  /** "YYYY-MM-DD" (what <input type="date"> uses) or "" */
  value: string;
  onValueChange?: (value: string) => void;
  hideHint?: boolean;
  compact?: boolean;
}

function relativeDay(d: Date): string {
  const diff = daysBetween(todayIST(), d);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (Math.abs(diff) < 60) return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
  const months = Math.round(Math.abs(diff) / 30.44);
  if (Math.abs(diff) < 730) return diff > 0 ? `in ${months} months` : `${months} months ago`;
  const years = Math.abs(diff) / 365.25;
  return diff > 0 ? `in ${years.toFixed(1)} years` : `${years.toFixed(1)} years ago`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Native date picker, styled; shows the Indian D/M/YYYY reading + relative day below. */
export function DateInput({ value, onValueChange, onChange, hideHint = true, compact, className, id, disabled, required, ...rest }: DateInputProps) {
  const field = useField();
  const baseId = id ?? field?.id;
  const hintId = baseId ? `${baseId}-live` : undefined;
  const { invalid, ...a11y } = useFieldProps(id, [rest["aria-describedby"], hideHint ? undefined : hintId].filter(Boolean).join(" ") || undefined, rest["aria-invalid"], required);
  const d = value ? parseDateInput(value) : null;
  return (
    <div className={className}>
      <div className={cx(styles.control, styles.dateControl, compact && styles.compact)} data-invalid={invalid} data-disabled={disabled}>
        {/* the date in the owner's D/M/YYYY inside the box (the native field follows the browser locale, e.g. 10/07/2026) */}
        <span className={cx(styles.dateFace, !d && styles.dateFaceEmpty)} aria-hidden>
          {d ? (
            <>
              {formatDate(d)}
              <span className={styles.dateDay}>{WEEKDAYS[d.getUTCDay()].slice(0, 3)}</span>
            </>
          ) : (
            "D/M/YYYY"
          )}
        </span>
        <input
          className={cx(styles.input, styles.date)}
          type="date"
          disabled={disabled}
          {...rest}
          {...a11y}
          value={value}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
        />
      </div>
      {!hideHint && (
        <div id={hintId} className={styles.below}>
          {d ? (
            <>
              <b className={styles.accent}>{formatDate(d)}</b>
              <span className={styles.sep} aria-hidden />
              <span>
                {WEEKDAYS[d.getUTCDay()]} · {relativeDay(d)}
              </span>
            </>
          ) : (
            <span>D/M/YYYY</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Select

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends ComponentProps<"select"> {
  options?: SelectOption[];
  /** Shown as an empty first option. */
  placeholder?: string;
  icon?: ReactNode;
  compact?: boolean;
}

export function Select({ options, placeholder, icon, compact, className, id, disabled, required, children, ...rest }: SelectProps) {
  const { invalid, ...a11y } = useFieldProps(id, rest["aria-describedby"], rest["aria-invalid"], required);
  return (
    <div className={cx(styles.control, compact && styles.compact, className)} data-invalid={invalid} data-disabled={disabled}>
      {icon && <span className={styles.lead}>{icon}</span>}
      <select className={cx(styles.input, styles.select)} disabled={disabled} {...rest} {...a11y}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className={styles.chev} aria-hidden />
    </div>
  );
}

// ---------------------------------------------------------------- Textarea

export type TextareaProps = ComponentProps<"textarea">;

/** Grows with its content (CSS field-sizing) up to 320px. */
export function Textarea({ className, id, disabled, required, ...rest }: TextareaProps) {
  const { invalid, ...a11y } = useFieldProps(id, rest["aria-describedby"], rest["aria-invalid"], required);
  return (
    <div className={cx(styles.control, styles.areaControl, className)} data-invalid={invalid} data-disabled={disabled}>
      <textarea className={cx(styles.input, styles.textarea)} disabled={disabled} rows={3} {...rest} {...a11y} />
    </div>
  );
}
