"use client";

import { TriangleAlert } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Field.module.css";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Inputs call this to pick up id / aria-describedby / aria-invalid from the surrounding <Field>. */
export function useField() {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Error message (e.g. from zod issues or the API's `issues`). Replaces the hint. */
  error?: ReactNode;
  required?: boolean;
  /** Explicit id for the control; auto-generated otherwise. */
  htmlFor?: string;
  /** Small text at the right of the label row (e.g. "optional", unit). */
  aside?: ReactNode;
  /** Grid span inside <FormGrid>. */
  span?: 1 | 2 | "full";
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error. Controls inside are wired up automatically for a11y. */
export function Field({ label, error, required, htmlFor, aside, span = 1, className, children }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? `f${autoId.replace(/:/g, "")}`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  // help text under a field is not shown (owner: no instruction text anywhere) — only errors
  const msgId = hasError ? `${id}-error` : undefined;
  return (
    <div className={cx(styles.field, span === 2 && styles.span2, span === "full" && styles.spanFull, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.req} aria-hidden>
              *
            </span>
          )}
        </label>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      <FieldContext.Provider value={{ id, describedBy: msgId, invalid: hasError, required }}>{children}</FieldContext.Provider>
      {hasError ? (
        <p id={msgId} className={styles.error} role="alert">
          <TriangleAlert aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export interface FormGridProps {
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}

/** Responsive form grid: collapses 3/4 → 2 columns under 1024px and to 1 column under 640px. */
export function FormGrid({ cols = 2, className, children }: FormGridProps) {
  return (
    <div className={cx(styles.grid, className)} data-cols={cols}>
      {children}
    </div>
  );
}
