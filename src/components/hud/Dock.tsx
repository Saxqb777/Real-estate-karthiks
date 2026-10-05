"use client";
// Bottom tray: a slim tab bar (keys 1–6) that slides one chart up at a time; click the tab again or Esc to close.
//   1 Income vs expenses · 2 Where money went · 3 <unit> vs <unit> · 4 Occupancy · 5 Growth · 6 Payments
import { BarChart3, CalendarRange, Columns2, PieChart, ReceiptText, TrendingUp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { IconButton, cx, isFocusTrapActive } from "@/components/ui";
import type { DashboardData, ExpenseSlice } from "@/lib/dashboard-types";
import { GrowthChart } from "./charts/GrowthChart";
import { IncomeExpenseChart } from "./charts/IncomeExpenseChart";
import { OccupancyGantt } from "./charts/OccupancyGantt";
import { PaymentsList } from "./charts/PaymentsList";
import { SpendingDonut } from "./charts/SpendingDonut";
import { UnitsCompare } from "./charts/UnitsCompare";
import { ScopeChip } from "./Figure";
import { useFormDrawer } from "./FormDrawer";
import { LedgerBadge } from "./LedgerBadge";
import { isTyping, useEscape } from "./store";
import type { DockTab, DrillView, PeriodKind } from "./types";
import s from "./dock.module.css";

export const DOCK_TABS: { id: DockTab; label: string; short: string; icon: ReactNode }[] = [
  { id: "income", label: "Income vs expenses", short: "Income", icon: <BarChart3 aria-hidden /> },
  { id: "spending", label: "Where money went", short: "Spending", icon: <PieChart aria-hidden /> },
  { id: "units", label: "Units", short: "Units", icon: <Columns2 aria-hidden /> },
  { id: "occupancy", label: "Occupancy", short: "Occupancy", icon: <CalendarRange aria-hidden /> },
  { id: "growth", label: "Growth", short: "Growth", icon: <TrendingUp aria-hidden /> },
  { id: "payments", label: "Payments", short: "Payments", icon: <ReceiptText aria-hidden /> },
];

export interface DockProps {
  data: DashboardData;
  period: PeriodKind;
  /** controlled open tab (null = collapsed) */
  tab?: DockTab | null;
  onTabChange?: (tab: DockTab | null) => void;
  defaultTab?: DockTab | null;
  /** a figure / category / lease in a chart was clicked → open that drill-down (e.g. in the property panel) */
  onDrill?: (view: DrillView) => void;
  onOpenUnit?: (unitId: string) => void;
  /** tabs to mark with the marigold "unexplored" dot */
  hints?: Iterable<string>;
  /** keys 1–6 toggle tabs (default true) */
  hotkeys?: boolean;
  /** phones: no tab bar — the open chart shows as a sheet with an ✕ (picked from the ☰ menu) */
  sheet?: boolean;
  className?: string;
}

/** The units tab is named after the units themselves (owner): "116/B8 vs 116/B7" (back first, as he reads it). */
export function dockTabLabel(data: DashboardData, id: DockTab): string {
  if (id !== "units") return DOCK_TABS.find((d) => d.id === id)?.label ?? id;
  const named = [...data.units].sort((a, b) => (a.position === "back" ? -1 : b.position === "back" ? 1 : 0)).map((u) => u.name);
  return named.length >= 2 ? named.join(" vs ") : (named[0] ?? "Units");
}

export function Dock({ data, period, tab: controlled, onTabChange, defaultTab = null, onDrill, onOpenUnit, hints, hotkeys = true, sheet = false, className }: DockProps) {
  const uid = useId();
  const [inner, setInner] = useState<DockTab | null>(defaultTab);
  const tab = controlled === undefined ? inner : controlled;
  const forms = useFormDrawer();
  const hintSet = new Set(hints ?? []);
  const setTab = useCallback(
    (t: DockTab | null) => {
      setInner(t);
      onTabChange?.(t);
    },
    [onTabChange],
  );
  const toggle = useCallback((t: DockTab) => setTab(tab === t ? null : t), [tab, setTab]);
  useEscape(tab !== null, () => setTab(null));

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || isFocusTrapActive()) return;
      const n = Number(e.key);
      if (n >= 1 && n <= DOCK_TABS.length) {
        e.preventDefault();
        toggle(DOCK_TABS[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, toggle]);

  const drillKey = onDrill ? (key: string) => onDrill({ kind: "metric", key }) : undefined;
  const p = data.periods[period];
  const slices: ExpenseSlice[] =
    period === "allTime"
      ? data.expenseComposition.allTime
      : period === "month"
        ? data.expenseComposition.month
        : (data.expenseComposition.byYear.find((y) => String(y.year) === p.key)?.slices ?? []);

  const scope: Record<DockTab, ReactNode> = {
    income: <ScopeChip>{data.yearMode === "fy" ? "Financial years" : "Calendar years"}</ScopeChip>,
    spending: <ScopeChip past={!data.isLive}>{p.label}</ScopeChip>,
    units: <ScopeChip past={!data.isLive}>{p.label} cash</ScopeChip>,
    occupancy: <ScopeChip>Purchase → today</ScopeChip>,
    growth: <ScopeChip>{data.scopeLabels.allTime}</ScopeChip>,
    payments: <ScopeChip>Latest {data.recentPayments.length}</ScopeChip>,
  };

  const content = (t: DockTab) => {
    switch (t) {
      case "income":
        return (
          <IncomeExpenseChart
            years={data.monthlyByYear}
            onDrill={drillKey ? (k) => drillKey(`year:${k}`) : undefined}
          />
        );
      case "spending":
        return (
          <SpendingDonut
            slices={slices}
            total={p.expenses}
            scopeLabel={p.label}
            onCategory={onDrill ? (sl) => onDrill({ kind: "category", categoryId: sl.categoryId, name: sl.name, period, color: sl.color }) : undefined}
          />
        );
      case "units":
        return <UnitsCompare data={data} period={period} onDrill={drillKey} onOpenUnit={onOpenUnit} />;
      case "occupancy":
        return (
          <OccupancyGantt
            timeline={data.timeline}
            asOf={data.asOf}
            isLive={data.isLive}
            onUnit={onOpenUnit}
            onLease={onDrill ? (leaseId, label) => onDrill({ kind: "lease", leaseId, label }) : undefined}
          />
        );
      case "growth":
        return <GrowthChart data={data} onDrill={drillKey} />;
      case "payments":
        return (
          <PaymentsList
            data={data}
            onRecord={() => forms.open({ kind: "payment" })}
            onPayment={onDrill ? (id, inv) => onDrill({ kind: "payment", id, label: inv }) : undefined}
          />
        );
    }
  };

  const labelOf = (d: (typeof DOCK_TABS)[number]) => dockTabLabel(data, d.id);
  const active = DOCK_TABS.find((d) => d.id === tab);

  return (
    <section className={cx(s.dock, tab && s.dockOpen, sheet && s.sheet, className)} aria-label="Charts">
      <AnimatePresence initial={false}>
        {tab && (
          <motion.div
            key="tray"
            className={s.tray}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={s.trayInner}>
              <header className={s.trayHead}>
                <span className={s.trayTitle}>{active ? labelOf(active) : null}</span>
                {sheet && <IconButton size="sm" label="Close" icon={<X />} onClick={() => setTab(null)} />}
                {scope[tab]}
                <span className={s.trayRule} aria-hidden />
                {(tab === "units" || tab === "income") && <LedgerBadge checks={data.checks} onClick={onDrill ? () => onDrill({ kind: "checks" }) : undefined} />}
              </header>
              <motion.div key={tab} className={s.trayBody} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                {content(tab)}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!sheet && (
        <div className={s.bar} role="tablist" aria-label="Charts">
          {DOCK_TABS.map((d, i) => {
            const on = d.id === tab;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-expanded={on}
                className={cx(s.tab, on && s.tabOn)}
                onClick={() => toggle(d.id)}
                title={`${labelOf(d)} (${i + 1})`}
              >
                {on && <motion.span layoutId={`${uid}-plate`} className={s.tabPlate} transition={{ type: "spring", stiffness: 520, damping: 44 }} />}
                <span className={s.tabIcon}>{d.icon}</span>
                <span className={s.tabLabel}>{labelOf(d)}</span>
                <span className={s.tabShort}>{d.short}</span>
                {hintSet.has(d.id) && !on && <span className={s.hintDot} aria-label="not opened yet" />}
              </button>
            );
          })}
        </div>
      )}
      {forms.element}
    </section>
  );
}
