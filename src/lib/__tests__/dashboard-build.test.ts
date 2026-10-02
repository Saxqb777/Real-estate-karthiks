// End-to-end tests for the pure buildDashboard(): a full hand-computed scenario, inactive units,
// ordering, actions, recent payments and the empty database (no NaN / Infinity anywhere).
import { describe, expect, it } from "vitest";
import {
  buildDashboard,
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

describe("buildDashboard — full scenario (2 units, 1 tenant, 1 lease, 3 payments, 2 expenses)", () => {
  const d = buildDashboard(scenario(), TODAY, NOW);
  const [A, B] = d.units;

  it("asserts every KPI", () => {
    expect(d.kpis).toEqual({
      unitsActive: 2,
      unitsOccupied: 1, // A has an active lease
      invested: 9_000_000, // 50,00,000 + 40,00,000
      currentValue: 12_712_266.58, // 50L × 1.08⁴ = 68,02,444.80  +  40L × 1.05⁸ = 59,09,821.78
      bestOfferTotal: 13_109_821.78, // A offer 72,00,000 + B estimate 59,09,821.78
      bestOfferIsPartialEstimate: true, // B has no offer
      appreciation: 4_109_821.78, // (72,00,000 − 50,00,000) + (59,09,821.78 − 40,00,000) = 22,00,000 + 19,09,821.78
      capitalMultiplier: 1.456647, // 1,31,09,821.78 / 90,00,000
      cagr: 0.067266, // 1.4566468644 ^ (1 / 5.7778) − 1
      holdingYears: 5.777778, // (50L × 4 + 40L × 8) / 90L = 52/9
      rentCollected: 75_000, // 3 × 25,000
      totalExpenses: 16_820.75, // 12,500.50 + 4,320.25
      netProfit: 58_179.25, // 75,000 − 16,820.75
      securityDepositsHeld: 100_000,
      totalReturn: 4_184_821.78, // 41,09,821.78 + 75,000
      totalBuiltUpSqft: 2200, // 1,200 + 1,000
      boughtAtPerSqft: 4090.91, // 90,00,000 / 2,200 = 4,090.909…
      offeredAtPerSqft: 5959.01, // 1,31,09,821.78 / 2,200 = 5,959.0099
      occupancyPct: 0.118868, // occupied 521 / owned (1,461 + 2,922 = 4,383)
      vacantDays: 3862, // A 940 + B 2,922
      unrealizedLoss: 783_333.33, // A: 940 × 25,000 / 30 = 7,83,333.33; B never leased → 0
      monthlyRentRoll: 25_000,
      overdueCount: 1, // June 2026 rent due 5/6, today 15/6
      overdueAmount: 25_500, // 25,000 + 500 late fee (10 days late > 3 grace)
      pendingActions: 2,
    });
  });

  it("stamps dates, settings and plot", () => {
    expect(d.generatedAt).toBe("2026-06-15T04:30:00.000Z");
    expect(d.today).toBe(ISO("2026-06-15"));
    expect(d.settings).toEqual({
      brandName: "Pattukottai Estates",
      subtitle: "Two townhouses",
      currency: "INR",
      rentDueDay: 5,
      lateFeeEnabled: true,
      lateFeeAmount: 500,
      lateFeeGraceDays: 3,
    });
    expect(d.plot).toEqual({
      frontWidthFt: 22.25,
      backWidthFt: 23.25,
      depthFt: 76.66,
      areaSqft: 1744.02,
      townName: "Pattukottai",
      sitePlanImageUrl: null,
      usingDefaults: true,
    });
  });

  it("unit A (front, occupied, overdue, valued at its best offer)", () => {
    expect(d.units.map((u) => u.id)).toEqual(["uA", "uB"]); // front before back, despite B being created first
    expect(A).toEqual({
      id: "uA",
      name: "Front House",
      type: "Townhouse",
      position: "front",
      floors: 2,
      isActive: true,
      status: "occupied",
      rentState: "overdue",
      builtUpSqft: 1200,
      footprintWidthFt: 20,
      footprintDepthFt: 28,
      purchaseDate: ISO("2022-06-15"),
      purchasePrice: 5_000_000,
      annualAppreciationRate: 8,
      yearsHeld: 4, // 1,461 / 365.25
      currentValue: 6_802_444.8, // 50,00,000 × 1.36048896
      bestOffer: 7_200_000,
      bestOfferDate: ISO("2026-05-01"), // tie with 10/1/2026 → most recent
      valuation: 7_200_000,
      valuationSource: "offer",
      appreciation: 2_200_000,
      appreciationPct: 0.44, // 22,00,000 / 50,00,000
      rentCollected: 75_000,
      expenses: 12_500.5,
      occupancyPct: 0.356605, // 521 / 1,461
      daysOwned: 1461,
      daysOccupied: 521, // 10/1/2025 → 15/6/2026
      vacantPeriods: [
        // 15/6/2022 → 10/1/2025 = 365 + 366 + 209 = 940 days, before the first lease → next lease's rent
        { start: ISO("2022-06-15"), end: ISO("2025-01-10"), days: 940, rentBasis: 25_000, unrealizedLoss: 783_333.33, noRentHistory: false },
      ],
      vacantDays: 940,
      unrealizedLoss: 783_333.33,
      activeLease: {
        id: "L1",
        tenantId: "t1",
        tenantName: "Ravi Kumar",
        tenantPhone: "9876543210",
        startDate: ISO("2025-01-10"),
        monthlyRent: 25_000,
        securityDeposit: 100_000,
      },
      nextPayment: {
        leaseId: "L1",
        dueDate: ISO("2026-06-05"), // month after May 2026, on the 5th
        periodMonth: 6,
        periodYear: 2026,
        amountDue: 25_500,
        isOverdue: true,
        daysOverdue: 10,
        lateFeeApplied: true,
        lateFee: 500,
      },
      electricityConsumerNumber: "04-123-456",
      electricityPayUrl: "https://www.tnebltd.gov.in/",
    });
  });

  it("unit B (back, vacant since purchase, valued at its estimate)", () => {
    expect(B).toMatchObject({
      id: "uB",
      position: "back",
      status: "vacant",
      rentState: "none",
      yearsHeld: 8, // 2,922 / 365.25
      currentValue: 5_909_821.78, // 40,00,000 × 1.05⁸
      bestOffer: null,
      bestOfferDate: null,
      valuation: 5_909_821.78,
      valuationSource: "estimate",
      appreciation: 1_909_821.78,
      appreciationPct: 0.477455, // 19,09,821.78 / 40,00,000
      rentCollected: 0,
      expenses: 4_320.25, // the Property Tax expense is tagged to B
      occupancyPct: 0,
      daysOwned: 2922,
      daysOccupied: 0,
      vacantDays: 2922,
      unrealizedLoss: 0,
      activeLease: null,
      nextPayment: null,
    });
    expect(B.vacantPeriods).toEqual([
      { start: ISO("2018-06-15"), end: ISO("2026-06-15"), days: 2922, rentBasis: 0, unrealizedLoss: 0, noRentHistory: true },
    ]);
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
      totalUnrealizedLoss: 783_333.33,
      occupancyPct: 0.118868,
      units: [
        { unitId: "uA", unitName: "Front House", vacantDays: 940, unrealizedLoss: 783_333.33, periods: A.vacantPeriods, noRentHistory: false },
        { unitId: "uB", unitName: "Back House", vacantDays: 2922, unrealizedLoss: 0, periods: B.vacantPeriods, noRentHistory: true },
      ],
    });
  });

  it("monthly income vs expenses and cumulative net", () => {
    expect(d.monthlyByYear.map((y) => [y.year, y.income, y.expenses, y.net])).toEqual([
      [2025, 50_000, 12_500.5, 37_499.5],
      [2026, 25_000, 4_320.25, 20_679.75],
    ]);
    expect(d.monthlyByYear[0].months.slice(0, 3)).toEqual([
      { month: 1, label: "Jan", income: 25_000, expenses: 0, net: 25_000, cumulative: 25_000 },
      { month: 2, label: "Feb", income: 25_000, expenses: 0, net: 25_000, cumulative: 50_000 },
      { month: 3, label: "Mar", income: 0, expenses: 12_500.5, net: -12_500.5, cumulative: 37_499.5 },
    ]);
    expect(d.monthlyByYear[1].months[4]).toMatchObject({ label: "May", income: 25_000, cumulative: 20_679.75 });
    expect(d.cumulativeNetByYear).toEqual([
      { year: 2025, net: 37_499.5, cumulative: 37_499.5 },
      { year: 2026, net: 20_679.75, cumulative: 58_179.25 },
    ]);
  });

  it("expense composition, all time and by year", () => {
    expect(d.expenseComposition.allTime).toEqual([
      { categoryId: "maint", name: "Maintenance", color: "#4F9DFF", amount: 12_500.5, share: 0.743159 }, // 12,500.50 / 16,820.75
      { categoryId: "tax", name: "Property Tax", color: "#EF4444", amount: 4_320.25, share: 0.256841 },
    ]);
    expect(d.expenseComposition.byYear).toEqual([
      { year: 2025, slices: [{ categoryId: "maint", name: "Maintenance", color: "#4F9DFF", amount: 12_500.5, share: 1 }] },
      { year: 2026, slices: [{ categoryId: "tax", name: "Property Tax", color: "#EF4444", amount: 4_320.25, share: 1 }] },
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

  it("is JSON-safe: no NaN / Infinity", () => {
    expectAllFinite(d);
    expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
  });

  it("all units with offers → not a partial estimate", () => {
    const input = scenario();
    input.offers.push({ id: "o4", unitId: "uB", amount: 6_000_000, offerDate: D("2026-06-01") });
    const k = buildDashboard(input, TODAY, NOW).kpis;
    expect(k.bestOfferIsPartialEstimate).toBe(false);
    expect(k.bestOfferTotal).toBe(13_200_000); // 72,00,000 + 60,00,000
    expect(k.capitalMultiplier).toBe(1.466667); // 1,32,00,000 / 90,00,000
  });

  it("paying June clears the overdue and the due-soon window drives rentState", () => {
    const input = scenario();
    input.payments.push({ id: "p4", leaseId: "L1", amount: 25_000, paymentDate: D("2026-06-14"), periodMonth: 6, periodYear: 2026, invoiceSeq: 4, invoiceNumber: "PE-2026-0004" });
    let out = buildDashboard(input, TODAY, NOW);
    // next = July, due 5/7/2026 → 20 days away → "paid"
    expect(out.units[0]).toMatchObject({ rentState: "paid", nextPayment: { dueDate: ISO("2026-07-05"), isOverdue: false, amountDue: 25_000 } });
    expect(out.kpis).toMatchObject({ overdueCount: 0, overdueAmount: 0, rentCollected: 100_000 });
    // on 30/6 the July rent is 5 days away → "due-soon"
    out = buildDashboard(input, D("2026-06-30"), NOW);
    expect(out.units[0].rentState).toBe("due-soon");
  });
});

// ─────────────────────────────── inactive units ───────────────────────────────

describe("buildDashboard — inactive units are listed but excluded from portfolio totals", () => {
  const input = scenario();
  // Unit C: inactive (sold), positioned front, created before everything, with a big offer, an ended lease,
  // one 10,000 payment and a 1,000 expense.
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
  const d = buildDashboard(input, TODAY, NOW);

  it("lists the inactive unit last, flagged", () => {
    expect(d.units.map((u) => u.id)).toEqual(["uA", "uB", "uC"]);
    expect(d.units[2]).toMatchObject({ isActive: false, status: "inactive", rentState: "none", bestOffer: 9_999_999, rentCollected: 10_000 });
  });

  it("keeps valuation / sqft / vacancy totals to active units", () => {
    expect(d.kpis).toMatchObject({
      unitsActive: 2,
      invested: 9_000_000,
      bestOfferTotal: 13_109_821.78,
      appreciation: 4_109_821.78,
      totalBuiltUpSqft: 2200,
      occupancyPct: 0.118868,
      vacantDays: 3862,
      unrealizedLoss: 783_333.33,
      securityDepositsHeld: 100_000, // C's lease has ended
    });
    expect(d.vacancy.units.map((u) => u.unitId)).toEqual(["uA", "uB"]);
  });

  it("but rent and expenses count every row ever recorded", () => {
    expect(d.kpis.rentCollected).toBe(85_000); // 75,000 + 10,000
    expect(d.kpis.totalExpenses).toBe(17_820.75); // 16,820.75 + 1,000
    expect(d.kpis.netProfit).toBe(67_179.25);
    expect(d.kpis.totalReturn).toBe(4_194_821.78); // 41,09,821.78 + 85,000
    expect(d.monthlyByYear.map((y) => y.year)).toEqual([2016, 2025, 2026]);
    expect(d.cumulativeNetByYear.at(-1)?.cumulative).toBe(67_179.25);
    expect(d.expenseComposition.byYear.map((y) => y.year)).toEqual([2016, 2025, 2026]);
  });
});

// ─────────────────────────────── ordering / lists ───────────────────────────────

describe("buildDashboard — ordering", () => {
  it("units: active first; front, back, unpositioned, then createdAt", () => {
    const at = (s: string) => new Date(`${s}T00:00:00Z`);
    const d = buildDashboard(
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
      TODAY,
      NOW,
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
    const d = buildDashboard(
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
      TODAY,
      NOW,
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
    const d = buildDashboard(input, TODAY, NOW);
    expect(d.recentPayments.map((p) => p.id)).toEqual(["p10", "p9", "p8", "p7", "p6", "p5", "p4", "p3"]);
  });
});

// ─────────────────────────────── empty database ───────────────────────────────

describe("buildDashboard — empty database", () => {
  const d = buildDashboard(empty(), TODAY, NOW);

  it("all zeros / nulls", () => {
    expect(d.kpis).toEqual({
      unitsActive: 0,
      unitsOccupied: 0,
      invested: 0,
      currentValue: 0,
      bestOfferTotal: 0,
      bestOfferIsPartialEstimate: false,
      appreciation: 0,
      capitalMultiplier: null,
      cagr: null,
      holdingYears: 0,
      rentCollected: 0,
      totalExpenses: 0,
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
      overdueAmount: 0,
      pendingActions: 0,
    });
    expect(d.units).toEqual([]);
    expect(d.vacancy).toEqual({ totalVacantDays: 0, totalUnrealizedLoss: 0, occupancyPct: 0, units: [] });
    expect(d.actions.pending).toEqual([]);
    expect(d.recentPayments).toEqual([]);
    expect(d.expenseComposition).toEqual({ allTime: [], byYear: [{ year: 2026, slices: [] }] });
    expect(d.plot.usingDefaults).toBe(true);
  });

  it("still charts the current year", () => {
    expect(d.monthlyByYear).toHaveLength(1);
    expect(d.monthlyByYear[0]).toMatchObject({ year: 2026, income: 0, expenses: 0, net: 0 });
    expect(d.monthlyByYear[0].months).toHaveLength(12);
    expect(d.cumulativeNetByYear).toEqual([{ year: 2026, net: 0, cumulative: 0 }]);
  });

  it("contains no NaN / Infinity anywhere", () => {
    expectAllFinite(d);
    expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
  });

  it("a unit bought today has 0 days owned and no division by zero", () => {
    const out = buildDashboard(empty({ units: [unit({ id: "u", name: "New", purchaseDate: TODAY, builtUpSqft: 0 })] }), TODAY, NOW);
    expect(out.units[0]).toMatchObject({ daysOwned: 0, occupancyPct: 0, yearsHeld: 0, currentValue: 1_000_000, appreciation: 0 });
    expect(out.kpis).toMatchObject({ cagr: null, capitalMultiplier: 1, boughtAtPerSqft: null, offeredAtPerSqft: null, occupancyPct: 0 });
    expectAllFinite(out);
  });
});
