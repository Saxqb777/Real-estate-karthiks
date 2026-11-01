"use client";
// The overview's as-of setter, for the year picker in the windows and charts (owner 1/11/2026: "just keep years to
// select"): picking an earlier year shows the estate as it stood at the end of that year; the current year = today.
import { createContext, useContext } from "react";

export const AsOfContext = createContext<((iso: string | null) => void) | null>(null);
export const useSetAsOf = () => useContext(AsOfContext);
