"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { Coin } from "./Coin";
import { cx } from "./cx";
import { dismissToast, getServerToasts, getToasts, subscribeToasts, type ToastItem } from "./toast";
import styles from "./Toaster.module.css";

/** Renders toasts from the toast() store. Mount once (the app shell does). */
export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  return (
    <div className={styles.region} role="region" aria-label="Notifications" data-print-hide>
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;

function ToastCard({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused || item.duration <= 0) return;
    const started = Date.now();
    const t = window.setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - started;
    };
  }, [paused, item.id, item.duration]);

  const Icon = item.kind === "coin" ? null : ICONS[item.kind];
  return (
    <motion.div
      layout
      role={item.kind === "error" ? "alert" : "status"}
      className={cx(styles.toast, styles[item.kind])}
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.icon} aria-hidden>
        {Icon ? (
          <Icon />
        ) : (
          <motion.span
            style={{ display: "grid" }}
            initial={reduce ? false : { rotateY: 0, scale: 0.4 }}
            animate={{ rotateY: 720, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <Coin />
          </motion.span>
        )}
      </span>
      {item.kind === "coin" && !reduce && <CoinBurst />}
      <div className={styles.text}>
        {item.kind === "coin" && item.amount !== undefined && (
          <span className={styles.amount}>
            +<AnimatedNumber value={item.amount} format="inr" duration={1.1} flash={false} />
          </span>
        )}
        <p className={styles.title}>{item.title}</p>
        {item.description && <p className={styles.desc}>{item.description}</p>}
        {item.action && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              item.action?.onClick();
              dismissToast(item.id);
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button type="button" className={styles.close} aria-label="Dismiss notification" onClick={() => dismissToast(item.id)}>
        <X />
      </button>
      {item.duration > 0 && <span className={styles.timer} style={{ animationDuration: `${item.duration}ms` }} aria-hidden />}
    </motion.div>
  );
}

const PARTICLES = Array.from({ length: 11 }, (_, i) => {
  const angle = (-160 + i * 26 + (i % 2) * 9) * (Math.PI / 180); // fan upwards
  const dist = 34 + ((i * 37) % 30);
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 6, r: (i * 53) % 360, delay: (i % 4) * 0.025, s: 0.55 + ((i * 7) % 5) * 0.1 };
});

function CoinBurst() {
  return (
    <span className={styles.burst} aria-hidden>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className={styles.particle}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.2, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y * 0.7, p.y, p.y + 26], opacity: [0, 1, 1, 0], scale: p.s, rotate: p.r }}
          transition={{ duration: 1.05, delay: 0.12 + p.delay, ease: [0.2, 0.8, 0.4, 1], times: [0, 0.2, 0.75, 1] }}
        />
      ))}
    </span>
  );
}
