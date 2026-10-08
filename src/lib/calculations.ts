// Single source of truth for every money / KPI formula. Pure functions only: no Prisma, no I/O, no clock.
// src/lib/dashboard.ts loads the rows (Decimal → number) and calls buildDashboard(input, { asOf, yearMode, today, now });
// src/lib/reports.ts builds the printable reports from the same functions.
//
// RULES (owner's spec + "Calculation rule decisions" in CLAUDE.md) — and how each ambiguity is interpreted:
//  • Dates are date-only UTC-midnight values. A "day count" is whole days between two of them.
//  • AS OF: everything is computed for one date A (default today, IST). Payments / expenses / offers dated after A are
//    ignored, values are grown to A, leases are judged on A, units bought after A are not owned yet.
//  • Lease endDate = LAST DAY of tenancy (inclusive): a lease occupies the days [startDate, endDate + 1).
//    The next lease may start the day after endDate. Last rent month = the month of endDate.
//  • Lease state on A: start > A → "incoming"; end < A → "ended"; otherwise "current" (start ≤ A ≤ end, or open).
//  • Unit status: inactive → "inactive"; a current lease → "occupied"; else a lease starting after A → "incoming";
//    else "vacant". activeLease = the current lease (latest start if several); incomingLease = the earliest future one.
//  • yearsHeld = max(0, days(purchaseDate → A)) / 365.25. Current Value = price × (1 + rate/100) ^ yearsHeld.
//  • Best Offer = highest offer dated ≤ A; tie → the most recent offerDate. Valuation ("Worth now (est.)") =
//    bestOffer ?? currentValue. Gain = valuation − price. LVL (multiplier) = valuation / price.
//  • Portfolio value totals (invested, worth, gain, sqft, occupancy, vacancy, rent roll, deposits, arrears) = Σ over
//    ACTIVE units owned on A. Inactive units are listed in `units` (flagged) after the active ones.
//  • holdingYears = investment-weighted mean of yearsHeld: Σ(price × years) / Σ price.
//  • CAGR = (worth / invested) ^ (1 / years) − 1; null (with cagrNote) when nothing is invested or held < 1 year.
//  • Rent Collected = Σ ALL payments dated ≤ A (every lease, every unit). Expenses = Σ ALL expenses dated ≤ A
//    (includes the Expense rows auto-created for Paid property tax). Net cash = Rent collected − Expenses.
//    Total Return = Gain (active units) + Rent collected.
//  • Rent schedule: every month from the lease's start month to its last rent month expects one full month's rent —
//    the starting monthlyRent, or the latest rent change starting on/before that month (rentForMonth)
//    (no part-month proration). Due on Settings.rentDueDay clamped to the month length, never before the lease
//    start. "Paid" for a month = Σ payments recorded for that period and dated ≤ A.
//    A month is overdue from the day after its due date (dueDate < A).
//  • Arrears (current leases): every overdue month that is unpaid or part-paid, from the lease start to A's month.
//    Late fee (flat, per overdue month) when lateFeeEnabled AND lateFeeAmount > 0 AND A − dueDate > grace days.
//    overdueAmount = Σ outstanding + Σ late fees. nextPayment = the OLDEST month with anything outstanding
//    (scanning past A for leases paid in advance); null when an ended lease is fully paid.
//  • rentState: no current lease → "none"; any overdue month → "overdue"; next due within 0..5 days → "due-soon"; else "paid".
//  • Scoped cash (periods): allTime / year (FY Apr–Mar or calendar, containing A) / month (of A).
//    rentCollected = payments dated in the scope (cash). rentExpected = rent of lease-months in the scope whose due date
//    is before A; rentReceivedForScope = paid towards those months (capped at each month's rent); collection % =
//    received ÷ expected. Months in the scope not due yet → rentDueLater.
//  • Vacancy (derived, never stored) — half-open day intervals: owned [purchaseDate, A); each lease occupies
//    [start, end + 1) clipped to owned; overlapping/adjacent leases merge; the gaps are vacant periods.
//    Unrealized loss ("Rent lost") per gap = days × rentBasis / 30. rentBasis = rent of the most recent lease that
//    started on/before the gap; if none (gap before the first lease) the next lease's rent; never leased → 0.
//    Occupancy = occupied days / days owned (unit); portfolio = Σ occupied / Σ owned (active units).
//  • Deposits: received at lease start; a refund counts once recorded (refund date, else the last day, ≤ A).
//    Ended lease with a refund → kept = deposit − refunded; without → awaiting refund. Not ended → held.
//    Deposits held (KPI) = Σ held of current leases on active units. Deposits are never income.
//  • Year series: contiguous years (active year mode) from the first year with a purchase / payment / expense up to A's
//    year, zero-filled; months after A's month are flagged isFuture.
//  • Every money output is round2()-ed; estimates that never carry paise (growth estimate, rent lost, per sqft) are
//    whole rupees (round0). Per-unit values are rounded first and totals are sums of the rounded values, so the cards
//    always add up to the KPIs. Ratios / percentages are fractions rounded to 6 dp; years to 6 dp.
//  • EXPLAIN: each figure's explanation is produced by the code that computes it (KPIs are read from explain values);
//    the last step's value is the figure. More than 24 source records are grouped (payments by lease, expenses by
//    category) so the "what went into it" table stays small and still adds up.
//  • RECONCILIATION (checks): Σ unit + whole-plot expenses, Σ categories, Σ per-lease / per-unit rent, Σ years, Σ months,
//    net = rent − expenses, Σ unit worth, deposits identity, Σ arrears — any mismatch → ledgerBalanced false.
import type {
  Arrears,
  ArrearsMonth,
  CashChange,
  CashComparison,
  DashboardData,
  DepositRow,
  DepositsLedger,
  ExpenseSlice,
  Explain,
  ExplainBucket,
  ExplainFormat,
  ExplainInput,
  ExplainStep,
  Forecast,
  Kpis,
  LeaseState,
  LeaseSummary,
  MonthPoint,
  NextPayment,
  PeriodSummary,
  PlotGeometry,
  Reconciliation,
  ReconciliationItem,
  RenewalReminder,
  RentState,
  Timeline,
  TimelineMarker,
  UnitBreakdown,
  UnitStatus,
  VacantPeriod,
  YearMode,
  YearSeries,
  YieldRow,
  Yields,
} from "./dashboard-types";
import { MONTHS_SHORT, MS_PER_DAY, dateOnly, formatDate, todayIST } from "./dates";
import { formatINR, formatIndianNumber, formatPercent } from "./format";

export type { YearMode } from "./dashboard-types";

// ───────────────────────────── input types (plain numbers, date-only Dates) ─────────────────────────────

export interface SettingsInput {
  brandName: string;
  subtitle: string | null;
  currency: string;
  rentDueDay: number;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  lateFeeGraceDays: number;
  /** remind this many days before a rental agreement ends (default 30) */
  renewalReminderDays?: number;
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
  address?: string | null;
}

export interface OfferInput {
  id: string;
  unitId: string;
  amount: number;
  offerDate: Date;
  notes?: string | null;
}

export type RentTiming = "advance" | "arrears";

export interface LeaseInput {
  id: string;
  unitId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  startDate: Date;
  /** LAST DAY of tenancy (inclusive); null = open-ended */
  endDate: Date | null;
  /** STARTING rent; later revisions are in rentChanges */
  monthlyRent: number;
  /** rent revisions: from effectiveFrom's month on, each month expects that monthlyRent (see rentForMonth) */
  rentChanges?: RentChangeInput[];
  /** "advance" (default): a month's rent falls due in that month; "arrears": in the following month, after living it */
  rentTiming?: RentTiming;
  /** day of the month rent falls due for this lease; null/undefined = Settings.rentDueDay */
  rentDueDay?: number | null;
  securityDeposit: number;
  depositRefundedAmount?: number | null;
  depositRefundDate?: Date | null;
  /** the rental agreement's end (e.g. an 11-month agreement); null = not recorded */
  agreementEndDate?: Date | null;
}

export interface RentChangeInput {
  /** 1st of the month the new rent starts (date-only) */
  effectiveFrom: Date;
  monthlyRent: number;
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
  method?: string | null;
}

export interface ExpenseInput {
  id: string;
  /** null = whole plot */
  unitId: string | null;
  categoryId: string;
  expenseDate: Date;
  amount: number;
  description?: string | null;
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
  /** when the to-do was created (instant); used to hide it before that date in as-of views */
  createdAt?: Date | null;
  /** when it was ticked off (instant) */
  doneAt?: Date | null;
}

/** A property tax bill (one unit, one tax year). */
export interface PropertyTaxInput {
  id: string;
  unitId: string;
  year: number;
  amount: number;
  status: "Due" | "Paid";
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
  /** property tax bills (for the forecast's "tax still due"); optional so older callers keep working */
  propertyTax?: PropertyTaxInput[];
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

/** Whole rupees, half away from zero — for estimates (value growth, rent lost, per sqft) that never carry paise. */
export function round0(n: number): number {
  const r = Math.round(Number(Math.abs(n).toPrecision(15)));
  return n < 0 && r !== 0 ? -r : r;
}

/** Ratios, percentages (as fractions) and year counts. */
export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

const sum2 = (values: number[]) => round2(values.reduce((s, v) => s + v, 0));

/** Day number since the epoch (UTC calendar day — floors, so a stray time of day never shifts it). */
export const dayNum = (d: Date) => Math.floor(d.getTime() / MS_PER_DAY);
const fromDayNum = (n: number) => new Date(n * MS_PER_DAY);
const isoDay = (n: number) => fromDayNum(n).toISOString();
const ratio = (a: number, b: number) => (b > 0 ? round6(a / b) : 0);
const stripTime = (d: Date) => dateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
const iso = (d: Date) => stripTime(d).toISOString();

function groupBy<T, K extends string | number>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
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

// ───────────────────────────── months + years (FY / calendar) ─────────────────────────────

/** Months since year 0: year × 12 + (month − 1). */
export const monthIndex = (year: number, month: number) => year * 12 + (month - 1);
const monthIndexOfDay = (day: number) => {
  const d = fromDayNum(day);
  return monthIndex(d.getUTCFullYear(), d.getUTCMonth() + 1);
};
const miYear = (mi: number) => Math.floor(mi / 12);

type RentRevisable = Pick<LeaseInput, "monthlyRent" | "rentChanges">;

/** Rent a lease expects for month index `mi`: the latest rent change starting on/before that month, else the starting rent. */
export function rentForMonthIndex(lease: RentRevisable, mi: number): number {
  let rent = lease.monthlyRent;
  let from = -Infinity;
  for (const c of lease.rentChanges ?? []) {
    const ci = monthIndex(c.effectiveFrom.getUTCFullYear(), c.effectiveFrom.getUTCMonth() + 1);
    if (ci <= mi && ci > from) {
      from = ci;
      rent = c.monthlyRent;
    }
  }
  return rent;
}

/** Rent for a period (month 1-12). */
export const rentForMonth = (lease: RentRevisable, year: number, month: number) => rentForMonthIndex(lease, monthIndex(year, month));

/** The rent in effect on a date (the rent of that date's month). */
export const rentOn = (lease: RentRevisable, date: Date) => rentForMonthIndex(lease, monthIndexOfDay(dayNum(date)));
const miMonth = (mi: number) => (mi % 12) + 1;
const monthStartDay = (mi: number) => dayNum(dateOnly(miYear(mi), miMonth(mi), 1));
const monthEndDay = (mi: number) => monthStartDay(mi + 1) - 1;
/** "2026-07" */
export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
/** "Jul 2026" */
export const monthLabel = (year: number, month: number) => `${MONTHS_SHORT[month - 1]} ${year}`;
const miKey = (mi: number) => monthKey(miYear(mi), miMonth(mi));
const miLabel = (mi: number) => monthLabel(miYear(mi), miMonth(mi));

/** Year key of a date: the FY start year (Apr–Mar) or the calendar year. */
export function yearKeyOf(d: Date, mode: YearMode): number {
  return yearKeyOfMonth(monthIndex(d.getUTCFullYear(), d.getUTCMonth() + 1), mode);
}
function yearKeyOfMonth(mi: number, mode: YearMode): number {
  const y = miYear(mi);
  return mode === "fy" && miMonth(mi) < 4 ? y - 1 : y;
}
/** "FY 2025-26" or "2026". */
export function yearLabel(key: number, mode: YearMode): string {
  return mode === "fy" ? `FY ${key}-${String((key + 1) % 100).padStart(2, "0")}` : String(key);
}
/** First month index of a year key. */
const yearFirstMonth = (key: number, mode: YearMode) => monthIndex(key, mode === "fy" ? 4 : 1);
/** First and last day (date-only) of a year key. */
export function yearBounds(key: number, mode: YearMode): { start: Date; end: Date } {
  const first = yearFirstMonth(key, mode);
  return { start: fromDayNum(monthStartDay(first)), end: fromDayNum(monthEndDay(first + 11)) };
}

// ───────────────────────────── formatting for explanations ─────────────────────────────

const fINR = (n: number) => formatINR(n, !Number.isInteger(round2(n)));
const fPct = (f: number | null) => (f === null ? "—" : formatPercent(f));
const fMult = (x: number | null) => (x === null ? "—" : `×${x.toFixed(2)}`);
const fYears = (y: number) => `${y.toFixed(2)} yr`;
const fDays = (n: number) => `${formatIndianNumber(n)} day${n === 1 ? "" : "s"}`;
const plural = (n: number, word: string, many = `${word}s`) => `${formatIndianNumber(n)} ${n === 1 ? word : many}`;

function fmtValue(v: number | null, format: ExplainFormat): string {
  if (v === null) return "—";
  switch (format) {
    case "inr":
      return fINR(v);
    case "pct":
      return fPct(v);
    case "multiplier":
      return fMult(v);
    case "days":
      return fDays(v);
    case "years":
      return fYears(v);
    case "count":
      return formatIndianNumber(v);
    case "inrPerSqft":
      return `${fINR(v)}/sqft`;
  }
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

/** Why CAGR can't be shown, or null when it can. */
export function cagrNote(invested: number, holdingYears: number): string | null {
  if (!(invested > 0)) return "Nothing invested yet";
  if (!(holdingYears >= 1)) return "Held under 1 year — a yearly growth rate would be misleading";
  return null;
}

/** (total / invested) ^ (1 / years) − 1; null when nothing is invested or held under 1 year. */
export function cagr(valuationTotal: number, invested: number, holdingYears: number): number | null {
  if (cagrNote(invested, holdingYears)) return null;
  const r = Math.pow(Math.max(0, valuationTotal) / invested, 1 / holdingYears) - 1;
  return Number.isFinite(r) ? round6(r) : null;
}

export interface UnitValuation {
  daysHeld: number;
  yearsHeld: number;
  currentValue: number;
  best: OfferInput | null;
  offersCount: number;
  valuation: number;
  source: "offer" | "estimate";
  appreciation: number;
  appreciationPct: number;
  multiplier: number | null;
  cagr: number | null;
  cagrNote: string | null;
}

/** Worth of one unit on A from its offers dated ≤ A (pass them already filtered) and its growth estimate. */
export function valueUnit(u: UnitInput, offers: OfferInput[], asOf: Date): UnitValuation {
  const daysHeld = Math.max(0, dayNum(asOf) - dayNum(u.purchaseDate));
  const yearsHeld = daysHeld / 365.25;
  const currentValue = round0(appreciatedValue(u.purchasePrice, u.annualAppreciationRate, yearsHeld));
  const best = pickBestOffer(offers);
  const valuation = best ? round2(best.amount) : currentValue;
  const price = round2(u.purchasePrice);
  const appreciation = round2(valuation - price);
  return {
    daysHeld,
    yearsHeld,
    currentValue,
    best,
    offersCount: offers.length,
    valuation,
    source: best ? "offer" : "estimate",
    appreciation,
    appreciationPct: price > 0 ? round6(appreciation / price) : 0,
    multiplier: capitalMultiplier(valuation, price),
    cagr: cagr(valuation, price, yearsHeld),
    cagrNote: cagrNote(price, yearsHeld),
  };
}

// ───────────────────────────── leases: state, occupancy / vacancy ─────────────────────────────

type LeaseSpan = Pick<LeaseInput, "startDate" | "endDate" | "monthlyRent" | "rentChanges">;

/** incoming / current / ended on A (endDate is the last day, inclusive). */
export function leaseStateOn(lease: Pick<LeaseInput, "startDate" | "endDate">, asOf: Date): LeaseState {
  const a = dayNum(asOf);
  if (dayNum(lease.startDate) > a) return "incoming";
  if (lease.endDate !== null && dayNum(lease.endDate) < a) return "ended";
  return "current";
}

/** [start, end + 1) as day numbers; open leases run to +∞. */
const leaseDays = (l: Pick<LeaseInput, "startDate" | "endDate">): [number, number] => [
  dayNum(l.startDate),
  l.endDate === null ? Infinity : dayNum(l.endDate) + 1,
];

export interface OccupancyResult {
  daysOwned: number;
  daysOccupied: number;
  vacantDays: number;
  vacantPeriods: VacantPeriod[];
  unrealizedLoss: number;
  /** the unit never had a lease, so losses are 0 by rule */
  noRentHistory: boolean;
  /** a lease covers the as-of date itself */
  occupiedOnAsOf: boolean;
}

/**
 * Occupied days and vacant periods for one unit over owned days [from, asOf) — see RULES: Vacancy.
 * `from` defaults to the purchase date; pass a later day to measure a window (e.g. one year).
 */
export function occupancyFor(purchaseDate: Date, asOf: Date, leases: LeaseSpan[], from?: Date): OccupancyResult {
  const ownedStart = Math.max(dayNum(purchaseDate), from ? dayNum(from) : -Infinity);
  const ownedEnd = dayNum(asOf);
  const daysOwned = Math.max(0, ownedEnd - ownedStart);
  const sorted = [...leases].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const noRentHistory = sorted.length === 0;
  const occupiedOnAsOf = sorted.some((l) => {
    const [s, e] = leaseDays(l);
    return s <= ownedEnd && ownedEnd < e;
  });

  // Occupied spans clipped to [ownedStart, ownedEnd), merged.
  const spans = sorted
    .map((l) => {
      const [s, e] = leaseDays(l);
      return [Math.max(s, ownedStart), Math.min(e, ownedEnd)];
    })
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
    let source: VacantPeriod["rentBasisSource"] = basis ? "previous-lease" : "none";
    if (!basis && sorted.length) {
      basis = sorted.find((l) => dayNum(l.startDate) >= e) ?? sorted[0]; // gap precedes the first lease → the next lease
      source = "next-lease";
    }
    // previous lease → its rent in the gap's first month (after any rent change); next lease → its starting rent
    const rentBasis = basis ? (source === "previous-lease" ? rentForMonthIndex(basis, monthIndexOfDay(s)) : basis.monthlyRent) : 0;
    const days = e - s;
    return {
      start: isoDay(s),
      end: isoDay(e),
      lastDay: isoDay(e - 1),
      days,
      ongoing: e === ownedEnd && !occupiedOnAsOf,
      rentBasis: round2(rentBasis),
      rentBasisSource: source,
      unrealizedLoss: round0((days * rentBasis) / 30),
      noRentHistory,
    };
  });

  return {
    daysOwned,
    daysOccupied,
    vacantDays: daysOwned - daysOccupied,
    vacantPeriods,
    unrealizedLoss: sum2(vacantPeriods.map((p) => p.unrealizedLoss)),
    noRentHistory,
    occupiedOnAsOf,
  };
}

// ───────────────────────────── rent schedule, arrears, next payment ─────────────────────────────

type RentSettings = Pick<SettingsInput, "rentDueDay" | "lateFeeEnabled" | "lateFeeAmount" | "lateFeeGraceDays">;
type RentLease = Pick<LeaseInput, "id" | "startDate" | "endDate" | "monthlyRent" | "rentChanges" | "rentTiming" | "rentDueDay">;
type RentPayment = Pick<PaymentInput, "amount" | "paymentDate" | "periodMonth" | "periodYear">;

/** Due date (date-only) of a rent period: due day clamped to the month length. */
export function dueDateFor(periodYear: number, periodMonth: number, rentDueDay: number): Date {
  const day = Math.min(Math.max(1, Math.trunc(rentDueDay) || 1), daysInMonth(periodYear, periodMonth));
  return dateOnly(periodYear, periodMonth, day);
}

/**
 * Day number on which a lease's rent for (year, month) falls due. Day of month = the lease's own rentDueDay, else
 * Settings.rentDueDay (clamped to the month length). "advance": in that month, never before the lease start;
 * "arrears": in the following month (rent for October paid in November, after living it).
 */
export function rentDueDayNum(lease: Pick<LeaseInput, "startDate" | "rentTiming" | "rentDueDay">, year: number, month: number, settings: Pick<SettingsInput, "rentDueDay">): number {
  const day = lease.rentDueDay ?? settings.rentDueDay;
  if (lease.rentTiming === "arrears") {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    return dayNum(dueDateFor(ny, nm, day));
  }
  return Math.max(dayNum(dueDateFor(year, month, day)), dayNum(lease.startDate));
}

/** First and last rent month (month index) of a lease; last = month of the last day, null while open. */
export function leaseMonthBounds(lease: Pick<LeaseInput, "startDate" | "endDate">): { first: number; last: number | null } {
  const s = stripTime(lease.startDate);
  const e = lease.endDate ? stripTime(lease.endDate) : null;
  return {
    first: monthIndex(s.getUTCFullYear(), s.getUTCMonth() + 1),
    last: e ? monthIndex(e.getUTCFullYear(), e.getUTCMonth() + 1) : null,
  };
}

export interface RentMonth {
  leaseId: string;
  index: number; // month index
  year: number;
  month: number;
  key: string;
  label: string;
  dueDay: number; // day number of the due date
  due: number; // rent for this month (after any rent change)
  paid: number; // received for this month, dated ≤ A
  outstanding: number; // due − paid (negative when overpaid)
  isOverdue: boolean; // dueDate < A
  daysOverdue: number;
  lateFee: number; // only on overdue months with something outstanding
}

function lateFeeFor(settings: RentSettings, daysPastDue: number, outstanding: number): number {
  return settings.lateFeeEnabled && settings.lateFeeAmount > 0 && outstanding > 0 && daysPastDue > Math.max(0, settings.lateFeeGraceDays)
    ? round2(settings.lateFeeAmount)
    : 0;
}

function rentMonth(lease: RentLease, mi: number, paidByMonth: Map<number, number>, settings: RentSettings, a: number): RentMonth {
  const year = miYear(mi);
  const month = miMonth(mi);
  const dueDay = rentDueDayNum(lease, year, month, settings);
  const due = round2(rentForMonthIndex(lease, mi));
  const paid = round2(paidByMonth.get(mi) ?? 0);
  const outstanding = round2(due - paid);
  const daysOverdue = Math.max(0, a - dueDay);
  return {
    leaseId: lease.id,
    index: mi,
    year,
    month,
    key: monthKey(year, month),
    label: monthLabel(year, month),
    dueDay,
    due,
    paid,
    outstanding,
    isOverdue: daysOverdue > 0,
    daysOverdue,
    lateFee: daysOverdue > 0 ? lateFeeFor(settings, daysOverdue, outstanding) : 0,
  };
}

function paidByMonthOf(payments: RentPayment[], a: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of payments) {
    if (dayNum(p.paymentDate) > a) continue;
    const mi = monthIndex(p.periodYear, p.periodMonth);
    m.set(mi, (m.get(mi) ?? 0) + p.amount);
  }
  return m;
}

/**
 * The lease's rent months from its start month to min(last rent month, A's month) — empty when the lease starts after A.
 * Each month: rent due, paid by A (payments for that period dated ≤ A), outstanding, overdue, late fee.
 */
export function leaseRentMonths(lease: RentLease, payments: RentPayment[], settings: RentSettings, asOf: Date): RentMonth[] {
  const a = dayNum(asOf);
  if (dayNum(lease.startDate) > a) return [];
  return rentMonthsRange(lease, payments, settings, asOf, -Infinity, monthIndexOfDay(a));
}

/** The lease's rent months with index in [fromMonth, toMonth] (clipped to the lease), judged on A. */
export function rentMonthsRange(
  lease: RentLease,
  payments: RentPayment[],
  settings: RentSettings,
  asOf: Date,
  fromMonth: number,
  toMonth: number,
): RentMonth[] {
  const a = dayNum(asOf);
  const { first, last } = leaseMonthBounds(lease);
  const from = Math.max(first, fromMonth);
  const through = Math.min(last ?? Infinity, toMonth);
  const paid = paidByMonthOf(payments, a);
  const out: RentMonth[] = [];
  for (let mi = from; mi <= through; mi++) out.push(rentMonth(lease, mi, paid, settings, a));
  return out;
}

/** Overdue months with something outstanding (oldest first) and their totals. */
export function arrearsFrom(months: RentMonth[]): Arrears {
  const rows: ArrearsMonth[] = months
    .filter((m) => m.isOverdue && m.outstanding > 0)
    .map((m) => ({
      year: m.year,
      month: m.month,
      key: m.key,
      label: m.label,
      dueDate: isoDay(m.dueDay),
      due: m.due,
      paid: m.paid,
      outstanding: m.outstanding,
      daysOverdue: m.daysOverdue,
      lateFee: m.lateFee,
    }));
  const total = sum2(rows.map((r) => r.outstanding));
  const lateFees = sum2(rows.map((r) => r.lateFee));
  return { months: rows, total, lateFees, totalWithFees: round2(total + lateFees) };
}

/** Next rent to collect for a lease (see RULES: Arrears / nextPayment). */
export function nextPaymentFor(lease: RentLease, payments: RentPayment[], settings: RentSettings, asOf: Date): NextPayment | null {
  const a = dayNum(asOf);
  const months = leaseRentMonths(lease, payments, settings, asOf);
  let next = months.find((m) => m.outstanding > 0) ?? null;
  if (!next) {
    // Up to date through A's month (or the lease starts later): look ahead, skipping months paid in advance.
    const { first, last } = leaseMonthBounds(lease);
    const paid = paidByMonthOf(payments, a);
    const from = Math.max(first, months.length ? months[months.length - 1].index + 1 : first);
    for (let mi = from, guard = 0; (last === null || mi <= last) && guard < 1200; mi++, guard++) {
      const m = rentMonth(lease, mi, paid, settings, a);
      if (m.outstanding > 0) {
        next = m;
        break;
      }
    }
  }
  if (!next) return null;
  return {
    leaseId: lease.id,
    dueDate: isoDay(next.dueDay),
    periodMonth: next.month,
    periodYear: next.year,
    label: next.label,
    monthlyRent: next.due,
    paidSoFar: next.paid,
    amountDue: round2(next.outstanding + next.lateFee),
    isOverdue: next.isOverdue,
    daysOverdue: next.daysOverdue,
    lateFeeApplied: next.lateFee > 0,
    lateFee: next.lateFee,
    arrears: arrearsFrom(months),
  };
}

export function rentStateFor(next: NextPayment | null, asOf: Date): RentState {
  if (!next) return "none";
  if (next.isOverdue) return "overdue";
  return dayNum(new Date(next.dueDate)) - dayNum(asOf) <= 5 ? "due-soon" : "paid";
}

export function unitStatusFor(isActive: boolean, hasCurrentLease: boolean, hasIncomingLease = false): UnitStatus {
  if (!isActive) return "inactive";
  if (hasCurrentLease) return "occupied";
  return hasIncomingLease ? "incoming" : "vacant";
}

// ───────────────────────────── deposits ─────────────────────────────

/** One lease's deposit position on A (null when the lease starts after A). See RULES: Deposits. */
export function depositRowFor(lease: LeaseInput, unitName: string, asOf: Date): DepositRow | null {
  const a = dayNum(asOf);
  if (dayNum(lease.startDate) > a) return null;
  const deposit = round2(lease.securityDeposit);
  const refundAt = lease.depositRefundDate ?? lease.endDate ?? null;
  const recorded = lease.depositRefundedAmount != null && refundAt !== null && dayNum(refundAt) <= a;
  const refunded = recorded ? round2(Math.min(lease.depositRefundedAmount ?? 0, deposit)) : 0;
  const ended = lease.endDate !== null && dayNum(lease.endDate) < a;
  return {
    leaseId: lease.id,
    tenantName: lease.tenantName,
    unitId: lease.unitId,
    unitName,
    deposit,
    receivedDate: iso(lease.startDate),
    refunded,
    refundDate: recorded && refundAt ? iso(refundAt) : null,
    kept: ended && recorded ? round2(deposit - refunded) : 0,
    awaitingRefund: ended && !recorded ? deposit : 0,
    held: ended ? 0 : round2(deposit - refunded),
  };
}

export function depositsLedger(rows: DepositRow[]): DepositsLedger {
  return {
    received: sum2(rows.map((r) => r.deposit)),
    refunded: sum2(rows.map((r) => r.refunded)),
    kept: sum2(rows.map((r) => r.kept)),
    awaitingRefund: sum2(rows.map((r) => r.awaitingRefund)),
    held: sum2(rows.map((r) => r.held)),
    rows,
  };
}

// ───────────────────────────── plot ─────────────────────────────

/** Owner's annotated site plan: 23'3" front (Gate to Unit A), 22'3" back, 76.66 ft deep. */
export const SITE_PLAN_DEFAULTS = { frontWidthFt: 23.25, backWidthFt: 22.25, depthFt: 76.66 } as const;

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

/**
 * Income (by paymentDate) vs expenses (by expenseDate) per month, one series per year (FY or calendar) from the first
 * year with data (or `firstDate`, e.g. the earliest purchase) to A's year — contiguous and zero-filled.
 * Pass rows already filtered to ≤ A.
 */
export function monthlyByYear(
  payments: Pick<PaymentInput, "amount" | "paymentDate">[],
  expenses: Pick<ExpenseInput, "amount" | "expenseDate">[],
  asOf: Date,
  mode: YearMode = "fy",
  firstDate?: Date | null,
): YearSeries[] {
  const asOfMonth = monthIndexOfDay(dayNum(asOf));
  const mi = (d: Date) => monthIndex(d.getUTCFullYear(), d.getUTCMonth() + 1);
  const inc = groupBy(payments, (p) => mi(p.paymentDate));
  const exp = groupBy(expenses, (e) => mi(e.expenseDate));
  const lastKey = yearKeyOfMonth(asOfMonth, mode);
  let firstKey = lastKey;
  for (const k of [...inc.keys(), ...exp.keys()]) firstKey = Math.min(firstKey, yearKeyOfMonth(k, mode));
  if (firstDate) firstKey = Math.min(firstKey, yearKeyOf(firstDate, mode));

  const out: YearSeries[] = [];
  for (let key = firstKey; key <= lastKey; key++) {
    const first = yearFirstMonth(key, mode);
    let running = 0;
    const months: MonthPoint[] = [];
    for (let i = first; i < first + 12; i++) {
      const income = sumAmounts(inc.get(i) ?? []);
      const expensesM = sumAmounts(exp.get(i) ?? []);
      const net = round2(income - expensesM);
      running = round2(running + net);
      months.push({
        month: miMonth(i),
        year: miYear(i),
        key: miKey(i),
        label: MONTHS_SHORT[miMonth(i) - 1],
        longLabel: miLabel(i),
        income,
        expenses: expensesM,
        net,
        cumulative: running,
        isFuture: i > asOfMonth,
      });
    }
    const income = sum2(months.map((m) => m.income));
    const expensesY = sum2(months.map((m) => m.expenses));
    const { start, end } = yearBounds(key, mode);
    out.push({
      year: key,
      label: yearLabel(key, mode),
      mode,
      start: start.toISOString(),
      end: end.toISOString(),
      isCurrent: key === lastKey,
      income,
      expenses: expensesY,
      net: round2(income - expensesY),
      months,
    });
  }
  return out;
}

export function cumulativeNetByYear(series: YearSeries[]): DashboardData["cumulativeNetByYear"] {
  let running = 0;
  return series.map((s) => {
    running = round2(running + s.net);
    return { year: s.year, label: s.label, net: s.net, cumulative: running };
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
      const cat = cats.get(id);
      const amount = sumAmounts(rows);
      return {
        categoryId: id,
        name: cat?.name ?? "Uncategorised",
        color: cat?.color ?? "#8B93A7",
        amount,
        share: ratio(amount, total),
      };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

// ───────────────────────────── scoped cash (periods) ─────────────────────────────

export interface CashScope {
  kind: PeriodSummary["kind"];
  key: string;
  label: string;
  /** first day (null = all time) and last day counted (inclusive, ≤ A) */
  startDay: number | null;
  endDay: number;
  /** month-index window for rent months (null = from the beginning) */
  firstMonth: number | null;
  lastMonth: number;
}

export function allTimeScope(asOf: Date): CashScope {
  const a = dayNum(asOf);
  return { kind: "allTime", key: "all", label: "All time", startDay: null, endDay: a, firstMonth: null, lastMonth: monthIndexOfDay(a) };
}

/** The FY / calendar year `key`, counted up to A. */
export function yearScope(key: number, mode: YearMode, asOf: Date): CashScope {
  const a = dayNum(asOf);
  const first = yearFirstMonth(key, mode);
  return {
    kind: "year",
    key: String(key),
    label: yearLabel(key, mode),
    startDay: monthStartDay(first),
    endDay: Math.min(monthEndDay(first + 11), a),
    firstMonth: first,
    lastMonth: Math.min(first + 11, monthIndexOfDay(a)),
  };
}

export function monthScope(asOf: Date): CashScope {
  const d = stripTime(asOf);
  return monthScopeFor(d.getUTCFullYear(), d.getUTCMonth() + 1, asOf);
}

/** Any month, counted up to A. */
export function monthScopeFor(year: number, month: number, asOf: Date): CashScope {
  const mi = monthIndex(year, month);
  return {
    kind: "month",
    key: miKey(mi),
    label: miLabel(mi),
    startDay: monthStartDay(mi),
    endDay: Math.min(monthEndDay(mi), dayNum(asOf)),
    firstMonth: mi,
    lastMonth: mi,
  };
}

/** The same calendar day one year earlier (29 Feb → 28 Feb). */
export function yearEarlier(d: Date): Date {
  const y = d.getUTCFullYear() - 1;
  const m = d.getUTCMonth() + 1;
  return dateOnly(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m)));
}

const dayKey = (n: number) => isoDay(n).slice(0, 10);

/**
 * Custom dates (owner 8/10/2026): `from` → `to`, both inclusive, counted up to A. Cash = by date inside the range;
 * rent due = every month the range touches (the same whole-month rule as the month and year scopes).
 */
export function rangeScope(from: Date, to: Date, asOf: Date): CashScope {
  const s = dayNum(from);
  const t = dayNum(to);
  const e = Math.min(t, dayNum(asOf));
  return {
    kind: "range",
    key: `${dayKey(s)}..${dayKey(t)}`,
    label: `${formatDate(fromDayNum(s))} – ${formatDate(fromDayNum(t))}`,
    startDay: s,
    endDay: e,
    firstMonth: monthIndexOfDay(s),
    lastMonth: monthIndexOfDay(Math.max(s, e)),
  };
}

/** `part` (a month or year row of a statement) kept inside `outer` (the statement's own dates), so rows add up to it. */
export function clipScope(outer: CashScope, part: CashScope): CashScope {
  const lo = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
  return {
    ...part,
    startDay: lo(outer.startDay, part.startDay),
    endDay: Math.min(outer.endDay, part.endDay),
    firstMonth: lo(outer.firstMonth, part.firstMonth),
    lastMonth: Math.min(outer.lastMonth, part.lastMonth),
  };
}

/**
 * The span to compare with ("compared with last year"): a year → the year before up to the same day; a month → the
 * same month last year up to the same day; custom dates → the same dates a year earlier. All time → null.
 */
export function lastYearScope(scope: CashScope, mode: YearMode, asOf: Date): { scope: CashScope; label: string } | null {
  const before = yearEarlier(asOf);
  const upTo = (sc: CashScope, naturalEnd: number) => (sc.endDay < naturalEnd ? `${sc.label} to ${formatDate(fromDayNum(sc.endDay))}` : sc.label);
  if (scope.kind === "year") {
    const sc = yearScope(Number(scope.key) - 1, mode, before);
    return { scope: sc, label: upTo(sc, monthEndDay((sc.firstMonth ?? 0) + 11)) };
  }
  if (scope.kind === "month" && scope.firstMonth !== null) {
    const mi = scope.firstMonth - 12;
    const sc = monthScopeFor(miYear(mi), miMonth(mi), before);
    return { scope: sc, label: upTo(sc, monthEndDay(mi)) };
  }
  if (scope.kind === "range" && scope.startDay !== null) {
    const [, to] = scope.key.split("..");
    const toDay = to ? dayNum(new Date(`${to}T00:00:00.000Z`)) : scope.endDay;
    const sc = rangeScope(yearEarlier(fromDayNum(scope.startDay)), yearEarlier(fromDayNum(toDay)), before);
    return { scope: sc, label: sc.label };
  }
  return null;
}

const inDayScope = (s: CashScope, day: number) => (s.startDay === null || day >= s.startDay) && day <= s.endDay;
const inMonthScope = (s: CashScope, mi: number) => (s.firstMonth === null || mi >= s.firstMonth) && mi <= s.lastMonth;

/** Rent-schedule figures of a scope (see RULES: Scoped cash). */
function scheduleTotals(scope: CashScope, months: RentMonth[], a: number) {
  let expected = 0;
  let received = 0;
  let dueLater = 0;
  const dueMonths: RentMonth[] = [];
  for (const m of months) {
    if (!inMonthScope(scope, m.index)) continue;
    if (m.dueDay < a) {
      expected += m.due;
      received += Math.min(Math.max(0, m.paid), m.due);
      dueMonths.push(m);
    } else {
      dueLater += Math.max(0, m.due - m.paid);
    }
  }
  return { expected: round2(expected), received: round2(received), dueLater: round2(dueLater), dueMonths };
}

// ───────────────────────────── explain builders ─────────────────────────────

const MAX_INPUT_ROWS = 24;

const step = (label: string, expression: string, value: number | null, format: ExplainFormat = "inr"): ExplainStep => ({
  label,
  expression,
  value,
  format,
});

interface ExplainSpec {
  key: string;
  title: string;
  bucket: ExplainBucket;
  scope: string;
  value: number | null;
  format: ExplainFormat;
  plain: string;
  formula: string;
  steps: ExplainStep[];
  inputs?: ExplainInput[];
  inputsNote?: string | null;
  notes?: string[];
}

const explainOf = (s: ExplainSpec): Explain => ({
  key: s.key,
  title: s.title,
  bucket: s.bucket,
  scope: s.scope,
  value: s.value,
  format: s.format,
  plain: s.plain,
  formula: s.formula,
  steps: s.steps,
  inputs: s.inputs ?? [],
  inputsNote: s.inputsNote ?? null,
  notes: s.notes ?? [],
});

interface Part {
  label: string;
  value: number;
  expression?: string;
}

/** Steps for "a + b + … = total" (value = round2 Σ parts). */
function sumSteps(parts: Part[], totalLabel: string, format: ExplainFormat = "inr"): { steps: ExplainStep[]; total: number } {
  const total = format === "inr" ? sum2(parts.map((p) => p.value)) : parts.reduce((s, p) => s + p.value, 0);
  const steps = parts.map((p) => step(p.label, p.expression ?? fmtValue(p.value, format), p.value, format));
  if (parts.length !== 1) {
    const expr = parts.length ? `${parts.map((p) => fmtValue(p.value, format)).join(" + ")} = ${fmtValue(total, format)}` : fmtValue(0, format);
    steps.push(step(totalLabel, expr, total, format));
  } else {
    steps.push(step(totalLabel, fmtValue(total, format), total, format));
  }
  return { steps, total };
}

const unitInput = (u: UnitInput): ExplainInput => ({
  kind: "unit",
  id: u.id,
  label: `${u.name} — bought ${formatDate(u.purchaseDate)}`,
  value: round2(u.purchasePrice),
  date: iso(u.purchaseDate),
  unitId: u.id,
});
const offerInput = (o: OfferInput, unitName: string): ExplainInput => ({
  kind: "offer",
  id: o.id,
  label: `Offer for ${unitName}${o.notes ? ` — ${o.notes}` : ""}`,
  value: round2(o.amount),
  date: iso(o.offerDate),
  unitId: o.unitId,
});
const leaseLabel = (l: LeaseInput, unitName: string) =>
  `${l.tenantName} · ${unitName} · ${formatDate(l.startDate)} – ${l.endDate ? formatDate(l.endDate) : "open"}`;
const settingInput = (id: string, label: string, value: number | null): ExplainInput => ({
  kind: "setting",
  id,
  label,
  value,
  date: null,
  unitId: null,
});

/** Lookups shared by the explain builders. */
export interface Ctx {
  a: number;
  asOf: Date;
  mode: YearMode;
  settings: SettingsInput;
  unitById: Map<string, UnitInput>;
  leaseById: Map<string, LeaseInput>;
  categoryById: Map<string, CategoryInput>;
  asOfScope: string;
}

const unitNameOf = (ctx: Ctx, unitId: string | null) => (unitId === null ? "Whole plot" : (ctx.unitById.get(unitId)?.name ?? "Unknown unit"));

function paymentInputs(ctx: Ctx, payments: PaymentInput[]): { inputs: ExplainInput[]; note: string | null } {
  const sorted = [...payments].sort((x, y) => x.paymentDate.getTime() - y.paymentDate.getTime() || x.invoiceSeq - y.invoiceSeq);
  if (sorted.length <= MAX_INPUT_ROWS) {
    return {
      inputs: sorted.map((p) => {
        const l = ctx.leaseById.get(p.leaseId);
        return {
          kind: "payment" as const,
          id: p.id,
          label: `${p.invoiceNumber} · ${monthLabel(p.periodYear, p.periodMonth)} rent · ${l?.tenantName ?? "—"} · ${unitNameOf(ctx, l?.unitId ?? null)}`,
          value: round2(p.amount),
          date: iso(p.paymentDate),
          unitId: l?.unitId ?? null,
        };
      }),
      note: null,
    };
  }
  const byLease = groupBy(sorted, (p) => p.leaseId);
  return {
    inputs: [...byLease].map(([leaseId, rows]) => {
      const l = ctx.leaseById.get(leaseId);
      return {
        kind: "lease" as const,
        id: leaseId,
        label: `${l ? leaseLabel(l, unitNameOf(ctx, l.unitId)) : "Unknown lease"} — ${plural(rows.length, "payment")}`,
        value: sumAmounts(rows),
        date: iso(rows[rows.length - 1].paymentDate),
        unitId: l?.unitId ?? null,
      };
    }),
    note: `${plural(sorted.length, "payment")}, grouped by lease`,
  };
}

function expenseInputs(ctx: Ctx, expenses: ExpenseInput[]): { inputs: ExplainInput[]; note: string | null } {
  const sorted = [...expenses].sort((x, y) => x.expenseDate.getTime() - y.expenseDate.getTime() || x.id.localeCompare(y.id));
  if (sorted.length <= MAX_INPUT_ROWS) {
    return {
      inputs: sorted.map((e) => ({
        kind: "expense" as const,
        id: e.id,
        label: `${ctx.categoryById.get(e.categoryId)?.name ?? "Uncategorised"}${e.description ? ` — ${e.description}` : ""} · ${unitNameOf(ctx, e.unitId)}`,
        value: round2(e.amount),
        date: iso(e.expenseDate),
        unitId: e.unitId,
      })),
      note: null,
    };
  }
  const byCat = groupBy(sorted, (e) => e.categoryId);
  return {
    inputs: [...byCat]
      .map(([catId, rows]) => ({
        kind: "category" as const,
        id: catId,
        label: `${ctx.categoryById.get(catId)?.name ?? "Uncategorised"} — ${plural(rows.length, "expense")}`,
        value: sumAmounts(rows),
        date: iso(rows[rows.length - 1].expenseDate),
        unitId: null,
      }))
      .sort((x, y) => (y.value ?? 0) - (x.value ?? 0)),
    note: `${plural(sorted.length, "expense")}, grouped by category`,
  };
}

/** Explain key prefix for a scope: "" (all time), "year:", "month:". */
const scopePrefix = (s: CashScope) => (s.kind === "allTime" ? "" : `${s.kind}:`);

export interface CashData {
  payments: PaymentInput[]; // dated ≤ A
  expenses: ExpenseInput[]; // dated ≤ A
  months: RentMonth[]; // rent months of the leases in view, through A's month
}

/**
 * PeriodSummary + its four explains (rentCollected, expenses, netCash, collection) for one scope.
 * `unit` = unit-scoped view (its leases' rent, expenses tagged to it); otherwise the whole portfolio.
 */
export function scopedCash(ctx: Ctx, scope: CashScope, data: CashData, unit?: UnitInput): { summary: PeriodSummary; explains: Explain[] } {
  const prefix = unit ? `unit:${unit.id}:${scopePrefix(scope)}` : scopePrefix(scope);
  const scopeText = scope.kind === "allTime" ? "since you started" : `in ${scope.label}`;
  const payments = data.payments.filter((p) => inDayScope(scope, dayNum(p.paymentDate)));
  const expenses = data.expenses.filter((e) => inDayScope(scope, dayNum(e.expenseDate)));

  // Rent collected: per unit (portfolio) or per lease (unit view).
  const rentParts: Part[] = unit
    ? [...groupBy(payments, (p) => p.leaseId)].map(([leaseId, rows]) => {
        const l = ctx.leaseById.get(leaseId);
        return { label: `${l?.tenantName ?? "Unknown tenant"} — ${plural(rows.length, "payment")}`, value: sumAmounts(rows) };
      })
    : [...groupBy(payments, (p) => ctx.leaseById.get(p.leaseId)?.unitId ?? "?")].map(([unitId, rows]) => ({
        label: `${unitNameOf(ctx, unitId === "?" ? null : unitId)} — ${plural(rows.length, "payment")}`,
        value: sumAmounts(rows),
      }));
  const rent = sumSteps(rentParts, "Rent collected");
  const pIn = paymentInputs(ctx, payments);
  const rentExplain = explainOf({
    key: `${prefix}rentCollected`,
    title: "Rent collected",
    bucket: "cash",
    scope: scope.label,
    value: rent.total,
    format: "inr",
    plain: payments.length
      ? `All the rent ${unit ? `${unit.name}'s tenants` : "your tenants"} actually paid you ${scopeText}, counted on the day it was received.`
      : `No rent was received ${scopeText}.`,
    formula: "Add up every rent payment received in this period",
    steps: rent.steps,
    inputs: pIn.inputs,
    inputsNote: pIn.note,
    notes: ["Counted by the date the money was received (cash), whichever month it was for.", "Security deposits are not rent and are not included."],
  });

  // Expenses: per unit + whole plot (portfolio) or per category (unit view).
  const expParts: Part[] = unit
    ? [...groupBy(expenses, (e) => e.categoryId)].map(([catId, rows]) => ({
        label: `${ctx.categoryById.get(catId)?.name ?? "Uncategorised"} — ${plural(rows.length, "expense")}`,
        value: sumAmounts(rows),
      }))
    : [...groupBy(expenses, (e) => e.unitId ?? "")]
        .map(([unitId, rows]) => ({
          label: `${unitNameOf(ctx, unitId === "" ? null : unitId)} — ${plural(rows.length, "expense")}`,
          value: sumAmounts(rows),
          order: unitId === "" ? 1 : 0,
        }))
        .sort((x, y) => x.order - y.order)
        .map(({ label, value }) => ({ label, value }));
  const exp = sumSteps(expParts, "Expenses");
  const eIn = expenseInputs(ctx, expenses);
  const expNotes = ["Property tax marked Paid is included as an expense on its payment date."];
  if (unit) expNotes.push("Only expenses tagged to this unit — whole-plot expenses (compound wall, trees, auditor…) are in the portfolio total.");
  const expExplain = explainOf({
    key: `${prefix}expenses`,
    title: "Expenses",
    bucket: "cash",
    scope: scope.label,
    value: exp.total,
    format: "inr",
    plain: expenses.length ? `Everything you spent on ${unit ? unit.name : "the property"} ${scopeText}.` : `Nothing was spent ${scopeText}.`,
    formula: unit ? "Add up every expense tagged to this unit" : "Unit expenses + whole-plot expenses",
    steps: exp.steps,
    inputs: eIn.inputs,
    inputsNote: eIn.note,
    notes: expNotes,
  });

  const net = round2(rent.total - exp.total);
  const netExplain = explainOf({
    key: `${prefix}netCash`,
    title: "Net cash",
    bucket: "cash",
    scope: scope.label,
    value: net,
    format: "inr",
    plain: `Money in minus money out ${scopeText}${unit ? ` for ${unit.name}` : ""}: rent collected less expenses.`,
    formula: "Rent collected − Expenses",
    steps: [
      step("Rent collected", fINR(rent.total), rent.total),
      step("Expenses", fINR(exp.total), exp.total),
      step("Net cash", `${fINR(rent.total)} − ${fINR(exp.total)} = ${fINR(net)}`, net),
    ],
    notes: ["Property value (offers, estimates) and deposits are not cash and never enter this figure."],
  });

  // Collection: rent that fell due vs received towards it.
  const sched = scheduleTotals(scope, data.months, ctx.a);
  const collectionPct = sched.expected > 0 ? ratio(sched.received, sched.expected) : null;
  const byLease = groupBy(sched.dueMonths, (m) => m.leaseId);
  const dueParts: Part[] = [...byLease].map(([leaseId, rows]) => {
    const l = ctx.leaseById.get(leaseId);
    const amount = sum2(rows.map((r) => r.due));
    return {
      label: `${l?.tenantName ?? "Unknown tenant"}${unit ? "" : ` · ${unitNameOf(ctx, l?.unitId ?? null)}`} — ${plural(rows.length, "month")} due`,
      value: amount,
      expression: `${plural(rows.length, "month")} × ${fINR(rows[0].due)} = ${fINR(amount)}`,
    };
  });
  const dueSteps = sumSteps(dueParts, "Rent that fell due").steps;
  const unpaid = round2(sched.expected - sched.received);
  const collectionExplain = explainOf({
    key: `${prefix}collection`,
    title: scope.kind === "month" ? "This month's collection" : "Rent collection",
    bucket: "cash",
    scope: scope.label,
    value: collectionPct,
    format: "pct",
    plain:
      collectionPct === null
        ? `No rent has fallen due ${scopeText} yet${sched.dueLater > 0 ? ` — ${fINR(sched.dueLater)} is due later this ${scope.kind === "month" ? "month" : "period"}` : ""}.`
        : `Of the rent that fell due ${scopeText}, how much has been paid.`,
    formula: "Rent received for those months ÷ Rent that fell due",
    steps: [
      ...dueSteps,
      step("Received towards it", fINR(sched.received), sched.received),
      ...(unpaid > 0 ? [step("Still unpaid", `${fINR(sched.expected)} − ${fINR(sched.received)} = ${fINR(unpaid)}`, unpaid)] : []),
      step(
        "Collection",
        collectionPct === null ? "nothing due yet" : `${fINR(sched.received)} ÷ ${fINR(sched.expected)} = ${fPct(collectionPct)}`,
        collectionPct,
        "pct",
      ),
    ],
    inputs: [...byLease].map(([leaseId, rows]) => {
      const l = ctx.leaseById.get(leaseId);
      return {
        kind: "lease" as const,
        id: leaseId,
        label: l ? leaseLabel(l, unitNameOf(ctx, l.unitId)) : "Unknown lease",
        value: sum2(rows.map((r) => Math.min(Math.max(0, r.paid), r.due))),
        date: l ? iso(l.startDate) : null,
        unitId: l?.unitId ?? null,
      };
    }),
    notes: [
      `A month's rent falls due on the lease's own due day (default day ${ctx.settings.rentDueDay}) — in that month for rent paid in advance, in the next month for rent paid after the month; it counts here from the next day.`,
      "Each month of a lease expects one full month's rent (no part-month proration).",
      ...(sched.dueLater > 0 ? [`${fINR(sched.dueLater)} for this period isn't due yet and isn't counted.`] : []),
    ],
  });

  const summary: PeriodSummary = {
    kind: scope.kind,
    key: scope.key,
    label: scope.label,
    start: scope.startDay === null ? null : isoDay(scope.startDay),
    end: isoDay(scope.endDay),
    rentCollected: rent.total,
    rentExpected: sched.expected,
    rentReceivedForScope: sched.received,
    rentUnpaid: unpaid,
    rentDueLater: sched.dueLater,
    collectionPct,
    expenses: exp.total,
    net,
  };
  return { summary, explains: [rentExplain, expExplain, netExplain, collectionExplain] };
}

// ───────────────────────────── per-unit value / occupancy explains ─────────────────────────────

function estimateExpression(u: UnitInput, v: UnitValuation): string {
  return `${fINR(u.purchasePrice)} × (1 + ${u.annualAppreciationRate}%)^${v.yearsHeld.toFixed(2)} = ${fINR(v.currentValue)}`;
}

function unitValueExplains(ctx: Ctx, u: UnitInput, v: UnitValuation, offers: OfferInput[]): Explain[] {
  const p = `unit:${u.id}:`;
  const scope = ctx.asOfScope;
  const price = round2(u.purchasePrice);
  const sqft = u.builtUpSqft;
  const held = step(
    "Years held",
    `${formatDate(u.purchaseDate)} → ${formatDate(ctx.asOf)} = ${fDays(v.daysHeld)} ÷ 365.25 = ${v.yearsHeld.toFixed(2)}`,
    round6(v.yearsHeld),
    "years",
  );
  const estimate = explainOf({
    key: `${p}estimatedValue`,
    title: "Estimated value",
    bucket: "value",
    scope,
    value: v.currentValue,
    format: "inr",
    plain: `What ${u.name} would be worth if it grew ${u.annualAppreciationRate}% a year since you bought it.`,
    formula: "Purchase price × (1 + yearly rate) ^ years held",
    steps: [held, step("Estimate", estimateExpression(u, v), v.currentValue)],
    inputs: [unitInput(u), settingInput(`unit:${u.id}:annualAppreciationRate`, `Growth rate you set for ${u.name}`, u.annualAppreciationRate)],
    notes: ["An estimate from the growth rate you entered — not an offer and not cash."],
  });
  const bestOffer = explainOf({
    key: `${p}bestOffer`,
    title: "Best offer",
    bucket: "value",
    scope,
    value: v.best ? round2(v.best.amount) : null,
    format: "inr",
    plain: v.best
      ? `The highest offer anyone has made for ${u.name} (on ${formatDate(v.best.offerDate)}).`
      : `No offer has been recorded for ${u.name} yet.`,
    formula: "Highest offer received (a tie goes to the most recent)",
    steps: v.best
      ? [
          ...offers
            .slice()
            .sort((x, y) => x.offerDate.getTime() - y.offerDate.getTime())
            .map((o) => step(`Offer ${formatDate(o.offerDate)}`, fINR(o.amount), round2(o.amount))),
          step("Best offer", `highest of ${plural(offers.length, "offer")} = ${fINR(v.best.amount)}`, round2(v.best.amount)),
        ]
      : [step("Best offer", "no offers yet", null)],
    inputs: offers.map((o) => offerInput(o, u.name)),
    notes: v.best ? [] : ["Add an offer in Config → Offers when someone quotes a price."],
  });
  const worthNow = explainOf({
    key: `${p}worthNow`,
    title: "Worth now (est.)",
    bucket: "value",
    scope,
    value: v.valuation,
    format: "inr",
    plain:
      v.source === "offer"
        ? `What ${u.name} is worth if you sold at the best offer you've received.`
        : `What ${u.name} is worth by our growth estimate — no offer has been made yet.`,
    formula: "Best offer if there is one, otherwise the estimated value",
    steps:
      v.source === "offer" && v.best
        ? [step(`Best offer (${formatDate(v.best.offerDate)})`, fINR(v.best.amount), v.valuation)]
        : [held, step("Estimated value", estimateExpression(u, v), v.valuation)],
    inputs: v.best ? [offerInput(v.best, u.name), unitInput(u)] : [unitInput(u)],
    notes:
      v.source === "offer"
        ? v.currentValue !== v.valuation
          ? [`For comparison the growth estimate is ${fINR(v.currentValue)} at ${u.annualAppreciationRate}%/yr.`]
          : []
        : [`${u.name} has no offer yet — we used its estimated value (${fINR(v.currentValue)} at ${u.annualAppreciationRate}%/yr) instead.`],
  });
  const gain = explainOf({
    key: `${p}gain`,
    title: "Gain",
    bucket: "value",
    scope,
    value: v.appreciation,
    format: "inr",
    plain: `How much more ${u.name} is worth now than you paid for it (on paper — not cash).`,
    formula: "Worth now − Purchase price",
    steps: [
      step("Worth now", fINR(v.valuation), v.valuation),
      step("Purchase price", fINR(price), price),
      step("Gain", `${fINR(v.valuation)} − ${fINR(price)} = ${fINR(v.appreciation)}`, v.appreciation),
    ],
    inputs: v.best ? [unitInput(u), offerInput(v.best, u.name)] : [unitInput(u)],
    notes: [
      ...(price > 0 ? [`That is ${fPct(v.appreciationPct)} on what you paid (${fINR(v.appreciation)} ÷ ${fINR(price)}).`] : []),
      ...(v.source === "estimate" ? [`Based on the estimate — ${u.name} has no offer yet.`] : []),
    ],
  });
  const multiplier = explainOf({
    key: `${p}multiplier`,
    title: "Level (×)",
    bucket: "value",
    scope,
    value: v.multiplier,
    format: "multiplier",
    plain: `How many times your money ${u.name} is worth now: ×2.00 would mean it doubled.`,
    formula: "Worth now ÷ Purchase price",
    steps: [step("Level", v.multiplier === null ? "no purchase price" : `${fINR(v.valuation)} ÷ ${fINR(price)} = ${fMult(v.multiplier)}`, v.multiplier, "multiplier")],
    inputs: [unitInput(u)],
  });
  const ratioGrowth = price > 0 ? v.valuation / price : 0;
  const cagrX = explainOf({
    key: `${p}cagr`,
    title: "Growth per year (CAGR)",
    bucket: "value",
    scope,
    value: v.cagr,
    format: "pct",
    plain: v.cagr === null ? `Not shown: ${v.cagrNote ?? "not enough history"}.` : `The steady yearly growth that turns what you paid into what ${u.name} is worth now.`,
    formula: "(Worth now ÷ Purchase price) ^ (1 ÷ years held) − 1",
    steps:
      v.cagr === null
        ? [held, step("Growth per year", v.cagrNote ?? "not available", null, "pct")]
        : [
            held,
            step("Growth", `${fINR(v.valuation)} ÷ ${fINR(price)} = ${fMult(ratioGrowth)}`, round6(ratioGrowth), "multiplier"),
            step("Per year", `${ratioGrowth.toFixed(4)}^(1 ÷ ${v.yearsHeld.toFixed(2)}) − 1 = ${fPct(v.cagr)}`, v.cagr, "pct"),
          ],
    inputs: [unitInput(u)],
    notes: v.cagrNote ? [v.cagrNote] : [],
  });
  const boughtPer = sqft > 0 ? round0(price / sqft) : null;
  const offeredPer = sqft > 0 ? round0(v.valuation / sqft) : null;
  const perSqftBought = explainOf({
    key: `${p}perSqftBought`,
    title: "Bought at per sqft",
    bucket: "value",
    scope,
    value: boughtPer,
    format: "inrPerSqft",
    plain: `What you paid for each square foot of ${u.name}.`,
    formula: "Purchase price ÷ Built-up area",
    steps: [step("Per sqft", boughtPer === null ? "built-up area not set" : `${fINR(price)} ÷ ${formatIndianNumber(sqft, 2)} sqft = ${fINR(boughtPer)}`, boughtPer, "inrPerSqft")],
    inputs: [unitInput(u)],
  });
  const perSqftOffered = explainOf({
    key: `${p}perSqftOffered`,
    title: v.source === "offer" ? "Offered at per sqft" : "Worth per sqft (est.)",
    bucket: "value",
    scope,
    value: offeredPer,
    format: "inrPerSqft",
    plain: `What each square foot of ${u.name} is worth now (${v.source === "offer" ? "best offer" : "estimate"}).`,
    formula: "Worth now ÷ Built-up area",
    steps: [step("Per sqft", offeredPer === null ? "built-up area not set" : `${fINR(v.valuation)} ÷ ${formatIndianNumber(sqft, 2)} sqft = ${fINR(offeredPer)}`, offeredPer, "inrPerSqft")],
    inputs: v.best ? [unitInput(u), offerInput(v.best, u.name)] : [unitInput(u)],
  });
  return [estimate, bestOffer, worthNow, gain, multiplier, cagrX, perSqftBought, perSqftOffered];
}

function vacantPeriodStep(unitName: string | null, p: VacantPeriod): ExplainStep {
  const span = `${formatDate(p.start)} – ${p.ongoing ? "now" : formatDate(p.lastDay)}`;
  return step(
    `${unitName ? `${unitName} · ` : ""}${span}`,
    p.noRentHistory ? `${fDays(p.days)} (never let — no rent to compare)` : `${fDays(p.days)} × ${fINR(p.rentBasis)} ÷ 30 = ${fINR(p.unrealizedLoss)}`,
    p.unrealizedLoss,
  );
}

function rentLostNotes(periods: VacantPeriod[]): string[] {
  const notes = ["Rent lost is what the empty days would have earned at the unit's rent — an opportunity cost, never subtracted from cash."];
  if (periods.some((p) => p.rentBasisSource === "next-lease")) notes.push("Before the first lease we used the first tenant's rent.");
  if (periods.some((p) => p.noRentHistory)) notes.push("A unit that has never been let has no rent to compare, so its rent lost is ₹0.");
  return notes;
}

function unitOccupancyExplains(ctx: Ctx, u: UnitInput, occ: OccupancyResult, leases: LeaseInput[]): Explain[] {
  const p = `unit:${u.id}:`;
  const scope = "All time";
  const pct = ratio(occ.daysOccupied, occ.daysOwned);
  const leaseInputs = leases.map((l) => ({
    kind: "lease" as const,
    id: l.id,
    label: leaseLabel(l, u.name),
    value: round2(rentOn(l, ctx.asOf)),
    date: iso(l.startDate),
    unitId: u.id,
  }));
  const occupancy = explainOf({
    key: `${p}occupancy`,
    title: "Occupancy",
    bucket: "occupancy",
    scope,
    value: pct,
    format: "pct",
    plain: `Share of the days you've owned ${u.name} that a tenant lived there.`,
    formula: "Days let ÷ Days owned",
    steps: [
      step("Days owned", `${formatDate(u.purchaseDate)} → ${formatDate(ctx.asOf)} = ${fDays(occ.daysOwned)}`, occ.daysOwned, "days"),
      step("Days let", fDays(occ.daysOccupied), occ.daysOccupied, "days"),
      step("Occupancy", `${formatIndianNumber(occ.daysOccupied)} ÷ ${formatIndianNumber(occ.daysOwned)} = ${fPct(pct)}`, pct, "pct"),
    ],
    inputs: leaseInputs,
    notes: ["A lease counts from its start day through its last day of tenancy."],
  });
  const vd = sumSteps(
    occ.vacantPeriods.map((vp) => ({
      label: `${formatDate(vp.start)} – ${vp.ongoing ? "now" : formatDate(vp.lastDay)}`,
      value: vp.days,
      expression: fDays(vp.days),
    })),
    "Vacant days",
    "days",
  );
  const vacantDays = explainOf({
    key: `${p}vacantDays`,
    title: "Vacant days",
    bucket: "occupancy",
    scope,
    value: occ.vacantDays,
    format: "days",
    plain: occ.vacantDays ? `Days ${u.name} stood empty since you bought it.` : `${u.name} has never stood empty.`,
    formula: "Add up every empty stretch",
    steps: vd.steps,
    inputs: leaseInputs,
  });
  const rentLost = explainOf({
    key: `${p}rentLost`,
    title: "Rent lost (vacant)",
    bucket: "occupancy",
    scope,
    value: occ.unrealizedLoss,
    format: "inr",
    plain: `Rent ${u.name} could have earned on the days it stood empty.`,
    formula: "Each empty stretch: days × monthly rent ÷ 30",
    steps: occ.vacantPeriods.length
      ? [
          ...occ.vacantPeriods.map((vp) => vacantPeriodStep(null, vp)),
          step("Rent lost", `${occ.vacantPeriods.map((vp) => fINR(vp.unrealizedLoss)).join(" + ")} = ${fINR(occ.unrealizedLoss)}`, occ.unrealizedLoss),
        ]
      : [step("Rent lost", fINR(0), 0)],
    inputs: leaseInputs,
    notes: rentLostNotes(occ.vacantPeriods),
  });
  return [occupancy, vacantDays, rentLost];
}

function overdueSteps(ctx: Ctx, rows: { unitName: string | null; tenantName: string; arrears: Arrears }[]) {
  const steps: ExplainStep[] = [];
  const MAX_MONTH_ROWS = 12;
  for (const r of rows) {
    // A long run of arrears: the oldest months collapse into one line so the breakdown stays readable.
    const months = r.arrears.months;
    const cut = months.length > MAX_MONTH_ROWS ? months.length - (MAX_MONTH_ROWS - 1) : 0;
    if (cut > 0) {
      const older = months.slice(0, cut);
      const amount = sum2(older.map((m) => m.outstanding));
      steps.push(
        step(
          `${r.unitName ? `${r.unitName} · ` : ""}${older[0].label} – ${older[older.length - 1].label}`,
          `${plural(older.length, "month")} unpaid or part-paid = ${fINR(amount)}`,
          amount,
        ),
      );
    }
    for (const m of months.slice(cut)) {
      steps.push(
        step(
          `${r.unitName ? `${r.unitName} · ` : ""}${m.label} (due ${formatDate(m.dueDate)})`,
          m.paid > 0 ? `${fINR(m.due)} − ${fINR(m.paid)} paid = ${fINR(m.outstanding)}` : `${fINR(m.due)} unpaid`,
          m.outstanding,
        ),
      );
    }
  }
  const total = sum2(rows.map((r) => r.arrears.total));
  const fees = sum2(rows.map((r) => r.arrears.lateFees));
  const feeMonths = rows.reduce((n, r) => n + r.arrears.months.filter((m) => m.lateFee > 0).length, 0);
  const value = round2(total + fees);
  if (steps.length > 1) steps.push(step("Arrears", fINR(total), total));
  if (fees > 0) steps.push(step("Late fees", `${plural(feeMonths, "month")} × ${fINR(ctx.settings.lateFeeAmount)} = ${fINR(fees)}`, fees));
  steps.push(step("Overdue", fees > 0 ? `${fINR(total)} + ${fINR(fees)} = ${fINR(value)}` : fINR(value), value));
  return { steps, value };
}

function overdueNotes(ctx: Ctx): string[] {
  const s = ctx.settings;
  const notes = [
    `Rent is due on each lease's due day (default day ${s.rentDueDay}) — in the same month when paid in advance, in the following month when paid after the month (e.g. October's rent on 10 November); a month is overdue from the next day.`,
    "Every month from the lease start is checked: unpaid and part-paid months both count.",
  ];
  notes.push(
    s.lateFeeEnabled && s.lateFeeAmount > 0
      ? `Late fee: ${fINR(s.lateFeeAmount)} per overdue month once it is more than ${s.lateFeeGraceDays} day${s.lateFeeGraceDays === 1 ? "" : "s"} late (Settings).`
      : "Late fees are switched off in Settings.",
  );
  return notes;
}

// ───────────────────────────── reconciliation ─────────────────────────────

export function recon(key: string, label: string, expected: number, actual: number): ReconciliationItem {
  const e = round2(expected);
  const a = round2(actual);
  return { key, label, expected: e, actual: a, ok: Math.abs(e - a) < 0.005 };
}

export function reconciliation(items: ReconciliationItem[]): Reconciliation {
  return { ledgerBalanced: items.every((i) => i.ok), items };
}

// ───────────────────────────── the dashboard ─────────────────────────────

const POSITION_RANK = { front: 0, back: 1 } as const;
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;
/** Expenses at or above this show as markers on the timeline. */
export const BIG_EXPENSE_MIN = 20_000;

export function compareUnits(a: UnitInput, b: UnitInput): number {
  return (
    Number(b.isActive) - Number(a.isActive) ||
    (a.position ? POSITION_RANK[a.position] : 2) - (b.position ? POSITION_RANK[b.position] : 2) ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

export interface BuildOptions {
  /** date every figure is computed for (default: today) */
  asOf?: Date;
  /** default "fy" */
  yearMode?: YearMode;
  /** real today in IST (default: todayIST(now)) */
  today?: Date;
  /** wall clock, only used for generatedAt (default: new Date()) */
  now?: Date;
}

const leaseSummary = (l: LeaseInput, asOf: Date): LeaseSummary => ({
  id: l.id,
  tenantId: l.tenantId,
  tenantName: l.tenantName,
  tenantPhone: l.tenantPhone,
  startDate: iso(l.startDate),
  endDate: l.endDate ? iso(l.endDate) : null,
  monthlyRent: round2(rentOn(l, asOf)),
  securityDeposit: round2(l.securityDeposit),
  state: leaseStateOn(l, asOf),
  agreementEndDate: l.agreementEndDate ? iso(l.agreementEndDate) : null,
});

/** Normalised options (shared with the report builders). */
export function resolveOptions(o: BuildOptions) {
  const now = o.now ?? new Date();
  const today = stripTime(o.today ?? todayIST(now));
  const asOf = stripTime(o.asOf ?? today);
  return { now, today, asOf, mode: o.yearMode ?? ("fy" as YearMode) };
}

/** Lookups for explain builders (exported for reports). */
export function makeCtx(input: DashboardInput, asOf: Date, mode: YearMode): Ctx {
  return {
    a: dayNum(asOf),
    asOf,
    mode,
    settings: input.settings,
    unitById: new Map(input.units.map((u) => [u.id, u])),
    leaseById: new Map(input.leases.map((l) => [l.id, l])),
    categoryById: new Map(input.categories.map((c) => [c.id, c])),
    asOfScope: `As of ${formatDate(asOf)}`,
  };
}

/** Rent months (through A's month) of every lease that started by A. */
export function allRentMonths(input: DashboardInput, asOf: Date, leases: LeaseInput[] = input.leases): RentMonth[] {
  const paymentsByLease = groupBy(input.payments, (p) => p.leaseId);
  return leases.flatMap((l) => leaseRentMonths(l, paymentsByLease.get(l.id) ?? [], input.settings, asOf));
}

// ───────────────────────────── compared with last year (owner 8/10/2026) ─────────────────────────────

/** One figure now vs before: change = (now − before) ÷ |before| (null when before is ₹0). */
export const changeOf = (now: number, before: number): CashChange => ({
  now: round2(now),
  before: round2(before),
  change: round2(before) === 0 ? null : round6((now - before) / Math.abs(before)),
});

/** Rent collected / expenses / net cash in `now` vs `before` — cash by date, the same rule as scopedCash. */
export function compareCash(data: Pick<CashData, "payments" | "expenses">, now: CashScope, before: CashScope, label: string): CashComparison {
  const rent = (sc: CashScope) => sumAmounts(data.payments.filter((p) => inDayScope(sc, dayNum(p.paymentDate))));
  const spent = (sc: CashScope) => sumAmounts(data.expenses.filter((e) => inDayScope(sc, dayNum(e.expenseDate))));
  const [rn, rb, en, eb] = [rent(now), rent(before), spent(now), spent(before)];
  return {
    label,
    start: before.startDay === null ? null : isoDay(before.startDay),
    end: isoDay(Math.max(before.endDay, before.startDay ?? before.endDay)),
    rentCollected: changeOf(rn, rb),
    expenses: changeOf(en, eb),
    net: changeOf(round2(rn - en), round2(rb - eb)),
  };
}

/** "Rent collected vs last year" explanations: key `<prefix>yoy:<year|month>:<rentCollected|expenses|netCash>`. */
function comparisonExplains(prefix: string, scope: CashScope, cmp: CashComparison, who: string): Explain[] {
  const rows: [keyof Pick<CashComparison, "rentCollected" | "expenses" | "net">, string, string, string][] = [
    ["rentCollected", "rentCollected", "Rent collected", "rent collected"],
    ["expenses", "expenses", "Expenses", "money spent"],
    ["net", "netCash", "Net cash", "net cash (rent − expenses)"],
  ];
  return rows.map(([field, key, title, noun]) => {
    const c = cmp[field];
    const diff = round2(c.now - c.before);
    return explainOf({
      key: `${prefix}yoy:${scope.kind}:${key}`,
      title: `${title} vs last year`,
      bucket: "cash",
      scope: scope.label,
      value: c.change,
      format: "pct",
      plain:
        c.change === null
          ? `Nothing to compare with: ${who}${noun} was ₹0 in ${cmp.label}.`
          : `${who ? `${who}${noun}` : noun.charAt(0).toUpperCase() + noun.slice(1)} in ${scope.label}, compared with the same days a year earlier (${cmp.label}).`,
      formula: "(this period − the same period last year) ÷ the same period last year",
      steps: [
        step(scope.label, fINR(c.now), c.now),
        step(cmp.label, fINR(c.before), c.before),
        step("Difference", `${fINR(c.now)} − ${fINR(c.before)} = ${fINR(diff)}`, diff),
        step("Change", c.change === null ? "nothing last year to compare with" : `${fINR(diff)} ÷ ${fINR(Math.abs(c.before))} = ${fPct(c.change)}`, c.change, "pct"),
      ],
      notes: ["Last year is counted up to the same day, so a part of a year is compared with the same part of the year before."],
    });
  });
}

// ───────────────────────────── rental yield (owner 8/10/2026) ─────────────────────────────

const share = (x: number, base: number) => (base > 0 ? round6(x / base) : null);

function yieldRow(unitId: string | null, name: string, rent: number, expenses: number, price: number, value: number, fullYear: boolean): YieldRow {
  const net = round2(rent - expenses);
  return {
    unitId,
    name,
    rent: round2(rent),
    expenses: round2(expenses),
    net,
    price: round2(price),
    value: round2(value),
    grossOnPrice: share(rent, price),
    netOnPrice: share(net, price),
    grossOnValue: share(rent, value),
    netOnValue: share(net, value),
    fullYear,
  };
}

/** Yield explanations: key `<prefix>yield:<gross|net><Price|Value>`. */
function yieldExplains(prefix: string, r: YieldRow, scopeLabel: string, isUnit: boolean): Explain[] {
  const out: Explain[] = [];
  for (const basis of ["Price", "Value"] as const) {
    const base = basis === "Price" ? r.price : r.value;
    const baseLabel = basis === "Price" ? "Price paid" : "Worth now (est.)";
    for (const kind of ["gross", "net"] as const) {
      const top = kind === "gross" ? r.rent : r.net;
      const v = kind === "gross" ? (basis === "Price" ? r.grossOnPrice : r.grossOnValue) : basis === "Price" ? r.netOnPrice : r.netOnValue;
      const notes = ["Rent is the cash actually received in the last 12 months, so empty months lower the yield."];
      if (basis === "Value") notes.push("Worth now is an estimate — the best offer, else your growth rate.");
      if (!r.fullYear) notes.push("Owned for less than 12 months, so this covers only the months owned.");
      if (kind === "net" && isUnit) notes.push("Only expenses tagged to this unit — whole-plot costs are in the property's yield.");
      out.push(
        explainOf({
          key: `${prefix}yield:${kind}${basis}`,
          title: `${kind === "gross" ? "Gross" : "Net"} yield (on ${basis === "Price" ? "price paid" : "today's value"})`,
          bucket: basis === "Price" ? "cash" : "value",
          scope: scopeLabel,
          value: v,
          format: "pct",
          plain:
            kind === "gross"
              ? `How much of ${basis === "Price" ? "what you paid" : "what it's worth today"} came back as rent in a year.`
              : `What was left after expenses, as a share of ${basis === "Price" ? "what you paid" : "what it's worth today"}.`,
          formula: kind === "gross" ? `Rent in the last 12 months ÷ ${baseLabel.toLowerCase()}` : `(Rent − expenses in the last 12 months) ÷ ${baseLabel.toLowerCase()}`,
          steps: [
            step("Rent received", fINR(r.rent), r.rent),
            ...(kind === "net"
              ? [step("Expenses", fINR(r.expenses), r.expenses), step("Rent − expenses", `${fINR(r.rent)} − ${fINR(r.expenses)} = ${fINR(r.net)}`, r.net)]
              : []),
            step(baseLabel, fINR(base), base),
            step(`${kind === "gross" ? "Gross" : "Net"} yield`, v === null ? "no price recorded" : `${fINR(top)} ÷ ${fINR(base)} = ${fPct(v)}`, v, "pct"),
          ],
          notes,
        }),
      );
    }
  }
  return out;
}

// ───────────────────────────── next 12 months (owner 8/10/2026) ─────────────────────────────

const isPropertyTaxCategory = (name: string | undefined) => /property\s*tax/i.test(name ?? "");

/** Expenses that count as "usual running costs": not property tax, not a one-off (≥ BIG_EXPENSE_MIN). */
function usualCosts(expenses: ExpenseInput[], categories: CategoryInput[]): ExpenseInput[] {
  const name = new Map(categories.map((c) => [c.id, c.name]));
  return expenses.filter((e) => !isPropertyTaxCategory(name.get(e.categoryId)) && e.amount < BIG_EXPENSE_MIN);
}

// ───────────────────────────── renewals (owner 8/10/2026) ─────────────────────────────

/** Days between A and a rental agreement's end (negative = ended). */
export const agreementDaysLeft = (agreementEnd: Date, asOf: Date) => dayNum(agreementEnd) - dayNum(asOf);

/**
 * Build the full GET /api/dashboard payload from plain inputs (see RULES at the top).
 * Legacy form buildDashboard(input, today, now) = { asOf: today, today, now }.
 */
export function buildDashboard(input: DashboardInput, options?: BuildOptions): DashboardData;
export function buildDashboard(input: DashboardInput, today: Date, now: Date): DashboardData;
export function buildDashboard(input: DashboardInput, a?: BuildOptions | Date, b?: Date): DashboardData {
  const { now, today, asOf, mode } = resolveOptions(a instanceof Date ? { asOf: a, today: a, now: b } : (a ?? {}));
  const A = dayNum(asOf);
  const { settings } = input;
  const ctx = makeCtx(input, asOf, mode);

  // What existed on A.
  const owned = input.units.filter((u) => dayNum(u.purchaseDate) <= A);
  const ownedIds = new Set(owned.map((u) => u.id));
  const offers = input.offers.filter((o) => dayNum(o.offerDate) <= A);
  const payments = input.payments.filter((p) => dayNum(p.paymentDate) <= A);
  const expenses = input.expenses.filter((e) => dayNum(e.expenseDate) <= A);
  const leases = input.leases.filter((l) => ownedIds.has(l.unitId));

  const offersByUnit = groupBy(offers, (o) => o.unitId);
  const leasesByUnit = groupBy(leases, (l) => l.unitId);
  const paymentsByLease = groupBy(payments, (p) => p.leaseId);
  const expensesByUnit = groupBy(
    expenses.filter((e) => e.unitId !== null),
    (e) => e.unitId as string,
  );
  const months = allRentMonths({ ...input, payments }, asOf, leases);
  const monthsByLease = groupBy(months, (m) => m.leaseId);
  const unitName = (id: string) => ctx.unitById.get(id)?.name ?? "—";
  const depositRows = leases.flatMap((l) => depositRowFor(l, unitName(l.unitId), asOf) ?? []);
  const depositByLease = new Map(depositRows.map((r) => [r.leaseId, r]));

  const scopes = {
    allTime: allTimeScope(asOf),
    year: yearScope(yearKeyOf(asOf, mode), mode, asOf),
    month: monthScope(asOf),
  };
  // compared with last year: the same span one year earlier (exists for both the year and the month)
  const lastYear = { year: lastYearScope(scopes.year, mode, asOf)!, month: lastYearScope(scopes.month, mode, asOf)! };
  const explain: Record<string, Explain> = {};
  const put = (x: Explain) => (explain[x.key] = x);

  const unitRows = [...owned].sort(compareUnits).map((u) => {
    const uLeases = leasesByUnit.get(u.id) ?? [];
    const byStart = [...uLeases].sort((x, y) => y.startDate.getTime() - x.startDate.getTime() || x.id.localeCompare(y.id));
    const current = byStart.find((l) => leaseStateOn(l, asOf) === "current") ?? null;
    const incoming = [...byStart].reverse().find((l) => leaseStateOn(l, asOf) === "incoming") ?? null;
    const uOffers = offersByUnit.get(u.id) ?? [];
    const v = valueUnit(u, uOffers, asOf);
    const occ = occupancyFor(u.purchaseDate, asOf, uLeases);
    // Current lease → what is owed next (incl. arrears); no current lease → the incoming lease's first rent.
    const payLease = current ?? incoming;
    const nextPayment = payLease ? nextPaymentFor(payLease, paymentsByLease.get(payLease.id) ?? [], settings, asOf) : null;
    const uPayments = uLeases.flatMap((l) => paymentsByLease.get(l.id) ?? []);
    const uExpenses = expensesByUnit.get(u.id) ?? [];
    const uMonths = uLeases.flatMap((l) => monthsByLease.get(l.id) ?? []);
    const cashData = { payments: uPayments, expenses: uExpenses, months: uMonths };
    const all = scopedCash(ctx, scopes.allTime, cashData, u);
    const yr = scopedCash(ctx, scopes.year, cashData, u);
    const mo = scopedCash(ctx, scopes.month, cashData, u);
    for (const x of [...all.explains, ...yr.explains, ...mo.explains]) put(x);
    const uCmp = {
      year: compareCash(cashData, scopes.year, lastYear.year.scope, lastYear.year.label),
      month: compareCash(cashData, scopes.month, lastYear.month.scope, lastYear.month.label),
    };
    for (const x of [...comparisonExplains(`unit:${u.id}:`, scopes.year, uCmp.year, `${u.name}'s `), ...comparisonExplains(`unit:${u.id}:`, scopes.month, uCmp.month, `${u.name}'s `)]) put(x);
    for (const x of unitValueExplains(ctx, u, v, uOffers)) put(x);
    for (const x of unitOccupancyExplains(ctx, u, occ, uLeases)) put(x);

    const depositHeld = current ? (depositByLease.get(current.id)?.held ?? 0) : 0;
    put(
      explainOf({
        key: `unit:${u.id}:depositHeld`,
        title: "Deposit held",
        bucket: "cash",
        scope: ctx.asOfScope,
        value: depositHeld,
        format: "inr",
        plain: current ? `${current.tenantName}'s security deposit, which you hold and return when they leave.` : `No current tenant, so no deposit is held for ${u.name}.`,
        formula: "Security deposit of the current lease − any part already refunded",
        steps: [
          step("Deposit received", current ? fINR(current.securityDeposit) : fINR(0), current ? round2(current.securityDeposit) : 0),
          step("Deposit held", fINR(depositHeld), depositHeld),
        ],
        inputs: current
          ? [{ kind: "lease", id: current.id, label: leaseLabel(current, u.name), value: round2(current.securityDeposit), date: iso(current.startDate), unitId: u.id }]
          : [],
        notes: ["Deposits are the tenant's money held by you — never income."],
      }),
    );
    const od = overdueSteps(ctx, current && nextPayment ? [{ unitName: null, tenantName: current.tenantName, arrears: nextPayment.arrears }] : []);
    put(
      explainOf({
        key: `unit:${u.id}:overdue`,
        title: "Overdue rent",
        bucket: "cash",
        scope: ctx.asOfScope,
        value: od.value,
        format: "inr",
        plain:
          od.value > 0 && current
            ? `Rent ${current.tenantName} owes for months whose due date has passed.`
            : current
              ? "Nothing overdue — every month that has fallen due is paid."
              : `No current tenant in ${u.name}.`,
        formula: "Each overdue month: rent − paid for that month, + late fees",
        steps: od.steps,
        inputs: current
          ? [
              { kind: "lease", id: current.id, label: leaseLabel(current, u.name), value: round2(rentOn(current, ctx.asOf)), date: iso(current.startDate), unitId: u.id },
              ...(paymentsByLease.get(current.id) ?? [])
                .filter((pm) => nextPayment?.arrears.months.some((m) => m.year === pm.periodYear && m.month === pm.periodMonth))
                .map((pm) => ({
                  kind: "payment" as const,
                  id: pm.id,
                  label: `${pm.invoiceNumber} · ${monthLabel(pm.periodYear, pm.periodMonth)} rent (part payment)`,
                  value: round2(pm.amount),
                  date: iso(pm.paymentDate),
                  unitId: u.id,
                })),
            ]
          : [],
        notes: overdueNotes(ctx),
      }),
    );
    put(
      explainOf({
        key: `unit:${u.id}:rent`,
        title: "Monthly rent",
        bucket: "cash",
        scope: ctx.asOfScope,
        value: current ? round2(rentOn(current, ctx.asOf)) : 0,
        format: "inr",
        plain: current ? `The rent in ${current.tenantName}'s lease.` : `${u.name} has no current tenant.`,
        formula: "Monthly rent of the current lease",
        steps: [step("Monthly rent", current ? fINR(rentOn(current, ctx.asOf)) : "no current lease", current ? round2(rentOn(current, ctx.asOf)) : 0)],
        inputs: current
          ? [{ kind: "lease", id: current.id, label: leaseLabel(current, u.name), value: round2(rentOn(current, ctx.asOf)), date: iso(current.startDate), unitId: u.id }]
          : [],
        notes: incoming ? [`${incoming.tenantName} moves in on ${formatDate(incoming.startDate)} at ${fINR(incoming.monthlyRent)} a month.`] : [],
      }),
    );

    const boughtAtPerSqft = u.builtUpSqft > 0 ? round0(u.purchasePrice / u.builtUpSqft) : null;
    const offeredAtPerSqft = u.builtUpSqft > 0 ? round0(v.valuation / u.builtUpSqft) : null;
    const rentCollected = all.summary.rentCollected;
    const uExpTotal = all.summary.expenses;
    const breakdown: UnitBreakdown = {
      id: u.id,
      name: u.name,
      type: u.type,
      position: u.position,
      floors: u.floors,
      isActive: u.isActive,
      status: unitStatusFor(u.isActive, current !== null, incoming !== null),
      rentState: current ? rentStateFor(nextPayment, asOf) : "none",
      builtUpSqft: u.builtUpSqft,
      footprintWidthFt: u.footprintWidthFt,
      footprintDepthFt: u.footprintDepthFt,
      purchaseDate: iso(u.purchaseDate),
      purchasePrice: round2(u.purchasePrice),
      annualAppreciationRate: u.annualAppreciationRate,
      yearsHeld: round6(v.yearsHeld),
      currentValue: v.currentValue,
      bestOffer: v.best ? round2(v.best.amount) : null,
      bestOfferDate: v.best ? iso(v.best.offerDate) : null,
      offersCount: v.offersCount,
      valuation: v.valuation,
      valuationSource: v.source,
      appreciation: v.appreciation,
      appreciationPct: v.appreciationPct,
      capitalMultiplier: v.multiplier,
      cagr: v.cagr,
      cagrNote: v.cagrNote,
      boughtAtPerSqft,
      offeredAtPerSqft,
      rentCollected,
      expenses: uExpTotal,
      netCash: all.summary.net,
      periods: { allTime: all.summary, year: yr.summary, month: mo.summary },
      comparisons: uCmp,
      occupancyPct: ratio(occ.daysOccupied, occ.daysOwned),
      daysOwned: occ.daysOwned,
      daysOccupied: occ.daysOccupied,
      vacantPeriods: occ.vacantPeriods,
      vacantDays: occ.vacantDays,
      unrealizedLoss: occ.unrealizedLoss,
      activeLease: current && leaseSummary(current, asOf),
      incomingLease: incoming && leaseSummary(incoming, asOf),
      depositHeld,
      nextPayment,
      electricityConsumerNumber: u.electricityConsumerNumber,
      electricityPayUrl: u.electricityPayUrl,
    };
    return { u, breakdown, v, occ, current, nextPayment };
  });

  const units = unitRows.map((r) => r.breakdown);
  const activeRows = unitRows.filter((r) => r.breakdown.isActive);
  const act = activeRows.map((r) => r.breakdown);
  const inactiveNote = unitRows.some((r) => !r.breakdown.isActive)
    ? [`${unitRows.filter((r) => !r.breakdown.isActive).map((r) => r.u.name).join(", ")} is marked inactive and left out of this total.`]
    : [];
  const vScope = ctx.asOfScope;

  // ── property value (active units) ──
  const investedX = sumSteps(
    activeRows.map((r) => ({ label: `${r.u.name} — bought ${formatDate(r.u.purchaseDate)}`, value: r.breakdown.purchasePrice })),
    "Invested",
  );
  put(
    explainOf({
      key: "invested",
      title: "Invested",
      bucket: "value",
      scope: vScope,
      value: investedX.total,
      format: "inr",
      plain: "What you paid for your units.",
      formula: "Add up the purchase prices",
      steps: investedX.steps,
      inputs: activeRows.map((r) => unitInput(r.u)),
      notes: ["Purchase prices only — registration, renovation and other costs are in Expenses.", ...inactiveNote],
    }),
  );
  const invested = investedX.total;

  const estX = sumSteps(
    activeRows.map((r) => ({ label: `${r.u.name} — ${r.u.annualAppreciationRate}%/yr`, value: r.v.currentValue, expression: estimateExpression(r.u, r.v) })),
    "Estimated value",
  );
  put(
    explainOf({
      key: "estimatedValue",
      title: "Estimated value",
      bucket: "value",
      scope: vScope,
      value: estX.total,
      format: "inr",
      plain: "What your units would be worth if each grew at the yearly rate you set.",
      formula: "Σ Purchase price × (1 + rate) ^ years held",
      steps: estX.steps,
      inputs: activeRows.map((r) => unitInput(r.u)),
      notes: ["Estimates are not offers and not cash.", ...inactiveNote],
    }),
  );

  const withOffer = activeRows.filter((r) => r.v.best);
  const bestOfferX = sumSteps(
    withOffer.map((r) => ({ label: `${r.u.name} — best offer ${formatDate(r.v.best!.offerDate)}`, value: round2(r.v.best!.amount) })),
    "Best offer",
  );
  const bestOfferSum = withOffer.length ? bestOfferX.total : null;
  put(
    explainOf({
      key: "bestOffer",
      title: "Best offer",
      bucket: "value",
      scope: vScope,
      value: bestOfferSum,
      format: "inr",
      plain: withOffer.length ? "The highest offers you have received for your units, added up." : "No offers have been recorded yet.",
      formula: "Σ highest offer per unit (units with an offer)",
      steps: withOffer.length ? bestOfferX.steps : [step("Best offer", "no offers yet", null)],
      inputs: withOffer.map((r) => offerInput(r.v.best!, r.u.name)),
      notes: [
        ...activeRows.filter((r) => !r.v.best).map((r) => `${r.u.name} has no offer yet, so it isn't in this total.`),
        ...inactiveNote,
      ],
    }),
  );

  const worthX = sumSteps(
    activeRows.map((r) =>
      r.v.source === "offer"
        ? { label: `${r.u.name} — best offer (${formatDate(r.v.best!.offerDate)})`, value: r.v.valuation }
        : { label: `${r.u.name} — estimate (no offer yet)`, value: r.v.valuation, expression: estimateExpression(r.u, r.v) },
    ),
    "Worth now",
  );
  const bestOfferTotal = worthX.total;
  const estimated = activeRows.filter((r) => r.v.source === "estimate");
  put(
    explainOf({
      key: "worthNow",
      title: "Worth now (est.)",
      bucket: "value",
      scope: vScope,
      value: bestOfferTotal,
      format: "inr",
      plain:
        estimated.length === 0
          ? `What your ${activeRows.length === 1 ? "unit is" : "units are"} worth today if you sold at the best offers you've received.`
          : `What your ${activeRows.length === 1 ? "unit is" : "units are"} worth today: the best offer where you have one, otherwise our growth estimate.`,
      formula: "Σ (best offer, or the estimate when there is no offer)",
      steps: worthX.steps,
      inputs: activeRows.flatMap((r) => (r.v.best ? [offerInput(r.v.best, r.u.name)] : [unitInput(r.u)])),
      notes: [
        ...estimated.map((r) => `${r.u.name} has no offer yet — we used its estimated value (${fINR(r.v.currentValue)} at ${r.u.annualAppreciationRate}%/yr) instead.`),
        ...inactiveNote,
      ],
    }),
  );

  const gainX = sumSteps(
    activeRows.map((r) => ({
      label: r.u.name,
      value: r.v.appreciation,
      expression: `${fINR(r.v.valuation)} − ${fINR(r.breakdown.purchasePrice)} = ${fINR(r.v.appreciation)}`,
    })),
    "Gain",
  );
  const appreciation = gainX.total;
  put(
    explainOf({
      key: "gain",
      title: "Gain",
      bucket: "value",
      scope: vScope,
      value: appreciation,
      format: "inr",
      plain: "How much more your units are worth than you paid (on paper — you only get it if you sell).",
      formula: "Worth now − Invested",
      steps: [...gainX.steps.slice(0, -1), step("Gain", `${fINR(bestOfferTotal)} − ${fINR(invested)} = ${fINR(appreciation)}`, appreciation)],
      inputs: activeRows.map((r) => unitInput(r.u)),
      notes: [...estimated.map((r) => `${r.u.name}'s part is based on the estimate (no offer yet).`), ...inactiveNote],
    }),
  );

  const multiplier = capitalMultiplier(bestOfferTotal, invested);
  put(
    explainOf({
      key: "multiplier",
      title: "Level (×)",
      bucket: "value",
      scope: vScope,
      value: multiplier,
      format: "multiplier",
      plain: "How many times your money the property is worth now — ×2.00 would mean it doubled.",
      formula: "Worth now ÷ Invested",
      steps: [step("Level", multiplier === null ? "nothing invested yet" : `${fINR(bestOfferTotal)} ÷ ${fINR(invested)} = ${fMult(multiplier)}`, multiplier, "multiplier")],
      inputs: activeRows.map((r) => unitInput(r.u)),
      notes: estimated.length ? ["Uses the estimate for units without an offer."] : [],
    }),
  );

  const holdingYears = weightedHoldingYears(activeRows.map((r) => ({ purchasePrice: r.breakdown.purchasePrice, yearsHeld: r.v.yearsHeld })));
  const holdSteps: ExplainStep[] = [
    ...activeRows.map((r) =>
      step(
        `${r.u.name} held`,
        `${formatDate(r.u.purchaseDate)} → ${formatDate(asOf)} = ${fDays(r.v.daysHeld)} ÷ 365.25 = ${r.v.yearsHeld.toFixed(2)}`,
        round6(r.v.yearsHeld),
        "years",
      ),
    ),
    step(
      "Weighted by price",
      activeRows.length
        ? `(${activeRows.map((r) => `${fINR(r.breakdown.purchasePrice)} × ${r.v.yearsHeld.toFixed(2)}`).join(" + ")}) ÷ ${fINR(invested)} = ${holdingYears.toFixed(2)}`
        : "no units",
      round6(holdingYears),
      "years",
    ),
  ];
  put(
    explainOf({
      key: "holdingYears",
      title: "Years held",
      bucket: "value",
      scope: vScope,
      value: round6(holdingYears),
      format: "years",
      plain: "How long your money has been in the property on average — bigger purchases count for more.",
      formula: "Σ (price × years held) ÷ Σ price",
      steps: holdSteps,
      inputs: activeRows.map((r) => unitInput(r.u)),
    }),
  );

  const portfolioCagr = cagr(bestOfferTotal, invested, holdingYears);
  const portfolioCagrNote = cagrNote(invested, holdingYears);
  const growth = invested > 0 ? bestOfferTotal / invested : 0;
  put(
    explainOf({
      key: "cagr",
      title: "Growth per year (CAGR)",
      bucket: "value",
      scope: vScope,
      value: portfolioCagr,
      format: "pct",
      plain:
        portfolioCagr === null
          ? `Not shown: ${portfolioCagrNote ?? "not enough history"}.`
          : "The steady yearly growth rate that turns what you invested into what the property is worth now.",
      formula: "(Worth now ÷ Invested) ^ (1 ÷ years held) − 1",
      steps:
        portfolioCagr === null
          ? [...holdSteps, step("Growth per year", portfolioCagrNote ?? "not available", null, "pct")]
          : [
              ...holdSteps,
              step("Growth", `${fINR(bestOfferTotal)} ÷ ${fINR(invested)} = ${fMult(growth)}`, round6(growth), "multiplier"),
              step("Per year", `${growth.toFixed(4)}^(1 ÷ ${holdingYears.toFixed(2)}) − 1 = ${fPct(portfolioCagr)}`, portfolioCagr, "pct"),
            ],
      inputs: activeRows.map((r) => unitInput(r.u)),
      notes: [
        ...(portfolioCagrNote ? [portfolioCagrNote] : []),
        "Years held is the price-weighted average across units (see Years held).",
        ...(estimated.length ? ["Uses the estimate for units without an offer."] : []),
      ],
    }),
  );

  // ── cash (portfolio scopes) ──
  const cashData: CashData = { payments, expenses, months };
  const pAll = scopedCash(ctx, scopes.allTime, cashData);
  const pYear = scopedCash(ctx, scopes.year, cashData);
  const pMonth = scopedCash(ctx, scopes.month, cashData);
  for (const x of [...pAll.explains, ...pYear.explains, ...pMonth.explains]) put(x);
  const comparisons = {
    year: compareCash(cashData, scopes.year, lastYear.year.scope, lastYear.year.label),
    month: compareCash(cashData, scopes.month, lastYear.month.scope, lastYear.month.label),
  };
  for (const x of [...comparisonExplains("", scopes.year, comparisons.year, ""), ...comparisonExplains("", scopes.month, comparisons.month, "")]) put(x);
  const rentCollected = pAll.summary.rentCollected;
  const totalExpenses = pAll.summary.expenses;
  const wholePlotExpenses = sumAmounts(expenses.filter((e) => e.unitId === null));

  const totalReturn = round2(appreciation + rentCollected);
  put(
    explainOf({
      key: "totalReturn",
      title: "Total return",
      bucket: "value",
      scope: vScope,
      value: totalReturn,
      format: "inr",
      plain: "Everything the property has given you: the gain in value plus all the rent collected.",
      formula: "Gain + Rent collected",
      steps: [
        step("Gain (on paper)", fINR(appreciation), appreciation),
        step("Rent collected (cash)", fINR(rentCollected), rentCollected),
        step("Total return", `${fINR(appreciation)} + ${fINR(rentCollected)} = ${fINR(totalReturn)}`, totalReturn),
      ],
      notes: ["Mixes paper value and cash, as specified — expenses are not subtracted here (see Net cash)."],
    }),
  );

  // ── per sqft ──
  const sqftX = sumSteps(
    activeRows.map((r) => ({ label: r.u.name, value: r.u.builtUpSqft, expression: `${formatIndianNumber(r.u.builtUpSqft, 2)} sqft` })),
    "Built-up area",
    "count",
  );
  const totalBuiltUpSqft = round2(sqftX.total);
  const boughtAtPerSqft = totalBuiltUpSqft > 0 ? round0(invested / totalBuiltUpSqft) : null;
  const offeredAtPerSqft = totalBuiltUpSqft > 0 ? round0(bestOfferTotal / totalBuiltUpSqft) : null;
  put(
    explainOf({
      key: "perSqftBought",
      title: "Bought at per sqft",
      bucket: "value",
      scope: vScope,
      value: boughtAtPerSqft,
      format: "inrPerSqft",
      plain: "What you paid for each square foot of built-up area.",
      formula: "Invested ÷ Total built-up area",
      steps: [
        ...sqftX.steps,
        step(
          "Per sqft",
          boughtAtPerSqft === null ? "built-up area not set" : `${fINR(invested)} ÷ ${formatIndianNumber(totalBuiltUpSqft, 2)} sqft = ${fINR(boughtAtPerSqft)}`,
          boughtAtPerSqft,
          "inrPerSqft",
        ),
      ],
      inputs: activeRows.map((r) => unitInput(r.u)),
    }),
  );
  put(
    explainOf({
      key: "perSqftOffered",
      title: estimated.length ? "Worth per sqft (est.)" : "Offered at per sqft",
      bucket: "value",
      scope: vScope,
      value: offeredAtPerSqft,
      format: "inrPerSqft",
      plain: "What each square foot is worth now.",
      formula: "Worth now ÷ Total built-up area",
      steps: [
        ...sqftX.steps,
        step(
          "Per sqft",
          offeredAtPerSqft === null ? "built-up area not set" : `${fINR(bestOfferTotal)} ÷ ${formatIndianNumber(totalBuiltUpSqft, 2)} sqft = ${fINR(offeredAtPerSqft)}`,
          offeredAtPerSqft,
          "inrPerSqft",
        ),
      ],
      inputs: activeRows.map((r) => unitInput(r.u)),
      notes: estimated.length ? ["Uses the estimate for units without an offer."] : [],
    }),
  );

  // ── occupancy (active units) ──
  const daysOwned = act.reduce((s, u) => s + u.daysOwned, 0);
  const daysOccupied = act.reduce((s, u) => s + u.daysOccupied, 0);
  const occupancyPct = ratio(daysOccupied, daysOwned);
  put(
    explainOf({
      key: "occupancy",
      title: "Occupancy",
      bucket: "occupancy",
      scope: "All time",
      value: occupancyPct,
      format: "pct",
      plain: "Share of all the days you've owned your units that they had a tenant.",
      formula: "Σ days let ÷ Σ days owned",
      steps: [
        ...act.map((u) =>
          step(u.name, `${formatIndianNumber(u.daysOccupied)} let ÷ ${formatIndianNumber(u.daysOwned)} owned = ${fPct(u.occupancyPct)}`, u.occupancyPct, "pct"),
        ),
        step("Occupancy", `${formatIndianNumber(daysOccupied)} ÷ ${formatIndianNumber(daysOwned)} = ${fPct(occupancyPct)}`, occupancyPct, "pct"),
      ],
      inputs: activeRows.flatMap((r) => (leasesByUnit.get(r.u.id) ?? []).map((l) => ({ kind: "lease" as const, id: l.id, label: leaseLabel(l, r.u.name), value: round2(rentOn(l, ctx.asOf)), date: iso(l.startDate), unitId: r.u.id }))),
      notes: ["A lease counts from its start day through its last day of tenancy.", ...inactiveNote],
    }),
  );
  const vdX = sumSteps(
    act.map((u) => ({ label: `${u.name} — ${plural(u.vacantPeriods.length, "empty stretch", "empty stretches")}`, value: u.vacantDays, expression: fDays(u.vacantDays) })),
    "Vacant days",
    "days",
  );
  const vacantDays = vdX.total;
  put(
    explainOf({
      key: "vacantDays",
      title: "Vacant days",
      bucket: "occupancy",
      scope: "All time",
      value: vacantDays,
      format: "days",
      plain: "Days your units stood empty since you bought them.",
      formula: "Σ empty days per unit",
      steps: vdX.steps,
      notes: inactiveNote,
    }),
  );
  const allGaps = act.flatMap((u) => u.vacantPeriods.map((p) => ({ unit: u.name, p })));
  const unrealizedLoss = sum2(act.map((u) => u.unrealizedLoss));
  put(
    explainOf({
      key: "rentLost",
      title: "Rent lost (vacant)",
      bucket: "occupancy",
      scope: "All time",
      value: unrealizedLoss,
      format: "inr",
      plain: "Rent your units could have earned on the days they stood empty.",
      formula: "Each empty stretch: days × monthly rent ÷ 30",
      steps: allGaps.length
        ? [
            ...allGaps.map(({ unit, p }) => vacantPeriodStep(unit, p)),
            step("Rent lost", `${allGaps.map(({ p }) => fINR(p.unrealizedLoss)).join(" + ")} = ${fINR(unrealizedLoss)}`, unrealizedLoss),
          ]
        : [step("Rent lost", fINR(0), 0)],
      inputs: activeRows.flatMap((r) =>
        (leasesByUnit.get(r.u.id) ?? []).map((l) => ({ kind: "lease" as const, id: l.id, label: leaseLabel(l, r.u.name), value: round2(rentOn(l, ctx.asOf)), date: iso(l.startDate), unitId: r.u.id })),
      ),
      notes: [...rentLostNotes(allGaps.map((g) => g.p)), ...inactiveNote],
    }),
  );

  // ── leases on active units: rent roll, deposits, arrears ──
  const currentRows = activeRows.filter((r) => r.current);
  const rollX = sumSteps(
    currentRows.map((r) => ({ label: `${r.u.name} — ${r.current!.tenantName}`, value: round2(rentOn(r.current!, ctx.asOf)) })),
    "Monthly rent roll",
  );
  const monthlyRentRoll = rollX.total;
  put(
    explainOf({
      key: "rentRoll",
      title: "Monthly rent roll",
      bucket: "cash",
      scope: vScope,
      value: monthlyRentRoll,
      format: "inr",
      plain: currentRows.length ? "The rent your current tenants pay each month, added up." : "No unit has a current tenant.",
      formula: "Σ monthly rent of current leases",
      steps: rollX.steps,
      inputs: currentRows.map((r) => ({ kind: "lease" as const, id: r.current!.id, label: leaseLabel(r.current!, r.u.name), value: round2(rentOn(r.current!, ctx.asOf)), date: iso(r.current!.startDate), unitId: r.u.id })),
      notes: ["Only leases that cover this date count — not ended or not-yet-started ones.", ...inactiveNote],
    }),
  );
  const depX = sumSteps(
    currentRows.map((r) => ({ label: `${r.u.name} — ${r.current!.tenantName}`, value: r.breakdown.depositHeld })),
    "Deposits held",
  );
  const securityDepositsHeld = depX.total;
  const ledger = depositsLedger(depositRows);
  put(
    explainOf({
      key: "depositsHeld",
      title: "Deposits held",
      bucket: "cash",
      scope: vScope,
      value: securityDepositsHeld,
      format: "inr",
      plain: "Security deposits from your current tenants that you are holding for them.",
      formula: "Σ deposits of current leases − any part already refunded",
      steps: depX.steps,
      inputs: currentRows.map((r) => ({ kind: "lease" as const, id: r.current!.id, label: leaseLabel(r.current!, r.u.name), value: r.breakdown.depositHeld, date: iso(r.current!.startDate), unitId: r.u.id })),
      notes: [
        "Deposits are the tenants' money, owed back when they leave — never counted as income.",
        ...(ledger.awaitingRefund > 0 ? [`${fINR(ledger.awaitingRefund)} from ended leases has no refund recorded yet (see the deposits ledger).`] : []),
      ],
    }),
  );

  const arrearsRows = currentRows.filter((r) => r.nextPayment && r.nextPayment.arrears.months.length);
  const od = overdueSteps(
    ctx,
    arrearsRows.map((r) => ({ unitName: r.u.name, tenantName: r.current!.tenantName, arrears: r.nextPayment!.arrears })),
  );
  const arrearsTotal = sum2(arrearsRows.map((r) => r.nextPayment!.arrears.total));
  const lateFeesTotal = sum2(arrearsRows.map((r) => r.nextPayment!.arrears.lateFees));
  put(
    explainOf({
      key: "overdue",
      title: "Overdue rent",
      bucket: "cash",
      scope: vScope,
      value: od.value,
      format: "inr",
      plain: od.value > 0 ? "Rent your current tenants owe for months whose due date has passed." : "Nothing overdue — every month that has fallen due is paid.",
      formula: "Each overdue month: rent − paid for that month, + late fees",
      steps: od.steps,
      inputs: arrearsRows.map((r) => ({ kind: "lease" as const, id: r.current!.id, label: leaseLabel(r.current!, r.u.name), value: r.nextPayment!.arrears.totalWithFees, date: iso(r.current!.startDate), unitId: r.u.id })),
      notes: overdueNotes(ctx),
    }),
  );

  const asOfIst = (d: Date | null | undefined) => (d ? dayNum(todayIST(d)) : null);
  const pendingActions = input.actions.filter((x) => {
    const created = asOfIst(x.createdAt);
    if (created !== null && created > A) return false;
    if (!x.isDone) return true;
    const done = asOfIst(x.doneAt);
    return done !== null && done > A;
  });

  const kpis: Kpis = {
    unitsActive: act.length,
    unitsOccupied: act.filter((u) => u.status === "occupied").length,
    unitsVacant: act.filter((u) => u.status === "vacant").length,
    unitsIncoming: act.filter((u) => u.status === "incoming").length,
    invested,
    currentValue: estX.total,
    bestOfferTotal,
    bestOfferIsPartialEstimate: estimated.length > 0,
    bestOfferSum,
    unitsWithOffer: withOffer.length,
    appreciation,
    capitalMultiplier: multiplier,
    cagr: portfolioCagr,
    cagrNote: portfolioCagrNote,
    holdingYears: round6(holdingYears),
    rentCollected,
    totalExpenses,
    wholePlotExpenses,
    netProfit: pAll.summary.net,
    securityDepositsHeld,
    totalReturn,
    totalBuiltUpSqft,
    boughtAtPerSqft,
    offeredAtPerSqft,
    occupancyPct,
    vacantDays,
    unrealizedLoss,
    monthlyRentRoll,
    overdueCount: arrearsRows.length,
    overdueMonths: arrearsRows.reduce((n, r) => n + r.nextPayment!.arrears.months.length, 0),
    arrearsTotal,
    lateFeesTotal,
    overdueAmount: od.value,
    pendingActions: pendingActions.length,
  };

  // ── rental yield: the last 12 months (active units + the property) ──
  const yStart = dayNum(yearEarlier(asOf)) + 1;
  const inLast12 = (d: Date) => dayNum(d) >= yStart && dayNum(d) <= A;
  const last12Label = "Last 12 months";
  const yieldUnits: YieldRow[] = activeRows.map(({ u, breakdown: b }) => {
    const rent = sumAmounts((leasesByUnit.get(u.id) ?? []).flatMap((l) => paymentsByLease.get(l.id) ?? []).filter((p) => inLast12(p.paymentDate)));
    const spent = sumAmounts((expensesByUnit.get(u.id) ?? []).filter((e) => inLast12(e.expenseDate)));
    return yieldRow(u.id, u.name, rent, spent, b.purchasePrice, b.valuation, dayNum(u.purchaseDate) < yStart);
  });
  const wholePlotLast12 = sumAmounts(expenses.filter((e) => e.unitId === null && inLast12(e.expenseDate)));
  const yieldProperty = yieldRow(
    null,
    settings.brandName,
    sum2(yieldUnits.map((r) => r.rent)),
    round2(sum2(yieldUnits.map((r) => r.expenses)) + wholePlotLast12),
    kpis.invested,
    kpis.bestOfferTotal,
    yieldUnits.length > 0 && yieldUnits.every((r) => r.fullYear),
  );
  for (const r of yieldUnits) for (const x of yieldExplains(`unit:${r.unitId}:`, r, last12Label, true)) put(x);
  for (const x of yieldExplains("", yieldProperty, last12Label, false)) put(x);
  const yields: Yields = { label: last12Label, start: isoDay(yStart), end: isoDay(A), units: yieldUnits, property: yieldProperty };

  // ── the next 12 months: rent falling due − property tax due − usual costs (est.) ──
  const m0 = monthIndexOfDay(A);
  const fEnd = monthEndDay(m0 + 11);
  const fMonths = Array.from({ length: 12 }, (_, i) => ({ key: miKey(m0 + i), label: miLabel(m0 + i), rent: 0, tax: 0, costs: 0, net: 0 }));
  const fUnits = activeRows.map(({ u, current }) => {
    const live = (leasesByUnit.get(u.id) ?? []).filter((l) => leaseStateOn(l, asOf) !== "ended");
    let rent = 0;
    let count = 0;
    for (const l of live) {
      const { first, last } = leaseMonthBounds(l);
      const paid = paidByMonthOf(paymentsByLease.get(l.id) ?? [], A);
      for (let mi = Math.max(first, m0 - 1); mi <= Math.min(last ?? Infinity, m0 + 11); mi++) {
        const m = rentMonth(l, mi, paid, settings, A);
        if (m.dueDay <= A || m.dueDay > fEnd || m.outstanding <= 0) continue;
        fMonths[monthIndexOfDay(m.dueDay) - m0].rent += m.outstanding;
        rent += m.outstanding;
        count++;
      }
    }
    const next = current ?? [...live].sort((x, y) => x.startDate.getTime() - y.startDate.getTime())[0] ?? null;
    return {
      unitId: u.id,
      unitName: u.name,
      tenantName: next?.tenantName ?? null,
      rentNow: next ? round2(rentOn(next, current ? asOf : next.startDate)) : null,
      rent: round2(rent),
      months: count,
    };
  });
  const activeIds = new Set(act.map((u) => u.id));
  const taxBills = (input.propertyTax ?? [])
    .filter((t) => t.status === "Due" && activeIds.has(t.unitId))
    .sort((x, y) => x.year - y.year || unitName(x.unitId).localeCompare(unitName(y.unitId)))
    .map((t) => ({ id: t.id, unitId: t.unitId, unitName: unitName(t.unitId), year: t.year, amount: round2(t.amount) }));
  const fTax = sumAmounts(taxBills);
  const costRows = usualCosts(expenses.filter((e) => inLast12(e.expenseDate)), input.categories);
  const costs12 = sumAmounts(costRows);
  const costsMonthly = round2(costs12 / 12);
  fMonths.forEach((m, i) => {
    m.rent = round2(m.rent);
    m.tax = i === 0 ? fTax : 0;
    m.costs = i < 11 ? costsMonthly : round2(costs12 - costsMonthly * 11);
    m.net = round2(m.rent - m.tax - m.costs);
  });
  const fRent = sum2(fMonths.map((m) => m.rent));
  const forecast: Forecast = {
    label: `${miLabel(m0)} – ${miLabel(m0 + 11)}`,
    start: isoDay(A + 1),
    end: isoDay(fEnd),
    months: fMonths,
    rent: fRent,
    tax: fTax,
    costs: costs12,
    net: round2(fRent - fTax - costs12),
    costsMonthly,
    oneOffMin: BIG_EXPENSE_MIN,
    units: fUnits,
    taxBills,
  };
  const fRentX = sumSteps(
    fUnits.map((f) => ({ label: `${f.unitName} — ${f.tenantName ?? "empty"} (${plural(f.months, "month")})`, value: f.rent })),
    "Rent expected",
  );
  put(
    explainOf({
      key: "forecast:rent",
      title: "Rent expected",
      bucket: "cash",
      scope: forecast.label,
      value: fRent,
      format: "inr",
      plain: "The rent that will fall due in the next 12 months from your current (and incoming) tenants.",
      formula: "Each month's rent (with any rent change you entered) that falls due in the window, minus anything paid ahead",
      steps: fRentX.steps,
      notes: [
        "Assumes today's tenants stay and pay when due.",
        "Rent paid after the month (in arrears) is counted in the month it falls due.",
        ...(fUnits.some((f) => f.tenantName === null) ? ["An empty unit earns nothing here."] : []),
      ],
    }),
  );
  const fTaxX = sumSteps(taxBills.map((t) => ({ label: `${t.unitName} — tax ${t.year}`, value: t.amount })), "Property tax due");
  put(
    explainOf({
      key: "forecast:tax",
      title: "Property tax due",
      bucket: "cash",
      scope: forecast.label,
      value: fTax,
      format: "inr",
      plain: taxBills.length ? "Property tax bills recorded as still to pay." : "No property tax bill is waiting to be paid.",
      formula: "Add up every property tax bill marked Due",
      steps: fTaxX.steps,
    }),
  );
  put(
    explainOf({
      key: "forecast:costs",
      title: "Usual costs (est.)",
      bucket: "cash",
      scope: forecast.label,
      value: costs12,
      format: "inr",
      plain: "Running costs for the next 12 months, if they are like the last 12 months.",
      formula: `Expenses of the last 12 months, without property tax and one-offs of ${fINR(BIG_EXPENSE_MIN)} or more`,
      steps: [
        step("Usual costs, last 12 months", fINR(costs12), costs12),
        step("A month", `${fINR(costs12)} ÷ 12 = ${fINR(costsMonthly)}`, costsMonthly),
        step("Next 12 months (est.)", `the same as the last 12 months = ${fINR(costs12)}`, costs12),
      ],
      notes: ["An estimate — property tax is counted separately, big one-off jobs are left out."],
    }),
  );
  put(
    explainOf({
      key: "forecast:net",
      title: "Net expected",
      bucket: "cash",
      scope: forecast.label,
      value: forecast.net,
      format: "inr",
      plain: "What should be left from the next 12 months' rent after property tax and the usual costs.",
      formula: "Rent expected − property tax due − usual costs (est.)",
      steps: [
        step("Rent expected", fINR(fRent), fRent),
        step("Property tax due", fINR(fTax), fTax),
        step("Usual costs (est.)", fINR(costs12), costs12),
        step("Net expected", `${fINR(fRent)} − ${fINR(fTax)} − ${fINR(costs12)} = ${fINR(forecast.net)}`, forecast.net),
      ],
      notes: ["A forecast, not cash in hand: it assumes tenants stay and pay, and costs stay as usual."],
    }),
  );

  // ── rental agreements to renew (current leases ending within the reminder window, or ended) ──
  const reminderDays = settings.renewalReminderDays ?? 30;
  const renewals: RenewalReminder[] = activeRows
    .flatMap(({ u, current }) => (current?.agreementEndDate ? [{ u, l: current, days: agreementDaysLeft(current.agreementEndDate, asOf) }] : []))
    .filter((x) => x.days <= reminderDays)
    .sort((x, y) => x.days - y.days)
    .map(({ u, l, days }) => ({
      leaseId: l.id,
      unitId: u.id,
      unitName: u.name,
      tenantName: l.tenantName,
      agreementEndDate: iso(l.agreementEndDate!),
      daysLeft: days,
      state: days < 0 ? ("expired" as const) : ("due-soon" as const),
    }));

  // ── series + composition ──
  const firstPurchase = owned.length ? owned.reduce((m, u) => (u.purchaseDate < m ? u.purchaseDate : m), owned[0].purchaseDate) : null;
  const series = monthlyByYear(payments, expenses, asOf, mode, firstPurchase);
  const expensesByYear = groupBy(expenses, (e) => yearKeyOf(e.expenseDate, mode));
  const monthExpenses = expenses.filter((e) => inDayScope(scopes.month, dayNum(e.expenseDate)));
  const byUnit = [
    ...[...owned].sort(compareUnits).map((u) => ({ unitId: u.id as string | null, unitName: u.name, rows: expensesByUnit.get(u.id) ?? [] })),
    { unitId: null, unitName: "Whole plot", rows: expenses.filter((e) => e.unitId === null) },
  ].map(({ unitId, unitName, rows }) => ({ unitId, unitName, amount: sumAmounts(rows), slices: expenseSlices(rows, input.categories) }));
  const expenseComposition = {
    allTime: expenseSlices(expenses, input.categories),
    byYear: series.map((s) => ({ year: s.year, label: s.label, slices: expenseSlices(expensesByYear.get(s.year) ?? [], input.categories) })),
    month: expenseSlices(monthExpenses, input.categories),
    byUnit,
  };

  // ── reconciliation ──
  const leaseTotals = [...groupBy(payments, (p) => p.leaseId).values()].map((rows) => sumAmounts(rows));
  const checks = reconciliation([
    recon(
      "expensesByUnit",
      "Unit expenses + whole-plot expenses = total expenses",
      totalExpenses,
      sum2([...units.map((u) => u.expenses), wholePlotExpenses]),
    ),
    recon("expensesByCategory", "Σ expense categories = total expenses", totalExpenses, sum2(expenseComposition.allTime.map((s) => s.amount))),
    recon("rentByLease", "Σ payments per lease = rent collected", rentCollected, sum2(leaseTotals)),
    recon("rentByUnit", "Σ rent per unit = rent collected", rentCollected, sum2(units.map((u) => u.rentCollected))),
    recon("incomeByYear", "Σ yearly rent = rent collected (all time)", rentCollected, sum2(series.map((s) => s.income))),
    recon("expensesByYear", "Σ yearly expenses = total expenses (all time)", totalExpenses, sum2(series.map((s) => s.expenses))),
    recon(
      "monthsToYears",
      "Σ months = year totals",
      sum2(series.map((s) => round2(s.income - s.expenses))),
      sum2(series.flatMap((s) => s.months.map((m) => m.net))),
    ),
    recon("netCash", "Rent collected − expenses = net cash", round2(rentCollected - totalExpenses), kpis.netProfit),
    recon("worthByUnit", "Σ unit worth = worth now", bestOfferTotal, sum2(act.map((u) => u.valuation))),
    recon(
      "deposits",
      "Deposits received = held + refunded + kept + awaiting refund",
      ledger.received,
      sum2([ledger.held, ledger.refunded, ledger.kept, ledger.awaitingRefund]),
    ),
    recon(
      "arrears",
      "Σ unit arrears = overdue rent",
      kpis.overdueAmount,
      sum2(act.map((u) => (u.activeLease ? (u.nextPayment?.arrears.totalWithFees ?? 0) : 0))),
    ),
  ]);

  const leaseById = ctx.leaseById;
  const recentPayments = [...payments]
    .sort((x, y) => y.paymentDate.getTime() - x.paymentDate.getTime() || y.invoiceSeq - x.invoiceSeq)
    .slice(0, 8)
    .map((p) => {
      const lease = leaseById.get(p.leaseId);
      return {
        id: p.id,
        amount: round2(p.amount),
        paymentDate: iso(p.paymentDate),
        unitName: (lease && ctx.unitById.get(lease.unitId)?.name) ?? "—",
        tenantName: lease?.tenantName ?? "—",
        invoiceNumber: p.invoiceNumber,
      };
    });

  const pending = [...pendingActions]
    .sort(
      (x, y) =>
        (x.dueDate ? x.dueDate.getTime() : Infinity) - (y.dueDate ? y.dueDate.getTime() : Infinity) ||
        PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] ||
        x.title.localeCompare(y.title),
    )
    .map((x) => ({
      id: x.id,
      title: x.title,
      priority: x.priority,
      dueDate: x.dueDate ? iso(x.dueDate) : null,
      unitId: x.unitId,
      isOverdue: x.dueDate !== null && dayNum(x.dueDate) < A,
    }));

  return {
    generatedAt: now.toISOString(),
    today: today.toISOString(),
    asOf: asOf.toISOString(),
    isLive: dayNum(asOf) === dayNum(today),
    yearMode: mode,
    scopeLabels: { allTime: "All time", year: scopes.year.label, month: scopes.month.label, asOf: ctx.asOfScope },
    settings: {
      brandName: settings.brandName,
      subtitle: settings.subtitle,
      currency: settings.currency,
      rentDueDay: settings.rentDueDay,
      lateFeeEnabled: settings.lateFeeEnabled,
      lateFeeAmount: round2(settings.lateFeeAmount),
      lateFeeGraceDays: settings.lateFeeGraceDays,
      renewalReminderDays: reminderDays,
    },
    plot: plotGeometry(input.plot),
    kpis,
    periods: { allTime: pAll.summary, year: pYear.summary, month: pMonth.summary },
    comparisons,
    yields,
    forecast,
    renewals,
    units,
    unitsNotYetOwned: input.units
      .filter((u) => !ownedIds.has(u.id))
      .sort(compareUnits)
      .map((u) => ({ id: u.id, name: u.name, position: u.position, purchaseDate: iso(u.purchaseDate) })),
    monthlyByYear: series,
    cumulativeNetByYear: cumulativeNetByYear(series),
    expenseComposition,
    vacancy: {
      totalVacantDays: vacantDays,
      totalUnrealizedLoss: unrealizedLoss,
      occupancyPct,
      units: activeRows.map(({ breakdown: u, occ }) => ({
        unitId: u.id,
        unitName: u.name,
        vacantDays: u.vacantDays,
        unrealizedLoss: u.unrealizedLoss,
        periods: u.vacantPeriods,
        noRentHistory: occ.noRentHistory,
      })),
    },
    deposits: ledger,
    actions: { pending },
    recentPayments,
    explain,
    checks,
    timeline: buildTimeline(input, today, mode),
  };
}

// ───────────────────────────── timeline ─────────────────────────────

/** Occupancy gantt + scrubber data: every unit's leases and vacancies from purchase to today (independent of asOf). */
export function buildTimeline(input: DashboardInput, today: Date, mode: YearMode): Timeline {
  const t = dayNum(today);
  const units = [...input.units].sort(compareUnits);
  const leasesByUnit = groupBy(input.leases, (l) => l.unitId);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const start = units.length ? Math.min(...units.map((u) => dayNum(u.purchaseDate))) : null;
  const markers: TimelineMarker[] = [];

  const tUnits = units.map((u) => {
    const leases = [...(leasesByUnit.get(u.id) ?? [])].sort((x, y) => x.startDate.getTime() - y.startDate.getTime());
    markers.push({ date: iso(u.purchaseDate), kind: "purchase", unitId: u.id, label: `${u.name} bought`, amount: round2(u.purchasePrice), refId: u.id });
    for (const l of leases) {
      if (dayNum(l.startDate) <= t) {
        markers.push({ date: iso(l.startDate), kind: "lease-start", unitId: u.id, label: `${l.tenantName} moves in · ${u.name}`, amount: round2(l.monthlyRent), refId: l.id });
      }
      if (l.endDate && dayNum(l.endDate) <= t) {
        markers.push({ date: iso(l.endDate), kind: "lease-end", unitId: u.id, label: `${l.tenantName}'s last day · ${u.name}`, amount: null, refId: l.id });
      }
    }
    return {
      unitId: u.id,
      unitName: u.name,
      position: u.position,
      isActive: u.isActive,
      purchaseDate: iso(u.purchaseDate),
      leases: leases.map((l) => ({
        leaseId: l.id,
        tenantId: l.tenantId,
        tenantName: l.tenantName,
        start: iso(l.startDate),
        end: l.endDate ? iso(l.endDate) : null,
        monthlyRent: round2(rentOn(l, today)),
        state: leaseStateOn(l, today),
      })),
      vacant: occupancyFor(u.purchaseDate, today, leases).vacantPeriods,
    };
  });
  for (const o of input.offers) {
    if (dayNum(o.offerDate) > t) continue;
    markers.push({ date: iso(o.offerDate), kind: "offer", unitId: o.unitId, label: `Offer for ${unitById.get(o.unitId)?.name ?? "unit"}`, amount: round2(o.amount), refId: o.id });
  }
  const cats = new Map(input.categories.map((c) => [c.id, c.name]));
  for (const e of input.expenses) {
    if (e.amount < BIG_EXPENSE_MIN || dayNum(e.expenseDate) > t) continue;
    markers.push({
      date: iso(e.expenseDate),
      kind: "expense",
      unitId: e.unitId,
      label: `${e.description ?? cats.get(e.categoryId) ?? "Expense"} · ${e.unitId ? (unitById.get(e.unitId)?.name ?? "unit") : "Whole plot"}`,
      amount: round2(e.amount),
      refId: e.id,
    });
  }
  const KIND_ORDER: Record<TimelineMarker["kind"], number> = { purchase: 0, "lease-end": 1, "lease-start": 2, offer: 3, expense: 4 };
  markers.sort((x, y) => x.date.localeCompare(y.date) || KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || x.label.localeCompare(y.label));

  const yearTicks: Timeline["yearTicks"] = [];
  if (start !== null) {
    for (let key = yearKeyOf(fromDayNum(start), mode) + 1; key <= yearKeyOf(today, mode); key++) {
      yearTicks.push({ key, label: yearLabel(key, mode), date: yearBounds(key, mode).start.toISOString() });
    }
  }
  return { range: { start: start === null ? null : isoDay(start), end: isoDay(t) }, units: tUnits, markers, yearTicks };
}
