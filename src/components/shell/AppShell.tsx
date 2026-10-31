"use client";

import { LogOut } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Overview } from "@/components/overview";
import { CommandProvider, ConfirmHost, Toaster, type Command } from "@/components/ui";
import { logout } from "@/lib/client";
import { HudBar } from "./HudBar";
import { MobileTabBar } from "./MobileTabBar";
import { NAV } from "./nav";
import { isWorldRoute, pageExit, useLeaving } from "./world-state";
import styles from "./Shell.module.css";

/**
 * Authenticated app frame (one screen, never scrolls): HUD bar, page area, phone tab bar,
 * toasts, confirm dialogs, ⌘K palette. Pages render inside <main> — a flex column filling the
 * rest of the viewport — and should use <Screen> (or flex: 1 for full-bleed) + internal scrolling.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // THE WORLD BEHIND EVERY PAGE (owner, 31/10/2026): the 3D estate is mounted once — on the first visit to the
  // overview, Data or Config — and stays: the overview is the world with its HUD, Data / Config are glass over it,
  // so moving between them never reloads it (no "Arriving…" screen on the way back).
  const onWorld = isWorldRoute(pathname);
  // a main tab was clicked: the page on screen dissolves, then the route changes (see smooth-nav.ts)
  const leaving = useLeaving();
  useEffect(() => {
    pageExit.set(false);
  }, [pathname]);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => pageExit.set(false), 3000); // never stay dissolved if a switch fails
    return () => window.clearTimeout(t);
  }, [leaving]);
  const [worldOn, setWorldOn] = useState(onWorld);
  useEffect(() => {
    if (onWorld) setWorldOn(true);
  }, [onWorld]);
  const [layout, setLayout] = useState<"immersive" | "framed">("immersive");
  useEffect(() => {
    // ?layout=framed previews the boxed-world layout (option B)
    setLayout(new URLSearchParams(window.location.search).get("layout") === "framed" ? "framed" : "immersive");
  }, []);
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
          <div className={styles.stage}>
            {worldOn && (
              <div className={styles.world} data-active={pathname === "/" || undefined} hidden={!onWorld}>
                <Overview layout={layout} active={pathname === "/" && !leaving} />
              </div>
            )}
            <motion.main
              id="main"
              key={pathname}
              className={pathname === "/" ? `${styles.main} ${styles.mainWorld}` : `${styles.main} ${styles.mainPadded}`}
              data-leaving={leaving || undefined}
              tabIndex={-1}
              // the overview IS the world behind (above); Data / Config bring their own fade-in (sections from a soft blur)
              initial={onWorld ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.main>
          </div>
          <MobileTabBar />
        </div>
        <Toaster />
        <ConfirmHost />
      </CommandProvider>
    </MotionConfig>
  );
}
