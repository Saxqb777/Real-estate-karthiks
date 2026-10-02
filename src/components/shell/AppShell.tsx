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

/** Authenticated app frame: HUD bar, page area, phone tab bar, toasts, confirm dialogs, ⌘K palette. */
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
            className={styles.main}
            tabIndex={-1}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
