"use client";
// ⌘K commands that only make sense on the game screen (the quick-add forms register their own via <QuickAddHost/>).
import {
  BarChart3,
  CalendarClock,
  CalendarRange,
  CircleHelp,
  Coins,
  Eye,
  EyeOff,
  Home,
  PanelLeft,
  PlayCircle,
  Ruler,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo } from "react";
import { useRegisterCommands, type Command } from "@/components/ui";
import { quickAdd, type YearMode } from "@/components/forms";
import { DOCK_TABS, type DockTab, type PeriodKind } from "@/components/hud";
import type { DashboardData } from "@/lib/dashboard-types";

export interface OverviewCommandOptions {
  data: DashboardData | undefined;
  yearMode: YearMode;
  setYearMode: (m: YearMode) => void;
  setPeriod: (p: PeriodKind) => void;
  openProperty: () => void;
  openUnit: (unitId: string) => void;
  openChart: (tab: DockTab) => void;
  hudHidden: boolean;
  setHudHidden: (hidden: boolean) => void;
  openHelp: () => void;
  replayTour: () => void;
  backToToday: (() => void) | null;
}

const GO: { id: string; title: string; href: string; subtitle: string; keywords: string[]; icon: "data" | "config" }[] = [
  { id: "payments", title: "Data → Payments", href: "/data#payments", subtitle: "Every rent receipt", keywords: ["rent", "receipts", "invoice"], icon: "data" },
  {
    id: "expenses",
    title: "Data → Expenses",
    href: "/data#expenses",
    subtitle: "Money spent, by category",
    keywords: ["spend", "bills", "repairs"],
    icon: "data",
  },
  { id: "todos", title: "Data → To-dos", href: "/data#todos", subtitle: "The property manager's list", keywords: ["tasks", "actions"], icon: "data" },
  {
    id: "reports",
    title: "Data → Reports",
    href: "/data#reports",
    subtitle: "Printable statements",
    keywords: ["annual", "statement", "print", "pdf"],
    icon: "data",
  },
  { id: "plot", title: "Config → Plot", href: "/config#plot", subtitle: "Plot size in feet", keywords: ["dimensions", "site plan", "land"], icon: "config" },
  { id: "units", title: "Config → Units", href: "/config#units", subtitle: "Houses, sizes, prices", keywords: ["build", "house", "unit"], icon: "config" },
  {
    id: "settings",
    title: "Config → Settings",
    href: "/config#settings",
    subtitle: "Rent due day, late fee, email",
    keywords: ["late fee", "due day", "email"],
    icon: "config",
  },
];

export function useOverviewCommands(o: OverviewCommandOptions) {
  const { data } = o;
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (data) {
      for (const u of data.units) {
        if (!u.isActive) continue;
        const lease = u.activeLease;
        if (lease)
          list.push({
            id: `ov:rent:${lease.id}`,
            group: "Quick add",
            title: `Record rent · ${u.name}`,
            subtitle: `${lease.tenantName}${u.nextPayment ? ` · ${u.nextPayment.label} due` : ""}`,
            keywords: ["rent", "payment", "collect", lease.tenantName, u.name],
            icon: <Coins />,
            perform: () => quickAdd("payment", { defaults: { leaseId: lease.id } }),
          });
      }
      for (const u of data.units)
        list.push({
          id: `ov:unit:${u.id}`,
          group: "Units",
          title: `Open ${u.name}${u.position ? ` · ${u.position === "front" ? "Front" : "Back"}` : ""}`,
          subtitle: u.activeLease ? `${u.activeLease.tenantName} lives here` : u.status === "incoming" ? "Tenant moving in" : "Empty",
          keywords: ["house", "unit", u.name, u.activeLease?.tenantName ?? ""],
          icon: <Home />,
          perform: () => o.openUnit(u.id),
        });
    }
    list.push(
      {
        id: "ov:property",
        group: "Overview",
        title: "Open the Property panel",
        subtitle: "Worth, cash flow, occupancy · P",
        keywords: ["totals", "portfolio", "net cash", "value"],
        icon: <PanelLeft />,
        perform: o.openProperty,
      },
      {
        id: "ov:yearmode",
        group: "Overview",
        title: o.yearMode === "fy" ? "Switch to calendar years (Jan–Dec)" : "Switch to financial years (Apr–Mar)",
        subtitle: o.yearMode === "fy" ? "Now showing financial years" : "Now showing calendar years",
        keywords: ["fy", "financial year", "calendar", "year type", "toggle"],
        icon: <CalendarRange />,
        perform: () => o.setYearMode(o.yearMode === "fy" ? "calendar" : "fy"),
      },
    );
    if (data)
      (["allTime", "year", "month"] as PeriodKind[]).forEach((p) =>
        list.push({
          id: `ov:period:${p}`,
          group: "Overview",
          title: `Cash figures for ${data.scopeLabels[p]}`,
          keywords: ["period", "scope", "all time", "year", "month"],
          icon: <CalendarClock />,
          perform: () => o.setPeriod(p),
        }),
      );
    DOCK_TABS.forEach((t, i) =>
      list.push({
        id: `ov:chart:${t.id}`,
        group: "Charts",
        title: `Chart: ${t.label}`,
        subtitle: `Key ${i + 1}`,
        keywords: ["chart", "graph", t.short],
        icon: <BarChart3 />,
        perform: () => o.openChart(t.id),
      }),
    );
    if (o.backToToday)
      list.push({
        id: "ov:live",
        group: "Overview",
        title: "Back to today",
        subtitle: "Leave the time scrubber",
        keywords: ["live", "now", "today", "as of"],
        icon: <CalendarClock />,
        perform: o.backToToday,
      });
    list.push(
      {
        id: "ov:hud",
        group: "Overview",
        title: o.hudHidden ? "Show the HUD" : "Hide the HUD — just the world",
        subtitle: "F",
        keywords: ["full screen", "world", "clean", "hide"],
        icon: o.hudHidden ? <Eye /> : <EyeOff />,
        perform: () => o.setHudHidden(!o.hudHidden),
      },
      {
        id: "ov:help",
        group: "Help",
        title: "Help & shortcuts",
        subtitle: "?",
        keywords: ["help", "keys", "shortcuts", "what can I click"],
        icon: <CircleHelp />,
        perform: o.openHelp,
      },
      {
        id: "ov:tour",
        group: "Help",
        title: "Replay the tour",
        keywords: ["tutorial", "intro", "guide", "onboarding"],
        icon: <PlayCircle />,
        perform: o.replayTour,
      },
    );
    for (const g of GO)
      list.push({
        id: `ov:go:${g.id}`,
        group: "Go to",
        title: g.title,
        subtitle: g.subtitle,
        keywords: g.keywords,
        href: g.href,
        icon: g.icon === "data" ? <ScrollText /> : g.id === "plot" ? <Ruler /> : <SlidersHorizontal />,
      });
    return list;
  }, [data, o]);
  useRegisterCommands(commands);
}
