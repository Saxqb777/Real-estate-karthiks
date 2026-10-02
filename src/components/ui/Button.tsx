import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Tooltip } from "./Tooltip";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (lucide element). Replaced by a spinner while loading. */
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export interface ButtonProps extends ComponentProps<"button">, StyleProps {
  loading?: boolean;
}

export function buttonClass({ variant = "secondary", size = "md", block }: StyleProps, className?: string) {
  return cx(styles.btn, styles[variant], size !== "md" && styles[size], block && styles.block, className);
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  block,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className={styles.spin} aria-hidden /> : icon}
      {children !== undefined && children !== null && <span className={styles.label}>{children}</span>}
      {!loading && iconRight}
    </button>
  );
}

export interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, "className">, StyleProps {
  className?: string;
}

/** A Next <Link> styled as a button (for "Go to Config", quest-log jumps, …). */
export function LinkButton({ variant = "secondary", size = "md", icon, iconRight, block, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass({ variant, size, block }, className)} {...rest}>
      {icon}
      <span className={styles.label}>{children}</span>
      {iconRight}
    </Link>
  );
}

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  /** Accessible name — also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Show the label as a tooltip on hover/focus (default true). */
  tooltip?: boolean;
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  tooltip = true,
  disabled,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const btn = (
    <button
      type={type}
      aria-label={label}
      className={cx(styles.btn, styles.icon, styles[variant], size !== "md" && styles[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className={styles.spin} aria-hidden /> : icon}
    </button>
  );
  return tooltip ? <Tooltip content={label} describe={false}>
      {btn}
    </Tooltip> : btn;
}
