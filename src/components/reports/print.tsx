"use client";
// Print plumbing shared by the reports and the rent receipt.
//  <PrintPortal> renders a LIGHT document straight under <body> that is hidden on screen and is the only thing
//  printed (the app shell — a one-screen, overflow-hidden frame — is hidden while printing). It also writes the
//  A4 @page rules with a running header and "Page X of Y" footer (Chromium margin boxes; other browsers just
//  print without them).
//  printDocument(title) sets the tab title (the default PDF file name) and opens the browser's print window.
import { useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/components/ui";
import s from "./reports.module.css";

/** CSS string literal (escapes quotes / backslashes / newlines). */
const str = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;

const noop = () => () => {};
/** The next/font family stacks (hashed names) so @page margin boxes use the same fonts as the page. */
function useFontStacks() {
  return useSyncExternalStore(
    noop,
    () => {
      const cs = getComputedStyle(document.documentElement);
      const tamil = cs.getPropertyValue("--font-tamil").trim();
      const body = cs.getPropertyValue("--font-body").trim() || "sans-serif";
      return `${tamil ? `${body}, ${tamil}` : body}|${cs.getPropertyValue("--font-display").trim() || "sans-serif"}`;
    },
    () => "sans-serif|sans-serif",
  );
}

export interface RunningText {
  /** top-left on pages 2+ (e.g. "Pattukottai Estates") */
  topLeft?: string;
  /** top-right on pages 2+ (e.g. "Annual statement · FY 2025-26") */
  topRight?: string;
  /** bottom-left on every page (e.g. "Generated 3/10/2026 · Ledger balanced ✓") */
  bottomLeft?: string;
  /** show "Page X of Y" bottom-right (default true) */
  pageNumbers?: boolean;
  /** page margins (CSS), default "15mm 13mm 16mm" */
  margin?: string;
}

export function PrintPortal({ children, running }: { children: ReactNode; running: RunningText }) {
  const isClient = useIsClient();
  const [body, display] = useFontStacks().split("|");
  if (!isClient) return null;
  const box = `font-family: ${body}; font-size: 7.5pt; color: #7a7064; letter-spacing: .02em;`;
  const num = `font-family: ${display}; font-size: 8.5pt; font-weight: 600; color: #7a7064; letter-spacing: .04em;`;
  const css = `
[data-print-doc] { display: none; }
@media print {
  :root { color-scheme: light !important; }
  @page {
    size: A4 portrait;
    background: #fff;
    margin: ${running.margin ?? "15mm 13mm 16mm"};
    ${running.topLeft ? `@top-left { content: ${str(running.topLeft)}; ${box} vertical-align: bottom; padding-bottom: 3mm; }` : ""}
    ${running.topRight ? `@top-right { content: ${str(running.topRight)}; ${box} vertical-align: bottom; padding-bottom: 3mm; }` : ""}
    ${running.bottomLeft ? `@bottom-left { content: ${str(running.bottomLeft)}; ${box} vertical-align: top; padding-top: 3mm; }` : ""}
    ${running.pageNumbers === false ? "" : `@bottom-right { content: "Page " counter(page) " of " counter(pages); ${num} vertical-align: top; padding-top: 3mm; }`}
  }
  @page :first { @top-left { content: none; } @top-right { content: none; } }
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body:has(> [data-print-doc]) > :not([data-print-doc]) { display: none !important; }
  [data-print-doc] { display: block !important; }
}`;
  return createPortal(
    <div data-print-doc className={s.printRoot}>
      <style>{css}</style>
      {children}
    </div>,
    document.body,
  );
}

/** Open the print window with `title` as the suggested PDF file name; restores the tab title afterwards. */
export function printDocument(title: string) {
  const prev = document.title;
  document.title = title.replace(/[\\/:*?"<>|]+/g, "-");
  const restore = () => {
    document.title = prev;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  // let React flush the portal before the browser snapshots the page
  requestAnimationFrame(() => window.print());
}

/** First-page header (owner's style C, no logo): a dark band with the name + place on the left and what the document is
 *  (title, scope / reference) on the right. Prints its background (print-color-adjust: exact). */
export function Letterhead({ brand, town, title, sub, right }: { brand: string; town?: string; title?: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className={s.lhC}>
      <div className={s.lhCLeft}>
        <span className={s.lhCName}>{brand}</span>
        {town && <span className={s.lhCSub}>{town}</span>}
      </div>
      <div className={s.lhCRight}>
        {title && <span className={s.lhCTitle}>{title}</span>}
        {sub && <span className={s.lhCSub}>{sub}</span>}
        {right && <span className={s.lhCSub}>{right}</span>}
      </div>
    </div>
  );
}

/**
 * The townhouse-on-laterite mark (same drawing as BrandMark / icon.svg) with its own ids: the shell's copy is
 * hidden while printing, and a clip-path / gradient referenced from a hidden SVG would not paint.
 */
export function PrintMark({ size = 30, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <clipPath id={`${id}t`}>
          <rect width="64" height="64" rx="10" />
        </clipPath>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC56A" />
          <stop offset="1" stopColor="#FF9C3F" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}t)`}>
        <rect width="64" height="64" fill={`url(#${id}s)`} />
        <rect y="50" width="64" height="14" fill="#B5532E" />
        <rect y="50" width="64" height="2" fill="#7A3418" />
        <rect x="6" y="56" width="3" height="3" fill="#F3E9D8" opacity=".8" />
        <rect x="30.5" y="56" width="3" height="3" fill="#F3E9D8" opacity=".8" />
        <rect x="55" y="56" width="3" height="3" fill="#F3E9D8" opacity=".8" />
        <rect x="16" y="11" width="10" height="9" rx="2" fill="#15120F" />
        <rect x="11" y="20" width="35" height="4" fill="#15120F" />
        <rect x="13" y="23" width="31" height="27" fill="#15120F" />
        <path d="M44 28h3.5v5h3.5v5h3.5v5h3.5v7H44z" fill="#15120F" />
        <rect x="17.5" y="28" width="7" height="6" fill="#F3E9D8" />
        <rect x="32.5" y="28" width="7" height="6" fill="#F3E9D8" />
        <rect x="25.5" y="39" width="6" height="11" fill="#FFB547" />
      </g>
    </svg>
  );
}
