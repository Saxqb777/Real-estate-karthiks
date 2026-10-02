import { Map as MapIcon, ScrollText, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra palette search words. */
  keywords: string[];
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: MapIcon, keywords: ["home", "dashboard", "3d", "plot", "world", "kpi"] },
  { href: "/data", label: "Data", icon: ScrollText, keywords: ["ledger", "tenants", "leases", "payments", "rent", "expenses", "property tax", "actions"] },
  { href: "/config", label: "Config", icon: SlidersHorizontal, keywords: ["settings", "plot", "units", "offers", "categories", "setup"] },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
