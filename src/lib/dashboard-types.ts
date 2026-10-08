// Contract for GET /api/dashboard and GET /api/reports/* — produced by src/lib/calculations.ts and
// src/lib/reports.ts, consumed by the UI. The UI never re-computes or re-groups any of these numbers.
//
// Conventions
//  • Money: INR as numbers rounded to paise. Ratios / percentages: fractions (0.083 = 8.3%), 6 dp.
//  • Dates: ISO strings. Date-only values are "YYYY-MM-DDT00:00:00.000Z" (format with formatDate → D/M/YYYY).
//  • Lease endDate = LAST DAY of tenancy (inclusive). A lease covers the days [startDate … endDate].
//  • "As of": every figure is computed for one date (`asOf`, default today in IST). Records dated after it are ignored,
//    values are grown to it, leases are judged on it.
//  • Year mode: "fy" = Indian financial year 1 Apr – 31 Mar, keyed by its START year (2025 → "FY 2025-26");
//    "calendar" = Jan – Dec (2026 → "2026"). Default "fy".
//  • Vocabulary (fixed, never synonyms): Invested · Worth now (est.) · Best offer · Gain · Rent collected · Expenses ·
//    Net cash · Deposits held · Rent lost (vacant). Three kinds of numbers never mixed: cash / paper value / occupancy.

export type YearMode = "fy" | "calendar";

/**
 * inactive → switched off by the owner · occupied → a lease covers the as-of date ·
 * incoming → empty now but a lease starting later is recorded · vacant → empty, nothing signed.
 */
export type UnitStatus = "occupied" | "incoming" | "vacant" | "inactive";
/** "none" = no current lease */
export type RentState = "paid" | "due-soon" | "overdue" | "none";
/** incoming = starts after the as-of date · current = start ≤ as-of ≤ last day (or open) · ended = last day before as-of */
export type LeaseState = "incoming" | "current" | "ended";

export interface PlotGeometry {
  frontWidthFt: number;
  backWidthFt: number;
  depthFt: number;
  areaSqft: number;
  townName: string;
  sitePlanImageUrl: string | null;
  /** true when any dimension fell back to the owner's site-plan defaults */
  usingDefaults: boolean;
}

export interface VacantPeriod {
  start: string; // first vacant day
  /** EXCLUSIVE end: the day the next lease starts, or the as-of date when still vacant */
  end: string;
  /** last vacant day (inclusive) = end − 1 day — use this for "1/6/2023 – 31/8/2023" labels */
  lastDay: string;
  days: number;
  /** still vacant on the as-of date */
  ongoing: boolean;
  /** rent used for the loss estimate (per month); 0 when the unit never had a lease */
  rentBasis: number;
  /** where rentBasis came from: the lease before the gap, the next lease (gap before the first lease), or none */
  rentBasisSource: "previous-lease" | "next-lease" | "none";
  /** days × rentBasis ÷ 30 — an opportunity cost, never subtracted from cash */
  unrealizedLoss: number;
  /** true when no lease ever existed so loss is 0 by rule */
  noRentHistory: boolean;
}

/** One rent month of a lease that is overdue (due date before the as-of date) and not fully paid. */
export interface ArrearsMonth {
  year: number;
  month: number; // 1-12
  key: string; // "2026-07"
  label: string; // "Jul 2026"
  dueDate: string;
  due: number; // monthly rent
  paid: number; // received for this month by the as-of date
  outstanding: number; // due − paid
  daysOverdue: number;
  /** flat late fee when the settings switch it on and the month is past the grace days; else 0 */
  lateFee: number;
}

export interface Arrears {
  months: ArrearsMonth[]; // oldest first
  total: number; // Σ outstanding
  lateFees: number; // Σ lateFee
  totalWithFees: number; // total + lateFees
}

export interface NextPayment {
  leaseId: string;
  /** the OLDEST month with something still to pay (overdue or upcoming) */
  dueDate: string;
  periodMonth: number; // 1-12
  periodYear: number;
  label: string; // "Aug 2026"
  monthlyRent: number;
  paidSoFar: number; // already received for that month (part payment)
  /** what is still owed for that month (+ its late fee if applied) */
  amountDue: number;
  isOverdue: boolean;
  daysOverdue: number; // 0 when not overdue
  lateFeeApplied: boolean;
  lateFee: number;
  /** every overdue unpaid / part-paid month of this lease (empty when up to date) */
  arrears: Arrears;
}

export interface LeaseSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  startDate: string;
  /** last day of tenancy (inclusive); null = open-ended */
  endDate: string | null;
  monthlyRent: number;
  securityDeposit: number;
  state: LeaseState;
  /** the rental agreement's end (renew before it); null = not recorded */
  agreementEndDate: string | null;
}

// ───────────────────────────── upgrades (owner 8/10/2026) ─────────────────────────────

/** One figure now vs the same span a year earlier. change = (now − before) ÷ |before|; null when before is 0. */
export interface CashChange {
  now: number;
  before: number;
  change: number | null;
}

/** Rent collected / expenses / net cash vs the same span one year earlier ("compared with last year"). */
export interface CashComparison {
  /** what it's compared with: "FY 2025-26 to 8/10/2025" · "Oct 2025 to 8/10/2025" · "1/4/2025 – 30/9/2025" */
  label: string;
  start: string | null;
  end: string;
  rentCollected: CashChange;
  expenses: CashChange;
  net: CashChange;
}

/** Rental yield over the last 12 months: rent (and rent − expenses) ÷ the price paid and ÷ today's value. */
export interface YieldRow {
  unitId: string | null; // null = the whole property
  name: string;
  rent: number; // rent received in the last 12 months
  expenses: number; // unit: its own expenses; property: all expenses incl. whole plot
  net: number;
  price: number; // purchase price (invested)
  value: number; // worth now (est.)
  grossOnPrice: number | null; // fraction
  netOnPrice: number | null;
  grossOnValue: number | null;
  netOnValue: number | null;
  /** owned for the whole 12 months (otherwise the yield covers only the months owned) */
  fullYear: boolean;
}

export interface Yields {
  label: string; // "Last 12 months"
  start: string;
  end: string;
  units: YieldRow[]; // active units
  property: YieldRow;
}

export interface ForecastMonth {
  key: string; // "2026-10"
  label: string; // "Oct 2026"
  rent: number; // rent falling due this month (unpaid part), current + incoming leases
  tax: number; // property tax still due (first month)
  costs: number; // usual running costs (est.)
  net: number;
}

/** Next 12 months: rent that will fall due (incl. rent changes already entered) − property tax due − usual costs (est.). */
export interface Forecast {
  label: string; // "Oct 2026 – Sep 2027"
  start: string; // the day after the as-of date
  end: string; // last day of the 12th month
  months: ForecastMonth[];
  rent: number;
  tax: number;
  costs: number;
  net: number;
  /** usual costs a month = expenses of the last 12 months (without property tax and one-offs ≥ oneOffMin) ÷ 12 */
  costsMonthly: number;
  oneOffMin: number;
  units: { unitId: string; unitName: string; tenantName: string | null; rentNow: number | null; rent: number; months: number }[];
  taxBills: { id: string; unitId: string; unitName: string; year: number; amount: number }[];
}

/** A current lease whose rental agreement ends within the reminder window (or already ended). */
export interface RenewalReminder {
  leaseId: string;
  unitId: string;
  unitName: string;
  tenantName: string;
  agreementEndDate: string;
  daysLeft: number; // negative = ended that many days ago
  state: "due-soon" | "expired";
}

/**
 * Cash summary for one scope. The HUD's period control (All time · Year · Month) picks one of these —
 * the UI never sums payments itself.
 */
export interface PeriodSummary {
  /** "range" = custom dates (owner 8/10/2026) */
  kind: "allTime" | "year" | "month" | "range";
  /** "all" | year key ("2025" = FY 2025-26 or calendar 2025) | "2026-10" */
  key: string;
  label: string; // "All time" | "FY 2025-26" | "2026" | "Oct 2026"
  /** first day of the scope (null for all time) */
  start: string | null;
  /** last day counted = min(scope end, as-of date) */
  end: string;
  /** CASH received in the scope (by payment date) */
  rentCollected: number;
  /** rent that fell due in the scope before the as-of date (every lease-month whose due date has passed) */
  rentExpected: number;
  /** received (by the as-of date) towards that due rent, capped at each month's rent */
  rentReceivedForScope: number;
  /** rentExpected − rentReceivedForScope (includes ended leases; current-lease arrears are in kpis / nextPayment) */
  rentUnpaid: number;
  /** rent for months in the scope whose due date hasn't passed yet (e.g. this month before the due day), unpaid part */
  rentDueLater: number;
  /** rentReceivedForScope ÷ rentExpected; null when nothing has fallen due yet */
  collectionPct: number | null;
  expenses: number;
  /** rentCollected − expenses */
  net: number;
}

export interface ScopedPeriods {
  allTime: PeriodSummary;
  /** the FY / calendar year containing the as-of date */
  year: PeriodSummary;
  /** the month containing the as-of date */
  month: PeriodSummary;
}

export interface UnitBreakdown {
  id: string;
  name: string;
  type: string;
  position: "front" | "back" | null;
  floors: number;
  isActive: boolean;
  status: UnitStatus;
  rentState: RentState;
  builtUpSqft: number;
  footprintWidthFt: number | null;
  footprintDepthFt: number | null;
  purchaseDate: string;
  purchasePrice: number;
  annualAppreciationRate: number; // percent
  yearsHeld: number; // fractional, purchase → as-of
  /** growth estimate: price × (1 + rate)^years */
  currentValue: number;
  /** best offer dated on/before the as-of date */
  bestOffer: number | null;
  bestOfferDate: string | null;
  offersCount: number;
  /** "Worth now (est.)" = bestOffer ?? currentValue */
  valuation: number;
  valuationSource: "offer" | "estimate";
  /** "Gain" = valuation − purchasePrice */
  appreciation: number;
  appreciationPct: number; // appreciation / purchasePrice (fraction)
  /** "LVL" = valuation / purchasePrice; null when the price is 0 */
  capitalMultiplier: number | null;
  /** yearly growth rate; null when held under 1 year (see cagrNote) */
  cagr: number | null;
  cagrNote: string | null;
  boughtAtPerSqft: number | null;
  offeredAtPerSqft: number | null; // valuation / sqft
  rentCollected: number; // all time (payments on this unit's leases)
  expenses: number; // expenses tagged to this unit only (whole-plot expenses excluded), all time
  /** rentCollected − expenses (unit-tagged only) */
  netCash: number;
  /** unit-scoped cash: rent of its leases, expenses tagged to it */
  periods: ScopedPeriods;
  /** this year / this month vs the same span last year (unit-scoped cash) */
  comparisons: { year: CashComparison; month: CashComparison };
  occupancyPct: number; // fraction 0..1
  daysOwned: number;
  daysOccupied: number;
  vacantPeriods: VacantPeriod[];
  vacantDays: number;
  unrealizedLoss: number;
  /** the CURRENT lease (start ≤ as-of ≤ last day, or open); null when empty */
  activeLease: LeaseSummary | null;
  /** the next lease that starts after the as-of date, if one is recorded */
  incomingLease: LeaseSummary | null;
  /** deposit of the current lease (0 when none) */
  depositHeld: number;
  /** current lease: the oldest month still owed (+ all arrears); no current lease: the incoming lease's first rent */
  nextPayment: NextPayment | null;
  electricityConsumerNumber: string | null;
  electricityPayUrl: string | null;
}

export interface Kpis {
  unitsActive: number;
  unitsOccupied: number;
  unitsVacant: number;
  unitsIncoming: number;
  invested: number; // Σ purchasePrice (active units)
  currentValue: number; // Σ growth estimate (active units)
  /** "Worth now (est.)" = Σ valuation (best offer, else estimate) (active units) */
  bestOfferTotal: number;
  bestOfferIsPartialEstimate: boolean; // true if any active unit has no offer
  /** "Best offer" = Σ best offers of active units that have one; null when none has an offer */
  bestOfferSum: number | null;
  unitsWithOffer: number;
  /** "Gain" = Σ appreciation (active units) */
  appreciation: number;
  capitalMultiplier: number | null; // bestOfferTotal / invested
  cagr: number | null; // fraction, e.g. 0.083; null when held under 1 year
  cagrNote: string | null; // why cagr is null ("Held under 1 year", "Nothing invested yet")
  holdingYears: number; // investment-weighted average years held
  rentCollected: number; // Σ all payments dated ≤ as-of (= periods.allTime.rentCollected)
  totalExpenses: number; // Σ all expenses dated ≤ as-of
  wholePlotExpenses: number; // part of totalExpenses not tagged to a unit
  /** "Net cash" = rentCollected − totalExpenses */
  netProfit: number;
  securityDepositsHeld: number; // Σ deposits of CURRENT leases on active units
  totalReturn: number; // appreciation + rentCollected
  totalBuiltUpSqft: number;
  boughtAtPerSqft: number | null; // invested / totalBuiltUpSqft
  offeredAtPerSqft: number | null; // bestOfferTotal / totalBuiltUpSqft
  occupancyPct: number; // Σ occupied days / Σ days owned (active units)
  vacantDays: number;
  unrealizedLoss: number; // "Rent lost (vacant)"
  monthlyRentRoll: number; // Σ monthlyRent of current leases on active units
  /** current leases (active units) with at least one overdue month */
  overdueCount: number;
  overdueMonths: number;
  arrearsTotal: number; // Σ outstanding of overdue months
  lateFeesTotal: number;
  /** arrearsTotal + lateFeesTotal */
  overdueAmount: number;
  pendingActions: number;
}

export interface MonthPoint {
  month: number; // 1-12
  year: number; // calendar year of this month
  key: string; // "2026-04"
  label: string; // "Apr"
  longLabel: string; // "Apr 2026"
  income: number; // rent collected (by payment date)
  expenses: number;
  net: number;
  cumulative: number; // running net within the year
  /** after the as-of month (always zero) */
  isFuture: boolean;
}

export interface YearSeries {
  /** FY start year ("fy") or calendar year */
  year: number;
  label: string; // "FY 2025-26" | "2026"
  mode: YearMode;
  start: string; // first day
  end: string; // last day
  isCurrent: boolean; // contains the as-of date
  income: number;
  expenses: number;
  net: number;
  months: MonthPoint[]; // 12, in year order (Apr → Mar for FY)
}

export interface ExpenseSlice {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  share: number; // fraction of total
}

// ───────────────────────────── "Show the maths" ─────────────────────────────

export type ExplainFormat = "inr" | "pct" | "multiplier" | "days" | "years" | "count" | "inrPerSqft";
export type ExplainBucket = "cash" | "value" | "occupancy";
export type ExplainInputKind = "unit" | "offer" | "payment" | "expense" | "lease" | "setting" | "category";

export interface ExplainStep {
  label: string;
  /** the arithmetic with real values in Indian format, e.g. "₹1,12,00,000 ÷ ₹78,00,000 = ×1.44" */
  expression: string;
  value: number | null;
  format: ExplainFormat;
}

export interface ExplainInput {
  kind: ExplainInputKind;
  /** record id (payment id, expense id, lease id, unit id, offer id, category id, settings field) */
  id: string | null;
  label: string;
  value: number | null;
  date: string | null;
  unitId: string | null;
}

/**
 * Explanation of one figure, built by the SAME code that computes it: `value` is exactly the number shown and
 * the last step's value equals it.
 * Keys — portfolio: invested · estimatedValue · bestOffer · worthNow · gain · multiplier · holdingYears · cagr ·
 *   depositsHeld · totalReturn · perSqftBought · perSqftOffered · occupancy · vacantDays · rentLost · overdue · rentRoll ·
 *   rentCollected · expenses · netCash · collection (all time) and "year:<same 4>", "month:<same 4>".
 * Unit — "unit:<id>:<key>" with worthNow · estimatedValue · bestOffer · gain · multiplier · cagr · depositHeld ·
 *   perSqftBought · perSqftOffered · occupancy · vacantDays · rentLost · overdue · rent · rentCollected · expenses ·
 *   netCash · collection and the "year:" / "month:" variants, e.g. "unit:abc:year:rentCollected".
 */
export interface Explain {
  key: string;
  title: string; // fixed vocabulary: "Worth now (est.)"
  bucket: ExplainBucket;
  /** scope chip text: "All time" | "FY 2026-27" | "Oct 2026" | "As of 2/10/2026" */
  scope: string;
  value: number | null;
  format: ExplainFormat;
  /** 1. in words */
  plain: string;
  /** 2. the formula in words */
  formula: string;
  /** 3. with your numbers, in order */
  steps: ExplainStep[];
  /** 4. what went into it (records); Σ of `value` = the figure for sums */
  inputs: ExplainInput[];
  /** set when many records were grouped (e.g. "128 payments, grouped by lease") */
  inputsNote: string | null;
  /** assumptions in plain English (marigold note) */
  notes: string[];
}

// ───────────────────────────── reconciliation ─────────────────────────────

export interface ReconciliationItem {
  key: string;
  label: string; // "Unit expenses + whole-plot expenses = total expenses"
  expected: number;
  actual: number;
  ok: boolean; // |expected − actual| < ₹0.01
}

export interface Reconciliation {
  /** every item ok → show "Ledger balanced ✓"; otherwise a coral warning listing the failing items */
  ledgerBalanced: boolean;
  items: ReconciliationItem[];
}

// ───────────────────────────── timeline (occupancy gantt + time scrubber) ─────────────────────────────

export interface TimelineLease {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  start: string;
  /** last day of tenancy (inclusive); null = open-ended */
  end: string | null;
  monthlyRent: number;
  state: LeaseState; // relative to today
}

export interface TimelineUnit {
  unitId: string;
  unitName: string;
  position: "front" | "back" | null;
  isActive: boolean;
  purchaseDate: string;
  leases: TimelineLease[]; // by start date
  vacant: VacantPeriod[]; // purchase → today
}

export type TimelineMarkerKind = "purchase" | "lease-start" | "lease-end" | "offer" | "expense";

export interface TimelineMarker {
  date: string;
  kind: TimelineMarkerKind;
  unitId: string | null; // null = whole plot
  label: string; // "Lakshmi Narayanan moves in · Unit A"
  amount: number | null;
  /** id of the lease / offer / expense / unit */
  refId: string;
}

export interface Timeline {
  /** scrubber range: earliest purchase → today (start null when there are no units) */
  range: { start: string | null; end: string };
  units: TimelineUnit[];
  /** sorted by date; expenses only when ≥ ₹20,000 (BIG_EXPENSE_MIN) */
  markers: TimelineMarker[];
  /** year boundaries inside the range in the active year mode (1 Apr for FY) */
  yearTicks: { key: number; label: string; date: string }[];
}

// ───────────────────────────── deposits ─────────────────────────────

export interface DepositRow {
  leaseId: string;
  tenantName: string;
  unitId: string;
  unitName: string;
  deposit: number;
  receivedDate: string; // lease start
  refunded: number;
  refundDate: string | null;
  /** kept back at move-out (deposit − refunded) once a refund is recorded */
  kept: number;
  /** lease ended but no refund recorded yet */
  awaitingRefund: number;
  /** still held for a lease that hasn't ended */
  held: number;
}

export interface DepositsLedger {
  received: number; // Σ deposit
  refunded: number;
  kept: number;
  awaitingRefund: number;
  held: number;
  /** received = held + refunded + kept + awaitingRefund */
  rows: DepositRow[];
}

// ───────────────────────────── GET /api/dashboard ─────────────────────────────

export interface DashboardData {
  generatedAt: string; // ISO datetime
  /** real today (IST) */
  today: string;
  /** the date every figure is computed for (= today unless ?asOf= was given) */
  asOf: string;
  isLive: boolean; // asOf === today
  yearMode: YearMode;
  /** scope chip texts in the active year mode */
  scopeLabels: { allTime: string; year: string; month: string; asOf: string };
  settings: {
    brandName: string;
    subtitle: string | null;
    currency: string;
    rentDueDay: number;
    lateFeeEnabled: boolean;
    lateFeeAmount: number;
    lateFeeGraceDays: number;
    renewalReminderDays: number;
  };
  plot: PlotGeometry;
  kpis: Kpis;
  /** cash summaries for the HUD's period control */
  periods: ScopedPeriods;
  /** this year / this month vs the same span last year (portfolio cash) */
  comparisons: { year: CashComparison; month: CashComparison };
  /** rental yield, last 12 months (active units + the property) */
  yields: Yields;
  /** the next 12 months, from the as-of date */
  forecast: Forecast;
  /** rental agreements to renew (current leases ending within settings.renewalReminderDays, or ended) */
  renewals: RenewalReminder[];
  /** units owned on the as-of date (active first), inactive flagged */
  units: UnitBreakdown[];
  /** units bought after the as-of date (time scrubber looking back) */
  unitsNotYetOwned: { id: string; name: string; position: "front" | "back" | null; purchaseDate: string }[];
  /** Monthly income vs expenses, one entry per year (active year mode), contiguous and zero-filled, ascending */
  monthlyByYear: YearSeries[];
  /** All-time running net, one point per year end */
  cumulativeNetByYear: { year: number; label: string; net: number; cumulative: number }[];
  expenseComposition: {
    allTime: ExpenseSlice[];
    /** same years as monthlyByYear */
    byYear: { year: number; label: string; slices: ExpenseSlice[] }[];
    /** the month of the as-of date */
    month: ExpenseSlice[];
    /** all time, per unit (owned units) then "Whole plot" (unitId null) */
    byUnit: { unitId: string | null; unitName: string; amount: number; slices: ExpenseSlice[] }[];
  };
  vacancy: {
    totalVacantDays: number;
    totalUnrealizedLoss: number;
    occupancyPct: number;
    units: { unitId: string; unitName: string; vacantDays: number; unrealizedLoss: number; periods: VacantPeriod[]; noRentHistory: boolean }[];
  };
  deposits: DepositsLedger;
  actions: {
    pending: { id: string; title: string; priority: "Low" | "Medium" | "High"; dueDate: string | null; unitId: string | null; isOverdue: boolean }[];
  };
  recentPayments: { id: string; amount: number; paymentDate: string; unitName: string; tenantName: string; invoiceNumber: string }[];
  /** "Show the maths" for every HUD figure (see Explain for the keys) */
  explain: Record<string, Explain>;
  /** visible reconciliation ("Ledger balanced ✓") */
  checks: Reconciliation;
  /** occupancy gantt + time scrubber (always purchase → today, independent of asOf) */
  timeline: Timeline;
}

// ───────────────────────────── GET /api/reports/annual?year=&yearMode= ─────────────────────────────

export interface AnnualReport {
  generatedAt: string;
  today: string;
  yearMode: YearMode;
  /** "year" = one FY / calendar year; "allTime" = first record → today (year=all); "range" = custom dates (from/to) */
  kind: "year" | "allTime" | "range";
  year: number; // key: FY start year or calendar year (all time: the running year)
  label: string; // "FY 2025-26" · "All time"
  start: string;
  end: string; // last day of the year
  /** last day counted = min(end, today); the year is partial when through < end */
  through: string;
  isPartial: boolean;
  /** identical to the dashboard's periods.year when the dashboard's as-of date is in this year */
  totals: PeriodSummary;
  /** the same span one year earlier (null for all time) */
  previous: CashComparison | null;
  /** one year: all 12 months (after `through` = 0); custom dates up to 24 months: their months; all time: [] */
  months: {
    year: number;
    month: number;
    key: string;
    label: string; // "Apr 2025"
    rentCollected: number;
    rentExpected: number;
    rentReceivedForMonth: number;
    expenses: number;
    net: number;
  }[];
  /** all time (and custom dates over 24 months) — else []: cash flow per FY / calendar year, oldest first */
  years: {
    year: number;
    key: string;
    label: string; // "FY 2025-26"
    rentCollected: number;
    rentExpected: number;
    rentReceivedForYear: number;
    expenses: number;
    net: number;
    isPartial: boolean;
  }[];
  /** cash flow by unit (units owned in the year) + a "Whole plot" row (unitId null, expenses only) */
  units: {
    unitId: string | null;
    unitName: string;
    rentCollected: number;
    rentExpected: number;
    collectionPct: number | null;
    expenses: number;
    net: number;
  }[];
  expensesByCategory: ExpenseSlice[];
  expenses: { id: string; date: string; unitId: string | null; unitName: string; categoryId: string; categoryName: string; description: string | null; amount: number }[];
  deposits: {
    opening: number; // held + awaiting refund on the day before the year starts
    received: number;
    refunded: number;
    kept: number;
    closing: number; // held + awaiting refund on `through`
    rows: DepositRow[]; // leases with any deposit movement in the year or holding a deposit during it
  };
  occupancy: {
    unitId: string;
    unitName: string;
    daysInYear: number; // days owned in the year up to `through`
    daysOccupied: number;
    vacantDays: number;
    occupancyPct: number;
    rentLost: number;
    vacantPeriods: VacantPeriod[]; // clipped to the year
  }[];
  reconciliation: Reconciliation;
}

// ───────────────────────────── GET /api/reports/unit/[id] ─────────────────────────────

export interface UnitReportLease {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  start: string;
  end: string | null; // last day of tenancy
  state: LeaseState;
  monthlyRent: number;
  months: number; // rent months up to today
  rentExpected: number; // fell due by today
  rentCollected: number; // Σ payments on this lease
  rentUnpaid: number;
  deposit: DepositRow;
}

export interface UnitReport {
  generatedAt: string;
  today: string;
  yearMode: YearMode;
  unit: {
    id: string;
    name: string;
    type: string;
    address: string | null;
    position: "front" | "back" | null;
    floors: number;
    builtUpSqft: number;
    isActive: boolean;
    status: UnitStatus;
    electricityConsumerNumber: string | null;
  };
  purchase: { date: string; price: number; perSqft: number | null; annualAppreciationRate: number };
  /** the unit's dashboard card as of today (worth now, gain, multiplier, CAGR, occupancy…); null if bought after today */
  now: UnitBreakdown | null;
  offers: { id: string; date: string; amount: number; isBest: boolean; notes: string | null }[];
  leases: UnitReportLease[];
  vacancies: VacantPeriod[];
  /** per year (active year mode) from the purchase year to today */
  byYear: {
    year: number;
    label: string;
    rentCollected: number;
    rentExpected: number;
    collectionPct: number | null;
    expenses: number;
    net: number;
    daysOwned: number;
    vacantDays: number;
    occupancyPct: number;
    rentLost: number;
  }[];
  expensesByCategory: ExpenseSlice[];
  /** estimate at purchase, at each year start, and today; best offer known on that date */
  valueGrowth: { date: string; label: string; estimate: number; bestOfferToDate: number | null }[];
  /** the purchase → today story, oldest first */
  story: { date: string; kind: "purchase" | "lease-start" | "rent-change" | "lease-end" | "vacant" | "offer" | "expense"; text: string; amount: number | null }[];
  totals: { rentCollected: number; expenses: number; netCash: number; rentLost: number; vacantDays: number };
  reconciliation: Reconciliation;
}

// ───────────────────────────── GET /api/reports/rent-ledger/[leaseId] ─────────────────────────────

export interface RentLedgerRow {
  year: number;
  month: number;
  key: string; // "2026-07"
  label: string; // "Jul 2026"
  dueDate: string;
  expected: number; // monthly rent
  paid: number;
  /** expected − paid for this month (negative = paid in advance / overpaid) */
  outstanding: number;
  /** Σ (expected − paid) up to and including this month */
  runningBalance: number;
  status: "paid" | "part-paid" | "unpaid" | "not-due" | "advance";
  payments: { id: string; date: string; amount: number; invoiceNumber: string; method: string | null }[];
}

export interface RentLedger {
  generatedAt: string;
  today: string;
  lease: {
    id: string;
    start: string;
    end: string | null; // last day of tenancy
    state: LeaseState;
    monthlyRent: number;
    tenant: { id: string; name: string; phone: string | null };
    unit: { id: string; name: string };
  };
  /** lease start month → min(last rent month, this month), plus any month paid in advance */
  rows: RentLedgerRow[];
  totals: { expected: number; paid: number; outstanding: number; lateFees: number };
  /** payments recorded for a period outside the lease (should be none) */
  unmatchedPayments: { id: string; date: string; amount: number; invoiceNumber: string; periodLabel: string }[];
  deposit: DepositRow;
  arrears: Arrears;
  reconciliation: Reconciliation;
}
