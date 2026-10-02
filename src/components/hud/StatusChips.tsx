"use client";
// The status strip over the clean world: at most 3 chips, prioritised overdue > due soon > tax / to-dos > vacancy,
// "+N more" for the rest, and a calm "All rent paid ✓" when nothing needs attention (the 3-second test).
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";
import { buildStatusChips, type StatusChip } from "./chips";
import type { ChipTarget } from "./types";
import s from "./bits.module.css";

export interface StatusChipsProps {
  data: DashboardData;
  /** /api/property-tax items (optional — adds the "Property tax due" chip) */
  taxes?: PropertyTaxDTO[] | null;
  /** chips shown before "+N more" (default 3) */
  max?: number;
  onSelect: (target: ChipTarget) => void;
  className?: string;
}

export function StatusChips({ data, taxes, max = 3, onSelect, className }: StatusChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const all = buildStatusChips(data, taxes);
  const occupied = data.units.some((u) => u.isActive && u.activeLease);
  const anyRentIssue = all.some((c) => c.rank <= 1);
  const calm: StatusChip | null =
    !anyRentIssue && occupied
      ? { id: "calm", tone: "teal", text: data.isLive ? "All rent paid" : "All rent paid on this date", target: { kind: "mailbox" }, rank: -1 }
      : null;
  const list = calm ? [calm, ...all] : all;
  const shown = expanded ? list : list.slice(0, max);
  const more = list.length - shown.length;

  if (list.length === 0)
    return (
      <div className={cx(s.chips, className)} role="status">
        <span className={cx(s.chip, s.chipCalm)} data-tone="teal">
          <Check aria-hidden className={s.chipCheck} />
          Nothing needs you today
        </span>
      </div>
    );

  return (
    <div className={cx(s.chips, expanded && s.chipsExpanded, className)} role="status" aria-label="What needs attention">
      {shown.map((c) => (
        <button key={c.id} type="button" className={cx(s.chip, c.id === "calm" && s.chipCalm)} data-tone={c.tone} onClick={() => onSelect(c.target)}>
          {c.id === "calm" ? <Check aria-hidden className={s.chipCheck} /> : <span className={cx(s.chipMark, c.tone === "coral" && s.chipPulse)} aria-hidden />}
          <span className={s.chipText}>{c.text}</span>
          {c.detail && <span className={s.chipDetail}>{c.detail}</span>}
        </button>
      ))}
      {more > 0 && (
        <button type="button" className={cx(s.chip, s.chipMore)} onClick={() => setExpanded(true)} aria-expanded={false}>
          +{more} more
          <ChevronDown aria-hidden />
        </button>
      )}
      {expanded && list.length > max && (
        <button type="button" className={cx(s.chip, s.chipMore)} onClick={() => setExpanded(false)} aria-expanded>
          Less
          <ChevronUp aria-hidden />
        </button>
      )}
    </div>
  );
}
