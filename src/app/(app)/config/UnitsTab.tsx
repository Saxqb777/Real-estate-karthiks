"use client";
import { Hammer, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Panel, Skeleton, StatusPill, confirmDialog, cx } from "@/components/ui";
import { UnitForm, unitFormValues, useDashboard, useUnits, type UnitFormValues } from "@/components/forms";
import type { UnitBreakdown } from "@/lib/dashboard-types";
import { formatINR, formatINRCompact, formatIndianNumber } from "@/lib/format";
import { unitDeleteBlockedMessage, type UnitListItem } from "@/lib/schemas/unit";
import { sceneUnitsFromBreakdown, type SceneUnit, type SlotName } from "@/lib/site-layout";
import { DeleteButton } from "../data/shared";
import { LivePreview } from "./Preview";
import s from "./config.module.css";

type Selection = { mode: "edit"; id: string } | { mode: "new"; slot: SlotName | ""; n: number };

const SLOTS: { slot: SlotName; label: string; where: string }[] = [
  { slot: "front", label: "Front", where: "on the street" },
  { slot: "back", label: "Back", where: "behind the courtyard" },
];

const FIELD_LABEL: Record<string, string> = {
  footprintWidthFt: "Footprint width — across the plot",
  footprintDepthFt: "Footprint depth — front to back",
  floors: "Floors — the building's height",
  builtUpSqft: "The whole building",
  position: "Front and back positions",
};

/** Map a focused unit field to the 3D highlight key. */
function highlightFor(field: string | null, id: string): string | null {
  if (!field) return null;
  if (field === "footprintWidthFt" || field === "footprintDepthFt") return `${field}:${id}`;
  if (field === "floors" || field === "builtUpSqft") return `floors:${id}`;
  if (field === "position") return "position";
  return null;
}

/** Overlay the unsaved form values onto the scene so the model follows the typing. */
function withDraft(base: SceneUnit[], draft: UnitFormValues | null, sel: Selection): SceneUnit[] {
  if (!draft) return base;
  const patch = {
    name: draft.name || "New unit",
    position: draft.position || null,
    floors: draft.floors ?? 1,
    footprintWidthFt: draft.footprintWidthFt,
    footprintDepthFt: draft.footprintDepthFt,
    isActive: draft.isActive,
  };
  if (sel.mode === "edit") return base.map((u) => (u.id === sel.id ? { ...u, ...patch } : u));
  return [...base, { id: "draft", status: "vacant", rentState: "none", ...patch }];
}

export function UnitsTab() {
  const units = useUnits();
  const dash = useDashboard();
  const items = units.data?.items;
  const breakdown = useMemo(() => new Map((dash.data?.units ?? []).map((u) => [u.id, u])), [dash.data]);

  const [picked, setPicked] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<UnitFormValues | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);

  const bySlot = useMemo(() => {
    const m: Partial<Record<SlotName, UnitListItem>> = {};
    for (const u of items ?? []) if (u.isActive && u.position && !m[u.position]) m[u.position] = u;
    return m;
  }, [items]);
  const others = (items ?? []).filter((u) => !Object.values(bySlot).includes(u));

  // Default selection: the front unit, else the first unit, else "build the front unit".
  const sel = useMemo<Selection | null>(
    () => picked ?? (items ? (items.length ? { mode: "edit", id: (bySlot.front ?? items[0]).id } : { mode: "new", slot: "front", n: 0 }) : null),
    [picked, items, bySlot],
  );
  const current = sel?.mode === "edit" ? items?.find((u) => u.id === sel.id) : undefined;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(unitFormValues(current ?? null, sel?.mode === "new" ? { position: sel.slot } : undefined));

  const choose = async (next: Selection) => {
    if (dirty && !(await confirmDialog({ title: "Discard unsaved changes?", message: "The changes to this unit haven't been saved.", confirmLabel: "Discard", tone: "danger" }))) return;
    setDraft(null);
    setFocused(null);
    setPicked(next);
  };
  const build = (slot: SlotName | "") => {
    setNewCount((n) => n + 1);
    void choose({ mode: "new", slot, n: newCount + 1 });
  };

  const sceneUnits = useMemo(() => withDraft(sceneUnitsFromBreakdown(dash.data?.units ?? []), draft, sel ?? { mode: "new", slot: "", n: 0 }), [dash.data, draft, sel]);
  const targetId = sel?.mode === "edit" ? sel.id : "draft";
  const highlight = highlightFor(focused, targetId);
  const scenePlot = useMemo(() => dash.data?.plot ?? { townName: "Pattukottai" }, [dash.data]);

  const blocked = current ? unitDeleteBlockedMessage(current.name, current._count) : null;

  return (
    <div className={s.split} data-wide-form>
      <div className={s.leftCol}>
        <div className={s.slots}>
          {SLOTS.map(({ slot, label, where }) => {
            const u = bySlot[slot];
            const on = sel?.mode === "edit" ? u?.id === sel.id : sel?.slot === slot;
            return u ? (
              <SlotCard key={slot} slot={label} where={where} unit={u} info={breakdown.get(u.id)} selected={on} onClick={() => void choose({ mode: "edit", id: u.id })} />
            ) : (
              <button key={slot} type="button" className={cx(s.slot, s.slotEmpty)} aria-pressed={on} onClick={() => build(slot)}>
                <span className={s.slotLabel}>
                  {label} <span className="faint">· {where}</span>
                </span>
                <span className={s.buildCta}>
                  <Plus aria-hidden /> Build unit
                </span>
                <span className={s.slotNote}>Empty slot on the plot</span>
              </button>
            );
          })}
        </div>
        {others.length > 0 && (
          <div className={s.others}>
            <span className={s.othersLabel}>Other units</span>
            {others.map((u) => (
              <button
                key={u.id}
                type="button"
                className={s.otherChip}
                aria-pressed={sel?.mode === "edit" && sel.id === u.id}
                onClick={() => void choose({ mode: "edit", id: u.id })}
              >
                {u.name}
                <Badge size="sm" tone={u.isActive ? "neutral" : "grey"}>
                  {u.isActive ? "not placed" : "inactive"}
                </Badge>
              </button>
            ))}
          </div>
        )}

        <Panel
          fill
          padding="none"
          eyebrow={sel?.mode === "new" ? "New unit" : "Unit"}
          title={sel?.mode === "new" ? (draft?.name || "Build a unit") : (current?.name ?? "Unit")}
          actions={
            sel?.mode === "edit" ? (
              <button type="button" className={s.textBtn} onClick={() => build("")}>
                <Hammer aria-hidden /> Build another
              </button>
            ) : null
          }
          className={s.formPanel}
        >
          {!sel || !items ? (
            <div className={s.loading}>
              <Skeleton lines={6} />
            </div>
          ) : sel.mode === "edit" && current ? (
            <UnitForm
              key={`edit-${current.id}`}
              unit={current}
              units={items}
              onValuesChange={setDraft}
              onFocusField={setFocused}
              onSaved={() => setDraft(null)}
              actionsLeft={
                <DeleteButton
                  path={`/api/units/${current.id}`}
                  what={current.name}
                  blocked={blocked}
                  onDeleted={() => {
                    setDraft(null);
                    setPicked(null);
                  }}
                  confirmMessage="Its offers are deleted with it. To-dos linked to it stay, without a unit."
                />
              }
            />
          ) : sel.mode === "new" ? (
            <UnitForm
              key={`new-${sel.slot}-${sel.n}`}
              defaults={{ position: sel.slot }}
              units={items}
              onValuesChange={setDraft}
              onFocusField={setFocused}
              onCancel={items.length ? () => void choose({ mode: "edit", id: (bySlot.front ?? items[0]).id }) : undefined}
              onSaved={(u) => {
                setDraft(null);
                setPicked({ mode: "edit", id: u.id });
              }}
            />
          ) : null}
        </Panel>
      </div>

      <LivePreview
        plot={scenePlot}
        units={sceneUnits}
        highlight={highlight}
        focusLabel={highlight && focused ? FIELD_LABEL[focused] : null}
        dirty={dirty}
        onSelectUnit={(id) => {
          if (id && id !== "draft") void choose({ mode: "edit", id });
        }}
        onEmptySlotClick={(slot) => build(slot)}
      />
    </div>
  );
}

function SlotCard({
  slot,
  where,
  unit,
  info,
  selected,
  onClick,
}: {
  slot: string;
  where: string;
  unit: UnitListItem;
  info?: UnitBreakdown;
  selected: boolean;
  onClick: () => void;
}) {
  const status = info ? (info.rentState === "overdue" ? "overdue" : info.status === "occupied" ? "occupied" : info.status === "inactive" ? "inactive" : "vacant") : null;
  return (
    <button type="button" className={s.slot} aria-pressed={selected} onClick={onClick}>
      <span className={s.slotLabel}>
        {slot} <span className="faint">· {where}</span>
      </span>
      <span className={s.slotName}>
        {unit.name}
        {status && <StatusPill status={status} size="sm" />}
      </span>
      <span className={s.slotFacts}>
        <span>
          <b className="num">{unit.floors}</b> {unit.floors === 1 ? "floor" : "floors"}
        </span>
        <span>
          <b className="num">{formatIndianNumber(unit.builtUpSqft)}</b> sqft
        </span>
        <span title={formatINR(unit.purchasePrice)}>
          Bought <b className="num">{formatINRCompact(unit.purchasePrice)}</b>
        </span>
        {unit.bestOffer !== null && (
          <span className={s.paper} title={`Best offer ${formatINR(unit.bestOffer)} — paper value`}>
            Offer <b className="num">{formatINRCompact(unit.bestOffer)}</b>
          </span>
        )}
      </span>
    </button>
  );
}
