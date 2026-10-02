"use client";

import { Command, LogOut, Search } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconButton, Kbd, useCommandPalette } from "@/components/ui";
import { logout, useApi } from "@/lib/client";
import { BrandMark } from "./BrandMark";
import { dayPhaseAt, istTime } from "./day-phase";
import { IstClock, useEpochSecond } from "./IstClock";
import { isActive, NAV } from "./nav";
import styles from "./Shell.module.css";

export function useBrandName(): string {
  const { data } = useApi<{ brandName?: string }>("/api/settings", { dedupeMs: 60_000 });
  return data?.brandName?.trim() || "Pattukottai Estates";
}

/** Brand mark whose windows light up at dusk/night (IST). */
function LiveMark() {
  const sec = useEpochSecond();
  const phase = sec ? dayPhaseAt(istTime(new Date(sec * 1000)).fractional) : "night";
  return <BrandMark className={styles.mark} lit={phase === "dusk" || phase === "night"} />;
}

/** Top HUD bar: brand, nav with sliding marker, IST clock, ⌘K, sign out. */
export function HudBar() {
  const pathname = usePathname();
  const palette = useCommandPalette();
  const brand = useBrandName();
  const [leaving, setLeaving] = useState(false);
  return (
    <header className={styles.bar} data-print-hide>
      <div className={styles.barInner}>
        <Link href="/" className={styles.brand} aria-label={`${brand} — Overview`}>
          <LiveMark />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{brand}</span>
            <span className={styles.brandSub}>
              <span className="tamil" lang="ta">
                பட்டுக்கோட்டை
              </span>
              <span className={styles.coords}>10.42°N 79.32°E</span>
            </span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item, i) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={styles.navLink} aria-current={active ? "page" : undefined}>
                <span className={styles.navIndex}>{String(i + 1).padStart(2, "0")}</span>
                <Icon className={styles.navIcon} aria-hidden />
                <span>{item.label}</span>
                {active && <motion.span layoutId="hud-nav-marker" className={styles.navMarker} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.barRight}>
          <IstClock />
          <button type="button" className={styles.cmdk} onClick={palette.toggle} aria-label="Open command palette" aria-keyshortcuts="Control+K Meta+K">
            <Search aria-hidden />
            <span className={styles.cmdkText}>Jump to…</span>
            <Kbd keys={["mod", "k"]} />
          </button>
          <IconButton
            className={styles.cmdkIcon}
            label="Commands"
            icon={<Command />}
            variant="secondary"
            onClick={palette.toggle}
          />
          <IconButton
            label="Sign out"
            icon={<LogOut />}
            variant="secondary"
            loading={leaving}
            onClick={() => {
              setLeaving(true);
              void logout();
            }}
          />
        </div>
      </div>
      <div className={styles.band} aria-hidden />
    </header>
  );
}
