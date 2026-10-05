"use client";

import { Menu, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { chartMenu, useChartMenu } from "./chart-menu";
import { isActive, NAV } from "./nav";
import styles from "./Shell.module.css";

/** Bottom tab bar for phones (< 768px): ☰ (charts menu) · Overview · Data · Config. */
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const menuOpen = useChartMenu();
  return (
    <nav className={styles.tabbar} aria-label="Main" data-print-hide>
      <button
        type="button"
        className={styles.tab}
        data-menu
        data-open={menuOpen || undefined}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close menu" : "Menu"}
        onClick={() => {
          if (pathname !== "/") {
            chartMenu.set(true);
            router.push("/");
          } else chartMenu.set(!menuOpen);
        }}
      >
        {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        <span>Menu</span>
      </button>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.tab}
            aria-current={active ? "page" : undefined}
            onClick={() => chartMenu.set(false)}
          >
            {active && <motion.span layoutId="tabbar-marker" className={styles.tabMarker} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Icon aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
