"use client";
// The overview's period, for the pill in the windows and charts (owner 2/11/2026: "add all time and custom date … in
// every page where dates are present" — [ Year | All time | Custom ]): Year = the estate as it stood at the end of
// the picked year (the as-of date; this year = today), All time = everything up to today, Custom = the figures for
// the dates (the dashboard fills its year slot with them; as-of = the To day, or today).
import { createContext, useContext } from "react";

export type Span = { kind: "year" } | { kind: "all" } | { kind: "range"; from: string; to: string };

export interface SpanApi {
  span: Span;
  setSpan: (span: Span) => void;
  /** Year view at this as-of date (null = today) */
  setAsOf: (iso: string | null) => void;
}

export const SpanContext = createContext<SpanApi | null>(null);
export const useSpan = () => useContext(SpanContext);
