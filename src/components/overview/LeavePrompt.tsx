"use client";
// Game-style "leave?" prompt shown when the owner clicks his car (sign out = drive off). Same look as the login bar:
// dark panel, gold border, chunky pressed buttons. Enter / Y = drive off, Esc / N = stay.
import { Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/components/ui";
import s from "./leave.module.css";

export function LeavePrompt({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  const isClient = useIsClient();
  const goRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape" || k === "n") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onStay();
      } else if (k === "y") {
        e.preventDefault();
        onLeave();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onStay, onLeave]);
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="leave" className={s.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onStay}>
          <motion.section
            className={s.box}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="leave-title" className={s.title}>
              Leave Pattukkottai Estates?
            </h2>
            <div className={s.actions}>
              <button type="button" className={s.stay} onClick={onStay}>
                Stay
              </button>
              <button ref={goRef} type="button" className={s.go} onClick={onLeave}>
                Drive off
                <Play aria-hidden />
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
