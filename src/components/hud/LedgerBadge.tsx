"use client";
// "Ledger balanced ✓" — visible reconciliation (DATA CLARITY CONTRACT §5) from data.checks.
// Coral warning naming what doesn't add up when any check fails — never silently.
import { Check, TriangleAlert } from "lucide-react";
import { Tooltip, cx } from "@/components/ui";
import type { Reconciliation } from "@/lib/dashboard-types";
import s from "./bits.module.css";

export interface LedgerBadgeProps {
  checks: Reconciliation;
  /** Open the list of checks (e.g. push the "checks" drill view). */
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function LedgerBadge({ checks, onClick, size = "sm", className }: LedgerBadgeProps) {
  const failing = checks.items.filter((i) => !i.ok);
  const ok = checks.ledgerBalanced && failing.length === 0;
  const tip = ok
    ? `${checks.items.length} checks: every total equals the sum of its parts`
    : `Doesn't add up: ${failing.map((f) => f.label).join(" · ")}`;
  const body = (
    <>
      {ok ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
      <span>{ok ? "Ledger balanced" : failing.length === 1 ? "1 total doesn't add up" : `${failing.length} totals don't add up`}</span>
    </>
  );
  const cls = cx(s.ledger, !ok && s.ledgerBad, size === "md" && s.ledgerMd, onClick && s.ledgerBtn, className);
  return (
    <Tooltip content={tip} delay={300} describe={false}>
      {onClick ? (
        <button type="button" className={cls} onClick={onClick}>
          {body}
        </button>
      ) : (
        <span className={cls} role="status">
          {body}
        </span>
      )}
    </Tooltip>
  );
}
