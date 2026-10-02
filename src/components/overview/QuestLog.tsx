"use client";
// Quest log — the left HUD while the property isn't set up yet (empty database → first steps, like a game's
// opening quests). Each quest shows progress and a button that opens the right form (or Config → Plot).
import { Check, Coins, FileSignature, Home, Lock, Ruler, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button, SegmentedBar, cx } from "@/components/ui";
import { quickAdd } from "@/components/forms";
import { HudPanel } from "@/components/hud";
import type { QuestId, QuestState } from "./quests";
import s from "./quest.module.css";

const ICON: Record<QuestId, ReactNode> = {
  plot: <Ruler aria-hidden />,
  unit1: <Home aria-hidden />,
  unit2: <Home aria-hidden />,
  tenant: <UserPlus aria-hidden />,
  lease: <FileSignature aria-hidden />,
  rent: <Coins aria-hidden />,
};

export interface QuestLogProps {
  state: QuestState;
  /** positions already taken, so "Build unit" suggests the free slot */
  takenPositions: ("front" | "back")[];
  onClose?: () => void;
  side?: "left" | "inline";
  className?: string;
}

/** Runs a quest's action (also used by the empty-slot "+ Build unit" in the world and by ⌘K). */
export function useQuestAction(takenPositions: ("front" | "back")[]) {
  const router = useRouter();
  return (id: QuestId) => {
    switch (id) {
      case "plot":
        return router.push("/config#plot");
      case "unit1":
      case "unit2": {
        const position = !takenPositions.includes("front") ? "front" : !takenPositions.includes("back") ? "back" : "";
        return quickAdd("unit", { defaults: { position } });
      }
      case "tenant":
        return quickAdd("tenant");
      case "lease":
        return quickAdd("lease");
      case "rent":
        return quickAdd("payment");
    }
  };
}

export function QuestLog({ state, takenPositions, onClose, side = "left", className }: QuestLogProps) {
  const run = useQuestAction(takenPositions);
  return (
    <HudPanel
      side={side}
      eyebrow="Getting started"
      title="Quest log"
      aside={
        <span className={s.count}>
          <b className="num">{state.done}</b>/{state.total}
        </span>
      }
      onClose={onClose}
      accent="marigold"
      className={className}
      hint={<span>{state.complete ? "All set — the world is yours" : "Each step takes about a minute"}</span>}
    >
      <div className={s.progress}>
        <SegmentedBar value={state.done} max={state.total} segments={state.total} tone="marigold" size="sm" valueLabel={null} aria-label="Setup progress" />
        <span className={s.progressText}>{state.complete ? "Setup complete" : `${state.total - state.done} ${state.total - state.done === 1 ? "step" : "steps"} to a working estate`}</span>
      </div>
      <ol className={s.list}>
        {state.quests.map((q, i) => {
          const current = q.id === state.current;
          return (
            <motion.li
              key={q.id}
              className={cx(s.quest, q.done && s.done, current && s.current, q.locked && s.locked)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={s.mark} aria-hidden>
                {q.done ? <Check /> : q.locked ? <Lock /> : ICON[q.id]}
              </span>
              <div className={s.body}>
                <div className={s.titleRow}>
                  <span className={s.step}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.title}>{q.title}</span>
                </div>
                <p className={s.text}>{q.done ? q.doneNote : (q.locked ?? q.text)}</p>
              </div>
              {!q.done && !q.locked && (
                <Button size="sm" variant={current ? "primary" : "secondary"} onClick={() => run(q.id)} className={s.cta}>
                  {q.cta}
                </Button>
              )}
            </motion.li>
          );
        })}
      </ol>
    </HudPanel>
  );
}
