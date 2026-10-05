"use client";
// Option C (owner): records as game-style character cards — initials badge, name, a tag (unit / status), a contact
// line and two stats — with a dashed "+ new" card at the end. Used where a list stays short (tenants, leases, units).
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton, cx } from "@/components/ui";
import s from "./cards.module.css";

export interface GameCardProps {
  badge: ReactNode;
  title: ReactNode;
  tag?: { text: ReactNode; tone?: "teal" | "coral" | "marigold" | "muted" };
  line?: ReactNode;
  stats?: { label: ReactNode; value: ReactNode; tone?: "teal" | "coral" | "muted" }[];
  selected?: boolean;
  onOpen?: () => void;
}

export function GameCard({ badge, title, tag, line, stats, selected, onOpen }: GameCardProps) {
  return (
    <button type="button" className={cx(s.card, selected && s.selected)} onClick={onOpen}>
      <span className={s.top}>
        <span className={s.badge}>{badge}</span>
        {tag && (
          <span className={s.tag} data-tone={tag.tone ?? "marigold"}>
            {tag.text}
          </span>
        )}
      </span>
      <span className={s.title}>{title}</span>
      {line && <span className={s.line}>{line}</span>}
      {stats && stats.length > 0 && (
        <span className={s.stats}>
          {stats.map((st, i) => (
            <span key={i} className={s.stat}>
              <span className={s.statLabel}>{st.label}</span>
              <span className={s.statValue} data-tone={st.tone}>
                {st.value}
              </span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

export function CardGrid({ loading, children, addLabel, onAdd, empty }: { loading?: boolean; children: ReactNode; addLabel?: string; onAdd?: () => void; empty?: ReactNode }) {
  const kids = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (loading)
    return (
      <div className={s.grid}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={s.skeleton} />
        ))}
      </div>
    );
  if (!kids.length && empty) return <>{empty}</>;
  return (
    <div className={s.grid}>
      {children}
      {onAdd && (
        <button type="button" className={s.add} onClick={onAdd}>
          <Plus aria-hidden />
          {addLabel ?? "New"}
        </button>
      )}
    </div>
  );
}

/** "Mohamed Akkeem" → "MA" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
