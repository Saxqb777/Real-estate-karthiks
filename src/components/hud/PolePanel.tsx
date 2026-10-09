"use client";
// Electric pole + meter → electricity per house (owner picked design A "Meter", 9/10/2026): a card per house with its
// TNPDCL consumer number on a glowing meter display (tap to copy), its last bill · this year · all time (tap for the
// bills) and Pay bill (TNPDCL site) + Add bill (an expense pre-filled for that house). Bills = the electricity /
// utilities category's expenses, counted up to the as-of date like every other figure; totals via sumAmounts().
import { Check, Copy, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, cx, toast } from "@/components/ui";
import { useCategories } from "@/components/forms";
import { sumAmounts } from "@/lib/calculations";
import { useApi } from "@/lib/client";
import type { DashboardData, UnitBreakdown } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import type { ExpenseDTO, ExpenseListResponse } from "@/lib/schemas/expense";
import { DrillPanel, inScope, useDrillStack, type DrillStack } from "./DrillDown";
import { useFormDrawer } from "./FormDrawer";
import { inr } from "./format";
import { PayBillButton, UnitStatusPill } from "./UnitPanel";
import b from "./bits.module.css";

export interface PolePanelProps {
  data: DashboardData;
  onClose?: () => void;
  side?: "right" | "inline";
  drill?: DrillStack;
  className?: string;
}

const ELECTRIC = /electric|tnpdcl|\beb\b/i;
const UTILITY = /utilit|power/i;

/** "06441008572" → "06 441 008 572" (TNPDCL: region · section · distribution · service). A number saved with its own
 *  dashes / spaces keeps that grouping; any other run of digits is shown in fours. */
export function groupConsumerNo(no: string): string {
  const raw = no.trim();
  if (/[\s-]/.test(raw)) return raw.split(/[\s-]+/).filter(Boolean).join(" ");
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d ? d.replace(/(\d{4})(?=\d)/g, "$1 ") : raw;
}

const bills = (n: number) => `${n} ${n === 1 ? "bill" : "bills"}`;

export function PolePanel({ data, onClose, side = "right", drill: external, className }: PolePanelProps) {
  const own = useDrillStack();
  const drill = external ?? own;
  const forms = useFormDrawer();
  const units = data.units.filter((u) => u.isActive);
  const cats = useCategories();
  // the electricity category ("Electricity" / "EB" / "TNPDCL"), else the utilities one
  const cat = useMemo(() => {
    const list = cats.data?.items ?? [];
    return list.find((c) => ELECTRIC.test(c.name)) ?? list.find((c) => UTILITY.test(c.name)) ?? null;
  }, [cats.data]);
  const list = useApi<ExpenseListResponse>(cat ? `/api/expenses?categoryId=${encodeURIComponent(cat.id)}` : null, { keepPrevious: true });
  const loading = !cats.data || (Boolean(cat) && !list.data);

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
      >
        {units.map((u) => {
          // this house's bills up to the as-of date, newest first
          const rows = (list.data?.items ?? [])
            .filter((e) => e.unitId === u.id && inScope(e.expenseDate, null, data.periods.allTime.end))
            .sort((x, y) => y.expenseDate.localeCompare(x.expenseDate));
          const year = rows.filter((e) => inScope(e.expenseDate, data.periods.year.start, data.periods.year.end));
          return (
            <MeterCard
              key={u.id}
              unit={u}
              rows={rows}
              year={year}
              yearLabel={data.periods.year.label}
              loading={loading}
              onBill={(e) => drill.push({ kind: "expense", id: e.id, label: formatDate(e.expenseDate) })}
              onBills={
                cat
                  ? (period) => drill.push({ kind: "category", categoryId: cat.id, name: cat.name, period, unitId: u.id, color: cat.color })
                  : undefined
              }
              onAdd={() =>
                forms.open({
                  kind: "expense",
                  title: `Add an electricity bill · ${u.name}`,
                  props: { defaults: { unitId: u.id, categoryId: cat?.id ?? "", description: "TNPDCL bill" } },
                })
              }
            />
          );
        })}
      </DrillPanel>
      {forms.element}
    </>
  );
}

function MeterCard({
  unit: u,
  rows,
  year,
  yearLabel,
  loading,
  onBill,
  onBills,
  onAdd,
}: {
  unit: UnitBreakdown;
  rows: ExpenseDTO[];
  year: ExpenseDTO[];
  yearLabel: string;
  loading: boolean;
  onBill: (e: ExpenseDTO) => void;
  onBills?: (period: "year" | "allTime") => void;
  onAdd: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const no = u.electricityConsumerNumber?.trim() || null;
  const last = rows[0] ?? null;
  const copy = async () => {
    if (!no) return;
    try {
      await navigator.clipboard.writeText(no);
      setCopied(true);
      toast.success(`Copied ${no}`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.info(no);
    }
  };
  const wait = loading ? "…" : null;

  return (
    <section className={b.mCard}>
      <div className={b.mHead}>
        <span className={b.mName}>{u.name}</span>
        <UnitStatusPill unit={u} />
      </div>

      <button type="button" className={b.lcd} onClick={copy} disabled={!no} aria-label={no ? `Copy consumer number ${no}` : "No consumer number saved"}>
        <span className={b.lcdLabel}>TNPDCL · Consumer no.</span>
        <span className={cx(b.lcdDigits, !no && b.lcdNone)}>{no ? groupConsumerNo(no) : "Not saved"}</span>
        {no && (copied ? <Check aria-hidden /> : <Copy aria-hidden />)}
      </button>

      <div className={b.mStats}>
        <Stat label="Last bill" value={wait ?? (last ? inr(last.amount) : null)} sub={last ? formatDate(last.expenseDate) : "No bills yet"} onClick={last ? () => onBill(last) : undefined} />
        <Stat
          label="This year"
          value={wait ?? (year.length ? inr(sumAmounts(year)) : null)}
          sub={year.length ? bills(year.length) : yearLabel}
          onClick={year.length && onBills ? () => onBills("year") : undefined}
        />
        <Stat
          label="All time"
          value={wait ?? (rows.length ? inr(sumAmounts(rows)) : null)}
          sub={rows.length ? bills(rows.length) : "—"}
          onClick={rows.length && onBills ? () => onBills("allTime") : undefined}
        />
      </div>

      <div className={b.mActs}>
        <PayBillButton url={u.electricityPayUrl} block />
        <Button variant="secondary" block icon={<Plus />} onClick={onAdd}>
          Add bill
        </Button>
      </div>
    </section>
  );
}

/** One meter figure: label, ₹ (red = money out) or "—", a small line under it; tap → the bills behind it. */
function Stat({ label, value, sub, onClick }: { label: string; value: string | null; sub: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className={b.mStatLabel}>{label}</span>
      <span className={cx(b.mStatValue, "num", (value === null || value === "…") && b.mStatNone)}>{value ?? "—"}</span>
      <span className={b.mStatSub}>{sub}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={b.mStat} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={b.mStat}>{inner}</div>
  );
}
