"use client";
// Year type (owner choice): Indian financial year (1 Apr – 31 Mar, "FY 2025-26") by default, calendar year as a toggle.
// Remembered per browser and shared by every screen through one localStorage key, so a global period control
// can use the same store (useYearMode) and every scope chip shows the active label.
import { useCallback, useSyncExternalStore } from "react";
import { todayIST } from "@/lib/dates";
import type { YearMode } from "@/lib/schemas/expense";

export type { YearMode } from "@/lib/schemas/expense";

export const YEAR_MODE_KEY = "pe.yearMode";
const EVENT = "pe:yearmode";

function read(): YearMode {
  try {
    return window.localStorage.getItem(YEAR_MODE_KEY) === "calendar" ? "calendar" : "fy";
  } catch {
    return "fy";
  }
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === YEAR_MODE_KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

/** [mode, setMode] — "fy" (default) or "calendar", synced across tabs and components. */
export function useYearMode(): [YearMode, (mode: YearMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => "fy" as YearMode);
  const set = useCallback((m: YearMode) => {
    try {
      window.localStorage.setItem(YEAR_MODE_KEY, m);
    } catch {
      /* private mode: still switch for this page */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, set];
}

/** "FY 2025-26" (year = the April it starts in) or "2026". */
export function yearLabel(year: number, mode: YearMode): string {
  return mode === "fy" ? `FY ${year}-${String((year + 1) % 100).padStart(2, "0")}` : String(year);
}

/** The year a date-only value falls in (FY: Jan–Mar belong to the year that started the April before). */
export function yearOf(date: string | Date, mode: YearMode): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  return mode === "fy" && d.getUTCMonth() < 3 ? y - 1 : y;
}

export const currentYear = (mode: YearMode) => yearOf(todayIST(), mode);
