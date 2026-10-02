// Lease-end rule (round 2): endDate is the LAST DAY of tenancy, inclusive. The shared API/UI rules in
// src/lib/schemas/lease.ts and src/lib/schemas/payment.ts must agree with the calculations.
import { describe, expect, it, vi } from "vitest";
import { leaseMonthBounds, leaseStateOn, monthIndex } from "../calculations";

// The schema modules import through the "@/" path alias, which this repo's vitest setup doesn't resolve; map the
// few modules they use to the real files.
vi.mock("@/lib/dates", () => import("../dates"));
vi.mock("@/lib/format", () => import("../format"));
vi.mock("@/lib/validation", () => import("../validation"));
vi.mock("@/lib/calculations", () => import("../calculations"));
import {
  compareLeases,
  isLeaseActive,
  leaseConflictMessage,
  leaseRuleIssues,
  leaseStateOf,
  leaseStatus,
  leasesOverlap,
} from "../schemas/lease";
import { leasePeriodBounds, paymentPeriodError, paymentsOutsideLease } from "../schemas/payment";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const span = (start: string, end: string | null) => ({ startDate: D(start), endDate: end ? D(end) : null });

describe("overlap: leases may not share a single day", () => {
  it("the next lease may start the day after the last day", () => {
    expect(leasesOverlap(span("2023-09-01", null), span("2019-08-01", "2023-08-31"))).toBe(false);
  });

  it("starting ON the previous lease's last day overlaps (that day is still theirs)", () => {
    expect(leasesOverlap(span("2023-08-31", null), span("2019-08-01", "2023-08-31"))).toBe(true);
  });

  it("open-ended leases overlap everything after their start", () => {
    expect(leasesOverlap(span("2030-01-01", "2030-12-31"), span("2023-09-01", null))).toBe(true);
    expect(leasesOverlap(span("2020-01-01", "2023-08-31"), span("2023-09-01", null))).toBe(false);
  });

  it("a one-day tenancy (start = last day) is valid and occupies that day", () => {
    expect(leaseRuleIssues({ startDate: D("2026-01-10"), endDate: D("2026-01-10"), securityDeposit: 0 })).toEqual([]);
    expect(leasesOverlap(span("2026-01-10", "2026-01-10"), span("2026-01-10", null))).toBe(true);
    expect(leasesOverlap(span("2026-01-10", "2026-01-10"), span("2026-01-11", null))).toBe(false);
  });

  it("explains the clash and suggests the day after the last day", () => {
    const others = [{ ...span("2019-08-01", "2023-08-31"), tenant: { name: "Murugan" } }];
    expect(leaseConflictMessage(span("2023-08-15", null), others, "Unit A")).toBe(
      "These dates overlap Murugan's lease on Unit A (1/8/2019 – 31/8/2023). Leases on the same unit can't share a day — the next lease can start on 1/9/2023, the day after their last day.",
    );
    expect(leaseConflictMessage(span("2023-09-01", null), others, "Unit A")).toBeNull();
    // only one open lease per unit
    const open = [{ ...span("2023-09-01", null), tenant: { name: "Lakshmi" } }];
    expect(leaseConflictMessage(span("2030-01-01", null), open, "Unit A")).toMatch(/already has an open lease .*last day of tenancy/);
  });

  it("last day before the start is rejected with the new wording", () => {
    expect(leaseRuleIssues({ startDate: D("2026-01-10"), endDate: D("2026-01-09"), securityDeposit: 0 })).toEqual([
      { field: "endDate", message: "Last day of tenancy 9/1/2026 can't be before the start date 10/1/2026" },
    ]);
  });
});

describe("lease state: same rule in the API helpers and the calculations", () => {
  const cases: [string, string | null, string, "incoming" | "current" | "ended"][] = [
    ["2026-11-01", null, "2026-10-02", "incoming"],
    ["2023-09-01", null, "2026-10-02", "current"],
    ["2021-07-01", "2025-04-30", "2025-04-30", "current"], // the last day itself
    ["2021-07-01", "2025-04-30", "2025-05-01", "ended"],
  ];
  it.each(cases)("start %s, last day %s, on %s → %s", (start, end, on, state) => {
    expect(leaseStateOf(span(start, end), D(on))).toBe(state);
    expect(leaseStateOn(span(start, end), D(on))).toBe(state);
    expect(isLeaseActive(span(start, end), D(on))).toBe(state !== "ended");
    expect(leaseStatus(span(start, end), D(on))).toEqual({ isActive: state !== "ended", state });
  });

  it("lists active (not ended) leases first, newest first", () => {
    const today = D("2025-05-01");
    const rows = [span("2019-08-01", "2023-05-31"), span("2023-09-01", null), span("2021-07-01", "2025-04-30"), span("2025-05-01", "2025-05-01")];
    expect([...rows].sort((a, b) => compareLeases(a, b, today)).map((r) => r.startDate.toISOString().slice(0, 10))).toEqual([
      "2025-05-01",
      "2023-09-01",
      "2021-07-01",
      "2019-08-01",
    ]);
  });
});

describe("rent periods: the last rent month is the month of the last day", () => {
  it("bounds agree with the calculations' rent schedule", () => {
    for (const end of ["2025-04-30", "2025-05-01", "2025-04-01", null]) {
      const l = span("2021-07-01", end);
      const b = leasePeriodBounds(l);
      const c = leaseMonthBounds(l);
      expect(monthIndex(b.first.year, b.first.month)).toBe(c.first);
      expect(b.last ? monthIndex(b.last.year, b.last.month) : null).toBe(c.last);
    }
    expect(leasePeriodBounds(span("2021-07-01", "2025-05-01")).last).toEqual({ month: 5, year: 2025 }); // one day of May is a rent month
  });

  it("rejects periods outside the lease with plain wording", () => {
    const l = span("2021-07-01", "2025-04-30");
    expect(paymentPeriodError(l, { month: 4, year: 2025 })).toBeNull();
    expect(paymentPeriodError(l, { month: 7, year: 2021 })).toBeNull();
    expect(paymentPeriodError(l, { month: 5, year: 2025 })).toBe(
      "Rent period May 2025 is after the tenant's last day of tenancy (30/4/2025) — this lease's last rent month is April 2025. Choose April 2025 or earlier.",
    );
    expect(paymentPeriodError(l, { month: 6, year: 2021 })).toMatch(/^Rent period June 2021 is before this lease started \(July 2021\)/);
    // a one-day tenancy still has one rent month
    expect(paymentPeriodError(span("2026-01-10", "2026-01-10"), { month: 1, year: 2026 })).toBeNull();
  });

  it("finds payments a date change would orphan", () => {
    const pays = [
      { periodMonth: 4, periodYear: 2025 },
      { periodMonth: 5, periodYear: 2025 },
      { periodMonth: 3, periodYear: 2025 },
    ];
    expect(paymentsOutsideLease(span("2021-07-01", "2025-04-30"), pays)).toEqual([{ periodMonth: 5, periodYear: 2025 }]);
    expect(paymentsOutsideLease(span("2021-07-01", "2025-03-31"), pays).map((p) => p.periodMonth)).toEqual([4, 5]);
  });
});
