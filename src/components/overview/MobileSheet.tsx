"use client";
// Phones (< 768px): the bottom sheet under the world — swipeable tabs Portfolio · This month · Charts · Units · To-do.
// Content scrolls inside the sheet; the page never scrolls. A world tap opens the matching tab.
import { BarChart3, ChevronRight, Home, ListTodo, Mailbox, PieChart } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import {
  Dock,
  HudPanelFor,
  MailboxPanel,
  NoticeBoardPanel,
  PeriodControl,
  PropertyPanel,
  RentStatePill,
  UnitPanel,
  UnitStatusPill,
  positionLabel,
  type PanelTarget,
  type PeriodKind,
} from "@/components/hud";
import type { DashboardData, UnitBreakdown } from "@/lib/dashboard-types";
import { formatINR } from "@/lib/format";
import { QuestLog } from "./QuestLog";
import type { QuestState } from "./quests";
import s from "./sheet.module.css";

export type SheetTab = "portfolio" | "month" | "charts" | "units" | "todo";

const TABS: { id: SheetTab; label: string; icon: ReactNode }[] = [
  { id: "portfolio", label: "Portfolio", icon: <PieChart aria-hidden /> },
  { id: "month", label: "This month", icon: <Mailbox aria-hidden /> },
  { id: "charts", label: "Charts", icon: <BarChart3 aria-hidden /> },
  { id: "units", label: "Units", icon: <Home aria-hidden /> },
  { id: "todo", label: "To-do", icon: <ListTodo aria-hidden /> },
];

export interface MobileSheetProps {
  data: DashboardData;
  tab: SheetTab;
  onTab: (t: SheetTab) => void;
  period: PeriodKind;
  /** a world object without its own tab (pole, tax stamp) */
  detail: PanelTarget | null;
  onCloseDetail: () => void;
  /** the unit shown in the Units tab (null = list) */
  unitId: string | null;
  onUnit: (id: string | null) => void;
  quests: QuestState | null;
  takenPositions: ("front" | "back")[];
  onHideQuests: () => void;
}

export function MobileSheet({ data, tab, onTab, period, detail, onCloseDetail, unitId, onUnit, quests, takenPositions, onHideQuests }: MobileSheetProps) {
  const [dir, setDir] = useState(1);
  const touch = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const idx = TABS.findIndex((t) => t.id === tab);
  const go = (t: SheetTab) => {
    const n = TABS.findIndex((x) => x.id === t);
    setDir(n >= idx ? 1 : -1);
    onTab(t);
  };
  const pending = data.actions.pending.length;
  const late = data.units.some((u) => u.rentState === "overdue");

  const body = () => {
    if (detail) return <HudPanelFor target={detail} data={data} period={period} onClose={onCloseDetail} side="inline" className={s.fill} />;
    switch (tab) {
      case "portfolio":
        return quests ? (
          <QuestLog state={quests} takenPositions={takenPositions} onClose={onHideQuests} side="inline" className={s.fill} />
        ) : (
          <div className={s.stack}>
            <PeriodControl data={data} period={period} size="sm" className={s.period} />
            <PropertyPanel data={data} period={period} side="inline" className={s.fill} onOpenUnit={(id) => (go("units"), onUnit(id))} />
          </div>
        );
      case "month":
        return <MailboxPanel data={data} period="month" side="inline" className={s.fill} onOpenUnit={(id) => (go("units"), onUnit(id))} />;
      case "charts":
        return <Dock data={data} period={period} defaultTab="income" hotkeys={false} className={s.dock} onOpenUnit={(id) => (go("units"), onUnit(id))} />;
      case "units": {
        const u = unitId ? data.units.find((x) => x.id === unitId) : null;
        if (u) return <UnitPanel data={data} unitId={u.id} period={period} side="inline" className={s.fill} onClose={() => onUnit(null)} onOpenUnit={(id) => onUnit(id)} />;
        return <UnitList units={data.units} onPick={onUnit} />;
      }
      case "todo":
        return <NoticeBoardPanel data={data} side="inline" className={s.fill} />;
    }
  };

  return (
    <section className={s.sheet} aria-label="Details">
      <span className={s.grip} aria-hidden />
      <div className={s.tabs} role="tablist" aria-label="Sheet">
        {TABS.map((t) => {
          const on = t.id === tab && !detail;
          const badge = t.id === "todo" ? pending : 0;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} className={cx(s.tab, on && s.tabOn)} onClick={() => go(t.id)}>
              {on && <motion.span layoutId="sheet-tab" className={s.tabPlate} transition={{ type: "spring", stiffness: 520, damping: 44 }} />}
              <span className={s.tabIcon}>
                {t.icon}
                {t.id === "month" && late && <span className={s.alert} aria-label="rent overdue" />}
              </span>
              <span className={s.tabLabel}>{t.label}</span>
              {badge > 0 && <span className={s.badge}>{badge}</span>}
            </button>
          );
        })}
      </div>
      <div
        className={s.body}
        onTouchStart={(e) => {
          const t = e.touches[0];
          const el = e.target as HTMLElement;
          touch.current = { x: t.clientX, y: t.clientY, ok: !el.closest("input,textarea,select,[data-noswipe]") };
        }}
        onTouchEnd={(e) => {
          const st = touch.current;
          touch.current = null;
          if (!st?.ok) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - st.x;
          const dy = t.clientY - st.y;
          if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
          const next = TABS[Math.min(TABS.length - 1, Math.max(0, idx + (dx < 0 ? 1 : -1)))];
          if (next && next.id !== tab) go(next.id);
        }}
      >
        <motion.div
          key={detail ? `d:${detail.kind}` : `${tab}:${tab === "units" ? (unitId ?? "list") : ""}`}
          className={s.page}
          initial={{ opacity: 0, x: 26 * dir }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {body()}
        </motion.div>
      </div>
    </section>
  );
}

function tone(u: UnitBreakdown) {
  if (!u.isActive) return "neutral";
  if (u.rentState === "overdue") return "coral";
  if (u.rentState === "due-soon") return "marigold";
  if (u.status === "occupied") return "teal";
  return "sky";
}

function UnitList({ units, onPick }: { units: UnitBreakdown[]; onPick: (id: string) => void }) {
  if (!units.length) return <p className={s.empty}>No units yet — build one from the Portfolio tab.</p>;
  return (
    <ul className={s.units}>
      {units.map((u) => {
        const lease = u.activeLease;
        const vacant = u.vacantPeriods.find((v) => v.ongoing);
        return (
          <li key={u.id}>
            <button type="button" className={s.unit} data-tone={tone(u)} onClick={() => onPick(u.id)}>
              <span className={s.unitMain}>
                <span className={s.unitName}>
                  {u.name}
                  {positionLabel(u.position) && <span className={s.unitPos}>{positionLabel(u.position)}</span>}
                </span>
                <span className={s.unitSub}>
                  {lease ? `${lease.tenantName} · ${formatINR(lease.monthlyRent)}/month` : u.incomingLease ? `${u.incomingLease.tenantName} moving in` : vacant ? `Empty ${vacant.days} days` : "Empty"}
                </span>
              </span>
              <span className={s.unitPills}>
                <UnitStatusPill unit={u} />
                <RentStatePill unit={u} />
              </span>
              <ChevronRight aria-hidden className={s.chev} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
