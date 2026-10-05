// Unit tests for every formula in src/lib/calculations.ts.
// Expected values are hand-computed; the arithmetic is shown in the comment next to each assertion.
import { describe, expect, it } from "vitest";
import {
  appreciatedValue,
  arrearsFrom,
  cagr,
  cagrNote,
  capitalMultiplier,
  cumulativeNetByYear,
  daysInMonth,
  dueDateFor,
  expenseSlices,
  leaseMonthBounds,
  leaseRentMonths,
  leaseStateOn,
  monthIndex,
  monthlyByYear,
  nextPaymentFor,
  occupancyFor,
  pickBestOffer,
  plotGeometry,
  rentStateFor,
  round0,
  round2,
  round6,
  sumAmounts,
  trapezoidArea,
  unitStatusFor,
  weightedHoldingYears,
  yearBounds,
  yearKeyOf,
  yearLabel,
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

  it("round0 gives whole rupees for estimates, half away from zero", () => {
    expect(round0(6_802_444.8)).toBe(6_802_445);
    expect(round0(2_333.5)).toBe(2_334);
    expect(round0(-2_333.5)).toBe(-2_334);
    expect(Object.is(round0(-0.2), 0)).toBe(true);
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
    // (72,00,000 + 59,09,822) / 90,00,000 = 1,31,09,822 / 90,00,000 = 1.4566468… → 1.456647
    expect(capitalMultiplier(13_109_822, 9_000_000)).toBe(1.456647);
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
    // 1.4566468889^(9/52) − 1 = 0.0672664
    expect(cagr(13_109_822, 9_000_000, 52 / 9)).toBe(0.067266);
    // a loss: 45,00,000 from 50,00,000 in exactly 1 year = −10%
    expect(cagr(4_500_000, 5_000_000, 1)).toBe(-0.1);
  });

  it("CAGR is null (with a reason) when nothing is invested or held under 1 year", () => {
    expect(cagr(0, 0, 4)).toBeNull();
    expect(cagrNote(0, 4)).toBe("Nothing invested yet");
    expect(cagr(1_000_000, 1_000_000, 0)).toBeNull();
    // 0.999 years: a yearly rate would be misleading
    expect(cagr(1_100_000, 1_000_000, 0.999)).toBeNull();
    expect(cagrNote(1_000_000, 0.999)).toMatch(/^Held under 1 year/);
    // exactly 1 year is shown
    expect(cagr(1_100_000, 1_000_000, 1)).toBe(0.1);
    expect(cagrNote(1_000_000, 1)).toBeNull();
  });
});

describe("Lease state — endDate is the LAST DAY of tenancy (inclusive)", () => {
  const l = { startDate: D("2023-09-01"), endDate: D("2025-04-30") };
  it("incoming before the start, current from the start through the last day, ended the day after", () => {
    expect(leaseStateOn(l, D("2023-08-31"))).toBe("incoming");
    expect(leaseStateOn(l, D("2023-09-01"))).toBe("current");
    expect(leaseStateOn(l, D("2025-04-30"))).toBe("current"); // the last day still counts
    expect(leaseStateOn(l, D("2025-05-01"))).toBe("ended");
    expect(leaseStateOn({ ...l, endDate: null }, D("2040-01-01"))).toBe("current");
  });

  it("last rent month = the month of the last day", () => {
    // last day 30/4 → April; last day 1/5 → May (one day of May is still a rent month)
    expect(leaseMonthBounds(l)).toEqual({ first: monthIndex(2023, 9), last: monthIndex(2025, 4) });
    expect(leaseMonthBounds({ ...l, endDate: D("2025-05-01") }).last).toBe(monthIndex(2025, 5));
    expect(leaseMonthBounds({ ...l, endDate: null }).last).toBeNull();
  });

  it("unit status: inactive > occupied (current lease) > incoming (future lease) > vacant", () => {
    expect(unitStatusFor(false, true, true)).toBe("inactive");
    expect(unitStatusFor(true, true, true)).toBe("occupied");
    expect(unitStatusFor(true, false, true)).toBe("incoming");
    expect(unitStatusFor(true, false, false)).toBe("vacant");
    expect(unitStatusFor(true, false)).toBe("vacant");
  });
});

describe("Vacancy, unrealized loss and occupancy (leases occupy [start, last day + 1))", () => {
  const lease = (start: string, end: string | null, rent: number) => ({
    startDate: D(start),
    endDate: end ? D(end) : null,
    monthlyRent: rent,
  });
  const gap = (start: string, end: string, lastDay: string, days: number, rentBasis: number, loss: number, more: object = {}) => ({
    start: ISO(start),
    end: ISO(end),
    lastDay: ISO(lastDay),
    days,
    ongoing: false,
    rentBasis,
    rentBasisSource: "previous-lease",
    unrealizedLoss: loss,
    noRentHistory: false,
    ...more,
  });

  it("no leases ever → whole ownership vacant, loss 0, noRentHistory", () => {
    // owned [1/1, 1/3/2026) = 31 + 28 = 59 days
    const r = occupancyFor(D("2026-01-01"), D("2026-03-01"), []);
    expect(r).toMatchObject({ daysOwned: 59, daysOccupied: 0, vacantDays: 59, unrealizedLoss: 0, noRentHistory: true, occupiedOnAsOf: false });
    expect(r.vacantPeriods).toEqual([
      gap("2026-01-01", "2026-03-01", "2026-02-28", 59, 0, 0, { ongoing: true, rentBasisSource: "none", noRentHistory: true }),
    ]);
  });

  it("gap before the first lease uses the next lease's rent", () => {
    // owned [1/1, 1/3/2026) = 59 days; lease from 21/1 (open) → gap 1/1 – 20/1 = 20 days
    // loss = 20 × 30,000 / 30 = 20,000; occupied = 59 − 20 = 39
    const r = occupancyFor(D("2026-01-01"), D("2026-03-01"), [lease("2026-01-21", null, 30_000)]);
    expect(r.vacantPeriods).toEqual([gap("2026-01-01", "2026-01-21", "2026-01-20", 20, 30_000, 20_000, { rentBasisSource: "next-lease" })]);
    expect(r).toMatchObject({ daysOwned: 59, daysOccupied: 39, vacantDays: 20, unrealizedLoss: 20_000, noRentHistory: false, occupiedOnAsOf: true });
  });

  it("gap between leases uses the previous lease's rent", () => {
    // owned [1/1, 1/6/2025) = 151 days; L1 1/1 – 31/3 (last day) = 90 days @15,000; L2 from 1/5 = 31 days @18,000
    // gap 1/4 – 30/4 = 30 days × 15,000 / 30 = 15,000
    const r = occupancyFor(D("2025-01-01"), D("2025-06-01"), [
      lease("2025-05-01", null, 18_000),
      lease("2025-01-01", "2025-03-31", 15_000),
    ]);
    expect(r.vacantPeriods).toEqual([gap("2025-04-01", "2025-05-01", "2025-04-30", 30, 15_000, 15_000)]);
    expect(r).toMatchObject({ daysOwned: 151, daysOccupied: 121, vacantDays: 30, unrealizedLoss: 15_000 });
  });

  it("the last day of tenancy is occupied; the trailing gap starts the day after and runs to the as-of date", () => {
    // L1 1/1 – 28/2/2025 (last day) @12,000, as of 31/3 → vacant 1/3 – 30/3 = 30 days → 12,000, still vacant
    const r = occupancyFor(D("2025-01-01"), D("2025-03-31"), [lease("2025-01-01", "2025-02-28", 12_000)]);
    expect(r.vacantPeriods).toEqual([gap("2025-03-01", "2025-03-31", "2025-03-30", 30, 12_000, 12_000, { ongoing: true })]);
    // 59 occupied (Jan 31 + Feb 28) of 89 owned
    expect(r).toMatchObject({ daysOwned: 89, daysOccupied: 59, vacantDays: 30 });
  });

  it("a lease whose last day is the as-of date still covers it", () => {
    const L = [lease("2025-01-01", "2025-03-31", 10_000)];
    expect(occupancyFor(D("2025-01-01"), D("2025-03-31"), L)).toMatchObject({ daysOwned: 89, daysOccupied: 89, vacantPeriods: [], occupiedOnAsOf: true });
    // the day after the last day: 90 owned, 90 let, nobody there today — but no vacant day has passed yet
    expect(occupancyFor(D("2025-01-01"), D("2025-04-01"), L)).toMatchObject({ daysOwned: 90, daysOccupied: 90, vacantPeriods: [], occupiedOnAsOf: false });
    // two days after: 1/4 was vacant
    const r = occupancyFor(D("2025-01-01"), D("2025-04-02"), L);
    expect(r.vacantPeriods).toEqual([gap("2025-04-01", "2025-04-02", "2025-04-01", 1, 10_000, 333, { ongoing: true })]);
  });

  it("an open lease since purchase → fully occupied, no gaps", () => {
    const r = occupancyFor(D("2025-01-01"), D("2025-07-01"), [lease("2025-01-01", null, 20_000)]);
    expect(r).toMatchObject({ daysOwned: 181, daysOccupied: 181, vacantDays: 0, unrealizedLoss: 0, vacantPeriods: [] });
  });

  it("a lease starting before the purchase date is clipped to ownership", () => {
    // purchase 1/3/2025 with a sitting tenant 1/12/2024 – 31/3/2025 @9,000; as of 1/5/2025
    // occupied 1/3 – 31/3 = 31 days; vacant 1/4 – 30/4 = 30 days × 9,000/30 = 9,000
    const r = occupancyFor(D("2025-03-01"), D("2025-05-01"), [lease("2024-12-01", "2025-03-31", 9_000)]);
    expect(r).toMatchObject({ daysOwned: 61, daysOccupied: 31, vacantDays: 30, unrealizedLoss: 9_000 });
    expect(r.vacantPeriods[0]).toMatchObject({ start: ISO("2025-04-01"), lastDay: ISO("2025-04-30"), rentBasis: 9_000 });
  });

  it("a lease that ended before the purchase still counts as rent history", () => {
    // lease 2020 @7,000 (wholly before purchase); owned [1/1, 31/1/2022) = 30 days all vacant → 30 × 7,000/30 = 7,000
    const r = occupancyFor(D("2022-01-01"), D("2022-01-31"), [lease("2020-01-01", "2020-12-31", 7_000)]);
    expect(r).toMatchObject({ daysOwned: 30, daysOccupied: 0, unrealizedLoss: 7_000, noRentHistory: false });
  });

  it("overlapping leases are merged, never double counted", () => {
    // 1/1 – 28/2 ∪ 1/2 – 31/3 = [1/1, 1/4) = 90 days; owned to 1/5/2025 = 120 days
    // gap 30 days; basis = most recent start (1/2) → 11,000
    const r = occupancyFor(D("2025-01-01"), D("2025-05-01"), [
      lease("2025-01-01", "2025-02-28", 10_000),
      lease("2025-02-01", "2025-03-31", 11_000),
    ]);
    expect(r).toMatchObject({ daysOwned: 120, daysOccupied: 90, vacantDays: 30, unrealizedLoss: 11_000 });
  });

  it("back-to-back leases (next starts the day after the last day) leave no gap", () => {
    const r = occupancyFor(D("2025-01-01"), D("2025-03-01"), [
      lease("2025-01-01", "2025-01-31", 10_000),
      lease("2025-02-01", null, 12_000),
    ]);
    expect(r).toMatchObject({ daysOccupied: 59, vacantDays: 0, vacantPeriods: [] });
  });

  it("rounds each period's loss to whole rupees (an estimate, never paise)", () => {
    // 7 days × 10,000 / 30 = 2,333.33… → 2,333
    const r = occupancyFor(D("2025-01-01"), D("2025-01-08"), [lease("2025-01-08", null, 10_000)]);
    expect(r.unrealizedLoss).toBe(2_333);
  });

  it("a future purchase owns nothing yet", () => {
    const r = occupancyFor(D("2027-01-01"), D("2026-06-15"), [lease("2027-01-01", null, 10_000)]);
    expect(r).toMatchObject({ daysOwned: 0, daysOccupied: 0, vacantDays: 0, unrealizedLoss: 0, vacantPeriods: [] });
  });

  it("a lease starting in the future leaves today vacant at that lease's rent", () => {
    // owned [1/6, 15/6/2026) = 14 days; lease starts 1/7 → gap 14 × 24,000/30 = 11,200
    const r = occupancyFor(D("2026-06-01"), D("2026-06-15"), [lease("2026-07-01", null, 24_000)]);
    expect(r).toMatchObject({ daysOwned: 14, daysOccupied: 0, unrealizedLoss: 11_200 });
    expect(r.vacantPeriods[0]).toMatchObject({ ongoing: true, rentBasisSource: "next-lease" });
  });

  it("a window (from) measures only part of the ownership — used by yearly reports", () => {
    // bought 1/1/2024, lease 1/3/2024 – 30/6/2025 @10,000; window 1/4/2025 → 1/1/2026 = 275 days
    // let 1/4 – 30/6 = 91 days; vacant 1/7 – 31/12 = 184 days × 10,000/30 = 61,333.33 → 61,333
    const r = occupancyFor(D("2024-01-01"), D("2026-01-01"), [lease("2024-03-01", "2025-06-30", 10_000)], D("2025-04-01"));
    expect(r).toMatchObject({ daysOwned: 275, daysOccupied: 91, vacantDays: 184, unrealizedLoss: 61_333 });
  });
});

describe("Rent schedule: next payment, arrears, due day clamping, late fees", () => {
  const settings = { rentDueDay: 5, lateFeeEnabled: true, lateFeeAmount: 500, lateFeeGraceDays: 3 };
  /** One full-rent payment per [month, year], dated the 1st of that month unless given. */
  const paid = (...periods: [number, number, number?, string?][]) =>
    periods.map(([periodMonth, periodYear, amount = 25_000, date]) => ({
      periodMonth,
      periodYear,
      amount,
      paymentDate: D(date ?? `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`),
    }));
  const lease = (start: string, end: string | null = null, rent = 25_000) => ({ id: "L1", startDate: D(start), endDate: end ? D(end) : null, monthlyRent: rent });

  it("rent paid AFTER the month (owner's 116/B7): October's rent is due on 10 November; per-lease due day", () => {
    const l = { ...lease("2026-09-01"), rentTiming: "arrears" as const, rentDueDay: 10 };
    // 5/10: September is due 10/10 → nothing overdue yet; next = Sep 2026 due 10/10/2026
    let n = nextPaymentFor(l, [], settings, D("2026-10-05"));
    expect(n).toMatchObject({ periodMonth: 9, periodYear: 2026, dueDate: ISO("2026-10-10"), isOverdue: false });
    expect(n?.arrears.months).toEqual([]);
    // 11/10: September overdue (1 day); October not due until 10/11
    n = nextPaymentFor(l, [], settings, D("2026-10-11"));
    expect(n?.arrears.months.map((m) => m.label)).toEqual(["Sep 2026"]);
    // September paid on 10/10 → next = October, due 10/11/2026
    n = nextPaymentFor(l, paid([9, 2026, 25_000, "2026-10-10"]), settings, D("2026-10-20"));
    expect(n).toMatchObject({ periodMonth: 10, dueDate: ISO("2026-11-10"), isOverdue: false });
    // December rolls into January
    n = nextPaymentFor(l, paid([9, 2026], [10, 2026], [11, 2026]), settings, D("2026-12-15"));
    expect(n).toMatchObject({ periodMonth: 12, dueDate: ISO("2027-01-10") });
  });

  it("rent paid IN ADVANCE on the 1st (owner's previous 116/B8 tenant): October's rent is due 1 October", () => {
    const l = { ...lease("2026-01-01"), rentTiming: "advance" as const, rentDueDay: 1 };
    const n = nextPaymentFor(l, paid([1, 2026], [2, 2026], [3, 2026], [4, 2026], [5, 2026], [6, 2026], [7, 2026], [8, 2026], [9, 2026]), settings, D("2026-10-02"));
    expect(n).toMatchObject({ periodMonth: 10, dueDate: ISO("2026-10-01"), isOverdue: true, daysOverdue: 1 });
  });

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
    let n = nextPaymentFor(lease("2026-03-20"), [], settings, D("2026-03-01"));
    expect(n).toMatchObject({ dueDate: ISO("2026-03-20"), periodMonth: 3, periodYear: 2026, label: "Mar 2026", isOverdue: false });
    // starts 2/3/2026 → due 5/3/2026
    n = nextPaymentFor(lease("2026-03-02"), [], settings, D("2026-03-01"));
    expect(n).toMatchObject({ dueDate: ISO("2026-03-05"), periodMonth: 3, periodYear: 2026 });
  });

  it("up to date → the month after, whatever order payments were recorded in", () => {
    const n = nextPaymentFor(lease("2026-01-10"), paid([3, 2026], [1, 2026], [2, 2026]), settings, D("2026-03-30"));
    expect(n).toMatchObject({ dueDate: ISO("2026-04-05"), periodMonth: 4, periodYear: 2026, isOverdue: false, amountDue: 25_000, paidSoFar: 0 });
    expect(n?.arrears).toEqual({ months: [], total: 0, lateFees: 0, totalWithFees: 0 });
  });

  it("rolls over December → January", () => {
    const n = nextPaymentFor(lease("2025-11-10"), paid([12, 2025], [11, 2025]), settings, D("2025-12-20"));
    expect(n).toMatchObject({ dueDate: ISO("2026-01-05"), periodMonth: 1, periodYear: 2026 });
  });

  it("due day 31 in February (normal and leap year)", () => {
    const s31 = { ...settings, rentDueDay: 31 };
    expect(nextPaymentFor(lease("2026-01-01"), paid([1, 2026]), s31, D("2026-02-01"))?.dueDate).toBe(ISO("2026-02-28"));
    expect(nextPaymentFor(lease("2024-01-01"), paid([1, 2024]), s31, D("2024-02-01"))?.dueDate).toBe(ISO("2024-02-29"));
  });

  it("never asks for a period or due date before the lease start (payment logged for a period before the start)", () => {
    const n = nextPaymentFor(lease("2025-01-10"), paid([11, 2024, 25_000, "2024-11-01"]), settings, D("2025-01-05"));
    expect(n).toMatchObject({ dueDate: ISO("2025-01-10"), periodMonth: 1, periodYear: 2025, isOverdue: false });
  });

  it("due today is not overdue", () => {
    const n = nextPaymentFor(lease("2026-05-01"), paid([5, 2026]), settings, D("2026-06-05"));
    expect(n).toMatchObject({ isOverdue: false, daysOverdue: 0, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
    expect(n?.arrears.months).toEqual([]);
  });

  it("overdue but within grace → no late fee", () => {
    // due 5/6, grace 3 → fee only once more than 3 days late. On 8/6: 3 days overdue, no fee.
    const n = nextPaymentFor(lease("2026-05-01"), paid([5, 2026]), settings, D("2026-06-08"));
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 3, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
    expect(n?.arrears).toMatchObject({ total: 25_000, lateFees: 0, totalWithFees: 25_000 });
  });

  it("overdue past grace → flat late fee added", () => {
    // 9/6 is 4 days after 5/6 > 3 grace → 25,000 + 500 = 25,500
    const n = nextPaymentFor(lease("2026-05-01"), paid([5, 2026]), settings, D("2026-06-09"));
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 4, lateFeeApplied: true, lateFee: 500, amountDue: 25_500 });
  });

  it("late fee off → never charged, however late", () => {
    // as of 5/7: June 30 days overdue; July is due today (not overdue yet)
    const n = nextPaymentFor(lease("2026-05-01"), paid([5, 2026]), { ...settings, lateFeeEnabled: false }, D("2026-07-05"));
    expect(n).toMatchObject({ isOverdue: true, daysOverdue: 30, lateFeeApplied: false, lateFee: 0, amountDue: 25_000 });
    expect(n?.arrears.months.map((m) => m.label)).toEqual(["Jun 2026"]);
  });

  it("grace 0 → fee from the first day late", () => {
    const n = nextPaymentFor(lease("2026-05-01"), paid([5, 2026]), { ...settings, lateFeeGraceDays: 0 }, D("2026-06-06"));
    expect(n).toMatchObject({ daysOverdue: 1, lateFeeApplied: true, amountDue: 25_500 });
  });

  it("prepaid months push the next due date forward", () => {
    // paid May–Sep on 1/5 → as of 15/6, next is October
    const n = nextPaymentFor(
      lease("2026-05-01"),
      paid([5, 2026], [6, 2026, 25_000, "2026-05-01"], [7, 2026, 25_000, "2026-05-01"], [8, 2026, 25_000, "2026-05-01"], [9, 2026, 25_000, "2026-05-01"]),
      settings,
      D("2026-06-15"),
    );
    expect(n).toMatchObject({ dueDate: ISO("2026-10-05"), isOverdue: false });
  });

  it("arrears = every unpaid or part-paid overdue month from the lease start, with a late fee each", () => {
    // rent 10,000 from 1/1/2026: Jan paid; Feb paid in two parts; Mar part-paid 7,000; Apr + May unpaid. As of 20/5/2026.
    const L = lease("2026-01-01", null, 10_000);
    const P = paid(
      [1, 2026, 10_000],
      [2, 2026, 6_000, "2026-02-05"],
      [2, 2026, 4_000, "2026-02-20"],
      [3, 2026, 7_000, "2026-03-04"],
    );
    const n = nextPaymentFor(L, P, settings, D("2026-05-20"));
    // Mar: 10,000 − 7,000 = 3,000 (76 days late) · Apr: 10,000 (45 days) · May: 10,000 (15 days) → 23,000 + 3 × 500
    expect(n?.arrears).toEqual({
      months: [
        { year: 2026, month: 3, key: "2026-03", label: "Mar 2026", dueDate: ISO("2026-03-05"), due: 10_000, paid: 7_000, outstanding: 3_000, daysOverdue: 76, lateFee: 500 },
        { year: 2026, month: 4, key: "2026-04", label: "Apr 2026", dueDate: ISO("2026-04-05"), due: 10_000, paid: 0, outstanding: 10_000, daysOverdue: 45, lateFee: 500 },
        { year: 2026, month: 5, key: "2026-05", label: "May 2026", dueDate: ISO("2026-05-05"), due: 10_000, paid: 0, outstanding: 10_000, daysOverdue: 15, lateFee: 500 },
      ],
      total: 23_000,
      lateFees: 1_500,
      totalWithFees: 24_500,
    });
    // the next thing to pay is the oldest month: March's 3,000 + its 500 fee
    expect(n).toMatchObject({ label: "Mar 2026", paidSoFar: 7_000, amountDue: 3_500, isOverdue: true, daysOverdue: 76 });
  });

  it("payments dated after the as-of date don't count yet", () => {
    const L = lease("2026-04-01", null, 10_000);
    const P = paid([4, 2026, 10_000, "2026-05-25"]);
    expect(nextPaymentFor(L, P, settings, D("2026-05-20"))?.arrears.total).toBe(20_000); // Apr + May
    expect(nextPaymentFor(L, P, settings, D("2026-05-25"))?.arrears.total).toBe(10_000); // May only
  });

  it("money is matched to the month it was recorded for (an overpaid month doesn't cover the next)", () => {
    const n = nextPaymentFor(lease("2026-01-01", null, 10_000), paid([1, 2026, 20_000]), settings, D("2026-02-10"));
    expect(n?.arrears.months.map((m) => [m.label, m.outstanding])).toEqual([["Feb 2026", 10_000]]);
  });

  it("an ended lease: last rent month = month of the last day; fully paid → nothing next", () => {
    const L = lease("2026-01-01", "2026-03-15", 10_000);
    expect(leaseRentMonths(L, [], settings, D("2026-06-01")).map((m) => m.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
    const all = paid([1, 2026, 10_000], [2, 2026, 10_000], [3, 2026, 10_000]);
    expect(nextPaymentFor(L, all, settings, D("2026-06-01"))).toBeNull();
    expect(arrearsFrom(leaseRentMonths(L, all.slice(0, 2), settings, D("2026-06-01"))).total).toBe(10_000);
  });
});

describe("rentState", () => {
  const next = (due: string, isOverdue = false) => ({
    leaseId: "L",
    dueDate: ISO(due),
    periodMonth: 6,
    periodYear: 2026,
    label: "Jun 2026",
    monthlyRent: 1,
    paidSoFar: 0,
    amountDue: 1,
    isOverdue,
    daysOverdue: 0,
    lateFeeApplied: false,
    lateFee: 0,
    arrears: { months: [], total: 0, lateFees: 0, totalWithFees: 0 },
  });

  it("none / overdue / due-soon (0..5 days) / paid", () => {
    expect(rentStateFor(null, D("2026-06-01"))).toBe("none");
    expect(rentStateFor(next("2026-05-31", true), D("2026-06-01"))).toBe("overdue");
    expect(rentStateFor(next("2026-06-01"), D("2026-06-01"))).toBe("due-soon"); // due today
    expect(rentStateFor(next("2026-06-06"), D("2026-06-01"))).toBe("due-soon"); // 5 days, inclusive
    expect(rentStateFor(next("2026-06-07"), D("2026-06-01"))).toBe("paid"); // 6 days
  });
});

describe("Plot geometry", () => {
  const plot = { frontWidthFt: null, backWidthFt: null, depthFt: null, areaSqft: null, townName: "Pattukottai", sitePlanImageUrl: null };

  it("falls back to the owner's site plan", () => {
    // annotated plan: 23'3" front, 22'3" back → (23.25 + 22.25) / 2 × 76.66 = 22.75 × 76.66 = 1,744.015 → 1,744.02
    expect(plotGeometry(plot)).toEqual({
      frontWidthFt: 23.25,
      backWidthFt: 22.25,
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
    // front 22, back default 22.25, depth 76 → (22 + 22.25)/2 × 76 = 1,681.5
    const g = plotGeometry({ ...plot, frontWidthFt: 22, depthFt: 76 });
    expect(g).toMatchObject({ frontWidthFt: 22, backWidthFt: 22.25, depthFt: 76, areaSqft: 1681.5, usingDefaults: true });
    expect(trapezoidArea(22.25, 23.25, 76.66)).toBe(1744.02);
  });
});

describe("Years: Indian FY (Apr–Mar, default) or calendar", () => {
  it("FY key = the start year; Jan–Mar belong to the FY that started the previous April", () => {
    expect(yearKeyOf(D("2026-02-15"), "fy")).toBe(2025);
    expect(yearKeyOf(D("2026-03-31"), "fy")).toBe(2025); // last day of FY 2025-26
    expect(yearKeyOf(D("2026-04-01"), "fy")).toBe(2026); // first day of FY 2026-27
    expect(yearKeyOf(D("2026-12-31"), "fy")).toBe(2026);
    expect(yearKeyOf(D("2026-02-15"), "calendar")).toBe(2026);
  });

  it("labels and bounds", () => {
    expect(yearLabel(2025, "fy")).toBe("FY 2025-26");
    expect(yearLabel(2099, "fy")).toBe("FY 2099-00");
    expect(yearLabel(2026, "calendar")).toBe("2026");
    expect(yearBounds(2023, "fy")).toEqual({ start: D("2023-04-01"), end: D("2024-03-31") }); // leap Feb inside
    expect(yearBounds(2026, "calendar")).toEqual({ start: D("2026-01-01"), end: D("2026-12-31") });
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

  it("calendar: contiguous years up to the as-of year, 12 months each, running net in-year", () => {
    const s = monthlyByYear(payments, expenses, D("2027-03-01"), "calendar");
    expect(s.map((y) => [y.year, y.label, y.isCurrent])).toEqual([
      [2025, "2025", false],
      [2026, "2026", false],
      [2027, "2027", true],
    ]);
    // 2025: income 50,000; expenses 12,500.50; net 37,499.50
    expect(s[0]).toMatchObject({ income: 50_000, expenses: 12_500.5, net: 37_499.5, start: ISO("2025-01-01"), end: ISO("2025-12-31"), mode: "calendar" });
    expect(s[0].months).toHaveLength(12);
    expect(s[0].months[0]).toEqual({
      month: 1,
      year: 2025,
      key: "2025-01",
      label: "Jan",
      longLabel: "Jan 2025",
      income: 25_000,
      expenses: 0,
      net: 25_000,
      cumulative: 25_000,
      isFuture: false,
    });
    expect(s[0].months[1].cumulative).toBe(50_000); // Jan + Feb
    expect(s[0].months[2]).toMatchObject({ label: "Mar", expenses: 12_500.5, net: -12_500.5, cumulative: 37_499.5 });
    expect(s[0].months[11].cumulative).toBe(37_499.5);
    // 2026: Feb −4,320.25, May +25,000 → net 20,679.75
    expect(s[1]).toMatchObject({ income: 25_000, expenses: 4_320.25, net: 20_679.75 });
    expect(s[1].months.map((m) => m.cumulative)).toEqual([
      0, -4320.25, -4320.25, -4320.25, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75, 20679.75,
    ]);
    // the as-of year with no data is all zeros; months after March are flagged future
    expect(s[2]).toMatchObject({ income: 0, expenses: 0, net: 0 });
    expect(s[2].months.map((m) => m.isFuture)).toEqual([false, false, false, true, true, true, true, true, true, true, true, true]);
  });

  it("FY: Apr → Mar order; Jan–Mar go to the previous FY; Mar 31 / Apr 1 split", () => {
    const s = monthlyByYear(
      [...payments, { amount: 1_000, paymentDate: D("2026-03-31") }, { amount: 2_000, paymentDate: D("2026-04-01") }],
      expenses,
      D("2026-06-15"),
      "fy",
    );
    expect(s.map((y) => y.label)).toEqual(["FY 2024-25", "FY 2025-26", "FY 2026-27"]);
    expect(s[0].months.map((m) => m.longLabel)).toEqual([
      "Apr 2024", "May 2024", "Jun 2024", "Jul 2024", "Aug 2024", "Sep 2024", "Oct 2024", "Nov 2024", "Dec 2024", "Jan 2025", "Feb 2025", "Mar 2025",
    ]);
    // FY 2024-25: Jan + Feb 2025 rent, Mar 2025 expense
    expect(s[0]).toMatchObject({ income: 50_000, expenses: 12_500.5, net: 37_499.5, start: ISO("2024-04-01"), end: ISO("2025-03-31") });
    // FY 2025-26: Feb 2026 expense + the 31/3/2026 payment
    expect(s[1]).toMatchObject({ income: 1_000, expenses: 4_320.25, net: -3_320.25 });
    expect(s[1].months[11]).toMatchObject({ key: "2026-03", income: 1_000 });
    // FY 2026-27: 1/4/2026 payment + May 2026; months after June are future
    expect(s[2]).toMatchObject({ income: 27_000, isCurrent: true });
    expect(s[2].months[0]).toMatchObject({ key: "2026-04", income: 2_000, isFuture: false });
    expect(s[2].months.filter((m) => m.isFuture).map((m) => m.label)).toEqual(["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]);
  });

  it("fills missing years with zeros and can start at the first purchase", () => {
    const s = monthlyByYear([{ amount: 5, paymentDate: D("2019-07-01") }], [], D("2026-06-15"), "calendar");
    expect(s.map((y) => y.year)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(s.slice(1).every((y) => y.income === 0 && y.expenses === 0)).toBe(true);
    const f = monthlyByYear([], [], D("2026-06-15"), "fy", D("2023-02-10"));
    expect(f.map((y) => y.label)).toEqual(["FY 2022-23", "FY 2023-24", "FY 2024-25", "FY 2025-26", "FY 2026-27"]);
  });

  it("cumulative net carries across years", () => {
    // 37,499.50 → 37,499.50 + 20,679.75 = 58,179.25
    expect(cumulativeNetByYear(monthlyByYear(payments, expenses, D("2026-12-31"), "calendar"))).toEqual([
      { year: 2025, label: "2025", net: 37_499.5, cumulative: 37_499.5 },
      { year: 2026, label: "2026", net: 20_679.75, cumulative: 58_179.25 },
    ]);
  });

  it("empty data → just the as-of year, zeroed", () => {
    const s = monthlyByYear([], [], D("2026-06-15"), "fy");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ year: 2026, label: "FY 2026-27", income: 0, expenses: 0, net: 0 });
    expect(cumulativeNetByYear(s)).toEqual([{ year: 2026, label: "FY 2026-27", net: 0, cumulative: 0 }]);
  });

  it("sums paise exactly", () => {
    // 0.1 + 0.2 in the same month = 0.30, not 0.30000000000000004
    const s = monthlyByYear([{ amount: 0.1, paymentDate: D("2026-01-01") }, { amount: 0.2, paymentDate: D("2026-01-31") }], [], D("2026-02-01"), "calendar");
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
