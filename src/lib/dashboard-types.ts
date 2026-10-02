// Contract for GET /api/dashboard — shared by src/lib/calculations.ts (producer)
// and the UI (consumer). All money in INR (number), dates as ISO strings (date-only = 00:00Z).

export type UnitStatus = "occupied" | "vacant" | "inactive";
export type RentState = "paid" | "due-soon" | "overdue" | "none"; // "none" = no active lease

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
  start: string; // ISO date
  end: string; // ISO date (exclusive end = day the next lease starts, or today)
  days: number;
  /** rent used for the loss estimate (per month); 0 when the unit never had a lease */
  rentBasis: number;
  unrealizedLoss: number;
  /** true when no lease ever existed so loss is 0 by rule */
  noRentHistory: boolean;
}

export interface NextPayment {
  leaseId: string;
  dueDate: string; // ISO date
  periodMonth: number; // 1-12
  periodYear: number;
  amountDue: number; // monthly rent (+ late fee if applied)
  isOverdue: boolean;
  daysOverdue: number; // 0 when not overdue
  lateFeeApplied: boolean;
  lateFee: number;
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
  yearsHeld: number; // fractional
  currentValue: number;
  bestOffer: number | null;
  bestOfferDate: string | null;
  /** bestOffer ?? currentValue — what the unit is "worth" for totals */
  valuation: number;
  valuationSource: "offer" | "estimate";
  appreciation: number;
  appreciationPct: number; // appreciation / purchasePrice (fraction)
  rentCollected: number;
  expenses: number; // expenses tagged to this unit only (whole-plot expenses excluded)
  occupancyPct: number; // fraction 0..1
  daysOwned: number;
  daysOccupied: number;
  vacantPeriods: VacantPeriod[];
  vacantDays: number;
  unrealizedLoss: number;
  activeLease: null | {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantPhone: string | null;
    startDate: string;
    monthlyRent: number;
    securityDeposit: number;
  };
  nextPayment: NextPayment | null;
  electricityConsumerNumber: string | null;
  electricityPayUrl: string | null;
}

export interface Kpis {
  unitsActive: number;
  unitsOccupied: number;
  invested: number; // Σ purchasePrice (active units)
  currentValue: number; // Σ currentValue (active units)
  bestOfferTotal: number; // Σ valuation (best offer, else estimate) (active units)
  bestOfferIsPartialEstimate: boolean; // true if any active unit has no offer
  appreciation: number; // Σ appreciation (active units)
  capitalMultiplier: number | null; // bestOfferTotal / invested
  cagr: number | null; // fraction, e.g. 0.083
  holdingYears: number; // investment-weighted average years held
  rentCollected: number; // Σ all payments
  totalExpenses: number; // Σ all expenses
  netProfit: number; // rentCollected - totalExpenses
  securityDepositsHeld: number; // Σ securityDeposit on active leases
  totalReturn: number; // appreciation + rentCollected
  totalBuiltUpSqft: number;
  boughtAtPerSqft: number | null; // invested / totalBuiltUpSqft
  offeredAtPerSqft: number | null; // bestOfferTotal / totalBuiltUpSqft
  occupancyPct: number; // Σ occupied days / Σ days owned (active units)
  vacantDays: number;
  unrealizedLoss: number;
  monthlyRentRoll: number; // Σ monthlyRent on active leases
  overdueCount: number;
  overdueAmount: number;
  pendingActions: number;
}

export interface MonthPoint {
  month: number; // 1-12
  label: string; // "Jan"
  income: number;
  expenses: number;
  net: number;
  cumulative: number; // running net within the year
}

export interface YearSeries {
  year: number;
  income: number;
  expenses: number;
  net: number;
  months: MonthPoint[];
}

export interface ExpenseSlice {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  share: number; // fraction of total
}

export interface DashboardData {
  generatedAt: string; // ISO datetime
  today: string; // ISO date (IST)
  settings: {
    brandName: string;
    subtitle: string | null;
    currency: string;
    rentDueDay: number;
    lateFeeEnabled: boolean;
    lateFeeAmount: number;
    lateFeeGraceDays: number;
  };
  plot: PlotGeometry;
  kpis: Kpis;
  units: UnitBreakdown[]; // all units (active first), inactive flagged
  /** Monthly income vs expenses, one entry per calendar year with data (ascending) */
  monthlyByYear: YearSeries[];
  /** All-time running net, one point per year end */
  cumulativeNetByYear: { year: number; net: number; cumulative: number }[];
  expenseComposition: {
    allTime: ExpenseSlice[];
    byYear: { year: number; slices: ExpenseSlice[] }[];
  };
  vacancy: {
    totalVacantDays: number;
    totalUnrealizedLoss: number;
    occupancyPct: number;
    units: { unitId: string; unitName: string; vacantDays: number; unrealizedLoss: number; periods: VacantPeriod[]; noRentHistory: boolean }[];
  };
  actions: {
    pending: { id: string; title: string; priority: "Low" | "Medium" | "High"; dueDate: string | null; unitId: string | null; isOverdue: boolean }[];
  };
  recentPayments: { id: string; amount: number; paymentDate: string; unitName: string; tenantName: string; invoiceNumber: string }[];
}
