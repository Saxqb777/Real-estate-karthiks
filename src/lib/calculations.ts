// Single source of truth for every money / KPI formula. Pure functions only: no Prisma, no I/O, no clock.
// src/lib/dashboard.ts loads the rows (Decimal → number) and calls buildDashboard(input, today, now).
//
// RULES (owner's spec) — and how each ambiguity is interpreted:
//  • Dates are date-only UTC-midnight values. A "day count" is whole days between two of them.
//  • yearsHeld        = max(0, days(purchaseDate → today)) / 365.25  (fractional; future purchase → 0).
//  • Current Value    = purchasePrice × (1 + rate/100) ^ yearsHeld.
//  • Best Offer       = highest Offer.amount for the unit; tie → the most recent offerDate. Its date = bestOfferDate.
//  • Valuation        = bestOffer ?? currentValue (valuationSource "offer" | "estimate").
//  • Appreciation     = valuation − purchasePrice; appreciationPct = appreciation / purchasePrice (0 when price is 0).
//  • Portfolio totals (invested, currentValue, bestOfferTotal, appreciation, sqft, occupancy, vacancy)
//    = Σ over ACTIVE units only. Inactive units are still listed in `units` (flagged), after the active ones.
//  • bestOfferTotal   = Σ valuation (an offer where there is one, else the estimate);
//    bestOfferIsPartialEstimate = true when any active unit has no offer.
//  • Capital Multiplier = bestOfferTotal / invested (null when invested = 0).
//  • holdingYears     = investment-weighted mean of yearsHeld: Σ(price × years) / Σ price (0 when Σ price = 0).
//  • CAGR             = (bestOfferTotal / invested) ^ (1 / holdingYears) − 1;
//    null when invested = 0, holdingYears < 1/365, or the result is not finite.
//  • Rent Collected   = Σ ALL payments (every lease, every unit, active or not).
//  • Total Expenses   = Σ ALL expenses (includes the Expense rows auto-created for Paid property tax).
//  • Net Profit       = rentCollected − totalExpenses.   Total Return = appreciation (active) + rentCollected.
//  • Active lease     = endDate null. Security deposits held = Σ securityDeposit; rent roll = Σ monthlyRent,
//    both over ALL active leases. overdueCount / overdueAmount = count / Σ amountDue of overdue next payments.
//  • Per sqft         = invested / Σ builtUpSqft and bestOfferTotal / Σ builtUpSqft (active units; null when sqft = 0).
//  • Vacancy (derived, never stored) — half-open day intervals:
//      owned [purchaseDate, today); each lease occupies [startDate, endDate ?? today) clipped to owned
//      (so leases starting before purchase are clipped); overlapping/adjacent leases are merged; the gaps
//      are vacant periods (VacantPeriod.end is exclusive). daysOwned = max(0, today − purchaseDate).
//  • Unrealized loss per gap = days × rentBasis / 30. rentBasis = monthlyRent of the most recent lease that
//    started on/before the gap start; if none (gap precedes the first lease) the next lease's rent; if the unit
//    never had a lease → 0 with noRentHistory = true.
//  • Occupancy        = occupied days / days owned (unit); portfolio = Σ occupied / Σ owned (active units); 0 when nothing owned.
//  • Next payment (per active lease): last paid period = max(periodYear×12 + periodMonth) of its payments; the next
//    period is the month after it, due on Settings.rentDueDay clamped to the month length (31 → 28/29/30).
//    No payments → the first period is the lease start month, due max(due day of start month, startDate).
//    The due date is never before the lease start (guards payments recorded for periods before the start).
//    Overdue = dueDate < today; daysOverdue = today − dueDate (0 when not overdue).
//    Late fee: lateFeeEnabled AND today > dueDate + lateFeeGraceDays → flat lateFeeAmount added to amountDue.
//  • rentState: no active lease → "none"; overdue → "overdue"; due within 0..5 days → "due-soon"; else "paid".
//    Unit status: inactive → "inactive"; has an active lease → "occupied"; else "vacant".
//    A unit's activeLease / nextPayment = its active lease with the latest startDate.
//  • monthlyByYear: income by paymentDate (cash basis), expenses by expenseDate; one YearSeries per calendar year
//    with any payment or expense, plus today's year (ascending); 12 months each, `cumulative` = running net in-year.
//    cumulativeNetByYear uses the same years: that year's net and the all-time running total.
//  • expenseComposition: slices per category with amount > 0, sorted amount desc (then name); share = amount / total.
//    byYear has one entry for every year in monthlyByYear (slices may be empty).
//  • vacancy.units = active units only, so it adds up to the vacancy / kpi totals.
//  • actions.pending: not done, sorted dueDate asc (undated last) → priority High→Low → title; isOverdue = dueDate < today.
//  • recentPayments: latest 8 by paymentDate desc, then invoiceSeq desc.
//  • Plot: each null dimension falls back to the owner's site plan (22.25 / 23.25 / 76.66 ft) and sets usingDefaults;
//    a null area = (front + back) / 2 × depth.
//  • Units order: active first, then inactive; within each: front, back, no position, then createdAt (then id).
//  • Every money output is round2()-ed; per-unit values are rounded first and totals are sums of the rounded values,
//    so the cards always add up to the KPIs. Ratios / percentages are fractions rounded to 6 dp; years to 6 dp.
import type {
  DashboardData,
  ExpenseSlice,
  Kpis,
  NextPayment,
  PlotGeometry,
  RentState,
  UnitBreakdown,
  UnitStatus,
  VacantPeriod,
  YearSeries,
} from "./dashboard-types";
import { MONTHS_SHORT, MS_PER_DAY, dateOnly } from "./dates";

// ───────────────────────────── input types (plain numbers, date-only Dates) ─────────────────────────────

export interface SettingsInput {
  brandName: string;
  subtitle: string | null;
  currency: string;
  rentDueDay: number;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  lateFeeGraceDays: number;
}

export interface PlotInput {
  frontWidthFt: number | null;
  backWidthFt: number | null;
  depthFt: number | null;
  areaSqft: number | null;
  townName: string;
  sitePlanImageUrl: string | null;
}

export interface UnitInput {
  id: string;
  name: string;
  type: string;
  position: "front" | "back" | null;
  floors: number;
  isActive: boolean;
  builtUpSqft: number;
  footprintWidthFt: number | null;
  footprintDepthFt: number | null;
  purchaseDate: Date;
  purchasePrice: number;
  /** percent per year, e.g. 8.5 */
  annualAppreciationRate: number;
  electricityConsumerNumber: string | null;
  electricityPayUrl: string | null;
  createdAt: Date;
}

export interface OfferInput {
  id: string;
  unitId: string;
  amount: number;
  offerDate: Date;
}

export interface LeaseInput {
  id: string;
  unitId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  startDate: Date;
  /** null = active */
  endDate: Date | null;
  monthlyRent: number;
  securityDeposit: number;
}

export interface PaymentInput {
  id: string;
  leaseId: string;
  amount: number;
  paymentDate: Date;
  periodMonth: number;
  periodYear: number;
  invoiceSeq: number;
  invoiceNumber: string;
}

export interface ExpenseInput {
  id: string;
  /** null = whole plot */
  unitId: string | null;
  categoryId: string;
  expenseDate: Date;
  amount: number;
}

export interface CategoryInput {
  id: string;
  name: string;
  color: string;
}

export interface ActionInput {
  id: string;
  title: string;
  priority: "Low" | "Medium" | "High";
  dueDate: Date | null;
  isDone: boolean;
  unitId: string | null;
}

export interface DashboardInput {
  settings: SettingsInput;
  plot: PlotInput;
  units: UnitInput[];
  offers: OfferInput[];
  leases: LeaseInput[];
  payments: PaymentInput[];
  expenses: ExpenseInput[];
  categories: CategoryInput[];
  actions: ActionInput[];
}

// ───────────────────────────── rounding + small helpers ─────────────────────────────

/** Sum of amounts, rounded to paise. Used for every expense / payment total in the app. */
export function sumAmounts(rows: { amount: number }[]): number {
  return round2(rows.reduce((s, r) => s + r.amount, 0));
}

/** Round to paise, half away from zero. toPrecision(15) first strips binary noise (1.005 × 100 = 100.49999…). */
export function round2(n: number): number {
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(15)));
  return n < 0 && cents !== 0 ? -cents / 100 : cents / 100;
}

/** Ratios, percentages (as fractions) and year counts. */
export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Day number since the epoch for a date-only value. */
const dayNum = (d: Date) => Math.round(d.getTime() / MS_PER_DAY);
const fromDayNum = (n: number) => new Date(n * MS_PER_DAY);
const isoDay = (n: number) => fromDayNum(n).toISOString();
const ratio = (a: number, b: number) => (b > 0 ? round6(a / b) : 0);
const stripTime = (d: Date) => dateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

function groupBy<T>(rows: T[], key: (r: T) => string | number): Map<string | number, T[]> {
  const m = new Map<string | number, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/** Days in month (month 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ───────────────────────────── valuation ─────────────────────────────

/** Fractional years between two date-only values: days / 365.25, never negative. */
export function yearsBetween(from: Date, to: Date): number {
  return Math.max(0, dayNum(to) - dayNum(from)) / 365.25;
}

/** price × (1 + rate/100) ^ years (unrounded). */
export function appreciatedValue(purchasePrice: number, annualRatePct: number, years: number): number {
  return purchasePrice * Math.pow(Math.max(0, 1 + annualRatePct / 100), years);
}

/** Highest offer; ties → the most recent offerDate. null when there are no offers. */
export function pickBestOffer<T extends Pick<OfferInput, "amount" | "offerDate">>(offers: T[]): T | null {
  let best: T | null = null;
  for (const o of offers) {
    if (!best || o.amount > best.amount || (o.amount === best.amount && o.offerDate.getTime() > best.offerDate.getTime())) {
      best = o;
    }
  }
  return best;
}

/** Σ(price × years) / Σ price. */
export function weightedHoldingYears(units: { purchasePrice: number; yearsHeld: number }[]): number {
  const invested = units.reduce((s, u) => s + u.purchasePrice, 0);
  return invested > 0 ? units.reduce((s, u) => s + u.purchasePrice * u.yearsHeld, 0) / invested : 0;
}

export function capitalMultiplier(valuationTotal: number, invested: number): number | null {
  return invested > 0 ? round6(valuationTotal / invested) : null;
}

export function cagr(valuationTotal: number, invested: number, holdingYears: number): number | null {
  if (!(invested > 0) || !(holdingYears >= 1 / 365)) return null;
  const r = Math.pow(Math.max(0, valuationTotal) / invested, 1 / holdingYears) - 1;
  return Number.isFinite(r) ? round6(r) : null;
}

// ───────────────────────────── occupancy / vacancy ─────────────────────────────

type LeaseSpan = Pick<LeaseInput, "startDate" | "endDate" | "monthlyRent">;

export interface OccupancyResult {
  daysOwned: number;
  daysOccupied: number;
  vacantDays: number;
  vacantPeriods: VacantPeriod[];
  unrealizedLoss: number;
  /** the unit never had a lease, so losses are 0 by rule */
  noRentHistory: boolean;
}

/** Derive occupied days and vacant periods for one unit (see RULES: Vacancy). */
export function occupancyFor(purchaseDate: Date, today: Date, leases: LeaseSpan[]): OccupancyResult {
  const ownedStart = dayNum(purchaseDate);
  const ownedEnd = dayNum(today);
  const daysOwned = Math.max(0, ownedEnd - ownedStart);
  const sorted = [...leases].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const noRentHistory = sorted.length === 0;

  // Occupied spans clipped to [ownedStart, ownedEnd), merged.
  const spans = sorted
    .map((l) => [Math.max(dayNum(l.startDate), ownedStart), Math.min(l.endDate ? dayNum(l.endDate) : ownedEnd, ownedEnd)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [];
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const daysOccupied = merged.reduce((sum, [s, e]) => sum + (e - s), 0);

  const gaps: [number, number][] = [];
  let cursor = ownedStart;
  for (const [s, e] of merged) {
    if (s > cursor) gaps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (ownedEnd > cursor) gaps.push([cursor, ownedEnd]);

  const vacantPeriods = gaps.map(([s, e]): VacantPeriod => {
    let basis: LeaseSpan | undefined;
    for (const l of sorted) if (dayNum(l.startDate) <= s) basis = l; // most recent lease started on/before the gap
    basis ??= sorted[0]; // gap precedes the first lease → the next lease
    const rentBasis = basis ? basis.monthlyRent : 0;
    const days = e - s;
    return {
      start: isoDay(s),
      end: isoDay(e),
      days,
      rentBasis: round2(rentBasis),
      unrealizedLoss: round2((days * rentBasis) / 30),
      noRentHistory,
    };
  });

  return {
    daysOwned,
    daysOccupied,
    vacantDays: daysOwned - daysOccupied,
    vacantPeriods,
    unrealizedLoss: round2(vacantPeriods.reduce((s, p) => s + p.unrealizedLoss, 0)),
    noRentHistory,
  };
}

// ───────────────────────────── rent schedule ─────────────────────────────

type RentSettings = Pick<SettingsInput, "rentDueDay" | "lateFeeEnabled" | "lateFeeAmount" | "lateFeeGraceDays">;

/** Due date (date-only) of a rent period: due day clamped to the month length. */
export function dueDateFor(periodYear: number, periodMonth: number, rentDueDay: number): Date {
  const day = Math.min(Math.max(1, Math.trunc(rentDueDay) || 1), daysInMonth(periodYear, periodMonth));
  return dateOnly(periodYear, periodMonth, day);
}

/** Next rent due for an active lease (see RULES: Next payment). */
export function nextPaymentFor(
  lease: Pick<LeaseInput, "id" | "startDate" | "monthlyRent">,
  payments: Pick<PaymentInput, "periodMonth" | "periodYear">[],
  settings: RentSettings,
  today: Date,
): NextPayment {
  const start = stripTime(lease.startDate);
  const index = payments.length
    ? Math.max(...payments.map((p) => p.periodYear * 12 + (p.periodMonth - 1))) + 1
    : start.getUTCFullYear() * 12 + start.getUTCMonth();
  const periodYear = Math.floor(index / 12);
  const periodMonth = (index % 12) + 1;
  const due = Math.max(dayNum(dueDateFor(periodYear, periodMonth, settings.rentDueDay)), dayNum(start));
  const daysPastDue = dayNum(today) - due;
  const isOverdue = daysPastDue > 0;
  const lateFeeApplied = settings.lateFeeEnabled && daysPastDue > Math.max(0, settings.lateFeeGraceDays);
  const lateFee = lateFeeApplied ? round2(settings.lateFeeAmount) : 0;
  return {
    leaseId: lease.id,
    dueDate: isoDay(due),
    periodMonth,
    periodYear,
    amountDue: round2(lease.monthlyRent + lateFee),
    isOverdue,
    daysOverdue: isOverdue ? daysPastDue : 0,
    lateFeeApplied,
    lateFee,
  };
}

export function rentStateFor(next: NextPayment | null, today: Date): RentState {
  if (!next) return "none";
  if (next.isOverdue) return "overdue";
  return dayNum(new Date(next.dueDate)) - dayNum(today) <= 5 ? "due-soon" : "paid";
}

export function unitStatusFor(isActive: boolean, hasActiveLease: boolean): UnitStatus {
  return !isActive ? "inactive" : hasActiveLease ? "occupied" : "vacant";
}

// ───────────────────────────── plot ─────────────────────────────

/** Owner's site plan: 22'3" front, 23'3" back, 76.66 ft deep. */
export const SITE_PLAN_DEFAULTS = { frontWidthFt: 22.25, backWidthFt: 23.25, depthFt: 76.66 } as const;

/** Trapezoid area (front + back) / 2 × depth, in integer hundredths so 22.25/23.25/76.66 → 1744.02 exactly. */
export function trapezoidArea(frontWidthFt: number, backWidthFt: number, depthFt: number): number {
  const c = (n: number) => Math.round(n * 100);
  return Math.round(((c(frontWidthFt) + c(backWidthFt)) * c(depthFt)) / 200) / 100;
}

export function plotGeometry(plot: PlotInput): PlotGeometry {
  const usingDefaults = plot.frontWidthFt === null || plot.backWidthFt === null || plot.depthFt === null;
  const frontWidthFt = plot.frontWidthFt ?? SITE_PLAN_DEFAULTS.frontWidthFt;
  const backWidthFt = plot.backWidthFt ?? SITE_PLAN_DEFAULTS.backWidthFt;
  const depthFt = plot.depthFt ?? SITE_PLAN_DEFAULTS.depthFt;
  return {
    frontWidthFt,
    backWidthFt,
    depthFt,
    areaSqft: plot.areaSqft ?? trapezoidArea(frontWidthFt, backWidthFt, depthFt),
    townName: plot.townName,
    sitePlanImageUrl: plot.sitePlanImageUrl,
    usingDefaults,
  };
}

// ───────────────────────────── cash-flow series ─────────────────────────────

type Dated = { amount: number; date: Date };

/** Income (by paymentDate) vs expenses (by expenseDate) per month, one series per year with data + currentYear. */
export function monthlyByYear(
  payments: Pick<PaymentInput, "amount" | "paymentDate">[],
  expenses: Pick<ExpenseInput, "amount" | "expenseDate">[],
  currentYear: number,
): YearSeries[] {
  const inc: Dated[] = payments.map((p) => ({ amount: p.amount, date: p.paymentDate }));
  const exp: Dated[] = expenses.map((e) => ({ amount: e.amount, date: e.expenseDate }));
  const monthKey = (r: Dated) => r.date.getUTCFullYear() * 12 + r.date.getUTCMonth();
  const incByMonth = groupBy(inc, monthKey);
  const expByMonth = groupBy(exp, monthKey);
  const years = new Set<number>([currentYear]);
  for (const r of [...inc, ...exp]) years.add(r.date.getUTCFullYear());

  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      let running = 0;
      const months = MONTHS_SHORT.map((label, i) => {
        const income = sumAmounts(incByMonth.get(year * 12 + i) ?? []);
        const expensesM = sumAmounts(expByMonth.get(year * 12 + i) ?? []);
        const net = round2(income - expensesM);
        running = round2(running + net);
        return { month: i + 1, label, income, expenses: expensesM, net, cumulative: running };
      });
      const income = sumAmounts(inc.filter((r) => r.date.getUTCFullYear() === year));
      const expensesY = sumAmounts(exp.filter((r) => r.date.getUTCFullYear() === year));
      return { year, income, expenses: expensesY, net: round2(income - expensesY), months };
    });
}

export function cumulativeNetByYear(series: YearSeries[]): DashboardData["cumulativeNetByYear"] {
  let running = 0;
  return series.map((s) => {
    running = round2(running + s.net);
    return { year: s.year, net: s.net, cumulative: running };
  });
}

/** Expense share per category (amount > 0 only), largest first. */
export function expenseSlices(
  expenses: Pick<ExpenseInput, "amount" | "categoryId">[],
  categories: CategoryInput[],
): ExpenseSlice[] {
  const total = sumAmounts(expenses);
  const cats = new Map(categories.map((c) => [c.id, c]));
  return [...groupBy(expenses, (e) => e.categoryId)]
    .map(([id, rows]) => {
      const cat = cats.get(String(id));
      const amount = sumAmounts(rows);
      return {
        categoryId: String(id),
        name: cat?.name ?? "Uncategorised",
        color: cat?.color ?? "#8B93A7",
        amount,
        share: ratio(amount, total),
      };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

// ───────────────────────────── the dashboard ─────────────────────────────

const POSITION_RANK = { front: 0, back: 1 } as const;
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;

function compareUnits(a: UnitInput, b: UnitInput): number {
  return (
    Number(b.isActive) - Number(a.isActive) ||
    (a.position ? POSITION_RANK[a.position] : 2) - (b.position ? POSITION_RANK[b.position] : 2) ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Build the full GET /api/dashboard payload from plain inputs.
 * @param today date-only "today" in IST (time of day is ignored)
 * @param now   wall-clock instant, only used for generatedAt
 */
export function buildDashboard(input: DashboardInput, today: Date, now: Date): DashboardData {
  const t = stripTime(today);
  const { settings } = input;

  const offersByUnit = groupBy(input.offers, (o) => o.unitId);
  const leasesByUnit = groupBy(input.leases, (l) => l.unitId);
  const paymentsByLease = groupBy(input.payments, (p) => p.leaseId);
  const expensesByUnit = groupBy(
    input.expenses.filter((e) => e.unitId !== null),
    (e) => e.unitId as string,
  );

  // Next payment for EVERY active lease (KPIs count all of them, unit cards show their own).
  const activeLeases = input.leases.filter((l) => l.endDate === null);
  const nextByLease = new Map(
    activeLeases.map((l) => [l.id, nextPaymentFor(l, paymentsByLease.get(l.id) ?? [], settings, t)]),
  );

  const unitRows = [...input.units].sort(compareUnits).map((u) => {
    const leases = leasesByUnit.get(u.id) ?? [];
    const active =
      leases
        .filter((l) => l.endDate === null)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime() || a.id.localeCompare(b.id))[0] ?? null;
    const yearsHeld = yearsBetween(u.purchaseDate, t);
    const currentValue = round2(appreciatedValue(u.purchasePrice, u.annualAppreciationRate, yearsHeld));
    const best = pickBestOffer(offersByUnit.get(u.id) ?? []);
    const valuation = best ? round2(best.amount) : currentValue;
    const appreciation = round2(valuation - u.purchasePrice);
    const occ = occupancyFor(u.purchaseDate, t, leases);
    const nextPayment = active ? (nextByLease.get(active.id) ?? null) : null;

    const breakdown: UnitBreakdown = {
      id: u.id,
      name: u.name,
      type: u.type,
      position: u.position,
      floors: u.floors,
      isActive: u.isActive,
      status: unitStatusFor(u.isActive, active !== null),
      rentState: rentStateFor(nextPayment, t),
      builtUpSqft: u.builtUpSqft,
      footprintWidthFt: u.footprintWidthFt,
      footprintDepthFt: u.footprintDepthFt,
      purchaseDate: stripTime(u.purchaseDate).toISOString(),
      purchasePrice: round2(u.purchasePrice),
      annualAppreciationRate: u.annualAppreciationRate,
      yearsHeld: round6(yearsHeld),
      currentValue,
      bestOffer: best ? round2(best.amount) : null,
      bestOfferDate: best ? stripTime(best.offerDate).toISOString() : null,
      valuation,
      valuationSource: best ? "offer" : "estimate",
      appreciation,
      appreciationPct: u.purchasePrice > 0 ? round6(appreciation / u.purchasePrice) : 0,
      rentCollected: sumAmounts(leases.flatMap((l) => paymentsByLease.get(l.id) ?? [])),
      expenses: sumAmounts(expensesByUnit.get(u.id) ?? []),
      occupancyPct: ratio(occ.daysOccupied, occ.daysOwned),
      daysOwned: occ.daysOwned,
      daysOccupied: occ.daysOccupied,
      vacantPeriods: occ.vacantPeriods,
      vacantDays: occ.vacantDays,
      unrealizedLoss: occ.unrealizedLoss,
      activeLease: active && {
        id: active.id,
        tenantId: active.tenantId,
        tenantName: active.tenantName,
        tenantPhone: active.tenantPhone,
        startDate: stripTime(active.startDate).toISOString(),
        monthlyRent: round2(active.monthlyRent),
        securityDeposit: round2(active.securityDeposit),
      },
      nextPayment,
      electricityConsumerNumber: u.electricityConsumerNumber,
      electricityPayUrl: u.electricityPayUrl,
    };
    return { breakdown, yearsHeld, noRentHistory: occ.noRentHistory };
  });

  const units = unitRows.map((r) => r.breakdown);
  const activeRows = unitRows.filter((r) => r.breakdown.isActive);
  const act = activeRows.map((r) => r.breakdown);
  const sum = (pick: (u: UnitBreakdown) => number) => round2(act.reduce((s, u) => s + pick(u), 0));

  const invested = sum((u) => u.purchasePrice);
  const bestOfferTotal = sum((u) => u.valuation);
  const appreciation = sum((u) => u.appreciation);
  const totalBuiltUpSqft = sum((u) => u.builtUpSqft);
  const daysOwned = act.reduce((s, u) => s + u.daysOwned, 0);
  const daysOccupied = act.reduce((s, u) => s + u.daysOccupied, 0);
  const holdingYears = weightedHoldingYears(activeRows.map((r) => ({ purchasePrice: r.breakdown.purchasePrice, yearsHeld: r.yearsHeld })));
  const rentCollected = sumAmounts(input.payments);
  const totalExpenses = sumAmounts(input.expenses);
  const overdue = [...nextByLease.values()].filter((n) => n.isOverdue);
  const pendingActions = input.actions.filter((a) => !a.isDone);
  const occupancyPct = ratio(daysOccupied, daysOwned);
  const vacantDays = act.reduce((s, u) => s + u.vacantDays, 0);
  const unrealizedLoss = sum((u) => u.unrealizedLoss);

  const kpis: Kpis = {
    unitsActive: act.length,
    unitsOccupied: act.filter((u) => u.status === "occupied").length,
    invested,
    currentValue: sum((u) => u.currentValue),
    bestOfferTotal,
    bestOfferIsPartialEstimate: act.some((u) => u.valuationSource === "estimate"),
    appreciation,
    capitalMultiplier: capitalMultiplier(bestOfferTotal, invested),
    cagr: cagr(bestOfferTotal, invested, holdingYears),
    holdingYears: round6(holdingYears),
    rentCollected,
    totalExpenses,
    netProfit: round2(rentCollected - totalExpenses),
    securityDepositsHeld: sumAmounts(activeLeases.map((l) => ({ amount: l.securityDeposit }))),
    totalReturn: round2(appreciation + rentCollected),
    totalBuiltUpSqft,
    boughtAtPerSqft: totalBuiltUpSqft > 0 ? round2(invested / totalBuiltUpSqft) : null,
    offeredAtPerSqft: totalBuiltUpSqft > 0 ? round2(bestOfferTotal / totalBuiltUpSqft) : null,
    occupancyPct,
    vacantDays,
    unrealizedLoss,
    monthlyRentRoll: sumAmounts(activeLeases.map((l) => ({ amount: l.monthlyRent }))),
    overdueCount: overdue.length,
    overdueAmount: sumAmounts(overdue.map((n) => ({ amount: n.amountDue }))),
    pendingActions: pendingActions.length,
  };

  const series = monthlyByYear(input.payments, input.expenses, t.getUTCFullYear());
  const expensesByYear = groupBy(input.expenses, (e) => e.expenseDate.getUTCFullYear());

  const leaseById = new Map(input.leases.map((l) => [l.id, l]));
  const unitById = new Map(input.units.map((u) => [u.id, u]));
  const recentPayments = [...input.payments]
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime() || b.invoiceSeq - a.invoiceSeq)
    .slice(0, 8)
    .map((p) => {
      const lease = leaseById.get(p.leaseId);
      return {
        id: p.id,
        amount: round2(p.amount),
        paymentDate: stripTime(p.paymentDate).toISOString(),
        unitName: (lease && unitById.get(lease.unitId)?.name) ?? "—",
        tenantName: lease?.tenantName ?? "—",
        invoiceNumber: p.invoiceNumber,
      };
    });

  const pending = [...pendingActions]
    .sort(
      (a, b) =>
        (a.dueDate ? a.dueDate.getTime() : Infinity) - (b.dueDate ? b.dueDate.getTime() : Infinity) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.title.localeCompare(b.title),
    )
    .map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      dueDate: a.dueDate ? stripTime(a.dueDate).toISOString() : null,
      unitId: a.unitId,
      isOverdue: a.dueDate !== null && dayNum(a.dueDate) < dayNum(t),
    }));

  return {
    generatedAt: now.toISOString(),
    today: t.toISOString(),
    settings: {
      brandName: settings.brandName,
      subtitle: settings.subtitle,
      currency: settings.currency,
      rentDueDay: settings.rentDueDay,
      lateFeeEnabled: settings.lateFeeEnabled,
      lateFeeAmount: round2(settings.lateFeeAmount),
      lateFeeGraceDays: settings.lateFeeGraceDays,
    },
    plot: plotGeometry(input.plot),
    kpis,
    units,
    monthlyByYear: series,
    cumulativeNetByYear: cumulativeNetByYear(series),
    expenseComposition: {
      allTime: expenseSlices(input.expenses, input.categories),
      byYear: series.map((s) => ({ year: s.year, slices: expenseSlices(expensesByYear.get(s.year) ?? [], input.categories) })),
    },
    vacancy: {
      totalVacantDays: vacantDays,
      totalUnrealizedLoss: unrealizedLoss,
      occupancyPct,
      units: activeRows.map(({ breakdown: u, noRentHistory }) => ({
        unitId: u.id,
        unitName: u.name,
        vacantDays: u.vacantDays,
        unrealizedLoss: u.unrealizedLoss,
        periods: u.vacantPeriods,
        noRentHistory,
      })),
    },
    actions: { pending },
    recentPayments,
  };
}
