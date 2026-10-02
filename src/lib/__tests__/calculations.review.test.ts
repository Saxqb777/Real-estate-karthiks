// Independent review of src/lib/calculations.ts (agent review-calc).
// "BUG" blocks FAILED against the original implementation (output kept in the review report) and pin the fix.
// "CHECK" blocks probe suspected weak spots (rounding, order, leap years, timezone, NaN) that held up.
import { describe, expect, it } from "vitest";
import {
  buildDashboard,
  dueDateFor,
  nextPaymentFor,
  occupancyFor,
  round2,
  sumAmounts,
  yearsBetween,
  type DashboardInput,
  type ExpenseInput,
  type LeaseInput,
  type PaymentInput,
  type SettingsInput,
  type UnitInput,
} from "../calculations";
import { todayIST } from "../dates";
import { sceneUnitsFromBreakdown } from "../site-layout";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ISO = (s: string) => `${s}T00:00:00.000Z`;
const TODAY = D("2026-06-15");
const NOW = new Date("2026-06-15T04:30:00.000Z");

const settings: SettingsInput = {
  brandName: "Pattukottai Estates",
  subtitle: null,
  currency: "INR",
  rentDueDay: 5,
  lateFeeEnabled: true,
  lateFeeAmount: 500,
  lateFeeGraceDays: 3,
};

const unit = (over: Partial<UnitInput> & Pick<UnitInput, "id">): UnitInput => ({
  name: over.id,
  type: "Townhouse",
  position: null,
  floors: 1,
  isActive: true,
  builtUpSqft: 1000,
  footprintWidthFt: null,
  footprintDepthFt: null,
  purchaseDate: D("2025-01-01"),
  purchasePrice: 1_000_000,
  annualAppreciationRate: 0,
  electricityConsumerNumber: null,
  electricityPayUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const lease = (over: Partial<LeaseInput> & Pick<LeaseInput, "id" | "unitId">): LeaseInput => ({
  tenantId: `t-${over.id}`,
  tenantName: `Tenant ${over.id}`,
  tenantPhone: null,
  startDate: D("2025-01-01"),
  endDate: null,
  monthlyRent: 20_000,
  securityDeposit: 40_000,
  ...over,
});

const input = (over: Partial<DashboardInput> = {}): DashboardInput => ({
  settings,
  plot: { frontWidthFt: null, backWidthFt: null, depthFt: null, areaSqft: null, townName: "Pattukottai", sitePlanImageUrl: null },
  units: [],
  offers: [],
  leases: [],
  payments: [],
  expenses: [],
  categories: [{ id: "c", name: "Maintenance", color: "#4F9DFF" }],
  actions: [],
  ...over,
});

// ───────────────────────────── confirmed bugs ─────────────────────────────

describe("BUG 1 — a lease that has not started yet made the unit 'occupied'", () => {
  // Bought 1/1/2026; lease signed, tenant moves in 1/7/2026; today 15/6/2026.
  const d = buildDashboard(
    input({
      units: [unit({ id: "u", purchaseDate: D("2026-01-01") })],
      leases: [lease({ id: "L", unitId: "u", startDate: D("2026-07-01") })],
    }),
    TODAY,
    NOW,
  );
  const u = d.units[0];

  it("vacancy in the same payload says nobody has lived there", () => {
    // owned [1/1, 15/6) = 165 days, none occupied
    expect(u).toMatchObject({ daysOwned: 165, daysOccupied: 0, vacantDays: 165, occupancyPct: 0 });
  });

  it("so the unit is vacant and not counted as occupied (was: status 'occupied', unitsOccupied 1)", () => {
    expect(u.status).toBe("vacant");
    expect(d.kpis.unitsOccupied).toBe(0);
  });

  it("the incoming tenant and first rent are still shown", () => {
    expect(u.activeLease?.id).toBe("L");
    expect(u.nextPayment).toMatchObject({ dueDate: ISO("2026-07-05"), periodMonth: 7, isOverdue: false });
  });
});

describe("BUG 2 — a move-out date recorded in advance made the unit 'vacant' while the tenant still lives there", () => {
  // L0 [1/1, 1/2/2025) → 31-day gap → L1 from 1/3/2025 with move-out recorded for 31/7/2026; today 15/6/2026.
  const d = buildDashboard(
    input({
      units: [unit({ id: "u" })],
      leases: [
        lease({ id: "L0", unitId: "u", startDate: D("2025-01-01"), endDate: D("2025-02-01") }),
        lease({ id: "L1", unitId: "u", startDate: D("2025-03-01"), endDate: D("2026-07-31") }),
      ],
    }),
    TODAY,
    NOW,
  );
  const u = d.units[0];

  it("vacancy counts the tenant as present up to today", () => {
    expect(u.vacantPeriods).toEqual([
      { start: ISO("2025-02-01"), end: ISO("2025-03-01"), days: 28, rentBasis: 20_000, unrealizedLoss: 18_666.67, noRentHistory: false },
    ]);
  });

  it("so the unit is occupied (was: 'vacant')", () => {
    expect(u.status).toBe("occupied");
    expect(d.kpis.unitsOccupied).toBe(1);
  });

  it("and the 3D scene no longer labels it 'Vacant · 28 days' from a gap that closed in 2025", () => {
    expect(sceneUnitsFromBreakdown(d.units)[0]).toMatchObject({ status: "occupied", vacantDays: 0 });
  });
});

describe("BUG 3 — a still-open lease on an INACTIVE unit leaked into portfolio KPIs", () => {
  // Reachable through the API: PUT /api/units/:id {isActive:false} does not check for an active lease.
  // A: active, never leased. B: inactive, open lease since 1/1/2025 (20,000/month, 40,000 deposit), never paid.
  const d = buildDashboard(
    input({
      units: [unit({ id: "A" }), unit({ id: "B", isActive: false })],
      leases: [lease({ id: "LB", unitId: "B" })],
    }),
    TODAY,
    NOW,
  );

  it("the inactive unit is not occupied in the KPIs", () => {
    expect(d.units.find((u) => u.id === "B")?.status).toBe("inactive");
    expect(d.kpis.unitsOccupied).toBe(0);
  });

  it("so it must not add rent roll, deposits or an overdue alert no unit card shows (were 20,000 / 40,000 / 1 / 20,500)", () => {
    expect(d.kpis).toMatchObject({ monthlyRentRoll: 0, securityDepositsHeld: 0, overdueCount: 0, overdueAmount: 0 });
  });

  it("the inactive unit's own card still shows its lease and what it owes", () => {
    expect(d.units[1]).toMatchObject({ id: "B", activeLease: { id: "LB" }, nextPayment: { isOverdue: true } });
  });
});

describe("BUG 4 — next rent period could fall before the lease started", () => {
  // Lease starts 10/1/2025; a stray payment exists for 11/2024 (e.g. data entered before the start date was corrected).
  const l = { id: "L", startDate: D("2025-01-10"), monthlyRent: 25_000 };
  const n = nextPaymentFor(l, [{ periodMonth: 11, periodYear: 2024 }], settings, D("2025-01-05"));

  it("asks for January 2025 — a period POST /api/payments accepts (was: December 2024, which it rejects)", () => {
    expect(n).toMatchObject({ periodMonth: 1, periodYear: 2025, dueDate: ISO("2025-01-10"), isOverdue: false });
  });
});

describe("BUG 5 — 'late fee applied' was reported for a ₹0 late fee", () => {
  it("enabled with amount 0 → no late fee flag", () => {
    const n = nextPaymentFor(
      { id: "L", startDate: D("2025-01-10"), monthlyRent: 25_000 },
      [{ periodMonth: 5, periodYear: 2026 }],
      { ...settings, lateFeeAmount: 0 },
      D("2026-06-20"),
    );
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 15, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
  });
});

describe("BUG 6 (latent) — day counts rounded a non-midnight Date to the NEXT day while labels floor it", () => {
  // Not reachable from Postgres DATE columns (always 00:00Z) but the module is pure and also used by the UI.
  it("purchase at 12:00Z on 1/1 counts from 1/1, like the purchaseDate it reports", () => {
    expect(occupancyFor(new Date("2026-01-01T12:00:00Z"), D("2026-01-11"), []).daysOwned).toBe(10); // was 9
    const d = buildDashboard(input({ units: [unit({ id: "u", purchaseDate: new Date("2026-01-01T18:00:00Z") })] }), D("2026-01-11"), NOW);
    expect(d.units[0]).toMatchObject({ purchaseDate: ISO("2026-01-01"), daysOwned: 10 });
  });
});

// ───────────────────────────── checks that held up ─────────────────────────────

describe("CHECK — dates: leap years, month clamping, IST 'today'", () => {
  it("due day 29/30/31 clamps correctly incl. century years", () => {
    expect(dueDateFor(2100, 2, 29)).toEqual(D("2100-02-28")); // 2100 is not a leap year
    expect(dueDateFor(2000, 2, 31)).toEqual(D("2000-02-29")); // 2000 is
    expect(dueDateFor(2028, 2, 30)).toEqual(D("2028-02-29"));
    expect(dueDateFor(2026, 11, 31)).toEqual(D("2026-11-30"));
  });

  it("29 Feb purchase: years held are fractional days / 365.25", () => {
    expect(yearsBetween(D("2024-02-29"), D("2025-02-28"))).toBeCloseTo(365 / 365.25, 12);
    expect(yearsBetween(D("2024-02-29"), D("2028-02-29"))).toBe(4); // 1,461 days
  });

  it("the IST date flips at 18:30Z and buildDashboard ignores the time of day", () => {
    expect(todayIST(new Date("2026-06-14T18:29:59Z"))).toEqual(D("2026-06-14"));
    expect(todayIST(new Date("2026-06-14T18:30:00Z"))).toEqual(D("2026-06-15"));
    const i = input({ units: [unit({ id: "u" })], leases: [lease({ id: "L", unitId: "u" })] });
    const a = buildDashboard(i, D("2026-06-15"), NOW);
    const b = buildDashboard(i, new Date("2026-06-15T23:59:59Z"), NOW);
    expect(b).toEqual(a);
  });

  it("rent overdue counts from the day after the due date, across a year boundary", () => {
    const l = { id: "L", startDate: D("2025-01-01"), monthlyRent: 10_000 };
    const n = nextPaymentFor(l, [{ periodMonth: 12, periodYear: 2025 }], { ...settings, rentDueDay: 31 }, D("2026-02-01"));
    expect(n).toMatchObject({ dueDate: ISO("2026-01-31"), periodMonth: 1, periodYear: 2026, isOverdue: true, daysOverdue: 1 });
  });
});

/** Fail on any NaN / ±Infinity (JSON.stringify would silently turn them into null). */
function expectAllFinite(value: unknown, path = "$"): void {
  if (typeof value === "number") expect(Number.isFinite(value), `${path} = ${value}`).toBe(true);
  else if (Array.isArray(value)) value.forEach((v, i) => expectAllFinite(v, `${path}[${i}]`));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) expectAllFinite(v, `${path}.${k}`);
}

// Seeded PRNG so the fuzz cases are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("CHECK — money totals are order independent (so /api/expenses and /api/dashboard can't disagree)", () => {
  it("2,000 random paise amounts sum to the same value forwards, backwards and sorted", () => {
    const r = rng(42);
    for (let trial = 0; trial < 50; trial++) {
      const rows = Array.from({ length: 40 }, () => ({ amount: Math.round(r() * 5_000_000_00) / 100 }));
      const exact = rows.reduce((s, x) => s + Math.round(x.amount * 100), 0) / 100; // integer paise
      expect(sumAmounts(rows)).toBe(round2(exact));
      expect(sumAmounts([...rows].reverse())).toBe(sumAmounts(rows));
      expect(sumAmounts([...rows].sort((a, b) => b.amount - a.amount))).toBe(sumAmounts(rows));
    }
  });
});

describe("CHECK — fuzzed portfolios: no NaN/Infinity, parts add up to the KPIs", () => {
  const r = rng(7);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const day = (from: string, span: number) => new Date(D(from).getTime() + Math.floor(r() * span) * 86_400_000);

  for (let trial = 0; trial < 60; trial++) {
    it(`portfolio #${trial}`, () => {
      const units = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) =>
        unit({
          id: `u${i}`,
          isActive: r() > 0.2,
          purchaseDate: day("2015-01-01", 4000),
          purchasePrice: Math.round(r() * 1e8) / 100 + 1,
          annualAppreciationRate: Math.round((r() * 30 - 5) * 1000) / 1000,
          builtUpSqft: Math.round(r() * 200000) / 100 + 1,
        }),
      );
      const leases: LeaseInput[] = [];
      for (const u of units) {
        let cursor = u.purchaseDate.getTime() + Math.floor(r() * 400) * 86_400_000;
        for (let k = 0; k < 3 && cursor < TODAY.getTime(); k++) {
          const start = new Date(cursor);
          const open = r() > 0.6 || k === 2;
          const end = open ? null : new Date(cursor + (30 + Math.floor(r() * 700)) * 86_400_000);
          leases.push(lease({ id: `${u.id}-L${k}`, unitId: u.id, startDate: start, endDate: end, monthlyRent: Math.round(r() * 5e6) / 100 + 1 }));
          if (!end) break;
          cursor = end.getTime() + Math.floor(r() * 120) * 86_400_000;
        }
      }
      const payments: PaymentInput[] = leases.flatMap((l, li) =>
        Array.from({ length: Math.floor(r() * 6) }, (_, k) => ({
          id: `p${li}-${k}`,
          leaseId: l.id,
          amount: Math.round(r() * 5e6) / 100,
          paymentDate: day("2015-01-01", 4200),
          periodMonth: l.startDate.getUTCMonth() + 1,
          periodYear: l.startDate.getUTCFullYear() + Math.floor(k / 2),
          invoiceSeq: li * 10 + k,
          invoiceNumber: `PE-${li}-${k}`,
        })),
      );
      const expenses: ExpenseInput[] = Array.from({ length: Math.floor(r() * 12) }, (_, k) => ({
        id: `e${k}`,
        unitId: r() > 0.3 ? pick(units).id : null,
        categoryId: pick(["c", "tax", "ghost"]),
        expenseDate: day("2015-01-01", 4200),
        amount: Math.round(r() * 1e7) / 100,
      }));
      const d = buildDashboard(input({ units, leases, payments, expenses, settings: { ...settings, rentDueDay: 1 + Math.floor(r() * 31) } }), TODAY, NOW);

      expectAllFinite(d);
      const act = d.units.filter((u) => u.isActive);
      const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));
      expect(sum(act.map((u) => u.purchasePrice))).toBe(d.kpis.invested);
      expect(sum(act.map((u) => u.valuation))).toBe(d.kpis.bestOfferTotal);
      expect(sum(act.map((u) => u.unrealizedLoss))).toBe(d.kpis.unrealizedLoss);
      expect(sum(d.units.map((u) => u.rentCollected))).toBe(d.kpis.rentCollected);
      expect(d.kpis.totalExpenses).toBe(sumAmounts(expenses));
      expect(sum(d.monthlyByYear.map((y) => y.expenses))).toBe(d.kpis.totalExpenses);
      expect(sum(d.monthlyByYear.map((y) => y.income))).toBe(d.kpis.rentCollected);
      expect(sum(d.expenseComposition.allTime.map((s) => s.amount))).toBe(d.kpis.totalExpenses);
      expect(d.cumulativeNetByYear.at(-1)?.cumulative).toBe(d.kpis.netProfit);
      expect(d.kpis.unitsOccupied).toBe(act.filter((u) => u.status === "occupied").length);
      for (const u of d.units) {
        expect(u.daysOccupied + u.vacantDays).toBe(u.daysOwned);
        expect(u.vacantPeriods.reduce((s, p) => s + p.days, 0)).toBe(u.vacantDays);
        expect(u.occupancyPct).toBeGreaterThanOrEqual(0);
        expect(u.occupancyPct).toBeLessThanOrEqual(1);
      }
    });
  }
});
