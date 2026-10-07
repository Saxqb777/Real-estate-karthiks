"use client";
// Typed data hooks + option builders shared by the forms and the Data / Config screens.
// Every list comes straight from the API (totals included) — nothing here does money maths.
import { useApi } from "@/lib/client";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate, todayIST } from "@/lib/dates";
import type { ActionDTO } from "@/lib/schemas/action";
import type { ExpenseCategoryDTO } from "@/lib/schemas/expense-category";
import type { ExpenseListResponse } from "@/lib/schemas/expense";
import type { LeaseListItem } from "@/lib/schemas/lease";
import type { PaymentListResponse } from "@/lib/schemas/payment";
import type { PlotDTO } from "@/lib/schemas/plot";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";
import type { SettingsDTO } from "@/lib/schemas/settings";
import type { TenantListItem } from "@/lib/schemas/tenant";
import type { UnitListItem } from "@/lib/schemas/unit";
import type { SelectOption } from "@/components/ui";

export const useUnits = () => useApi<{ items: UnitListItem[] }>("/api/units");
export const useTenants = () => useApi<{ items: TenantListItem[] }>("/api/tenants");
export const useLeases = () => useApi<{ items: LeaseListItem[] }>("/api/leases");
export const usePayments = (leaseId?: string | null) =>
  useApi<PaymentListResponse>(leaseId ? `/api/payments?leaseId=${encodeURIComponent(leaseId)}` : "/api/payments", { keepPrevious: true });
export const useCategories = () => useApi<{ items: ExpenseCategoryDTO[] }>("/api/expense-categories");
export const usePropertyTax = () => useApi<{ items: PropertyTaxDTO[] }>("/api/property-tax");
export const useActions = (status: "pending" | "done" | "all" = "pending") =>
  useApi<{ items: ActionDTO[] }>(`/api/actions?status=${status}`, { keepPrevious: true });
export const useDashboard = () => useApi<DashboardData>("/api/dashboard");
export const useSettings = () => useApi<SettingsDTO>("/api/settings");
export const usePlot = () => useApi<PlotDTO>("/api/plot");

export function useExpenses(q: { year?: number | null; yearMode?: string; unitId?: string | null; categoryId?: string | null }) {
  const p = new URLSearchParams();
  if (q.year != null) {
    p.set("year", String(q.year));
    p.set("yearMode", q.yearMode ?? "fy");
  }
  if (q.unitId) p.set("unitId", q.unitId);
  if (q.categoryId) p.set("categoryId", q.categoryId);
  const s = p.toString();
  return useApi<ExpenseListResponse>(`/api/expenses${s ? `?${s}` : ""}`, { keepPrevious: true });
}

// ---------------------------------------------------------------- labels

type UnitLike = { id: string; name: string; position?: "front" | "back" | null; isActive?: boolean };

/** Units are called by their names only (owner 5/10: never "Front"/"Back"). */
export function unitLabel(u: UnitLike): string {
  return u.name;
}

/** Units for a picker: active ones first; inactive ones only when asked (e.g. editing an old record). */
export function unitOptions(units: UnitLike[] | undefined, { includeInactive = false, keepId }: { includeInactive?: boolean; keepId?: string | null } = {}): SelectOption[] {
  return (units ?? [])
    .filter((u) => u.isActive !== false || includeInactive || u.id === keepId)
    .map((u) => ({ value: u.id, label: u.isActive === false ? `${unitLabel(u)} (inactive)` : unitLabel(u) }));
}

export const tenantOptions = (tenants: { id: string; name: string }[] | undefined): SelectOption[] =>
  (tenants ?? []).map((t) => ({ value: t.id, label: t.name }));

// ---------------------------------------------------------------- lease state

export type LeasePhase = "current" | "incoming" | "past";

type LeaseDates = { startDate: string; endDate: string | null; status?: string; state?: string };

/**
 * Current = started and not yet past its last day (or open-ended); incoming = starts in the future; past = ended.
 * Uses the API's own status when it sends one, so the list and the dashboard can never disagree.
 */
export function leasePhase(l: LeaseDates, today: Date = todayIST()): LeasePhase {
  const s = l.state ?? l.status;
  if (s === "current" || s === "active") return "current";
  if (s === "incoming") return "incoming";
  if (s === "past" || s === "ended") return "past";
  const t = today.getTime();
  if (new Date(l.startDate).getTime() > t) return "incoming";
  if (l.endDate && new Date(l.endDate).getTime() < t) return "past";
  return "current";
}

/** "Unit A · R. Senthil Kumar" */
export const leaseLabel = (l: { unit: { name: string }; tenant: { name: string } }) => `${l.unit.name} · ${l.tenant.name}`;

/** "from 1/4/2025" or "1/4/2025 – 31/3/2026" */
export const leaseSpan = (l: { startDate: string; endDate: string | null }) =>
  l.endDate ? `${formatDate(l.startDate)} – ${formatDate(l.endDate)}` : `from ${formatDate(l.startDate)}`;

export const METHOD_LABEL: Record<string, string> = { cash: "Cash", bank: "Bank", upi: "UPI", other: "Other" };
