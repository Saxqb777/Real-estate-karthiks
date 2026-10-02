"use client";
// Electric pole + meter → electricity per unit: TNPDCL consumer number (copy), "Pay electricity", and what the
// utilities bills have cost (the API's own category totals; tap for the bills).
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { FigLine, ScopeChip } from "./Figure";
import { useFormDrawer } from "./FormDrawer";
import { positionLabel } from "./format";
import { Electricity, UnitStatusPill } from "./UnitPanel";
import s from "./hud.module.css";
import b from "./bits.module.css";

export interface PolePanelProps {
  data: DashboardData;
  onClose?: () => void;
  side?: "right" | "inline";
  drill?: DrillStack;
  className?: string;
}

const UTILITY = /utilit|electric|eb\b|tnpdcl|power/i;

export function PolePanel({ data, onClose, side = "right", drill: external, className }: PolePanelProps) {
  const own = useDrillStack();
  const drill = external ?? own;
  const forms = useFormDrawer();
  const units = data.units.filter((u) => u.isActive);
  const utilityCat = data.expenseComposition.allTime.find((c) => UTILITY.test(c.name));

  return (
    <>
      <DrillPanel
        data={data}
        drill={drill}
        rootLabel="Electricity"
        side={side}
        eyebrow="Electric pole · TNPDCL"
        title="Electricity"
        pinId="pole"
        onClose={onClose}
        className={className}
        accent="sky"
        hint="Copy the consumer number, then pay on the TNPDCL site"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus />}
            onClick={() => forms.open({ kind: "expense", title: "Add an electricity bill", props: { defaults: { categoryId: utilityCat?.categoryId ?? "", description: "TNPDCL bill" } } })}
          >
            Add a bill you paid
          </Button>
        }
      >
        {units.map((u) => {
          const slice = data.expenseComposition.byUnit.find((x) => x.unitId === u.id)?.slices.find((c) => UTILITY.test(c.name));
          return (
            <section key={u.id} className={b.meter}>
              <div className={b.meterHead}>
                <span className={b.meterName}>
                  {u.name}
                  {positionLabel(u.position) && <span className={b.payerUnit}> · {positionLabel(u.position)}</span>}
                </span>
                <UnitStatusPill unit={u} />
              </div>
              <Electricity unit={u} compact />
              {slice ? (
                <FigLine
                  label={`${slice.name} paid`}
                  sub="Bills you recorded as expenses"
                  swatch={slice.color}
                  value={slice.amount}
                  tone="expense"
                  onClick={() => drill.push({ kind: "category", categoryId: slice.categoryId, name: slice.name, period: "allTime", unitId: u.id, color: slice.color })}
                />
              ) : (
                <p className={s.note}>No electricity bills recorded for {u.name}.</p>
              )}
            </section>
          );
        })}
        <p className={s.note}>
          Bill totals are <ScopeChip>{data.scopeLabels.allTime}</ScopeChip> — counted when you paid them. While a unit is let, the tenant usually pays the bill directly.
        </p>
      </DrillPanel>
      {forms.element}
    </>
  );
}
