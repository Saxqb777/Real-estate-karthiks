"use client";

import { motion } from "motion/react";
import { useCallback, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Small count tag (e.g. number of records). */
  count?: number;
  /** Render the count in coral (e.g. overdue items). */
  alert?: boolean;
  disabled?: boolean;
}

// ---- URL hash store (shared by every hash-aware Tabs on the page)
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => decodeURIComponent(window.location.hash.replace(/^#/, ""));

/**
 * [value, setValue] synced to the URL hash (e.g. /data#payments). Falls back to `fallback`
 * when the hash is not one of `ids`. Uses replaceState, so tab switches don't spam history.
 */
export function useHashTab(ids: string[], fallback: string): [string, (id: string) => void] {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const value = ids.includes(hash) ? hash : fallback;
  const set = useCallback((id: string) => {
    if (readHash() === id) return;
    window.history.replaceState(window.history.state, "", `#${encodeURIComponent(id)}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);
  return [value, set];
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled value. */
  value?: string;
  onChange?: (id: string) => void;
  defaultValue?: string;
  /** Keep the active tab in the URL hash (only one hash-aware Tabs per page). */
  hash?: boolean;
  variant?: "underline" | "segment";
  size?: "sm" | "md";
  /** Accessible name for the tab list. */
  label: string;
  /** Panel content: a node, or a render function receiving the active id. */
  children?: ReactNode | ((active: string) => ReactNode);
  className?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  defaultValue,
  hash = false,
  variant = "underline",
  size = "md",
  label,
  children,
  className,
}: TabsProps) {
  const uid = useId().replace(/:/g, "");
  const ids = items.map((i) => i.id);
  const fallback = defaultValue ?? items[0]?.id ?? "";
  const [inner, setInner] = useState(fallback);
  const [hashValue, setHash] = useHashTab(ids, fallback);
  const active = value ?? (hash ? hashValue : inner);
  const listRef = useRef<HTMLDivElement>(null);

  const select = (id: string) => {
    if (hash) setHash(id);
    else setInner(id);
    onChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.id === active);
    let next: TabItem | undefined;
    if (e.key === "ArrowRight") next = enabled[(idx + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next.id);
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${uid}-tab-${next.id}`)}`);
    btn?.focus();
    btn?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className={cx(styles.root, className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className={cx(styles.list, styles[variant], size === "sm" && styles.sm)}
        onKeyDown={onKeyDown}
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`${uid}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={children !== undefined ? `${uid}-panel` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              className={styles.tab}
              onClick={() => select(item.id)}
            >
              {selected &&
                (variant === "underline" ? (
                  <motion.span layoutId={`${uid}-ind`} className={styles.bar} transition={{ type: "spring", stiffness: 520, damping: 42 }} />
                ) : (
                  <motion.span layoutId={`${uid}-ind`} className={styles.plate} transition={{ type: "spring", stiffness: 520, damping: 42 }} />
                ))}
              <span className={styles.text}>
                {item.icon}
                {item.label}
                {item.count !== undefined && <span className={cx(styles.count, "num", item.alert && styles.countAlert)}>{item.count}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {children !== undefined && (
        <motion.div
          key={active}
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${active}`}
          tabIndex={0}
          className={styles.panel}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {typeof children === "function" ? children(active) : children}
        </motion.div>
      )}
    </div>
  );
}
