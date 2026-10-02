// Unit tests for every formula in src/lib/calculations.ts.
// Expected values are hand-computed; the arithmetic is shown in the comment next to each assertion.
import { describe, expect, it } from "vitest";
import {
  appreciatedValue,
  cagr,
  capitalMultiplier,
  cumulativeNetByYear,
  daysInMonth,
  dueDateFor,
  expenseSlices,
  monthlyByYear,
  nextPaymentFor,
  occupancyFor,
  pickBestOffer,
  plotGeometry,
  rentStateFor,
  round2,
  round6,
  sumAmounts,
  trapezoidArea,
  unitStatusFor,
  weightedHoldingYears,
  yearsBetween,
} from "../calculations";

/** date-only UTC midnight */
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ISO = (s: string) => `${s}T00:00:00.000Z`;

describe("round2 / sumAmounts", () => {
  it("rounds to paise, half away from zero, without float noise", () => {
    expect(round2(1.005)).toBe(1.01); // 1.005 × 100 = 100.49999… in binary → still 1.01
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(783333.3333333334)).toBe(783333.33);
    expect(Object.is(round2(-0.001), 0)).toBe(true); // never -0
  });

  it("sums amounts to the paisa", () => {
    expect(sumAmounts([])).toBe(0);
    expect(sumAmounts([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    // 12,500.50 + 4,320.25 = 16,820.75
    expect(sumAmounts([{ amount: 12500.5 }, { amount: 4320.25 }])).toBe(16820.75);
  });

  it("round6 keeps ratios tidy", () => {
    expect(round6(521 / 1461)).toBe(0.356605); // 0.3566050650…
  });
});

describe("Current Value = price × (1 + rate/100) ^ years", () => {
  it("years = days / 365.25", () => {
    // 15/6/2022 → 15/6/2026 = 1,461 days (incl. 29/2/2024) = 1461 / 365.25 = 4 years exactly
    expect(yearsBetween(D("2022-06-15"), D("2026-06-15"))).toBe(4);
    // 15/6/2018 → 15/6/2026 = 2,922 days = 8 years exactly
    expect(yearsBetween(D("2018-06-15"), D("2026-06-15"))).toBe(8);
    // 1/1/2023 → 1/1/2025 = 731 days → 731 / 365.25 = 2.0013689…
    expect(yearsBetween(D("2023-01-01"), D("2025-01-01"))).toBeCloseTo(2.001369, 6);
    // purchase in the future → 0, never negative
    expect(yearsBetween(D("2027-01-01"), D("2026-06-15"))).toBe(0);
  });

  it("compounds annually with fractional years", () => {
    // 50,00,000 at 8% for exactly 2 years (730.5 days) → 50,00,000 × 1.08² = 50,00,000 × 1.1664 = 58,32,000
    expect(round2(appreciatedValue(5_000_000, 8, 730.5 / 365.25))).toBe(5_832_000);
    // 50,00,000 at 8% for 4 years → × 1.36048896 = 68,02,444.80
    expect(round2(appreciatedValue(5_000_000, 8, 4))).toBe(6_802_444.8);
    // 40,00,000 at 5% for 8 years → × 1.4774554437890625 = 59,09,821.775… → 59,09,821.78
    expect(round2(appreciatedValue(4_000_000, 5, 8))).toBe(5_909_821.78);
    // 731 days at 8%: 50,00,000 × 1.08^2.0013689 = 58,32,614.46
    expect(round2(appreciatedValue(5_000_000, 8, 731 / 365.25))).toBe(5_832_614.46);
    // half a year at 21%: 10,00,000 × 1.21^0.5 = 10,00,000 × 1.1 = 11,00,000
    expect(round2(appreciatedValue(1_000_000, 21, 0.5))).toBe(1_100_000);
  });

  it("handles 0% and negative rates", () => {
    expect(appreciatedValue(3_000_000, 0, 5)).toBe(3_000_000);
    // −10% for 1 year: 50,00,000 × 0.9 = 45,00,000
    expect(round2(appreciatedValue(5_000_000, -10, 1))).toBe(4_500_000);
    // 0 years → purchase price
    expect(appreciatedValue(5_000_000, 8, 0)).toBe(5_000_000);
  });
});

describe("Best Offer = highest amount; tie → most recent date", () => {
  it("returns null when there are no offers", () => {
    expect(pickBestOffer([])).toBeNull();
  });

  it("picks the highest amount regardless of order", () => {
    const best = pickBestOffer([
      { amount: 6_000_000, offerDate: D("2026-03-01") },
      { amount: 7_200_000, offerDate: D("2025-11-20") },
      { amount: 5_500_000, offerDate: D("2026-05-01") },
    ]);
    expect(best).toEqual({ amount: 7_200_000, offerDate: D("2025-11-20") });
  });

  it("breaks ties by the most recent offer date", () => {
    const best = pickBestOffer([
      { amount: 7_200_000, offerDate: D("2026-01-10") },
      { amount: 7_200_000, offerDate: D("2026-05-01") },
      { amount: 7_200_000, offerDate: D("2026-02-14") },
    ]);
    expect(best?.offerDate).toEqual(D("2026-05-01"));
  });
});

describe("Capital Multiplier / holding years / CAGR", () => {
  it("multiplier = best offer total / invested", () => {
    // (72,00,000 + 59,09,821.78) / 90,00,000 = 1,31,09,821.78 / 90,00,000 = 1.4566468… → 1.456647
    expect(capitalMultiplier(13_109_821.78, 9_000_000)).toBe(1.456647);
    expect(capitalMultiplier(5_000_000, 5_000_000)).toBe(1);
    expect(capitalMultiplier(0, 0)).toBeNull();
  });

  it("holding years = investment-weighted average", () => {
    // (50,00,000 × 4 + 40,00,000 × 8) / 90,00,000 = 5,20,00,000 / 90,00,000 = 52/9 = 5.7778
    expect(
      weightedHoldingYears([
        { purchasePrice: 5_000_000, yearsHeld: 4 },
        { purchasePrice: 4_000_000, yearsHeld: 8 },
      ]),
    ).toBeCloseTo(52 / 9, 12);
    expect(weightedHoldingYears([])).toBe(0);
    expect(weightedHoldingYears([{ purchasePrice: 0, yearsHeld: 3 }])).toBe(0);
  });

  it("CAGR = (total / invested) ^ (1 / years) − 1", () => {
    // doubled in 4 years: 2^(1/4) − 1 = 0.189207
    expect(cagr(2_000_000, 1_000_000, 4)).toBe(0.189207);
    // 58,32,000 from 50,00,000 in 2 years = 1.1664^(1/2) − 1 = 1.08 − 1 = 0.08
    expect(cagr(5_832_000, 5_000_000, 2)).toBe(0.08);
    // 1.4566468644^(9/52) − 1 = 0.0672664
    expect(cagr(13_109_821.78, 9_000_000, 52 / 9)).toBe(0.067266);
    // a loss: 45,00,000 from 50,00,000 in 1 year = −10%
    expect(cagr(4_500_000, 5_000_000, 1)).toBe(-0.1);
  });

  it("CAGR is null when nothing is invested or held for under a day's worth of a year", () => {
    expect(cagr(0, 0, 4)).toBeNull();
    expect(cagr(1_000_000, 1_000_000, 0)).toBeNull();
    expect(cagr(1_100_000, 1_000_000, 0.5 / 365)).toBeNull();
    // exactly 1/365 years is allowed (finite)
    expect(cagr(1_000_000, 1_000_000, 1 / 365)).toBe(0);
    // absurd short-term growth that overflows → null, never Infinity
    expect(cagr(1e12, 1, 1 / 365)).toBeNull();
  });
});

describe("Vacancy, unrealized loss and occupancy (half-open day intervals)", () => {
  const lease = (start: string, end: string | null, rent: number) => ({
    startDate: D(start),
    endDate: end ? D(end) : null,
    monthlyRent: rent,
  });

  it("no leases ever → whole ownership vacant, loss 0, noRentHistory", () => {
    // owned [1/1/2026, 1/3/2026) = 31 + 28 = 59 days
    const r = occupancyFor(D("2026-01-01"), D("2026-03-01"), []);
    expect(r).toMatchObject({ daysOwned: 59, daysOccupied: 0, vacantDays: 59, unrealizedLoss: 0, noRentHistory: true });
    expect(r.vacantPeriods).toEqual([
      { start: ISO("2026-01-01"), end: ISO("2026-03-01"), days: 59, rentBasis: 0, unrealizedLoss: 0, noRentHistory: true },
    ]);
  });

  it("gap before the first lease uses the next lease's rent", () => {
    // owned [1/1, 1/3/2026) = 59 days; lease from 21/1 (active) → gap [1/1, 21/1) = 20 days
    // loss = 20 × 30,000 / 30 = 20,000; occupied = 59 − 20 = 39
    const r = occupancyFor(D("2026-01-01"), D("2026-03-01"), [lease("2026-01-21", null, 30_000)]);
    expect(r.vacantPeriods).toEqual([
      { start: ISO("2026-01-01"), end: ISO("2026-01-21"), days: 20, rentBasis: 30_000, unrealizedLoss: 20_000, noRentHistory: false },
    ]);
    expect(r).toMatchObject({ daysOwned: 59, daysOccupied: 39, vacantDays: 20, unrealizedLoss: 20_000, noRentHistory: false });
  });

  it("gap between leases uses the previous lease's rent", () => {
    // owned [1/1, 1/6/2025) = 151 days; L1 [1/1, 1/4) = 90 days @15,000; L2 [1/5, today) = 31 days @18,000
    // gap [1/4, 1/5) = 30 days × 15,000 / 30 = 15,000
    const r = occupancyFor(D("2025-01-01"), D("2025-06-01"), [
      lease("2025-05-01", null, 18_000),
      lease("2025-01-01", "2025-04-01", 15_000),
    ]);
    expect(r.vacantPeriods).toEqual([
      { start: ISO("2025-04-01"), end: ISO("2025-05-01"), days: 30, rentBasis: 15_000, unrealizedLoss: 15_000, noRentHistory: false },
    ]);
    expect(r).toMatchObject({ daysOwned: 151, daysOccupied: 121, vacantDays: 30, unrealizedLoss: 15_000 });
  });

  it("trailing gap after a move-out runs to today (exclusive) at the last rent", () => {
    // L1 [1/1, 1/3/2025) @12,000, today 31/3 → gap [1/3, 31/3) = 30 days → 12,000
    const r = occupancyFor(D("2025-01-01"), D("2025-03-31"), [lease("2025-01-01", "2025-03-01", 12_000)]);
    expect(r.vacantPeriods).toEqual([
      { start: ISO("2025-03-01"), end: ISO("2025-03-31"), days: 30, rentBasis: 12_000, unrealizedLoss: 12_000, noRentHistory: false },
    ]);
    // 59 occupied of 89 owned
    expect(r).toMatchObject({ daysOwned: 89, daysOccupied: 59, vacantDays: 30 });
  });

  it("an active lease since purchase → fully occupied, no gaps", () => {
    const r = occupancyFor(D("2025-01-01"), D("2025-07-01"), [lease("2025-01-01", null, 20_000)]);
    expect(r).toMatchObject({ daysOwned: 181, daysOccupied: 181, vacantDays: 0, unrealizedLoss: 0, vacantPeriods: [] });
  });

  it("a lease starting before the purchase date is clipped to ownership", () => {
    // purchase 1/3/2025 with a sitting tenant [1/12/2024, 1/4/2025) @9,000; today 1/5/2025
    // occupied [1/3, 1/4) = 31 days; gap [1/4, 1/5) = 30 days × 9,000/30 = 9,000
    const r = occupancyFor(D("2025-03-01"), D("2025-05-01"), [lease("2024-12-01", "2025-04-01", 9_000)]);
    expect(r).toMatchObject({ daysOwned: 61, daysOccupied: 31, vacantDays: 30, unrealizedLoss: 9_000 });
    expect(r.vacantPeriods[0]).toMatchObject({ start: ISO("2025-04-01"), end: ISO("2025-05-01"), rentBasis: 9_000 });
  });

  it("a lease that ended before the purchase still counts as rent history", () => {
    // lease 2020–2021 @7,000 (wholly before purchase); owned [1/1, 31/1/2022) = 30 days all vacant
    // basis = most recent lease that started before the gap = 7,000 → 30 × 7,000/30 = 7,000
    const r = occupancyFor(D("2022-01-01"), D("2022-01-31"), [lease("2020-01-01", "2021-01-01", 7_000)]);
    expect(r).toMatchObject({ daysOwned: 30, daysOccupied: 0, unrealizedLoss: 7_000, noRentHistory: false });
  });

  it("overlapping leases are merged, never double counted", () => {
    // [1/1, 1/3) ∪ [1/2, 1/4) = [1/1, 1/4) = 90 days; owned to 1/5/2025 = 120 days
    // gap [1/4, 1/5) = 30 days; basis = most recent start (1/2) → 11,000 → 11,000
    const r = occupancyFor(D("2025-01-01"), D("2025-05-01"), [
      lease("2025-01-01", "2025-03-01", 10_000),
      lease("2025-02-01", "2025-04-01", 11_000),
    ]);
    expect(r).toMatchObject({ daysOwned: 120, daysOccupied: 90, vacantDays: 30, unrealizedLoss: 11_000 });
  });

  it("adjacent leases (move-out day = next move-in) leave no gap", () => {
    const r = occupancyFor(D("2025-01-01"), D("2025-03-01"), [
      lease("2025-01-01", "2025-02-01", 10_000),
      lease("2025-02-01", null, 12_000),
    ]);
    expect(r).toMatchObject({ daysOccupied: 59, vacantDays: 0, vacantPeriods: [] });
  });

  it("rounds each period's loss to paise", () => {
    // 7 days × 10,000 / 30 = 2,333.333… → 2,333.33
    const r = occupancyFor(D("2025-01-01"), D("2025-01-08"), [lease("2025-01-08", null, 10_000)]);
    expect(r.unrealizedLoss).toBe(2_333.33);
  });

  it("a future purchase owns nothing yet", () => {
    const r = occupancyFor(D("2027-01-01"), D("2026-06-15"), [lease("2027-01-01", null, 10_000)]);
    expect(r).toMatchObject({ daysOwned: 0, daysOccupied: 0, vacantDays: 0, unrealizedLoss: 0, vacantPeriods: [] });
  });

  it("a lease starting in the future leaves today vacant at that lease's rent", () => {
    // owned [1/6, 15/6/2026) = 14 days; lease starts 1/7 → gap 14 × 24,000/30 = 11,200
    const r = occupancyFor(D("2026-06-01"), D("2026-06-15"), [lease("2026-07-01", null, 24_000)]);
    expect(r).toMatchObject({ daysOwned: 14, daysOccupied: 0, unrealizedLoss: 11_200 });
  });
});

describe("Rent schedule: next payment, due day clamping, late fees", () => {
  const settings = { rentDueDay: 5, lateFeeEnabled: true, lateFeeAmount: 500, lateFeeGraceDays: 3 };
  const lease = { id: "L1", startDate: D("2025-01-10"), monthlyRent: 25_000 };
  const paid = (...periods: [number, number][]) => periods.map(([periodMonth, periodYear]) => ({ periodMonth, periodYear }));

  it("clamps the due day to the month length", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(dueDateFor(2026, 2, 31)).toEqual(D("2026-02-28")); // 31 → 28 in Feb 2026
    expect(dueDateFor(2024, 2, 31)).toEqual(D("2024-02-29")); // leap year
    expect(dueDateFor(2026, 4, 31)).toEqual(D("2026-04-30"));
    expect(dueDateFor(2026, 1, 31)).toEqual(D("2026-01-31"));
    expect(dueDateFor(2026, 3, 5)).toEqual(D("2026-03-05"));
  });

  it("no payments: first period = lease start month, due max(due day, start date)", () => {
    // starts 20/3/2026, due day 5 → 5/3 is before the start → due 20/3/2026
    let n = nextPaymentFor({ ...lease, startDate: D("2026-03-20") }, [], settings, D("2026-03-01"));
    expect(n).toMatchObject({ dueDate: ISO("2026-03-20"), periodMonth: 3, periodYear: 2026, isOverdue: false });
    // starts 2/3/2026 → due 5/3/2026
    n = nextPaymentFor({ ...lease, startDate: D("2026-03-02") }, [], settings, D("2026-03-01"));
    expect(n).toMatchObject({ dueDate: ISO("2026-03-05"), periodMonth: 3, periodYear: 2026 });
  });

  it("month after the latest paid period, whatever order payments were recorded in", () => {
    const n = nextPaymentFor(lease, paid([3, 2026], [1, 2026], [2, 2026]), settings, D("2026-03-30"));
    expect(n).toMatchObject({ dueDate: ISO("2026-04-05"), periodMonth: 4, periodYear: 2026, isOverdue: false, amountDue: 25_000 });
  });

  it("rolls over December → January", () => {
    const n = nextPaymentFor(lease, paid([12, 2025], [11, 2025]), settings, D("2025-12-20"));
    expect(n).toMatchObject({ dueDate: ISO("2026-01-05"), periodMonth: 1, periodYear: 2026 });
  });

  it("due day 31 in February (normal and leap year)", () => {
    const s31 = { ...settings, rentDueDay: 31 };
    expect(nextPaymentFor(lease, paid([1, 2026]), s31, D("2026-02-01")).dueDate).toBe(ISO("2026-02-28"));
    const oldLease = { ...lease, startDate: D("2023-06-01") };
    expect(nextPaymentFor(oldLease, paid([1, 2024]), s31, D("2024-02-01")).dueDate).toBe(ISO("2024-02-29"));
  });

  it("never asks for a period or due date before the lease start (payment logged for a period before the start)", () => {
    // lease starts 10/1/2025; a payment was logged for 11/2024 → next period clamped to 1/2025, due max(5/1, 10/1) = 10/1/2025
    const n = nextPaymentFor(lease, paid([11, 2024]), settings, D("2025-01-05"));
    expect(n).toMatchObject({ dueDate: ISO("2025-01-10"), periodMonth: 1, periodYear: 2025, isOverdue: false });
  });

  it("due today is not overdue", () => {
    const n = nextPaymentFor(lease, paid([5, 2026]), settings, D("2026-06-05"));
    expect(n).toMatchObject({ isOverdue: false, daysOverdue: 0, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
  });

  it("overdue but within grace → no late fee", () => {
    // due 5/6, grace 3 → fee only once today > 8/6. On 8/6: 3 days overdue, no fee.
    const n = nextPaymentFor(lease, paid([5, 2026]), settings, D("2026-06-08"));
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 3, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
  });

  it("overdue past grace → flat late fee added", () => {
    // 9/6 > 5/6 + 3 → 25,000 + 500 = 25,500; 4 days overdue
    const n = nextPaymentFor(lease, paid([5, 2026]), settings, D("2026-06-09"));
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 4, lateFeeApplied: true, lateFee: 500, amountDue: 25_500 });
  });

  it("late fee off → never charged, however late", () => {
    const n = nextPaymentFor(lease, paid([5, 2026]), { ...settings, lateFeeEnabled: false }, D("2026-07-05"));
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 30, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
  });

  it("grace 0 → fee from the first day late", () => {
    const n = nextPaymentFor(lease, paid([5, 2026]), { ...settings, lateFeeGraceDays: 0 }, D("2026-06-06"));
    expect(n).toMatchObject({ daysOverdue: 1, lateFeeApplied: true, amountDue: 25_500 });
  });

  it("prepaid months push the next due date forward", () => {
    // paid through 9/2026 → next due 5/10/2026, not overdue in June
    const n = nextPaymentFor(lease, paid([7, 2026], [8, 2026], [9, 2026]), settings, D("2026-06-15"));
    expect(n).toMatchObject({ dueDate: ISO("2026-10-05"), isOverdue: false });
  });
});

describe("rentState and unit status", () => {
  const next = (due: string, isOverdue = false) => ({
    leaseId: "L",
    dueDate: ISO(due),
    periodMonth: 6,
    periodYear: 2026,
    amountDue: 1,
    isOverdue,
    daysOverdue: 0,
    lateFeeApplied: false,
    lateFee: 0,
  });

  it("none / overdue / due-soon (0..5 days) / paid", () => {
    expect(rentStateFor(null, D("2026-06-01"))).toBe("none");
    expect(rentStateFor(next("2026-05-31", true), D("2026-06-01"))).toBe("overdue");
    expect(rentStateFor(next("2026-06-01"), D("2026-06-01"))).toBe("due-soon"); // due today
    expect(rentStateFor(next("2026-06-06"), D("2026-06-01"))).toBe("due-soon"); // 5 days, inclusive
    expect(rentStateFor(next("2026-06-07"), D("2026-06-01"))).toBe("paid"); // 6 days
  });

  it("inactive beats everything; active lease → occupied; else vacant", () => {
    expect(unitStatusFor(false, true)).toBe("inactive");
    expect(unitStatusFor(true, true)).toBe("occupied");
    expect(unitStatusFor(true, false)).toBe("vacant");
  });
});

describe("Plot geometry", () => {
  const plot = { frontWidthFt: null, backWidthFt: null, depthFt: null, areaSqft: null, townName: "Pattukottai", sitePlanImageUrl: null };

  it("falls back to the owner's site plan", () => {
    // (22.25 + 23.25) / 2 × 76.66 = 22.75 × 76.66 = 1,744.015 → 1,744.02
    expect(plotGeometry(plot)).toEqual({
      frontWidthFt: 22.25,
      backWidthFt: 23.25,
      depthFt: 76.66,
      areaSqft: 1744.02,
      townName: "Pattukottai",
      sitePlanImageUrl: null,
      usingDefaults: true,
    });
  });

  it("uses stored values and computes a missing area from them", () => {
    // (30 + 40) / 2 × 50 = 1,750
    const g = plotGeometry({ ...plot, frontWidthFt: 30, backWidthFt: 40, depthFt: 50 });
    expect(g).toMatchObject({ frontWidthFt: 30, backWidthFt: 40, depthFt: 50, areaSqft: 1750, usingDefaults: false });
    expect(plotGeometry({ ...plot, frontWidthFt: 30, backWidthFt: 40, depthFt: 50, areaSqft: 1744 }).areaSqft).toBe(1744);
  });

  it("partial fallback flags usingDefaults", () => {
    // front 22, back default 23.25, depth 76 → (22 + 23.25)/2 × 76 = 1,719.5
    const g = plotGeometry({ ...plot, frontWidthFt: 22, depthFt: 76 });
    expect(g).toMatchObject({ frontWidthFt: 22, backWidthFt: 23.25, depthFt: 76, areaSqft: 1719.5, usingDefaults: true });
    expect(trapezoidArea(22.25, 23.25, 76.66)).toBe(1744.02);
  });
});

describe("Monthly income vs expenses (cash basis) and cumulative net", () => {
  const payments = [
    { amount: 25_000, paymentDate: D("2025-01-10") },
    { amount: 25_000, paymentDate: D("2025-02-06") },
    { amount: 25_000, paymentDate: D("2026-05-04") },
  ];
  const expenses = [
    { amount: 12_500.5, expenseDate: D("2025-03-12") },
    { amount: 4_320.25, expenseDate: D("2026-02-20") },
  ];

  it("one series per year with data plus the current year, 12 months each, running net in-year", () => {
    const s = monthlyByYear(payments, expenses, 2027);
    expect(s.map((y) => y.year)).toEqual([2025, 2026, 2027]);
    // 2025: income 50,000; expenses 12,500.50; net 37,499.50
    expect(s[0]).toMatchObject({ income: 50_000, expenses: 12_500.5, net: 37_499.5 });
    expect(s[0].months).toHaveLength(12);
    expect(s[0].months[0]).toEqual({ month: 1, label: "Jan", income: 25_000, expenses: 0, net: 25_000, cumulative: 25_000 });
    expect(s[0].months[1].cumulative).toBe(50_000); // Jan + Feb
    expect(s[0].months[2]).toMatchObject({ label: "Mar", expenses: 12_500.5, net: -12_500.5, cumulative: 37_499.5 });
    expect(s[0].months[11].cumulative).toBe(37_499.5);
    // 2026: Feb −4,320.25, May +25,000 → net 20,679.75
    expect(s[1]).toMatchObject({ income: 25_000, expenses: 4_320.25, net: 20_679.75 });
    expect(s[1].months.map((m) => m.cumulative)).toEqual([
      0, -4320.25, -4320.25, -4320.25, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75,
    ]);
    // the current year with no data is all zeros
    expect(s[2]).toMatchObject({ income: 0, expenses: 0, net: 0 });
    expect(s[2].months.every((m) => m.income === 0 && m.expenses === 0 && m.cumulative === 0)).toBe(true);
  });

  it("cumulative net carries across years", () => {
    // 37,499.50 → 37,499.50 + 20,679.75 = 58,179.25 → + 0
    expect(cumulativeNetByYear(monthlyByYear(payments, expenses, 2026))).toEqual([
      { year: 2025, net: 37_499.5, cumulative: 37_499.5 },
      { year: 2026, net: 20_679.75, cumulative: 58_179.25 },
    ]);
  });

  it("empty data → just the current year, zeroed", () => {
    const s = monthlyByYear([], [], 2026);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ year: 2026, income: 0, expenses: 0, net: 0 });
    expect(cumulativeNetByYear(s)).toEqual([{ year: 2026, net: 0, cumulative: 0 }]);
  });

  it("sums paise exactly", () => {
    // 0.1 + 0.2 in the same month = 0.30, not 0.30000000000000004
    const s = monthlyByYear([{ amount: 0.1, paymentDate: D("2026-01-01") }, { amount: 0.2, paymentDate: D("2026-01-31") }], [], 2026);
    expect(s[0].months[0].income).toBe(0.3);
    expect(s[0].income).toBe(0.3);
  });
});

describe("Expense composition", () => {
  const categories = [
    { id: "maint", name: "Maintenance", color: "#4F9DFF" },
    { id: "tax", name: "Property Tax", color: "#EF4444" },
    { id: "util", name: "Utilities", color: "#22C55E" },
  ];

  it("slices per category with amount > 0, largest first, share = amount / total", () => {
    const slices = expenseSlices(
      [
        { amount: 10_000, categoryId: "maint" },
        { amount: 2_500.5, categoryId: "maint" },
        { amount: 4_320.25, categoryId: "tax" },
        { amount: 0, categoryId: "util" },
      ],
      categories,
    );
    // total 16,820.75: Maintenance 12,500.50 → 0.743159; Property Tax 4,320.25 → 0.256841; Utilities 0 → dropped
    expect(slices).toEqual([
      { categoryId: "maint", name: "Maintenance", color: "#4F9DFF", amount: 12_500.5, share: 0.743159 },
      { categoryId: "tax", name: "Property Tax", color: "#EF4444", amount: 4_320.25, share: 0.256841 },
    ]);
  });

  it("ties sort by name; unknown categories still show", () => {
    const slices = expenseSlices(
      [
        { amount: 100, categoryId: "util" },
        { amount: 100, categoryId: "maint" },
        { amount: 50, categoryId: "ghost" },
      ],
      categories,
    );
    expect(slices.map((s) => s.name)).toEqual(["Maintenance", "Utilities", "Uncategorised"]);
    expect(slices[2]).toMatchObject({ color: "#8B93A7", share: 0.2 }); // 50 / 250
  });

  it("no expenses → no slices", () => {
    expect(expenseSlices([], categories)).toEqual([]);
  });
});
