// Onboarding quests (DESIGN.md "Quest log"): pure — what is done comes from the dashboard + the tenant count.
// Relative imports on purpose (unit-tested without the "@/" alias).
import type { DashboardData } from "../../lib/dashboard-types";
import { formatDate } from "../../lib/dates";
import { formatINR, formatIndianNumber } from "../../lib/format";
import { formatFeetInches } from "../../lib/site-layout";

export type QuestId = "plot" | "unit1" | "unit2" | "tenant" | "lease" | "rent";

export interface Quest {
  id: QuestId;
  title: string;
  /** what to do, in plain words */
  text: string;
  done: boolean;
  /** what was done (shown on a finished quest) */
  doneNote?: string;
  /** why it can't be done yet */
  locked?: string;
  /** button label */
  cta: string;
}

export interface QuestState {
  quests: Quest[];
  done: number;
  total: number;
  complete: boolean;
  /** first quest not done and not locked */
  current: QuestId | null;
}

type QuestData = Pick<DashboardData, "plot" | "units" | "unitsNotYetOwned" | "timeline" | "kpis" | "recentPayments">;

export function buildQuests(data: QuestData, tenantCount: number | null): QuestState {
  const p = data.plot;
  const units = [...data.units.map((u) => ({ name: u.name, position: u.position })), ...data.unitsNotYetOwned.map((u) => ({ name: u.name, position: u.position }))];
  const leases = data.timeline.units.flatMap((u) => u.leases.map((l) => ({ ...l, unitName: u.unitName })));
  const paid = data.recentPayments[0];
  const where = (u: { name: string; position: "front" | "back" | null }) => (u.position ? `${u.name} · ${u.position === "front" ? "front" : "back"}` : u.name);
  const tenants = tenantCount ?? 0;
  const hasRent = data.kpis.rentCollected > 0 || data.recentPayments.length > 0;

  const quests: Quest[] = [
    {
      id: "plot",
      title: "Set your plot size",
      text: "Front, back and depth in feet — or use the numbers from your site drawing.",
      done: !p.usingDefaults,
      doneNote: `${formatFeetInches(p.frontWidthFt)} front · ${formatFeetInches(p.depthFt)} deep · ${formatIndianNumber(p.areaSqft)} sq ft`,
      cta: "Set plot",
    },
    {
      id: "unit1",
      title: "Build unit 1",
      text: "The first house: its name, size and the price you paid.",
      done: units.length >= 1,
      doneNote: units[0] ? where(units[0]) : undefined,
      cta: "Build",
    },
    {
      id: "unit2",
      title: "Build unit 2",
      text: "The second house on the plot.",
      done: units.length >= 2,
      doneNote: units[1] ? where(units[1]) : undefined,
      locked: units.length < 1 ? "Build unit 1 first" : undefined,
      cta: "Build",
    },
    {
      id: "tenant",
      title: "Add a tenant",
      text: "Name and phone number of the person who rents.",
      done: tenants > 0,
      doneNote: tenants > 0 ? `${tenants} ${tenants === 1 ? "tenant" : "tenants"}` : undefined,
      cta: "Add tenant",
    },
    {
      id: "lease",
      title: "Sign a lease",
      text: "Who lives in which unit, the monthly rent and the deposit.",
      done: leases.length > 0,
      doneNote: leases[0] ? `${leases[0].tenantName} · ${leases[0].unitName} · ${formatINR(leases[0].monthlyRent)}/month` : undefined,
      locked: units.length < 1 ? "Needs a unit" : tenants < 1 ? "Needs a tenant" : undefined,
      cta: "Sign lease",
    },
    {
      id: "rent",
      title: "Record your first rent",
      text: "From now on, tap the mailbox at the gate to record rent.",
      done: hasRent,
      doneNote: paid ? `${formatINR(paid.amount)} on ${formatDate(paid.paymentDate)}` : undefined,
      locked: leases.length < 1 ? "Needs a lease" : undefined,
      cta: "Record rent",
    },
  ];
  for (const q of quests) if (q.done) q.locked = undefined;
  const done = quests.filter((q) => q.done).length;
  return {
    quests,
    done,
    total: quests.length,
    complete: done === quests.length,
    current: quests.find((q) => !q.done && !q.locked)?.id ?? null,
  };
}
