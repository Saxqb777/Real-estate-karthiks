// End-to-end tests for the pure buildDashboard(): a full hand-computed scenario, inactive units, ordering, actions,
// recent payments, the empty database (no NaN / Infinity anywhere), and the round-2 rules: as-of dates, FY / calendar
// grouping, scoped periods, arrears, incoming units, inclusive last day, deposits, explain map, reconciliation, timeline.
import { describe, expect, it } from "vitest";
import {
  buildDashboard,
  recon,
  reconciliation,
  type ActionInput,
  type CategoryInput,
  type DashboardInput,
  type ExpenseInput,
  type LeaseInput,
  type OfferInput,
  type PaymentInput,
  type PlotInput,
  type SettingsInput,
  type UnitInput,
} from "../calculations";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ISO = (s: string) => `${s}T00:00:00.000Z`;

const TODAY = D("2026-06-15");
const NOW = new Date("2026-06-15T04:30:00.000Z");

const settings: SettingsInput = {
  brandName: "Pattukottai Estates",
  subtitle: "Two townhouses",
  currency: "INR",
  rentDueDay: 5,
  lateFeeEnabled: true,
  lateFeeAmount: 500,
  lateFeeGraceDays: 3,
};
const plot: PlotInput = { frontWidthFt: null, backWidthFt: null, depthFt: null, areaSqft: null, townName: "Pattukottai", sitePlanImageUrl: null };
const categories: CategoryInput[] = [
  { id: "maint", name: "Maintenance", color: "#4F9DFF" },
  { id: "tax", name: "Property Tax", color: "#EF4444" },
  { id: "util", name: "Utilities", color: "#22C55E" },
];

function unit(over: Partial<UnitInput> & Pick<UnitInput, "id" | "name">): UnitInput {
  return {
    type: "Townhouse",
    position: null,
    floors: 1,
    isActive: true,
    builtUpSqft: 1000,
    footprintWidthFt: null,
    footprintDepthFt: null,
    purchaseDate: D("2024-01-01"),
    purchasePrice: 1_000_000,
    annualAppreciationRate: 0,
    electricityConsumerNumber: null,
    electricityPayUrl: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

const empty = (over: Partial<DashboardInput> = {}): DashboardInput => ({
  settings,
  plot,
  units: [],
  offers: [],
  leases: [],
  payments: [],
  expenses: [],
  categories,
  actions: [],
  ...over,
});

/** Walk the payload and fail on any NaN / ±Infinity (JSON.stringify would silently turn them into null). */
function expectAllFinite(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} = ${value}`).toBe(true);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => expectAllFinite(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) expectAllFinite(v, `${path}.${k}`);
  }
}

// ─────────────────────────────── full scenario ───────────────────────────────
// Unit A "Front House": bought 15/6/2022 for 50,00,000 at 8%/yr, 1,200 sqft → held 1,461 days = 4.0 years.
// (Estimates are whole rupees: 50L × 1.08⁴ = 68,02,444.80 → 68,02,445; 40L × 1.05⁸ = 59,09,821.78 → 59,09,822.)
//   Offers 60,00,000 (1/3/2026), 72,00,000 (10/1/2026), 72,00,000 (1/5/2026) → best 72,00,000 dated 1/5/2026 (tie → latest).
//   Lease to Ravi from 10/1/2025 (active), rent 25,000, deposit 1,00,000.
// Unit B "Back House": bought 15/6/2018 for 40,00,000 at 5%/yr, 1,000 sqft → 2,922 days = 8.0 years. No offers, never leased.
// Payments (lease L1): 25,000 ×3 — Jan 2025 (paid 10/1/2025), Feb 2025 (6/2/2025), May 2026 (4/5/2026).
// Expenses: Maintenance 12,500.50 on A (12/3/2025); Property Tax 4,320.25 on B (20/2/2026).
// Settings: rent due on the 5th, late fee 500 after 3 grace days. Today = 15/6/2026.
const scenario = (): DashboardInput => ({
  settings,
  plot,
  categories,
  units: [
    unit({
      id: "uB",
      name: "Back House",
      position: "back",
      builtUpSqft: 1000,
      purchaseDate: D("2018-06-15"),
      purchasePrice: 4_000_000,
      annualAppreciationRate: 5,
      createdAt: new Date("2026-01-01T09:00:00Z"),
    }),
    unit({
      id: "uA",
      name: "Front House",
      position: "front",
      floors: 2,
      builtUpSqft: 1200,
      footprintWidthFt: 20,
      footprintDepthFt: 28,
      purchaseDate: D("2022-06-15"),
      purchasePrice: 5_000_000,
      annualAppreciationRate: 8,
      electricityConsumerNumber: "04-123-456",
      electricityPayUrl: "https://www.tnebltd.gov.in/",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    }),
  ],
  offers: [
    { id: "o1", unitId: "uA", amount: 6_000_000, offerDate: D("2026-03-01") },
    { id: "o2", unitId: "uA", amount: 7_200_000, offerDate: D("2026-01-10") },
    { id: "o3", unitId: "uA", amount: 7_200_000, offerDate: D("2026-05-01") },
  ] satisfies OfferInput[],
  leases: [
    {
      id: "L1",
      unitId: "uA",
      tenantId: "t1",
      tenantName: "Ravi Kumar",
      tenantPhone: "9876543210",
      startDate: D("2025-01-10"),
      endDate: null,
      monthlyRent: 25_000,
      securityDeposit: 100_000,
    },
  ] satisfies LeaseInput[],
  payments: [
    { id: "p1", leaseId: "L1", amount: 25_000, paymentDate: D("2025-01-10"), periodMonth: 1, periodYear: 2025, invoiceSeq: 1, invoiceNumber: "PE-2025-0001" },
    { id: "p3", leaseId: "L1", amount: 25_000, paymentDate: D("2026-05-04"), periodMonth: 5, periodYear: 2026, invoiceSeq: 3, invoiceNumber: "PE-2026-0003" },
    { id: "p2", leaseId: "L1", amount: 25_000, paymentDate: D("2025-02-06"), periodMonth: 2, periodYear: 2025, invoiceSeq: 2, invoiceNumber: "PE-2025-0002" },
  ] satisfies PaymentInput[],
  expenses: [
    { id: "e1", unitId: "uA", categoryId: "maint", expenseDate: D("2025-03-12"), amount: 12_500.5 },
    { id: "e2", unitId: "uB", categoryId: "tax", expenseDate: D("2026-02-20"), amount: 4_320.25 },
  ] satisfies ExpenseInput[],
  actions: [
    { id: "a2", title: "Renew insurance", priority: "Low", dueDate: null, isDone: false, unitId: null },
    { id: "a1", title: "Fix leak", priority: "High", dueDate: D("2026-06-10"), isDone: false, unitId: "uA" },
    { id: "a3", title: "Old task", priority: "Medium", dueDate: D("2026-01-01"), isDone: true, unitId: null },
  ] satisfies ActionInput[],
});


const build = (input: DashboardInput, asOf: Date = TODAY, yearMode: "fy" | "calendar" = "fy") =>
  buildDashboard(input, { asOf, today: TODAY, now: NOW, yearMode });

describe("buildDashboard — full scenario (2 units, 1 tenant, 1 lease, 3 payments, 2 expenses)", () => {
  const d = build(scenario());
  const [A, B] = d.units;

  it("asserts every KPI", () => {
    expect(d.kpis).toEqual({
      unitsActive: 2,
      unitsOccupied: 1, // A has a current lease
      unitsVacant: 1, // B never leased
      unitsIncoming: 0,
      invested: 9_000_000, // 50,00,000 + 40,00,000
      currentValue: 12_712_267, // 68,02,445 + 59,09,822
      bestOfferTotal: 13_109_822, // A offer 72,00,000 + B estimate 59,09,822
      bestOfferIsPartialEstimate: true, // B has no offer
      bestOfferSum: 7_200_000, // only A has an offer
      unitsWithOffer: 1,
      appreciation: 4_109_822, // (72,00,000 − 50,00,000) + (59,09,822 − 40,00,000)
      capitalMultiplier: 1.456647, // 1,31,09,822 / 90,00,000
      cagr: 0.067266, // 1.4566469 ^ (9 / 52) − 1
      cagrNote: null,
      holdingYears: 5.777778, // (50L × 4 + 40L × 8) / 90L = 52/9
      rentCollected: 75_000, // 3 × 25,000
      totalExpenses: 16_820.75, // 12,500.50 + 4,320.25
      wholePlotExpenses: 0,
      netProfit: 58_179.25, // 75,000 − 16,820.75
      securityDepositsHeld: 100_000,
      totalReturn: 4_184_822, // 41,09,822 + 75,000
      totalBuiltUpSqft: 2200, // 1,200 + 1,000
      boughtAtPerSqft: 4091, // 90,00,000 / 2,200 = 4,090.9 → whole rupees
      offeredAtPerSqft: 5959, // 1,31,09,822 / 2,200 = 5,959.01
      occupancyPct: 0.118868, // occupied 521 / owned (1,461 + 2,922 = 4,383)
      vacantDays: 3862, // A 940 + B 2,922
      unrealizedLoss: 783_333, // A: 940 × 25,000 / 30 = 7,83,333.33 → 7,83,333; B never leased → 0
      monthlyRentRoll: 25_000,
      // Every month from Jan 2025 to Jun 2026 is checked: paid Jan + Feb 2025 and May 2026 →
      // Mar 2025 … Apr 2026 (14 months) + Jun 2026 (due 5/6, 10 days late) = 15 months × 25,000
      overdueCount: 1,
      overdueMonths: 15,
      arrearsTotal: 375_000,
      lateFeesTotal: 7_500, // 15 × 500 (all more than 3 grace days late)
      overdueAmount: 382_500,
      pendingActions: 2,
    });
  });

  it("stamps dates, scope labels, settings and plot", () => {
    expect(d.generatedAt).toBe("2026-06-15T04:30:00.000Z");
    expect(d.today).toBe(ISO("2026-06-15"));
    expect(d.asOf).toBe(ISO("2026-06-15"));
    expect(d.isLive).toBe(true);
    expect(d.yearMode).toBe("fy");
    expect(d.scopeLabels).toEqual({ allTime: "All time", year: "FY 2026-27", month: "Jun 2026", asOf: "As of 15/6/2026" });
    expect(d.settings).toEqual({
      brandName: "Pattukottai Estates",
      subtitle: "Two townhouses",
      currency: "INR",
      rentDueDay: 5,
      lateFeeEnabled: true,
      lateFeeAmount: 500,
      lateFeeGraceDays: 3,
      renewalReminderDays: 30,
      taxCollectorName: null,
      taxCollectorPhone: null,
    });
    expect(d.plot).toEqual({
      frontWidthFt: 23.25,
      backWidthFt: 22.25,
      depthFt: 76.66,
      areaSqft: 1744.02,
      townName: "Pattukottai",
      sitePlanImageUrl: null,
      usingDefaults: true,
    });
  });

  it("unit A (front, occupied, overdue, valued at its best offer)", () => {
    expect(d.units.map((u) => u.id)).toEqual(["uA", "uB"]); // front before back, despite B being created first
    expect(A).toMatchObject({
      id: "uA",
      name: "Front House",
      position: "front",
      floors: 2,
      isActive: true,
      status: "occupied",
      rentState: "overdue",
      purchaseDate: ISO("2022-06-15"),
      purchasePrice: 5_000_000,
      yearsHeld: 4, // 1,461 / 365.25
      currentValue: 6_802_445, // 50,00,000 × 1.36048896 = 68,02,444.80 → whole rupees
      bestOffer: 7_200_000,
      bestOfferDate: ISO("2026-05-01"), // tie with 10/1/2026 → most recent
      offersCount: 3,
      valuation: 7_200_000,
      valuationSource: "offer",
      appreciation: 2_200_000,
      appreciationPct: 0.44,
      capitalMultiplier: 1.44, // 72L / 50L
      cagr: 0.095445, // 1.44 ^ (1/4) − 1
      cagrNote: null,
      boughtAtPerSqft: 4167, // 50,00,000 / 1,200 = 4,166.67
      offeredAtPerSqft: 6000,
      rentCollected: 75_000,
      expenses: 12_500.5,
      netCash: 62_499.5,
      occupancyPct: 0.356605, // 521 / 1,461
      daysOwned: 1461,
      daysOccupied: 521, // 10/1/2025 → 15/6/2026
      vacantDays: 940,
      unrealizedLoss: 783_333,
      activeLease: {
        id: "L1",
        tenantId: "t1",
        tenantName: "Ravi Kumar",
        tenantPhone: "9876543210",
        startDate: ISO("2025-01-10"),
        endDate: null,
        monthlyRent: 25_000,
        securityDeposit: 100_000,
        state: "current",
      },
      incomingLease: null,
      depositHeld: 100_000,
      electricityConsumerNumber: "04-123-456",
      electricityPayUrl: "https://www.tnebltd.gov.in/",
    });
    // 15/6/2022 → 10/1/2025 = 940 days, before the first lease → next lease's rent
    expect(A.vacantPeriods).toEqual([
      {
        start: ISO("2022-06-15"),
        end: ISO("2025-01-10"),
        lastDay: ISO("2025-01-09"),
        days: 940,
        ongoing: false,
        rentBasis: 25_000,
        rentBasisSource: "next-lease",
        unrealizedLoss: 783_333,
        noRentHistory: false,
      },
    ]);
  });

  it("unit A's next payment is the OLDEST month still owed, with all arrears", () => {
    expect(A.nextPayment).toMatchObject({
      leaseId: "L1",
      dueDate: ISO("2025-03-05"),
      periodMonth: 3,
      periodYear: 2025,
      label: "Mar 2025",
      monthlyRent: 25_000,
      paidSoFar: 0,
      amountDue: 25_500,
      isOverdue: true,
      daysOverdue: 467, // 5/3/2025 → 15/6/2026
      lateFeeApplied: true,
      lateFee: 500,
    });
    const arrears = A.nextPayment!.arrears;
    expect(arrears.months.map((m) => m.key)).toEqual([
      "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-06", // May 2026 is paid
    ]);
    expect(arrears.months.at(-1)).toEqual({
      year: 2026, month: 6, key: "2026-06", label: "Jun 2026", dueDate: ISO("2026-06-05"), due: 25_000, paid: 0, outstanding: 25_000, daysOverdue: 10, lateFee: 500,
    });
    expect(arrears).toMatchObject({ total: 375_000, lateFees: 7_500, totalWithFees: 382_500 });
  });

  it("unit B (back, vacant since purchase, valued at its estimate)", () => {
    expect(B).toMatchObject({
      id: "uB",
      position: "back",
      status: "vacant",
      rentState: "none",
      yearsHeld: 8, // 2,922 / 365.25
      currentValue: 5_909_822, // 40,00,000 × 1.05⁸ = 59,09,821.78 → whole rupees
      bestOffer: null,
      bestOfferDate: null,
      offersCount: 0,
      valuation: 5_909_822,
      valuationSource: "estimate",
      appreciation: 1_909_822,
      appreciationPct: 0.477456, // 19,09,822 / 40,00,000
      capitalMultiplier: 1.477456,
      cagr: 0.05, // 1.05⁸ → 5%/yr
      rentCollected: 0,
      expenses: 4_320.25, // the Property Tax expense is tagged to B
      netCash: -4_320.25,
      occupancyPct: 0,
      daysOwned: 2922,
      daysOccupied: 0,
      vacantDays: 2922,
      unrealizedLoss: 0,
      activeLease: null,
      incomingLease: null,
      depositHeld: 0,
      nextPayment: null,
    });
    expect(B.vacantPeriods).toEqual([
      {
        start: ISO("2018-06-15"),
        end: ISO("2026-06-15"),
        lastDay: ISO("2026-06-14"),
        days: 2922,
        ongoing: true,
        rentBasis: 0,
        rentBasisSource: "none",
        unrealizedLoss: 0,
        noRentHistory: true,
      },
    ]);
  });

  it("scoped cash: all time, FY 2026-27 and June 2026", () => {
    expect(d.periods.allTime).toEqual({
      kind: "allTime",
      key: "all",
      label: "All time",
      start: null,
      end: ISO("2026-06-15"),
      rentCollected: 75_000,
      rentExpected: 450_000, // Jan 2025 … Jun 2026 = 18 months × 25,000, all due before 15/6
      rentReceivedForScope: 75_000,
      rentUnpaid: 375_000, // = the arrears
      rentDueLater: 0,
      collectionPct: 0.166667,
      expenses: 16_820.75,
      net: 58_179.25,
    });
    expect(d.periods.year).toEqual({
      kind: "year",
      key: "2026",
      label: "FY 2026-27",
      start: ISO("2026-04-01"),
      end: ISO("2026-06-15"),
      rentCollected: 25_000, // the 4/5/2026 payment
      rentExpected: 75_000, // Apr + May + Jun 2026
      rentReceivedForScope: 25_000,
      rentUnpaid: 50_000,
      rentDueLater: 0,
      collectionPct: 0.333333,
      expenses: 0, // the 20/2/2026 tax belongs to FY 2025-26
      net: 25_000,
    });
    expect(d.periods.month).toMatchObject({ key: "2026-06", label: "Jun 2026", rentCollected: 0, rentExpected: 25_000, collectionPct: 0, expenses: 0, net: 0 });
    // unit-scoped periods add up to the portfolio's
    expect(A.periods.allTime.rentCollected + B.periods.allTime.rentCollected).toBe(d.periods.allTime.rentCollected);
    expect(round2x(A.periods.allTime.expenses + B.periods.allTime.expenses)).toBe(d.periods.allTime.expenses);
    expect(B.periods.year).toMatchObject({ label: "FY 2026-27", rentCollected: 0, rentExpected: 0, collectionPct: null });
  });

  it("per-unit figures add up to the KPIs", () => {
    const sum = (f: (u: (typeof d.units)[number]) => number) => Math.round(d.units.reduce((s, u) => s + f(u), 0) * 100) / 100;
    expect(sum((u) => u.valuation)).toBe(d.kpis.bestOfferTotal);
    expect(sum((u) => u.currentValue)).toBe(d.kpis.currentValue);
    expect(sum((u) => u.appreciation)).toBe(d.kpis.appreciation);
    expect(sum((u) => u.rentCollected)).toBe(d.kpis.rentCollected);
    expect(sum((u) => u.unrealizedLoss)).toBe(d.kpis.unrealizedLoss);
    expect(d.cumulativeNetByYear.at(-1)?.cumulative).toBe(d.kpis.netProfit);
  });

  it("vacancy summary", () => {
    expect(d.vacancy).toEqual({
      totalVacantDays: 3862,
      totalUnrealizedLoss: 783_333,
      occupancyPct: 0.118868,
      units: [
        { unitId: "uA", unitName: "Front House", vacantDays: 940, unrealizedLoss: 783_333, periods: A.vacantPeriods, noRentHistory: false },
        { unitId: "uB", unitName: "Back House", vacantDays: 2922, unrealizedLoss: 0, periods: B.vacantPeriods, noRentHistory: true },
      ],
    });
  });

  it("monthly income vs expenses by FY, zero-filled from the first purchase", () => {
    expect(d.monthlyByYear.map((y) => [y.label, y.income, y.expenses, y.net])).toEqual([
      ["FY 2018-19", 0, 0, 0], // B bought 15/6/2018
      ["FY 2019-20", 0, 0, 0],
      ["FY 2020-21", 0, 0, 0],
      ["FY 2021-22", 0, 0, 0],
      ["FY 2022-23", 0, 0, 0],
      ["FY 2023-24", 0, 0, 0],
      ["FY 2024-25", 50_000, 12_500.5, 37_499.5], // Jan + Feb 2025 rent, Mar 2025 maintenance
      ["FY 2025-26", 0, 4_320.25, -4_320.25], // Feb 2026 tax
      ["FY 2026-27", 25_000, 0, 25_000], // May 2026 rent
    ]);
    const fy24 = d.monthlyByYear[6];
    expect(fy24.months.slice(9).map((m) => [m.longLabel, m.income, m.expenses, m.cumulative])).toEqual([
      ["Jan 2025", 25_000, 0, 25_000],
      ["Feb 2025", 25_000, 0, 50_000],
      ["Mar 2025", 0, 12_500.5, 37_499.5],
    ]);
    expect(d.cumulativeNetByYear.slice(-3)).toEqual([
      { year: 2024, label: "FY 2024-25", net: 37_499.5, cumulative: 37_499.5 },
      { year: 2025, label: "FY 2025-26", net: -4_320.25, cumulative: 33_179.25 },
      { year: 2026, label: "FY 2026-27", net: 25_000, cumulative: 58_179.25 },
    ]);
  });

  it("calendar years on request", () => {
    const c = build(scenario(), TODAY, "calendar");
    expect(c.monthlyByYear.slice(-2).map((y) => [y.label, y.income, y.expenses])).toEqual([
      ["2025", 50_000, 12_500.5],
      ["2026", 25_000, 4_320.25],
    ]);
    expect(c.periods.year).toMatchObject({ label: "2026", rentCollected: 25_000, expenses: 4_320.25, rentExpected: 150_000 }); // Jan–Jun 2026
    expect(c.scopeLabels.year).toBe("2026");
    expect(c.kpis).toEqual(d.kpis); // year mode never changes a KPI
  });

  it("expense composition: all time, by FY, this month and by unit", () => {
    expect(d.expenseComposition.allTime).toEqual([
      { categoryId: "maint", name: "Maintenance", color: "#4F9DFF", amount: 12_500.5, share: 0.743159 }, // 12,500.50 / 16,820.75
      { categoryId: "tax", name: "Property Tax", color: "#EF4444", amount: 4_320.25, share: 0.256841 },
    ]);
    expect(d.expenseComposition.byYear.map((y) => y.label)).toEqual(d.monthlyByYear.map((y) => y.label));
    expect(d.expenseComposition.byYear.slice(-3)).toEqual([
      { year: 2024, label: "FY 2024-25", slices: [{ categoryId: "maint", name: "Maintenance", color: "#4F9DFF", amount: 12_500.5, share: 1 }] },
      { year: 2025, label: "FY 2025-26", slices: [{ categoryId: "tax", name: "Property Tax", color: "#EF4444", amount: 4_320.25, share: 1 }] },
      { year: 2026, label: "FY 2026-27", slices: [] },
    ]);
    expect(d.expenseComposition.month).toEqual([]);
    expect(d.expenseComposition.byUnit.map((u) => [u.unitName, u.amount])).toEqual([
      ["Front House", 12_500.5],
      ["Back House", 4_320.25],
      ["Whole plot", 0],
    ]);
  });

  it("pending actions and recent payments", () => {
    expect(d.actions.pending).toEqual([
      { id: "a1", title: "Fix leak", priority: "High", dueDate: ISO("2026-06-10"), unitId: "uA", isOverdue: true },
      { id: "a2", title: "Renew insurance", priority: "Low", dueDate: null, unitId: null, isOverdue: false },
    ]);
    expect(d.recentPayments).toEqual([
      { id: "p3", amount: 25_000, paymentDate: ISO("2026-05-04"), unitName: "Front House", tenantName: "Ravi Kumar", invoiceNumber: "PE-2026-0003" },
      { id: "p2", amount: 25_000, paymentDate: ISO("2025-02-06"), unitName: "Front House", tenantName: "Ravi Kumar", invoiceNumber: "PE-2025-0002" },
      { id: "p1", amount: 25_000, paymentDate: ISO("2025-01-10"), unitName: "Front House", tenantName: "Ravi Kumar", invoiceNumber: "PE-2025-0001" },
    ]);
  });

  it("deposits ledger", () => {
    expect(d.deposits).toMatchObject({ received: 100_000, refunded: 0, kept: 0, awaitingRefund: 0, held: 100_000 });
  });

  it("is JSON-safe: no NaN / Infinity", () => {
    expectAllFinite(d);
    expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
  });

  it("all units with offers → not a partial estimate", () => {
    const input = scenario();
    input.offers.push({ id: "o4", unitId: "uB", amount: 6_000_000, offerDate: D("2026-06-01") });
    const k = build(input).kpis;
    expect(k.bestOfferIsPartialEstimate).toBe(false);
    expect(k.bestOfferTotal).toBe(13_200_000); // 72,00,000 + 60,00,000
    expect(k.bestOfferSum).toBe(13_200_000);
    expect(k.capitalMultiplier).toBe(1.466667); // 1,32,00,000 / 90,00,000
  });

  it("paying every month clears the arrears and the due-soon window drives rentState", () => {
    const input = scenario();
    let seq = 10;
    for (let i = 2; i < 18; i++) {
      const y = 2025 + Math.floor(i / 12);
      const m = (i % 12) + 1;
      if (y === 2026 && m === 5) continue; // already paid
      input.payments.push({ id: `px${i}`, leaseId: "L1", amount: 25_000, paymentDate: D("2026-06-14"), periodMonth: m, periodYear: y, invoiceSeq: seq++, invoiceNumber: `PE-X-${i}` });
    }
    let out = build(input);
    // next = July, due 5/7/2026 → 20 days away → "paid"
    expect(out.units[0]).toMatchObject({ rentState: "paid", nextPayment: { dueDate: ISO("2026-07-05"), isOverdue: false, amountDue: 25_000 } });
    expect(out.kpis).toMatchObject({ overdueCount: 0, overdueAmount: 0, arrearsTotal: 0, rentCollected: 450_000 });
    expect(out.periods.allTime.collectionPct).toBe(1);
    // on 30/6 the July rent is 5 days away → "due-soon"
    out = build(input, D("2026-06-30"));
    expect(out.units[0].rentState).toBe("due-soon");
  });
});

const round2x = (n: number) => Math.round(n * 100) / 100;

// ─────────────────────────────── as of a past date (time scrubber) ───────────────────────────────

describe("buildDashboard — as of a past date", () => {
  it("only records dated on/before the as-of date count; values grow to that date", () => {
    // 1/3/2025: no offers yet (first is 10/1/2026) → A valued by estimate; payments Jan + Feb 2025; no expenses yet
    const d = build(scenario(), D("2025-03-01"));
    expect(d.isLive).toBe(false);
    expect(d.asOf).toBe(ISO("2025-03-01"));
    expect(d.today).toBe(ISO("2026-06-15"));
    expect(d.scopeLabels).toMatchObject({ year: "FY 2024-25", month: "Mar 2025", asOf: "As of 1/3/2025" });
    const A = d.units[0];
    // held 15/6/2022 → 1/3/2025 = 990 days = 2.710472 yr; 50L × 1.08^2.710472 = 61,58,524.39… → whole rupees
    expect(A).toMatchObject({ yearsHeld: 2.710472, bestOffer: null, valuationSource: "estimate", rentCollected: 50_000, expenses: 0, offersCount: 0 });
    expect(A.currentValue).toBe(Math.round(5_000_000 * Math.pow(1.08, 990 / 365.25)));
    expect(d.kpis).toMatchObject({ rentCollected: 50_000, totalExpenses: 0, overdueAmount: 0, overdueCount: 0, unitsWithOffer: 0 });
    // March rent is due 5/3 → 4 days away
    expect(A).toMatchObject({ status: "occupied", rentState: "due-soon", nextPayment: { label: "Mar 2025", isOverdue: false } });
    expect(d.periods.year).toMatchObject({ label: "FY 2024-25", rentCollected: 50_000, rentExpected: 50_000, collectionPct: 1, rentDueLater: 25_000 });
    expect(d.monthlyByYear.at(-1)?.label).toBe("FY 2024-25");
    expect(d.recentPayments.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(d.checks.ledgerBalanced).toBe(true);
  });

  it("a unit bought after the as-of date isn't owned yet", () => {
    const d = build(scenario(), D("2022-01-01"));
    expect(d.units.map((u) => u.id)).toEqual(["uB"]);
    expect(d.unitsNotYetOwned).toEqual([{ id: "uA", name: "Front House", position: "front", purchaseDate: ISO("2022-06-15") }]);
    expect(d.kpis).toMatchObject({ unitsActive: 1, invested: 4_000_000 });
    expect(d.timeline.range).toEqual({ start: ISO("2018-06-15"), end: ISO("2026-06-15") }); // the scrubber range never shrinks
  });

  it("the arrears as they stood on that date", () => {
    // 15/7/2025: Mar, Apr, May, Jun, Jul 2025 overdue (Jul due 5/7)
    const d = build(scenario(), D("2025-07-15"));
    expect(d.units[0].nextPayment?.arrears.months.map((m) => m.label)).toEqual(["Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025"]);
    expect(d.kpis).toMatchObject({ arrearsTotal: 125_000, lateFeesTotal: 2_500, overdueAmount: 127_500 });
  });

  it("to-dos: hidden before they were created, still pending until they were done", () => {
    const input = scenario();
    input.actions = [
      { id: "new", title: "Created later", priority: "Low", dueDate: null, isDone: false, unitId: null, createdAt: new Date("2026-01-01T05:00:00Z") },
      { id: "done", title: "Done later", priority: "Low", dueDate: null, isDone: true, unitId: null, createdAt: new Date("2025-01-01T05:00:00Z"), doneAt: new Date("2026-02-01T05:00:00Z") },
    ];
    expect(build(input, D("2025-06-01")).actions.pending.map((a) => a.id)).toEqual(["done"]);
    expect(build(input, D("2026-03-01")).actions.pending.map((a) => a.id)).toEqual(["new"]);
  });
});

// ─────────────────────────────── lease rules: inclusive last day, incoming ───────────────────────────────

describe("buildDashboard — lease states on the as-of date", () => {
  const one = (lease: Partial<LeaseInput>) =>
    empty({
      units: [unit({ id: "u", name: "Solo", purchaseDate: D("2025-01-01") })],
      leases: [
        {
          id: "L",
          unitId: "u",
          tenantId: "t",
          tenantName: "Selvi",
          tenantPhone: null,
          startDate: D("2025-02-01"),
          endDate: null,
          monthlyRent: 10_000,
          securityDeposit: 30_000,
          ...lease,
        },
      ],
    });

  it("a future-start lease → 'incoming': empty now, tenant shown as incoming, first rent as next payment", () => {
    const d = build(one({ startDate: D("2026-07-01") }));
    expect(d.units[0]).toMatchObject({
      status: "incoming",
      rentState: "none",
      activeLease: null,
      incomingLease: { id: "L", state: "incoming", startDate: ISO("2026-07-01") },
      depositHeld: 0,
      nextPayment: { label: "Jul 2026", dueDate: ISO("2026-07-05"), isOverdue: false },
    });
    expect(d.kpis).toMatchObject({ unitsOccupied: 0, unitsIncoming: 1, unitsVacant: 0, monthlyRentRoll: 0, securityDepositsHeld: 0, overdueAmount: 0 });
    // the gap before it is valued at the incoming rent
    expect(d.units[0].vacantPeriods).toEqual([
      expect.objectContaining({ start: ISO("2025-01-01"), ongoing: true, rentBasis: 10_000, rentBasisSource: "next-lease" }),
    ]);
  });

  it("the last day of tenancy is still occupied; the next day it's vacant", () => {
    const L = { endDate: D("2026-06-15") };
    let d = build(one(L), D("2026-06-15"));
    expect(d.units[0]).toMatchObject({ status: "occupied", activeLease: { id: "L", endDate: ISO("2026-06-15"), state: "current" } });
    expect(d.kpis).toMatchObject({ monthlyRentRoll: 10_000, securityDepositsHeld: 30_000 });
    d = buildDashboard(one(L), { asOf: D("2026-06-16"), today: D("2026-06-16"), now: NOW });
    expect(d.units[0]).toMatchObject({ status: "vacant", activeLease: null, rentState: "none", nextPayment: null });
    expect(d.kpis).toMatchObject({ monthlyRentRoll: 0, securityDepositsHeld: 0 });
    expect(d.deposits).toMatchObject({ awaitingRefund: 30_000, held: 0 }); // ended with no refund recorded
  });

  it("looking back into a lease that later ended shows it as current then", () => {
    const d = build(one({ endDate: D("2025-12-31") }), D("2025-06-01"));
    expect(d.units[0]).toMatchObject({ status: "occupied", activeLease: { endDate: ISO("2025-12-31"), state: "current" } });
  });

  it("deposits: partial refund → kept; the KPI holds only current leases' deposits", () => {
    const input = one({ endDate: D("2025-12-31"), depositRefundedAmount: 25_000, depositRefundDate: D("2026-01-05") });
    input.leases.push({ id: "L2", unitId: "u", tenantId: "t2", tenantName: "Ravi", tenantPhone: null, startDate: D("2026-01-01"), endDate: null, monthlyRent: 12_000, securityDeposit: 40_000 });
    const d = build(input);
    expect(d.deposits).toMatchObject({ received: 70_000, refunded: 25_000, kept: 5_000, awaitingRefund: 0, held: 40_000 });
    expect(d.kpis.securityDepositsHeld).toBe(40_000);
    // before the refund was recorded, the first deposit was awaiting refund
    expect(build(input, D("2026-01-02")).deposits).toMatchObject({ refunded: 0, kept: 0, awaitingRefund: 30_000, held: 40_000 });
  });
});

// ─────────────────────────────── show the maths ───────────────────────────────

describe("buildDashboard — explain map: the maths shown is the maths used", () => {
  const d = build(scenario());
  const K = d.kpis;
  const portfolio: Record<string, number | null> = {
    invested: K.invested,
    estimatedValue: K.currentValue,
    bestOffer: K.bestOfferSum,
    worthNow: K.bestOfferTotal,
    gain: K.appreciation,
    multiplier: K.capitalMultiplier,
    holdingYears: K.holdingYears,
    cagr: K.cagr,
    depositsHeld: K.securityDepositsHeld,
    totalReturn: K.totalReturn,
    perSqftBought: K.boughtAtPerSqft,
    perSqftOffered: K.offeredAtPerSqft,
    occupancy: K.occupancyPct,
    vacantDays: K.vacantDays,
    rentLost: K.unrealizedLoss,
    overdue: K.overdueAmount,
    rentRoll: K.monthlyRentRoll,
    rentCollected: K.rentCollected,
    expenses: K.totalExpenses,
    netCash: K.netProfit,
    collection: d.periods.allTime.collectionPct,
    "year:rentCollected": d.periods.year.rentCollected,
    "year:expenses": d.periods.year.expenses,
    "year:netCash": d.periods.year.net,
    "year:collection": d.periods.year.collectionPct,
    "month:rentCollected": d.periods.month.rentCollected,
    "month:expenses": d.periods.month.expenses,
    "month:netCash": d.periods.month.net,
    "month:collection": d.periods.month.collectionPct,
  };

  it("every portfolio KPI has an explanation whose value is the KPI", () => {
    for (const [key, value] of Object.entries(portfolio)) {
      expect(d.explain[key], key).toBeDefined();
      expect(d.explain[key].value, key).toBe(value);
      expect(d.explain[key].key).toBe(key);
    }
  });

  it("every unit figure has an explanation whose value is the card's figure", () => {
    for (const u of d.units) {
      const unitFigures: Record<string, number | null> = {
        worthNow: u.valuation,
        estimatedValue: u.currentValue,
        bestOffer: u.bestOffer,
        gain: u.appreciation,
        multiplier: u.capitalMultiplier,
        cagr: u.cagr,
        depositHeld: u.depositHeld,
        perSqftBought: u.boughtAtPerSqft,
        perSqftOffered: u.offeredAtPerSqft,
        occupancy: u.occupancyPct,
        vacantDays: u.vacantDays,
        rentLost: u.unrealizedLoss,
        overdue: u.activeLease ? (u.nextPayment?.arrears.totalWithFees ?? 0) : 0,
        rent: u.activeLease?.monthlyRent ?? 0,
        rentCollected: u.rentCollected,
        expenses: u.expenses,
        netCash: u.netCash,
        collection: u.periods.allTime.collectionPct,
        "year:rentCollected": u.periods.year.rentCollected,
        "month:collection": u.periods.month.collectionPct,
      };
      for (const [k, v] of Object.entries(unitFigures)) {
        const key = `unit:${u.id}:${k}`;
        expect(d.explain[key], key).toBeDefined();
        expect(d.explain[key].value, key).toBe(v);
      }
    }
  });

  it("the last step of every explanation is the figure itself", () => {
    for (const e of Object.values(d.explain)) {
      expect(e.steps.length, e.key).toBeGreaterThan(0);
      expect(e.steps.at(-1)?.value, e.key).toBe(e.value);
      expect(e.plain.length, e.key).toBeGreaterThan(10);
      expect(e.formula.length, e.key).toBeGreaterThan(3);
    }
  });

  it("sum explanations list records that add up to the figure", () => {
    const sumInputs = (key: string) => round2x(d.explain[key].inputs.reduce((s, i) => s + (i.value ?? 0), 0));
    expect(sumInputs("rentCollected")).toBe(K.rentCollected);
    expect(sumInputs("expenses")).toBe(K.totalExpenses);
    expect(sumInputs("invested")).toBe(K.invested);
    expect(sumInputs("rentRoll")).toBe(K.monthlyRentRoll);
    expect(d.explain.rentCollected.inputs.map((i) => i.kind)).toEqual(["payment", "payment", "payment"]);
  });

  it("worth now: substitutes real numbers in Indian format and notes the estimate", () => {
    const e = d.explain.worthNow;
    expect(e).toMatchObject({ title: "Worth now (est.)", bucket: "value", scope: "As of 15/6/2026", format: "inr" });
    expect(e.steps.map((s) => s.expression)).toEqual([
      "₹72,00,000",
      "₹40,00,000 × (1 + 5%)^8.00 = ₹59,09,822",
      "₹72,00,000 + ₹59,09,822 = ₹1,31,09,822",
    ]);
    expect(e.notes[0]).toBe("Back House has no offer yet — we used its estimated value (₹59,09,822 at 5%/yr) instead.");
  });

  it("CAGR: years held → growth → yearly rate", () => {
    expect(d.explain.cagr.steps.map((s) => s.label)).toEqual(["Front House held", "Back House held", "Weighted by price", "Growth", "Per year"]);
    expect(d.explain.cagr.steps[2].expression).toBe("(₹50,00,000 × 4.00 + ₹40,00,000 × 8.00) ÷ ₹90,00,000 = 5.78");
  });

  it("overdue: month by month (a long run's oldest months collapse into one line), then late fees", () => {
    const steps = d.explain.overdue.steps;
    // 15 overdue months → the oldest 4 (Mar – Jun 2025) in one line + the latest 11 one by one
    expect(steps[0]).toEqual({ label: "Front House · Mar 2025 – Jun 2025", expression: "4 months unpaid or part-paid = ₹1,00,000", value: 100_000, format: "inr" });
    expect(steps[1]).toEqual({ label: "Front House · Jul 2025 (due 5/7/2025)", expression: "₹25,000 unpaid", value: 25_000, format: "inr" });
    expect(steps).toHaveLength(1 + 11 + 3);
    expect(steps.slice(-3).map((s) => s.expression)).toEqual(["₹3,75,000", "15 months × ₹500 = ₹7,500", "₹3,75,000 + ₹7,500 = ₹3,82,500"]);
    // part-paid months show the subtraction
    const input = scenario();
    input.payments.push({ id: "pp", leaseId: "L1", amount: 10_000, paymentDate: D("2025-03-07"), periodMonth: 3, periodYear: 2025, invoiceSeq: 7, invoiceNumber: "PE-2025-0007" });
    const part = build(input, D("2025-03-20"));
    expect(part.explain.overdue.steps.map((x) => x.expression)).toEqual([
      "₹25,000 − ₹10,000 paid = ₹15,000",
      "1 month × ₹500 = ₹500",
      "₹15,000 + ₹500 = ₹15,500",
    ]);
    expect(part.kpis.overdueAmount).toBe(15_500);
  });

  it("rent lost: each gap × rent ÷ 30", () => {
    expect(d.explain.rentLost.steps[0].expression).toBe("940 days × ₹25,000 ÷ 30 = ₹7,83,333");
    expect(d.explain.rentLost.notes).toContain("Before the first lease we used the first tenant's rent.");
  });

  it("CAGR under 1 year → null with the reason", () => {
    const x = build(empty({ units: [unit({ id: "n", name: "New", purchaseDate: D("2026-01-01") })] }));
    expect(x.kpis.cagr).toBeNull();
    expect(x.kpis.cagrNote).toMatch(/^Held under 1 year/);
    expect(x.explain.cagr.value).toBeNull();
    expect(x.explain.cagr.notes[0]).toMatch(/^Held under 1 year/);
    expect(x.units[0]).toMatchObject({ cagr: null, cagrNote: expect.stringMatching(/^Held under 1 year/) });
  });
});

// ─────────────────────────────── reconciliation + timeline ───────────────────────────────

describe("buildDashboard — reconciliation", () => {
  it("every check balances on a consistent ledger", () => {
    const d = build(scenario());
    expect(d.checks.ledgerBalanced).toBe(true);
    expect(d.checks.items.map((i) => i.key)).toEqual([
      "expensesByUnit",
      "expensesByCategory",
      "rentByLease",
      "rentByUnit",
      "incomeByYear",
      "expensesByYear",
      "monthsToYears",
      "netCash",
      "worthByUnit",
      "deposits",
      "arrears",
    ]);
    expect(d.checks.items[0]).toEqual({ key: "expensesByUnit", label: "Unit expenses + whole-plot expenses = total expenses", expected: 16_820.75, actual: 16_820.75, ok: true });
  });

  it("an expense tagged to a unit that isn't on the dashboard shows as not balanced", () => {
    const input = scenario();
    input.expenses.push({ id: "eX", unitId: "ghost", categoryId: "maint", expenseDate: D("2026-01-01"), amount: 999 });
    const d = build(input);
    expect(d.checks.ledgerBalanced).toBe(false);
    expect(d.checks.items.find((i) => !i.ok)).toMatchObject({ key: "expensesByUnit", expected: 17_819.75, actual: 16_820.75 });
  });

  it("recon / reconciliation helpers", () => {
    expect(recon("x", "X", 10, 10.004)).toMatchObject({ ok: true, actual: 10 });
    expect(reconciliation([recon("a", "A", 1, 1), recon("b", "B", 1, 2)]).ledgerBalanced).toBe(false);
  });
});

describe("buildDashboard — timeline", () => {
  const d = build(scenario());
  it("range = earliest purchase → today, units with leases and vacancies", () => {
    expect(d.timeline.range).toEqual({ start: ISO("2018-06-15"), end: ISO("2026-06-15") });
    expect(d.timeline.units.map((u) => [u.unitId, u.leases.length, u.vacant.length])).toEqual([
      ["uA", 1, 1],
      ["uB", 0, 1],
    ]);
    expect(d.timeline.units[0].leases[0]).toEqual({ leaseId: "L1", tenantId: "t1", tenantName: "Ravi Kumar", start: ISO("2025-01-10"), end: null, monthlyRent: 25_000, state: "current" });
  });

  it("markers sorted by date (purchases, lease starts / last days, offers, big expenses)", () => {
    expect(d.timeline.markers.map((m) => [m.date.slice(0, 10), m.kind])).toEqual([
      ["2018-06-15", "purchase"],
      ["2022-06-15", "purchase"],
      ["2025-01-10", "lease-start"],
      ["2026-01-10", "offer"],
      ["2026-03-01", "offer"],
      ["2026-05-01", "offer"],
    ]); // both expenses are under ₹20,000
  });

  it("year ticks follow the year mode", () => {
    expect(d.timeline.yearTicks[0]).toEqual({ key: 2019, label: "FY 2019-20", date: ISO("2019-04-01") });
    expect(d.timeline.yearTicks.at(-1)?.label).toBe("FY 2026-27");
    expect(build(scenario(), TODAY, "calendar").timeline.yearTicks[0]).toEqual({ key: 2019, label: "2019", date: ISO("2019-01-01") });
  });
});

// ─────────────────────────────── inactive units ───────────────────────────────

describe("buildDashboard — inactive units are listed but excluded from portfolio totals", () => {
  const input = scenario();
  // Unit C: inactive (sold), positioned front, created before everything, with a big offer, an ended lease
  // (1/1/2016 – last day 1/3/2016), one 10,000 payment and a 1,000 expense.
  input.units.push(
    unit({
      id: "uC",
      name: "Old Shop",
      position: "front",
      isActive: false,
      builtUpSqft: 500,
      purchaseDate: D("2015-01-01"),
      purchasePrice: 2_000_000,
      annualAppreciationRate: 10,
      createdAt: new Date("2020-01-01T00:00:00Z"),
    }),
  );
  input.offers.push({ id: "oC", unitId: "uC", amount: 9_999_999, offerDate: D("2026-01-01") });
  input.leases.push({
    id: "LC",
    unitId: "uC",
    tenantId: "t2",
    tenantName: "Meena",
    tenantPhone: null,
    startDate: D("2016-01-01"),
    endDate: D("2016-03-01"),
    monthlyRent: 10_000,
    securityDeposit: 50_000,
  });
  input.payments.push({ id: "pC", leaseId: "LC", amount: 10_000, paymentDate: D("2016-01-05"), periodMonth: 1, periodYear: 2016, invoiceSeq: 9, invoiceNumber: "PE-2016-0009" });
  input.expenses.push({ id: "eC", unitId: "uC", categoryId: "util", expenseDate: D("2016-02-01"), amount: 1_000 });
  const d = build(input);

  it("lists the inactive unit last, flagged", () => {
    expect(d.units.map((u) => u.id)).toEqual(["uA", "uB", "uC"]);
    expect(d.units[2]).toMatchObject({ isActive: false, status: "inactive", rentState: "none", bestOffer: 9_999_999, rentCollected: 10_000 });
  });

  it("keeps valuation / sqft / vacancy totals to active units", () => {
    expect(d.kpis).toMatchObject({
      unitsActive: 2,
      invested: 9_000_000,
      bestOfferTotal: 13_109_822,
      appreciation: 4_109_822,
      totalBuiltUpSqft: 2200,
      occupancyPct: 0.118868,
      vacantDays: 3862,
      unrealizedLoss: 783_333,
      securityDepositsHeld: 100_000, // C's lease has ended
    });
    expect(d.vacancy.units.map((u) => u.unitId)).toEqual(["uA", "uB"]);
    expect(d.explain.invested.notes).toContain("Old Shop is marked inactive and left out of this total.");
  });

  it("but rent and expenses count every row ever recorded", () => {
    expect(d.kpis.rentCollected).toBe(85_000); // 75,000 + 10,000
    expect(d.kpis.totalExpenses).toBe(17_820.75); // 16,820.75 + 1,000
    expect(d.kpis.netProfit).toBe(67_179.25);
    expect(d.kpis.totalReturn).toBe(4_194_822); // 41,09,822 + 85,000
    expect(d.monthlyByYear[0].label).toBe("FY 2014-15"); // C bought 1/1/2015
    expect(d.monthlyByYear.at(-1)?.label).toBe("FY 2026-27");
    expect(d.cumulativeNetByYear.at(-1)?.cumulative).toBe(67_179.25);
    expect(d.expenseComposition.byYear.map((y) => y.year)).toEqual(d.monthlyByYear.map((y) => y.year));
    // the ended lease's deposit was never marked refunded
    expect(d.deposits).toMatchObject({ received: 150_000, held: 100_000, awaitingRefund: 50_000 });
    expect(d.checks.ledgerBalanced).toBe(true);
  });
});

// ─────────────────────────────── ordering / lists ───────────────────────────────

describe("buildDashboard — ordering", () => {
  it("units: active first; front, back, unpositioned, then createdAt", () => {
    const at = (s: string) => new Date(`${s}T00:00:00Z`);
    const d = build(
      empty({
        units: [
          unit({ id: "u1", name: "1", position: null, createdAt: at("2026-01-01") }),
          unit({ id: "u2", name: "2", position: "back", createdAt: at("2026-03-01") }),
          unit({ id: "u3", name: "3", position: "front", isActive: false, createdAt: at("2025-01-01") }),
          unit({ id: "u4", name: "4", position: "front", createdAt: at("2026-05-01") }),
          unit({ id: "u5", name: "5", position: null, createdAt: at("2025-12-01") }),
          unit({ id: "u6", name: "6", position: null, isActive: false, createdAt: at("2024-01-01") }),
        ],
      }),
    );
    expect(d.units.map((u) => u.id)).toEqual(["u4", "u2", "u5", "u1", "u3", "u6"]);
  });

  it("pending actions: due date asc (undated last), then priority, then title", () => {
    const a = (id: string, priority: ActionInput["priority"], due: string | null, isDone = false): ActionInput => ({
      id,
      title: `Task ${id}`,
      priority,
      dueDate: due ? D(due) : null,
      isDone,
      unitId: null,
    });
    const d = build(
      empty({
        actions: [
          a("n1", "Low", null),
          a("late", "Low", "2026-06-01"),
          a("todayLow", "Low", "2026-06-15"),
          a("todayHigh", "High", "2026-06-15"),
          a("n2", "High", null),
          a("done", "High", "2020-01-01", true),
        ],
      }),
    );
    expect(d.actions.pending.map((x) => [x.id, x.isOverdue])).toEqual([
      ["late", true],
      ["todayHigh", false], // due today is not overdue
      ["todayLow", false],
      ["n2", false],
      ["n1", false],
    ]);
    expect(d.kpis.pendingActions).toBe(5);
  });

  it("recent payments: latest 8 by payment date, then invoice number", () => {
    const input = scenario();
    input.payments = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i + 1}`,
      leaseId: "L1",
      amount: 25_000,
      // p1..p10 paid on the 1st of consecutive months, except p9 and p10 both on 1/12/2025
      paymentDate: i >= 8 ? D("2025-12-01") : D(`2025-${String(i + 2).padStart(2, "0")}-01`),
      periodMonth: i + 1,
      periodYear: 2025,
      invoiceSeq: i + 1,
      invoiceNumber: `PE-2025-${String(i + 1).padStart(4, "0")}`,
    }));
    const d = build(input);
    expect(d.recentPayments.map((p) => p.id)).toEqual(["p10", "p9", "p8", "p7", "p6", "p5", "p4", "p3"]);
  });

  it("the legacy positional form buildDashboard(input, today, now) still works", () => {
    expect(buildDashboard(scenario(), TODAY, NOW)).toEqual(build(scenario()));
  });
});

// ─────────────────────────────── empty database ───────────────────────────────

describe("buildDashboard — empty database", () => {
  const d = build(empty());

  it("all zeros / nulls", () => {
    expect(d.kpis).toEqual({
      unitsActive: 0,
      unitsOccupied: 0,
      unitsVacant: 0,
      unitsIncoming: 0,
      invested: 0,
      currentValue: 0,
      bestOfferTotal: 0,
      bestOfferIsPartialEstimate: false,
      bestOfferSum: null,
      unitsWithOffer: 0,
      appreciation: 0,
      capitalMultiplier: null,
      cagr: null,
      cagrNote: "Nothing invested yet",
      holdingYears: 0,
      rentCollected: 0,
      totalExpenses: 0,
      wholePlotExpenses: 0,
      netProfit: 0,
      securityDepositsHeld: 0,
      totalReturn: 0,
      totalBuiltUpSqft: 0,
      boughtAtPerSqft: null,
      offeredAtPerSqft: null,
      occupancyPct: 0,
      vacantDays: 0,
      unrealizedLoss: 0,
      monthlyRentRoll: 0,
      overdueCount: 0,
      overdueMonths: 0,
      arrearsTotal: 0,
      lateFeesTotal: 0,
      overdueAmount: 0,
      pendingActions: 0,
    });
    expect(d.units).toEqual([]);
    expect(d.unitsNotYetOwned).toEqual([]);
    expect(d.vacancy).toEqual({ totalVacantDays: 0, totalUnrealizedLoss: 0, occupancyPct: 0, units: [] });
    expect(d.actions.pending).toEqual([]);
    expect(d.recentPayments).toEqual([]);
    expect(d.expenseComposition).toEqual({
      allTime: [],
      byYear: [{ year: 2026, label: "FY 2026-27", slices: [] }],
      month: [],
      byUnit: [{ unitId: null, unitName: "Whole plot", amount: 0, slices: [] }],
    });
    expect(d.plot.usingDefaults).toBe(true);
    expect(d.checks.ledgerBalanced).toBe(true);
    expect(d.timeline).toEqual({ range: { start: null, end: ISO("2026-06-15") }, units: [], markers: [], yearTicks: [] });
    expect(d.periods.allTime).toMatchObject({ rentCollected: 0, rentExpected: 0, collectionPct: null, expenses: 0, net: 0 });
  });

  it("still charts the current year", () => {
    expect(d.monthlyByYear).toHaveLength(1);
    expect(d.monthlyByYear[0]).toMatchObject({ year: 2026, label: "FY 2026-27", income: 0, expenses: 0, net: 0 });
    expect(d.monthlyByYear[0].months).toHaveLength(12);
    expect(d.cumulativeNetByYear).toEqual([{ year: 2026, label: "FY 2026-27", net: 0, cumulative: 0 }]);
  });

  it("contains no NaN / Infinity anywhere", () => {
    expectAllFinite(d);
    expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
  });

  it("a unit bought today has 0 days owned and no division by zero", () => {
    const out = build(empty({ units: [unit({ id: "u", name: "New", purchaseDate: TODAY, builtUpSqft: 0 })] }));
    expect(out.units[0]).toMatchObject({ daysOwned: 0, occupancyPct: 0, yearsHeld: 0, currentValue: 1_000_000, appreciation: 0, capitalMultiplier: 1, cagr: null });
    expect(out.kpis).toMatchObject({ cagr: null, capitalMultiplier: 1, boughtAtPerSqft: null, offeredAtPerSqft: null, occupancyPct: 0 });
    expectAllFinite(out);
  });
});
