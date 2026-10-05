"use client";
// /config — set-up. ONE-SCREEN: tab rail + one panel. Plot and Units show the form beside a live 3D preview
// that redraws from the unsaved values and lights up the measurement of the focused field.
import { Building2, HandCoins, LandPlot, Palette, Settings2 } from "lucide-react";
import { useMemo } from "react";
import { Screen, useHashTab } from "@/components/ui";
import { QuickAddHost, RailScreen, useCategories, usePlot, useUnits, quickAdd, type RailItem } from "@/components/forms";
import { formatFeetInches } from "@/lib/site-layout";
import { CategoriesTab } from "./CategoriesTab";
import { OffersTab } from "./OffersTab";
import { PlotTab } from "./PlotTab";
import { SettingsTab } from "./SettingsTab";
import { UnitsTab } from "./UnitsTab";

const TABS = ["settings", "plot", "units", "offers", "categories"] as const;
type ConfigTab = (typeof TABS)[number];

export function ConfigScreen() {
  const [tab, setTab] = useHashTab([...TABS], "settings");
  const plot = usePlot();
  const units = useUnits();
  const cats = useCategories();

  const items = useMemo<RailItem[]>(() => {
    const p = plot.data;
    const sized = p && p.frontWidthFt !== null && p.backWidthFt !== null && p.depthFt !== null;
    const active = units.data?.items.filter((u) => u.isActive).length;
    const offers = units.data?.items.reduce((n, u) => n + u._count.offers, 0);
    return [
      { id: "settings", label: "Settings", icon: <Settings2 />, note: "Rent rules, email" },
      {
        id: "plot",
        label: "Plot",
        icon: <LandPlot />,
        note: p ? (sized ? `${formatFeetInches(p.frontWidthFt!)} × ${formatFeetInches(p.depthFt!)}` : "Using the site plan") : undefined,
      },
      { id: "units", label: "Units", icon: <Building2 />, count: active, note: active === undefined ? undefined : active ? `${active} of 2 slots built` : "Nothing built yet" },
      { id: "offers", label: "Offers", icon: <HandCoins />, count: offers || undefined, note: "Buyer prices" },
      { id: "categories", label: "Categories", icon: <Palette />, count: cats.data?.items.length, note: "Expense colours" },
    ];
  }, [plot.data, units.data, cats.data]);

  const active = tab as ConfigTab;
  return (
    <Screen>
      <RailScreen
        label="Set-up sections"
        eyebrow="Set-up"
        title="Config"
        items={items}
        value={active}
        onChange={setTab}
        onNew={active === "offers" ? () => quickAdd("offer") : active === "categories" ? () => quickAdd("category") : undefined}
      >
        {active === "settings" && <SettingsTab />}
        {active === "plot" && <PlotTab />}
        {active === "units" && <UnitsTab />}
        {active === "offers" && <OffersTab />}
        {active === "categories" && <CategoriesTab />}
      </RailScreen>
      <QuickAddHost />
    </Screen>
  );
}
