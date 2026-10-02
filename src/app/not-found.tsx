import { ArrowLeft, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { BrandMark } from "@/components/shell/BrandMark";
import { Kolam, LinkButton } from "@/components/ui";
import styles from "./not-found.module.css";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.copy}>
        <div className={styles.brand}>
          <BrandMark size={28} />
          Pattukottai Estates
        </div>
        <div className={styles.code}>Error 404 · not surveyed</div>
        <h1 className={styles.title}>This page isn’t on the site plan.</h1>
        <p className={styles.desc}>The link may be mistyped, or the record it pointed to was removed. Everything else is where you left it.</p>
        <div className={styles.actions}>
          <LinkButton href="/" variant="primary" icon={<ArrowLeft />}>
            Back to overview
          </LinkButton>
          <LinkButton href="/data" variant="secondary" icon={<ScrollText />}>
            Open data
          </LinkButton>
        </div>
      </div>
      <div className={styles.sheet} aria-hidden>
        <svg viewBox="0 0 300 380" className={styles.plan} fill="none">
          {/* plot boundary (front 22'3" at the bottom, back 23'3" at the top, 76' deep) */}
          <path d="M66 46 L234 46 L228 330 L72 330 Z" stroke="var(--plaster)" strokeOpacity=".55" strokeDasharray="5 4" />
          {/* back building, front building — both missing */}
          <rect x="96" y="58" width="126" height="98" stroke="var(--line-bright)" strokeDasharray="2 4" />
          <rect x="96" y="218" width="126" height="98" stroke="var(--line-bright)" strokeDasharray="2 4" />
          {/* front dimension */}
          <path d="M72 352 H228 M72 346 V358 M228 346 V358" stroke="var(--text-faint)" />
          <text x="150" y="372" textAnchor="middle" className={styles.dimText}>22′3″</text>
          {/* depth dimension */}
          <path d="M256 46 V330 M250 46 H262 M250 330 H262" stroke="var(--text-faint)" />
          <text x="270" y="192" className={styles.dimText} transform="rotate(90 270 192)" textAnchor="middle">76′</text>
          {/* road */}
          <path d="M20 340 H280" stroke="var(--line-strong)" />
        </svg>
        <Kolam size={72} className={styles.kolam} />
        <span className={styles.stamp}>404 · No plot here</span>
      </div>
    </main>
  );
}
