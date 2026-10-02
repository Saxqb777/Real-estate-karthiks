"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { useField } from "./Field";
import styles from "./Toggle.module.css";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
  className?: string;
  /** Required when there is no visible label. */
  "aria-label"?: string;
}

/** Hardware-style switch (role="switch"). */
export function Toggle({ checked, onChange, label, description, disabled, size = "md", id, className, ...aria }: ToggleProps) {
  const field = useField();
  return (
    <button
      type="button"
      role="switch"
      id={id ?? field?.id}
      aria-checked={checked}
      aria-describedby={field?.describedBy}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(styles.toggle, checked && styles.on, size === "sm" && styles.sm, className)}
    >
      <span className={styles.track} aria-hidden>
        <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 38 }} className={styles.knob} />
      </span>
      {(label || description) && (
        <span className={styles.text}>
          {label && <span className={styles.label}>{label}</span>}
          {description && <span className={styles.desc}>{description}</span>}
        </span>
      )}
    </button>
  );
}

/** Alias — some people look for "Switch". */
export const Switch = Toggle;
