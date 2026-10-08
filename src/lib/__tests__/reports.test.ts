// Reports (src/lib/reports.ts): annual statement, unit report and rent ledger. They are built from the same
// calculations as the dashboard, so every total must equal the dashboard's figure for the same scope and date.
import { describe, expect, it } from "vitest";
import {
  buildDashboard,
  type DashboardInput,
  type ExpenseInput,
  type LeaseInput,
  type PaymentInput,
  type SettingsInput,
  type UnitInput,
} from "../calculations";
import { buildAnnualReport, buildRentLedger, buildUnitReport } from "../reports";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ISO = (s: string) => `${s}T00:00:00.000Z`;
const TODAY = D("2026-10-02");
const NOW = new Date("2026-10-02T04:30:00.000Z");
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

const settings: SettingsInput = {
  brandName: "Pattukottai Estates",
  subtitle: null,
  currency: "INR",
  rentDueDay: 5,
  lateFeeEnabled: true,
  lateFeeAmount: 500,
  lateFeeGraceDays: 5,
};

const unit = (over: Partial<UnitInput> & Pick<UnitInput, "id" | "name">): UnitInput => ({
  type: "Townhouse",
  position: null,
  floors: 2,
  isActive: true,
  builtUpSqft: 1120,
  footprintWidthFt: 20,
  footprintDepthFt: 28,
  purchaseDate: D("2019-06-15"),
  purchasePrice: 3_850_000,
  annualAppreciationRate: 7.5,
  electricityConsumerNumber: null,
  electricityPayUrl: null,
  createdAt: new Date("2019-06-15T00:00:00Z"),
  ...over,
});

const leases: LeaseInput[] = [
  {
    id: "A1",
    unitId: "A",
    tenantId: "murugan",
    tenantName: "Murugan Selvaraj",
    tenantPhone: null,
    startDate: D("2019-08-01"),
    endDate: D("2023-05-31"),
    monthlyRent: 9_500,
    securityDeposit: 50_000,
    depositRefundedAmount: 45_000,
    depositRefundDate: D("2023-06-06"),
  },
  {
    id: "B1",
    unitId: "B",
    tenantId: "karthi",
    tenantName: "Karthikeyan Ramasamy",
    tenantPhone: null,
    startDate: D("2021-07-01"),
    endDate: D("2025-04-30"),
    monthlyRent: 11_000,
    securityDeposit: 60_000,
    depositRefundedAmount: 60_000,
    depositRefundDate: D("2025-05-03"),
  },
  {
    id: "A2",
    unitId: "A",
    tenantId: "lakshmi",
    tenantName: "Lakshmi Narayanan",
    tenantPhone: "+91 90036 42871",
    startDate: D("2023-09-01"),
    endDate: null,
    monthlyRent: 12_500,
    securityDeposit: 75_000,
  },
];

/** One full payment per month [from, to] (inclusive), paid on the 5th. */
function monthly(leaseId: string, rent: number, from: [number, number], to: [number, number], seq: { n: number }): PaymentInput[] {
  const out: PaymentInput[] = [];
  for (let i = from[0] * 12 + from[1] - 1; i <= to[0] * 12 + to[1] - 1; i++) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    seq.n++;
    out.push({
      id: `${leaseId}-${y}-${m}`,
      leaseId,
      amount: rent,
      paymentDate: D(`${y}-${String(m).padStart(2, "0")}-05`),
      periodMonth: m,
      periodYear: y,
      invoiceSeq: seq.n,
      invoiceNumber: `PE-${y}-${String(seq.n).padStart(4, "0")}`,
    });
  }
  return out;
}

function fixture(): DashboardInput {
  const seq = { n: 0 };
  const payments = [
    ...monthly("A1", 9_500, [2019, 8], [2023, 5], seq),
    ...monthly("B1", 11_000, [2021, 7], [2025, 4], seq),
    ...monthly("A2", 12_500, [2023, 9], [2026, 6], seq),
    // July 2026 part-paid; August and September 2026 not paid
    { id: "A2-part", leaseId: "A2", amount: 10_000, paymentDate: D("2026-07-18"), periodMonth: 7, periodYear: 2026, invoiceSeq: 999, invoiceNumber: "PE-2026-0999" },
  ];
  const expenses: ExpenseInput[] = [
    { id: "e1", unitId: "A", categoryId: "renov", expenseDate: D("2019-07-08"), amount: 125_000, description: "Repainting" },
    { id: "e2", unitId: "B", categoryId: "renov", expenseDate: D("2021-04-18"), amount: 92_000, description: "Bathroom retiling" },
    { id: "e3", unitId: null, categoryId: "prof", expenseDate: D("2024-07-12"), amount: 6_500, description: "Auditor" },
    { id: "e4", unitId: "B", categoryId: "renov", expenseDate: D("2025-06-12"), amount: 54_000, description: "Terrace waterproofing" },
    { id: "e5", unitId: null, categoryId: "maint", expenseDate: D("2025-09-17"), amount: 5_800, description: "Coconut tree trimming" },
    { id: "e6", unitId: "A", categoryId: "maint", expenseDate: D("2026-01-24"), amount: 4_200, description: "Geyser repair" },
    { id: "e7", unitId: "B", categoryId: "util", expenseDate: D("2026-02-18"), amount: 380.5, description: "TNPDCL bill (vacant)" },
    { id: "e8", unitId: "B", categoryId: "util", expenseDate: D("2026-08-19"), amount: 470, description: "TNPDCL bill (vacant)" },
  ];
  return {
    settings,
    plot: { frontWidthFt: 22.25, backWidthFt: 23.25, depthFt: 76.66, areaSqft: 1744, townName: "Pattukottai", sitePlanImageUrl: null },
    units: [
      unit({ id: "A", name: "Unit A", position: "front" }),
      unit({
        id: "B",
        name: "Unit B",
        position: "back",
        purchaseDate: D("2021-03-10"),
        purchasePrice: 4_200_000,
        annualAppreciationRate: 8,
        createdAt: new Date("2021-03-10T00:00:00Z"),
      }),
    ],
    offers: [
      { id: "o1", unitId: "A", amount: 4_500_000, offerDate: D("2021-09-12"), notes: "Neighbour" },
      { id: "o2", unitId: "A", amount: 5_200_000, offerDate: D("2023-02-20"), notes: "Broker" },
      { id: "o3", unitId: "A", amount: 6_150_000, offerDate: D("2025-11-08"), notes: "Local buyer" },
    ],
    leases,
    payments,
    expenses,
    categories: [
      { id: "maint", name: "Maintenance", color: "#4F9DFF" },
      { id: "prof", name: "Professional Fees", color: "#A78BFA" },
      { id: "renov", name: "Renovation", color: "#F59E0B" },
      { id: "util", name: "Utilities", color: "#22C55E" },
    ],
    actions: [],
  };
}

const opts = (yearMode: "fy" | "calendar" = "fy") => ({ today: TODAY, now: NOW, yearMode });
const dash = (asOf: Date = TODAY, yearMode: "fy" | "calendar" = "fy") => buildDashboard(fixture(), { asOf, today: TODAY, now: NOW, yearMode });

// ─────────────────────────────── annual statement ───────────────────────────────

describe("annual statement", () => {
  it("defaults to the running FY and its totals ARE the dashboard's 'this year' figures", () => {
    const r = buildAnnualReport(fixture(), opts());
    expect(r).toMatchObject({ year: 2026, label: "FY 2026-27", start: ISO("2026-04-01"), end: ISO("2027-03-31"), through: ISO("2026-10-02"), isPartial: true });
    expect(r.totals).toEqual(dash().periods.year);
    // Apr–Jun full rent, Jul part (10,000) → 47,500; Aug + Sep unpaid
    expect(r.totals).toMatchObject({ rentCollected: 47_500, rentExpected: 75_000, rentUnpaid: 27_500, rentDueLater: 12_500, expenses: 470, net: 47_030 });
  });

  it("calendar years too", () => {
    const r = buildAnnualReport(fixture(), { ...opts("calendar"), year: 2026 });
    expect(r.label).toBe("2026");
    expect(r.totals).toEqual(dash(TODAY, "calendar").periods.year);
  });

  it("a closed year equals the dashboard looked at on the year's last day", () => {
    const r = buildAnnualReport(fixture(), { ...opts(), year: 2024 });
    expect(r).toMatchObject({ label: "FY 2024-25", through: ISO("2025-03-31"), isPartial: false });
    expect(r.totals).toEqual(dash(D("2025-03-31")).periods.year);
    // A2 12 × 12,500 + B1 12 × 11,000 = 2,82,000; collected in full
    expect(r.totals).toMatchObject({ rentCollected: 282_000, rentExpected: 282_000, collectionPct: 1, expenses: 6_500, net: 275_500 });
  });

  it("months and units add up to the totals (and reconcile)", () => {
    for (let year = 2019; year <= 2026; year++) {
      const r = buildAnnualReport(fixture(), { ...opts(), year });
      expect(r.months).toHaveLength(12);
      expect(sum(r.months.map((m) => m.rentCollected)), `${year}`).toBe(r.totals.rentCollected);
      expect(sum(r.months.map((m) => m.expenses)), `${year}`).toBe(r.totals.expenses);
      expect(sum(r.units.map((u) => u.rentCollected)), `${year}`).toBe(r.totals.rentCollected);
      expect(sum(r.units.map((u) => u.expenses)), `${year}`).toBe(r.totals.expenses);
      expect(r.reconciliation.ledgerBalanced, `${year} ${JSON.stringify(r.reconciliation.items.filter((i) => !i.ok))}`).toBe(true);
    }
  });

  it("Σ of every year's statement = the dashboard's all-time totals", () => {
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => buildAnnualReport(fixture(), { ...opts(), year }));
    const d = dash();
    expect(sum(years.map((y) => y.totals.rentCollected))).toBe(d.kpis.rentCollected);
    expect(sum(years.map((y) => y.totals.expenses))).toBe(d.kpis.totalExpenses);
  });

  it("cash flow by month, with months after today zero", () => {
    const r = buildAnnualReport(fixture(), opts());
    expect(r.months.slice(2, 7).map((m) => [m.label, m.rentCollected, m.rentExpected, m.rentReceivedForMonth, m.expenses])).toEqual([
      ["Jun 2026", 12_500, 12_500, 12_500, 0],
      ["Jul 2026", 10_000, 12_500, 10_000, 0],
      ["Aug 2026", 0, 12_500, 0, 470],
      ["Sep 2026", 0, 12_500, 0, 0],
      ["Oct 2026", 0, 0, 0, 0], // due 5/10, not yet
    ]);
    expect(r.months.slice(7).every((m) => m.rentCollected === 0 && m.expenses === 0)).toBe(true);
  });

  it("cash flow by unit + whole plot", () => {
    const r = buildAnnualReport(fixture(), { ...opts(), year: 2025 });
    expect(r.units).toEqual([
      { unitId: "A", unitName: "Unit A", rentCollected: 150_000, rentExpected: 150_000, collectionPct: 1, expenses: 4_200, net: 145_800 },
      { unitId: "B", unitName: "Unit B", rentCollected: 11_000, rentExpected: 11_000, collectionPct: 1, expenses: 54_380.5, net: -43_380.5 },
      { unitId: null, unitName: "Whole plot", rentCollected: 0, rentExpected: 0, collectionPct: null, expenses: 5_800, net: -5_800 },
    ]);
    expect(r.expensesByCategory.map((c) => [c.name, c.amount])).toEqual([
      ["Renovation", 54_000],
      ["Maintenance", 10_000],
      ["Utilities", 380.5],
    ]);
    expect(r.expenses.map((e) => e.id)).toEqual(["e4", "e5", "e6", "e7"]);
  });

  it("deposits ledger: opening + received − refunded − kept = closing", () => {
    // FY 2023-24: Murugan leaves (45,000 back, 5,000 kept); Lakshmi pays 75,000
    let r = buildAnnualReport(fixture(), { ...opts(), year: 2023 });
    expect(r.deposits).toMatchObject({ opening: 110_000, received: 75_000, refunded: 45_000, kept: 5_000, closing: 135_000 });
    expect(r.deposits.rows.map((x) => x.leaseId)).toEqual(["A1", "B1", "A2"]);
    // FY 2025-26: Karthikeyan's 60,000 refunded in full
    r = buildAnnualReport(fixture(), { ...opts(), year: 2025 });
    expect(r.deposits).toMatchObject({ opening: 135_000, received: 0, refunded: 60_000, kept: 0, closing: 75_000 });
  });

  it("occupancy per unit inside the year", () => {
    // FY 2023-24 (366 days, includes 29/2/2024): Unit A empty 1/6 – 31/8/2023 = 92 days at Murugan's 9,500
    const a = buildAnnualReport(fixture(), { ...opts(), year: 2023 }).occupancy[0];
    expect(a).toMatchObject({ unitId: "A", daysInYear: 366, daysOccupied: 274, vacantDays: 92, rentLost: 29_133 });
    // FY 2025-26: Unit B let 1/4 – 30/4/2025 only; 335 empty days × 11,000 / 30 = 1,22,833
    const b = buildAnnualReport(fixture(), { ...opts(), year: 2025 }).occupancy[1];
    expect(b).toMatchObject({ unitId: "B", daysInYear: 365, daysOccupied: 30, vacantDays: 335, rentLost: 122_833 });
  });

  it("a year before anything was bought is empty but valid", () => {
    const r = buildAnnualReport(fixture(), { ...opts(), year: 2015 });
    expect(r.totals).toMatchObject({ rentCollected: 0, expenses: 0, net: 0, collectionPct: null });
    expect(r.units).toEqual([{ unitId: null, unitName: "Whole plot", rentCollected: 0, rentExpected: 0, collectionPct: null, expenses: 0, net: 0 }]);
    expect(r.reconciliation.ledgerBalanced).toBe(true);
  });
});

describe("all-time statement (year = all)", () => {
  const r = buildAnnualReport(fixture(), { ...opts(), year: "all" });
  const d = dash();

  it("covers the first record → today and its totals ARE the dashboard's all-time figures", () => {
    expect(r).toMatchObject({ kind: "allTime", label: "All time", start: ISO("2019-06-15"), through: ISO("2026-10-02"), isPartial: false });
    expect(r.totals).toEqual(d.periods.allTime);
    expect(r.months).toEqual([]);
  });

  it("one row per FY, oldest first, adding up to the totals; each row = that year's own statement", () => {
    expect(r.years.map((y) => y.label)).toEqual(["FY 2019-20", "FY 2020-21", "FY 2021-22", "FY 2022-23", "FY 2023-24", "FY 2024-25", "FY 2025-26", "FY 2026-27"]);
    expect(r.years.map((y) => y.isPartial)).toEqual([false, false, false, false, false, false, false, true]);
    expect(sum(r.years.map((y) => y.rentCollected))).toBe(r.totals.rentCollected);
    expect(sum(r.years.map((y) => y.expenses))).toBe(r.totals.expenses);
    for (const y of r.years) {
      const one = buildAnnualReport(fixture(), { ...opts(), year: y.year }).totals;
      expect([y.rentCollected, y.expenses, y.net], y.label).toEqual([one.rentCollected, one.expenses, one.net]);
    }
    expect(r.reconciliation.ledgerBalanced, JSON.stringify(r.reconciliation.items.filter((i) => !i.ok))).toBe(true);
  });

  it("calendar years too", () => {
    const c = buildAnnualReport(fixture(), { ...opts("calendar"), year: "all" });
    expect(c.years[0].label).toBe("2019");
    expect(c.years[c.years.length - 1].label).toBe("2026");
    expect(c.totals).toEqual(dash(TODAY, "calendar").periods.allTime);
  });

  it("units, categories and deposits over the whole time", () => {
    expect(sum(r.units.map((u) => u.rentCollected))).toBe(d.kpis.rentCollected);
    expect(sum(r.expensesByCategory.map((c) => c.amount))).toBe(d.kpis.totalExpenses);
    // nothing was held before the first record; everything received − refunded − kept is held now
    expect(r.deposits.opening).toBe(0);
    expect(r.deposits.closing).toBe(round2(r.deposits.received - r.deposits.refunded - r.deposits.kept));
  });

  it("occupancy over the whole ownership = the dashboard's unit figures", () => {
    for (const o of r.occupancy) {
      const card = d.units.find((u) => u.id === o.unitId)!;
      expect([o.vacantDays, o.rentLost], o.unitName).toEqual([card.vacantDays, card.unrealizedLoss]);
    }
  });

  it("nothing recorded yet → an empty but valid statement", () => {
    const empty = { ...fixture(), units: [], leases: [], payments: [], expenses: [] };
    const e = buildAnnualReport(empty, { ...opts(), year: "all" });
    expect(e.totals).toMatchObject({ rentCollected: 0, expenses: 0, net: 0 });
    expect(e.years.map((y) => y.label)).toEqual(["FY 2026-27"]);
    expect(e.reconciliation.ledgerBalanced).toBe(true);
  });
});

// ─────────────────────────────── unit report ───────────────────────────────

describe("unit report", () => {
  const r = buildUnitReport(fixture(), "A", opts())!;
  const card = dash().units.find((u) => u.id === "A")!;

  it("matches the dashboard unit card", () => {
    expect(r.now).toEqual(card);
    expect(r.totals).toEqual({
      rentCollected: card.rentCollected,
      expenses: card.expenses,
      netCash: card.netCash,
      rentLost: card.unrealizedLoss,
      vacantDays: card.vacantDays,
    });
    expect(r.reconciliation.ledgerBalanced).toBe(true);
  });

  it("purchase, offers (best flagged) and every lease", () => {
    expect(r.purchase).toEqual({ date: ISO("2019-06-15"), price: 3_850_000, perSqft: 3_438, annualAppreciationRate: 7.5 });
    expect(r.offers.map((o) => [o.amount, o.isBest])).toEqual([
      [4_500_000, false],
      [5_200_000, false],
      [6_150_000, true],
    ]);
    expect(r.leases.map((l) => [l.tenantName, l.state, l.months, l.rentExpected, l.rentCollected, l.rentUnpaid])).toEqual([
      ["Murugan Selvaraj", "ended", 46, 437_000, 437_000, 0],
      ["Lakshmi Narayanan", "current", 38, 462_500, 435_000, 27_500], // Oct 2026 not due yet
    ]);
    expect(r.leases[0].deposit).toMatchObject({ refunded: 45_000, kept: 5_000, held: 0 });
  });

  it("per year: sums to the totals and the running year equals the card's 'this year'", () => {
    expect(r.byYear.map((y) => y.label)).toEqual(["FY 2019-20", "FY 2020-21", "FY 2021-22", "FY 2022-23", "FY 2023-24", "FY 2024-25", "FY 2025-26", "FY 2026-27"]);
    expect(sum(r.byYear.map((y) => y.rentCollected))).toBe(r.totals.rentCollected);
    expect(sum(r.byYear.map((y) => y.expenses))).toBe(r.totals.expenses);
    expect(r.byYear.reduce((n, y) => n + y.vacantDays, 0)).toBe(r.totals.vacantDays);
    const last = r.byYear.at(-1)!;
    expect([last.rentCollected, last.rentExpected, last.collectionPct, last.expenses, last.net]).toEqual([
      card.periods.year.rentCollected,
      card.periods.year.rentExpected,
      card.periods.year.collectionPct,
      card.periods.year.expenses,
      card.periods.year.net,
    ]);
  });

  it("value growth from the price to today's estimate, with the best offer known at each point", () => {
    expect(r.valueGrowth[0]).toEqual({ date: ISO("2019-06-15"), label: "Bought", estimate: 3_850_000, bestOfferToDate: null });
    expect(r.valueGrowth.at(-1)).toEqual({ date: ISO("2026-10-02"), label: "Today", estimate: card.currentValue, bestOfferToDate: 6_150_000 });
    expect(r.valueGrowth.find((p) => p.label === "FY 2023-24")?.bestOfferToDate).toBe(5_200_000);
  });

  it("the story, oldest first", () => {
    expect(r.story.map((s) => s.kind)).toEqual([
      "purchase",
      "vacant",
      "expense",
      "lease-start",
      "offer",
      "offer",
      "lease-end",
      "vacant",
      "lease-start",
      "offer",
    ]);
    expect(r.story[0].text).toBe("Bought Unit A for ₹38,50,000");
    expect(r.story[6].text).toBe("Murugan Selvaraj's last day of tenancy");
    expect(r.story[7].text).toBe("Empty for 92 days (rent lost ₹29,133)");
  });

  it("unknown unit → null", () => {
    expect(buildUnitReport(fixture(), "nope", opts())).toBeNull();
  });
});

// ─────────────────────────────── rent ledger ───────────────────────────────

describe("rent ledger", () => {
  it("current lease: month by month, running balance, arrears = the dashboard's", () => {
    const L = buildRentLedger(fixture(), "A2", opts())!;
    expect(L.lease).toMatchObject({ id: "A2", start: ISO("2023-09-01"), end: null, state: "current", monthlyRent: 12_500, tenant: { name: "Lakshmi Narayanan" }, unit: { name: "Unit A" } });
    expect(L.rows).toHaveLength(38); // Sep 2023 … Oct 2026
    expect(L.rows.slice(-4).map((r) => [r.label, r.expected, r.paid, r.outstanding, r.runningBalance, r.status])).toEqual([
      ["Jul 2026", 12_500, 10_000, 2_500, 2_500, "part-paid"],
      ["Aug 2026", 12_500, 0, 12_500, 15_000, "unpaid"],
      ["Sep 2026", 12_500, 0, 12_500, 27_500, "unpaid"],
      ["Oct 2026", 12_500, 0, 12_500, 27_500, "not-due"], // due 5/10 — not in the balance yet
    ]);
    expect(L.rows[0].payments).toEqual([{ id: "A2-2023-9", date: ISO("2023-09-05"), amount: 12_500, invoiceNumber: expect.any(String), method: null }]);
    expect(L.totals).toEqual({ expected: 462_500, paid: 435_000, outstanding: 27_500, lateFees: 1_500 });
    expect(L.arrears).toEqual(dash().units[0].nextPayment!.arrears);
    expect(L.deposit).toMatchObject({ deposit: 75_000, held: 75_000, refunded: 0 });
    expect(L.reconciliation.ledgerBalanced).toBe(true);
  });

  it("rent paid in advance shows as an 'advance' row and lowers the balance", () => {
    const input = fixture();
    input.payments.push({ id: "adv", leaseId: "A2", amount: 12_500, paymentDate: D("2026-10-01"), periodMonth: 11, periodYear: 2026, invoiceSeq: 1000, invoiceNumber: "PE-2026-1000" });
    const L = buildRentLedger(input, "A2", opts())!;
    expect(L.rows.at(-1)).toMatchObject({ label: "Nov 2026", paid: 12_500, outstanding: 0, runningBalance: 15_000, status: "advance" });
    expect(L.totals).toMatchObject({ paid: 447_500, outstanding: 15_000 });
    expect(L.arrears.total).toBe(27_500); // overdue months are still overdue
    expect(L.reconciliation.ledgerBalanced).toBe(true);
  });

  it("ended lease: last rent month = month of the last day; deposit refunded with some kept", () => {
    const L = buildRentLedger(fixture(), "A1", opts())!;
    expect(L.lease).toMatchObject({ state: "ended", end: ISO("2023-05-31") });
    expect(L.rows).toHaveLength(46); // Aug 2019 … May 2023
    expect(L.rows.at(-1)).toMatchObject({ label: "May 2023", status: "paid", runningBalance: 0 });
    expect(L.totals).toEqual({ expected: 437_000, paid: 437_000, outstanding: 0, lateFees: 0 });
    expect(L.deposit).toMatchObject({ deposit: 50_000, refunded: 45_000, kept: 5_000, held: 0, refundDate: ISO("2023-06-06") });
  });

  it("a payment recorded for a month outside the lease is listed separately, never lost", () => {
    const input = fixture();
    input.payments.push({ id: "stray", leaseId: "A1", amount: 9_500, paymentDate: D("2023-06-05"), periodMonth: 6, periodYear: 2023, invoiceSeq: 1001, invoiceNumber: "PE-2023-1001" });
    const L = buildRentLedger(input, "A1", opts())!;
    expect(L.unmatchedPayments).toEqual([{ id: "stray", date: ISO("2023-06-05"), amount: 9_500, invoiceNumber: "PE-2023-1001", periodLabel: "Jun 2023" }]);
    expect(L.reconciliation.ledgerBalanced).toBe(true);
  });

  it("unknown lease → null", () => {
    expect(buildRentLedger(fixture(), "nope", opts())).toBeNull();
  });
});
