"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV } from "./nav";
import styles from "./Shell.module.css";

/** Bottom tab bar for phones (< 768px). */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabbar} aria-label="Main" data-print-hide>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={styles.tab} aria-current={active ? "page" : undefined}>
            {active && <motion.span layoutId="tabbar-marker" className={styles.tabMarker} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Icon aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
