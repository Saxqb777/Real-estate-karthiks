"use client";
// The charts (keys 1–6), one at a time; click the tab again or Esc to close.
//   1 Income vs expenses · 2 Where money went · 3 <unit> vs <unit> · 4 Occupancy · 5 Growth · 6 Payments
// Desktop (owner 31/10/2026, the reel): the tabs are a slim column of ICONS on the left side (the chosen one a white
// circle; no name tags — owner 1/11/2026) and the chart opens beside the column.
import { BarChart3, CalendarRange, Columns2, LogOut, PersonStanding, PieChart, ReceiptText, TrendingUp, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { lifeSwitch, useLifeChoice } from "@/components/estate/life-state";
import { IconButton, cx, isFocusTrapActive } from "@/components/ui";
import type { DashboardData, ExpenseSlice } from "@/lib/dashboard-types";
import { GrowthChart } from "./charts/GrowthChart";
import { IncomeExpenseChart } from "./charts/IncomeExpenseChart";
import { OccupancyGantt } from "./charts/OccupancyGantt";
import { PaymentsList } from "./charts/PaymentsList";
import { SpendingDonut } from "./charts/SpendingDonut";
import { UnitsCompare } from "./charts/UnitsCompare";
import { PeriodSwitch } from "./PeriodSwitch";
import { useFormDrawer } from "./FormDrawer";
import { isTyping, useEscape } from "./store";
import type { DockTab, DrillView, PeriodKind } from "./types";
import s from "./dock.module.css";

export const DOCK_TABS: { id: DockTab; label: string; short: string; icon: ReactNode }[] = [
  { id: "income", label: "Income vs expenses", short: "Income", icon: <BarChart3 aria-hidden /> },
  { id: "spending", label: "Where money went?", short: "Spending", icon: <PieChart aria-hidden /> },
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
  /** desktop: the tabs as an icon column on the left side (the reel); the chart slides out beside it */
  side?: boolean;
  /** side mode: the SIGN OUT icon at the very end of the column (owner: the car is gone) */
  onLeave?: () => void;
  className?: string;
}

/** The units tab is named after the units themselves (owner): "116/B8 vs 116/B7" (back first, as he reads it). */
export function dockTabLabel(data: DashboardData, id: DockTab): string {
  if (id !== "units") return DOCK_TABS.find((d) => d.id === id)?.label ?? id;
  const named = [...data.units].sort((a, b) => (a.position === "back" ? -1 : b.position === "back" ? 1 : 0)).map((u) => u.name);
  return named.length >= 2 ? named.join(" vs ") : (named[0] ?? "Units");
}

export function Dock({ data, period, tab: controlled, onTabChange, defaultTab = null, onDrill, onOpenUnit, hints, hotkeys = true, sheet = false, side = false, onLeave, className }: DockProps) {
  const uid = useId();
  // the LIFE switch (owner: "add to the side bar in the end with its own icon") — shared with the scene
  const lifeChoice = useLifeChoice();
  const reduced = useReducedMotion();
  const life = lifeChoice ?? !reduced;
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

  // the chart's header = its name (+ the year for the period charts, the income chart too — owner 2/11/2026: "keep the
  // year on the side like the other charts") — no scope words, no ledger line (owner 1/11/2026)
  const yearPick: Partial<Record<DockTab, ReactNode>> = {
    income: <PeriodSwitch data={data} />,
    spending: <PeriodSwitch data={data} />,
    units: <PeriodSwitch data={data} />,
  };


  const content = (t: DockTab) => {
    switch (t) {
      case "income":
        return (
          <IncomeExpenseChart
            years={data.monthlyByYear}
            // the year the header picked (the year of the as-of date)
            year={data.monthlyByYear.find((y) => y.isCurrent)?.year}
            lastYear={data.comparisons.year}
            onDrill={drillKey ? (k, scope) => drillKey(scope === "all" ? k : `year:${k}`) : undefined}
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

  const tray = (
    <AnimatePresence initial={false}>
      {tab && (
        <motion.div
          key="tray"
          className={s.tray}
          initial={side ? { x: -12, opacity: 0 } : { height: 0, opacity: 0 }}
          animate={side ? { x: 0, opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={side ? { x: -8, opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: side ? 0.24 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={s.trayInner}>
            <header className={s.trayHead}>
              <span className={s.trayTitle}>{active ? labelOf(active) : null}</span>
              {sheet && <IconButton size="sm" label="Close" icon={<X />} onClick={() => setTab(null)} />}
              <span className={s.trayRule} aria-hidden />
              {yearPick[tab]}
            </header>
            <motion.div key={tab} className={s.trayBody} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              {content(tab)}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (side) {
    // the icon column and the chart panel share one row at the left middle: the panel takes the column's height
    // (owner 1/11/2026: "a rectangular bar … using the side bar as the guide for height … just pop up on the side")
    return (
      <div className={s.side}>
        <nav className={s.rail} role="tablist" aria-label="Charts" aria-orientation="vertical">
          {DOCK_TABS.map((d) => {
            const on = d.id === tab;
            const label = labelOf(d);
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-expanded={on}
                aria-label={label}
                className={cx(s.railBtn, on && s.railOn)}
                onClick={() => toggle(d.id)}
              >
                {on && <motion.span layoutId={`${uid}-dot`} className={s.railPlate} transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }} />}
                <span className={s.railIcon}>{d.icon}</span>
                {hintSet.has(d.id) && !on && <span className={s.hintDot} aria-label="not opened yet" />}
              </button>
            );
          })}
          <span className={s.railSep} aria-hidden />
          <button
            type="button"
            className={cx(s.railBtn, s.railLife, life && s.railOn)}
            aria-pressed={life}
            aria-label={life ? "Life on" : "Life off"}
            onClick={() => lifeSwitch.set(!life)}
          >
            {life && <span className={s.railPlate} />}
            <span className={s.railIcon}>
              <PersonStanding aria-hidden />
            </span>
          </button>
          {onLeave && (
            <button type="button" className={cx(s.railBtn, s.railLife)} aria-label="Sign out" onClick={onLeave}>
              <span className={s.railIcon}>
                <LogOut aria-hidden />
              </span>
            </button>
          )}
        </nav>
        <section className={cx(s.sideTray, !tab && s.sideTrayClosed, className)} aria-label="Chart" data-menu-bounds>
          {tray}
          {forms.element}
        </section>
      </div>
    );
  }

  return (
    <section className={cx(s.dock, tab && s.dockOpen, sheet && s.sheet, className)} aria-label="Charts">
      {tray}
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
                {on && <motion.span layoutId={`${uid}-plate`} className={s.tabPlate} transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }} />}
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
