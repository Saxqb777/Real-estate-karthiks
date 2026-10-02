"use client";
// Which report is open. Deep-linkable through the URL (/data?report=unit&unit=<id>#reports) and remembered per
// browser, so coming back to Data → Reports reopens the last report. Use reportHref() to link here.
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ReportKind = "annual" | "unit" | "ledger";
export const REPORT_KINDS: ReportKind[] = ["annual", "unit", "ledger"];

export interface ReportSelection {
  kind: ReportKind;
  /** annual statement: FY start year / calendar year (null = the current one) */
  year: number | null;
  unitId: string | null;
  leaseId: string | null;
}

const STORE_KEY = "pe.reports";
const EVENT = "pe:reports";
const PARAMS = ["report", "year", "unit", "lease"] as const;

/** Link to a report in Data → Reports, e.g. reportHref({ kind: "ledger", leaseId }). */
export function reportHref(sel: Partial<ReportSelection> & { kind: ReportKind }): string {
  const p = new URLSearchParams({ report: sel.kind });
  if (sel.kind === "annual" && sel.year != null) p.set("year", String(sel.year));
  if (sel.kind === "unit" && sel.unitId) p.set("unit", sel.unitId);
  if (sel.kind === "ledger" && sel.leaseId) p.set("lease", sel.leaseId);
  return `/data?${p.toString()}#reports`;
}

const isKind = (v: unknown): v is ReportKind => typeof v === "string" && (REPORT_KINDS as string[]).includes(v);

function parse(json: string | null): Partial<ReportSelection> {
  if (!json) return {};
  try {
    const o = JSON.parse(json) as Partial<ReportSelection>;
    return {
      kind: isKind(o.kind) ? o.kind : undefined,
      year: typeof o.year === "number" ? o.year : null,
      unitId: typeof o.unitId === "string" ? o.unitId : null,
      leaseId: typeof o.leaseId === "string" ? o.leaseId : null,
    };
  } catch {
    return {};
  }
}

function fromUrl(search: string): Partial<ReportSelection> | null {
  const p = new URLSearchParams(search);
  const kind = p.get("report");
  if (!isKind(kind)) return null;
  const y = Number(p.get("year"));
  return {
    kind,
    year: Number.isInteger(y) && y > 1900 ? y : null,
    unitId: p.get("unit"),
    leaseId: p.get("lease"),
  };
}

let memo: { raw: string; value: ReportSelection } | null = null;
const DEFAULT: ReportSelection = { kind: "annual", year: null, unitId: null, leaseId: null };

function snapshot(): ReportSelection {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORE_KEY);
  } catch {
    /* private mode */
  }
  const raw = `${window.location.search}|${stored ?? ""}`;
  if (memo?.raw === raw) return memo.value;
  const url = fromUrl(window.location.search);
  const saved = parse(stored);
  const value: ReportSelection = url
    ? { ...DEFAULT, ...saved, ...Object.fromEntries(Object.entries(url).filter(([, v]) => v !== null && v !== undefined)) }
    : { ...DEFAULT, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined)) };
  memo = { raw, value };
  return value;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("popstate", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("popstate", cb);
    window.removeEventListener("storage", cb);
  };
}

function writeUrl(sel: ReportSelection | null) {
  const url = new URL(window.location.href);
  for (const k of PARAMS) url.searchParams.delete(k);
  if (sel) {
    const target = new URL(reportHref(sel), window.location.origin);
    target.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  }
  const next = url.pathname + url.search + url.hash;
  if (next !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(window.history.state, "", next);
  }
}

function save(sel: ReportSelection) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(sel));
  } catch {
    /* private mode: still switch for this page */
  }
}

/** [selection, update] — update merges, saves for this browser and mirrors it in the URL. */
export function useReportSelection(): [ReportSelection, (patch: Partial<ReportSelection>) => void] {
  const sel = useSyncExternalStore(subscribe, snapshot, () => DEFAULT);

  const update = useCallback((patch: Partial<ReportSelection>) => {
    const next = { ...snapshot(), ...patch };
    save(next);
    writeUrl(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  // keep the URL in step while the hub is open (a deep link is saved first); tidy it when leaving the Reports tab
  useEffect(() => {
    const current = snapshot();
    save(current);
    writeUrl(current);
    return () => writeUrl(null);
  }, []);

  return [sel, update];
}
