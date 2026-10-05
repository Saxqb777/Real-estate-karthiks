"use client";

import { LogOut } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { CommandProvider, ConfirmHost, Toaster, type Command } from "@/components/ui";
import { logout } from "@/lib/client";
import { HudBar } from "./HudBar";
import { MobileTabBar } from "./MobileTabBar";
import { NAV } from "./nav";
import styles from "./Shell.module.css";

/**
 * Authenticated app frame (one screen, never scrolls): HUD bar, page area, phone tab bar,
 * toasts, confirm dialogs, ⌘K palette. Pages render inside <main> — a flex column filling the
 * rest of the viewport — and should use <Screen> (or flex: 1 for full-bleed) + internal scrolling.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const defaults = useMemo<Command[]>(
    () => [
      ...NAV.map((n) => {
        const Icon = n.icon;
        return {
          id: `nav:${n.href}`,
          group: "Go to",
          title: n.label,
          subtitle: n.href === "/" ? "3D plot, rent status and returns" : n.href === "/data" ? "Tenants, leases, payments, expenses, tax, actions" : "Settings, plot, units, offers, categories",
          keywords: n.keywords,
          icon: <Icon />,
          href: n.href,
        };
      }),
      { id: "account:logout", group: "Account", title: "Sign out", keywords: ["logout", "log out", "exit"], icon: <LogOut />, perform: () => logout() },
    ],
    [],
  );
  return (
    <MotionConfig reducedMotion="user">
      <CommandProvider defaults={defaults}>
        <a href="#main" className={styles.skip}>
          Skip to content
        </a>
        <div className={styles.shell}>
          <HudBar />
          <motion.main
            id="main"
            key={pathname}
            className={pathname === "/" ? styles.main : `${styles.main} ${styles.mainPadded}`}
            tabIndex={-1}
            // the overview brings its own arrival screen (it covers the page until the 3D world is drawn) — no fade under it
            initial={pathname === "/" ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.main>
          <MobileTabBar />
        </div>
        <Toaster />
        <ConfirmHost />
      </CommandProvider>
    </MotionConfig>
  );
}
