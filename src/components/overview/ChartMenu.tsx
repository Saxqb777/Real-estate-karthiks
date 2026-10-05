"use client";
// Phones: the ☰ charts menu (owner, 5/10/2026, option B) — a game pause-menu list of the chart names only.
// Picking one opens that chart as a sheet with an ✕ (Dock sheet mode).
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { DOCK_TABS, dockTabLabel, type DockTab } from "@/components/hud";
import type { DashboardData } from "@/lib/dashboard-types";
import s from "./overview.module.css";

export function ChartMenu({ open, data, onPick, onClose }: { open: boolean; data: DashboardData; onPick: (t: DockTab) => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="menu-shade"
            className={s.menuShade}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.nav
            key="menu"
            className={s.menu}
            aria-label="Charts"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className={s.menuTitle}>Charts</h2>
            {DOCK_TABS.map((d) => (
              <button key={d.id} type="button" className={s.menuRow} onClick={() => onPick(d.id)}>
                <span className={s.menuIcon}>{d.icon}</span>
                <span className={s.menuLabel}>{dockTabLabel(data, d.id)}</span>
                <ChevronRight aria-hidden className={s.menuChev} />
              </button>
            ))}
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
