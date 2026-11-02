"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { daysBetween, formatDate, parseDateInput, todayIST } from "@/lib/dates";
import { formatINR, formatINRCompact, formatIndianNumber } from "@/lib/format";
import { cx } from "./cx";
import { useField } from "./Field";
import styles from "./Input.module.css";
import { SelectMenu, pickValue, readEntries, type MenuEntry } from "./SelectMenu";

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

// ---------------------------------------------------------------- ComboInput

export interface ComboInputProps extends Omit<InputProps, "suffix" | "list"> {
  /** The usual choices; the box still takes any word (a new one is saved as typed). */
  options: string[];
}

/** Put text into the box as if it was typed (React's onChange runs). */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * "Type it or pick it" (to-do Kind, unit Type): a text box with the site's glass list under it. The list ALWAYS shows
 * every choice (owner 2/11/2026: the browser's list hid them once something was typed) — tap the box or ⌄, or press
 * ↓, to open it; typing highlights the matching choice (Enter takes it) and a word that isn't listed is kept as typed.
 */
export function ComboInput({ options, icon, compact, className, id, disabled, required, value, onChange, onKeyDown, onClick, ref, ...rest }: ComboInputProps) {
  const { invalid, ...a11y } = useFieldProps(id, rest["aria-describedby"], rest["aria-invalid"], required);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const picking = useRef(false);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const setInput = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const text = typeof value === "string" ? value : String(value ?? "");
  const entries: MenuEntry[] = options.map((o) => ({ kind: "option", value: o, label: o, disabled: false, placeholder: false }));
  const chosen = options.find((o) => o.toLowerCase() === text.trim().toLowerCase()) ?? "";
  const show = () => !disabled && setOpen(true);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) inputRef.current?.focus({ preventScroll: true });
  };
  return (
    <div ref={boxRef} className={cx(styles.control, styles.comboBox, compact && styles.compact, className)} data-invalid={invalid} data-disabled={disabled} data-open={open || undefined}>
      {icon && <span className={styles.lead}>{icon}</span>}
      <input
        ref={setInput}
        className={styles.input}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        {...rest}
        {...a11y}
        onChange={(e) => {
          onChange?.(e);
          if (!picking.current) show();
        }}
        onClick={(e) => {
          onClick?.(e);
          show();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        className={styles.chevBtn}
        aria-label={open ? "Hide the list" : "Show the list"}
        disabled={disabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) close(false);
          else show();
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
        <ChevronDown className={styles.chev} aria-hidden />
      </button>
      {open && (
        <SelectMenu
          anchor={boxRef}
          entries={entries}
          value={chosen}
          typed={text}
          id={listId}
          onClose={close}
          onPick={(v) => {
            const input = inputRef.current;
            if (input) {
              picking.current = true;
              typeInto(input, v);
              picking.current = false;
            }
            close(true);
          }}
        />
      )}
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

/** Native date picker, styled; shows the Indian DD/MM/YYYY reading + relative day below. */
export function DateInput({ value, onValueChange, onChange, hideHint = true, compact, className, id, disabled, required, ...rest }: DateInputProps) {
  const field = useField();
  const baseId = id ?? field?.id;
  const hintId = baseId ? `${baseId}-live` : undefined;
  const { invalid, ...a11y } = useFieldProps(id, [rest["aria-describedby"], hideHint ? undefined : hintId].filter(Boolean).join(" ") || undefined, rest["aria-invalid"], required);
  const d = value ? parseDateInput(value) : null;
  return (
    <div className={className}>
      <div className={cx(styles.control, styles.dateControl, compact && styles.compact)} data-invalid={invalid} data-disabled={disabled}>
        {/* the date in the owner's DD/MM/YYYY inside the box (the native field follows the browser locale, e.g. 10/07/2026) */}
        <span className={cx(styles.dateFace, !d && styles.dateFaceEmpty)} aria-hidden>
          {d ? (
            <>
              {formatDate(d)}
              <span className={styles.dateDay}>{WEEKDAYS[d.getUTCDay()].slice(0, 3)}</span>
            </>
          ) : (
            "DD/MM/YYYY"
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
            <span>DD/MM/YYYY</span>
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

export function Select({ options, placeholder, icon, compact, className, id, disabled, required, children, ref, onKeyDown, ...rest }: SelectProps) {
  const { invalid, ...a11y } = useFieldProps(id, rest["aria-describedby"], rest["aria-invalid"], required);
  // the list is our glass menu (SelectMenu), not the browser's (owner 1/11/2026: "drop downs should match the website")
  const boxRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLSelectElement | null>(null);
  const pointer = useRef("mouse");
  const [menu, setMenu] = useState<{ entries: MenuEntry[]; value: string } | null>(null);
  const setSel = useCallback(
    (el: HTMLSelectElement | null) => {
      selRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const open = () => {
    const sel = selRef.current;
    if (sel && !sel.disabled) setMenu({ entries: readEntries(sel), value: sel.value });
  };
  const close = (refocus: boolean) => {
    setMenu(null);
    if (refocus && pointer.current !== "touch") selRef.current?.focus({ preventScroll: true });
  };
  return (
    <div
      ref={boxRef}
      className={cx(styles.control, styles.selectBox, compact && styles.compact, className)}
      data-invalid={invalid}
      data-disabled={disabled}
      data-open={menu ? true : undefined}
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
        if (e.pointerType !== "mouse" || e.button !== 0 || disabled) return;
        e.preventDefault(); // keep focus where it belongs: on the select
        selRef.current?.focus({ preventScroll: true });
      }}
      onClick={() => (menu ? close(false) : open())}
    >
      {icon && <span className={styles.lead}>{icon}</span>}
      <select
        ref={setSel}
        className={cx(styles.input, styles.select)}
        disabled={disabled}
        {...rest}
        {...a11y}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || menu) return;
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            pointer.current = "keyboard";
            open();
          }
        }}
      >
        {placeholder !== undefined && (
          <option value="" data-placeholder="">
            {placeholder}
          </option>
        )}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className={styles.chev} aria-hidden />
      {menu && (
        <SelectMenu
          anchor={boxRef}
          entries={menu.entries}
          value={menu.value}
          onClose={close}
          onPick={(v) => {
            if (selRef.current) pickValue(selRef.current, v);
            close(true);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Textarea

export interface TextareaProps extends ComponentProps<"textarea"> {
  /** Sits in the bottom-right corner (e.g. the attachment clip); the text keeps clear of it. */
  suffix?: ReactNode;
}

/** Grows with its content (CSS field-sizing) up to 320px. */
export function Textarea({ suffix, className, id, disabled, required, ...rest }: TextareaProps) {
  const { invalid, ...a11y } = useFieldProps(id, rest["aria-describedby"], rest["aria-invalid"], required);
  return (
    <div
      className={cx(styles.control, styles.areaControl, className)}
      data-invalid={invalid}
      data-disabled={disabled}
      data-trail={suffix ? true : undefined}
    >
      <textarea className={cx(styles.input, styles.textarea)} disabled={disabled} rows={3} {...rest} {...a11y} />
      {suffix && <span className={styles.areaTrail}>{suffix}</span>}
    </div>
  );
}
