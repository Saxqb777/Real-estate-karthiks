"use client";
// The overview's period, for the pill in the windows and charts (owner 2/11/2026: "just add all time with year pill"
// — [ Year | All time ]): Year = the estate as it stood at the end of the picked year (the as-of date; this year =
// today), All time = everything up to today.
import { createContext, useContext } from "react";

export type Span = { kind: "year" } | { kind: "all" };

export interface SpanApi {
  span: Span;
  setSpan: (span: Span) => void;
  /** Year view at this as-of date (null = today) */
  setAsOf: (iso: string | null) => void;
}

export const SpanContext = createContext<SpanApi | null>(null);
export const useSpan = () => useContext(SpanContext);
