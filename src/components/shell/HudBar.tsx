"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/lib/client";
import { isActive, NAV } from "./nav";
import styles from "./Shell.module.css";

export function useBrandName(): string {
  const { data } = useApi<{ brandName?: string }>("/api/settings", { dedupeMs: 60_000 });
  return data?.brandName?.trim() || "Pattukottai Estates";
}

/**
 * The only chrome left (owner): three tabs — Overview · Data · Config — floating at the top centre over the page.
 * No bar, brand, clock, search box or sign-out (time = the sun/moon, sign out = the car, search = ⌘K).
 */
export function HudBar() {
  const pathname = usePathname();
  return (
    <nav className={styles.floatNav} aria-label="Main" data-print-hide>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={styles.floatLink} aria-current={active ? "page" : undefined}>
            {active && <motion.span layoutId="hud-nav-plate" className={styles.floatPlate} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Icon className={styles.floatIcon} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
