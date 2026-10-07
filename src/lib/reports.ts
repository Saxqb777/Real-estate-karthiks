// Printable reports (Data → Reports): pure builders over the same DashboardInput and the same calculations.ts
// functions as the dashboard, so every report total reconciles with the HUD.
//  • Annual statement: one FY / calendar year, computed AS OF the year's last day (or today for the running year) —
//    exactly the dashboard's periods.year when the dashboard is looked at on that date.
//  • Unit report: purchase → today story of one unit.
//  • Rent ledger: one lease, month by month (expected vs paid vs outstanding, running balance) + deposit.
import { z } from "zod";
import {
  BIG_EXPENSE_MIN,
  allRentMonths,
  appreciatedValue,
  arrearsFrom,
  buildDashboard,
  compareUnits,
  dayNum,
  depositRowFor,
  expenseSlices,
  leaseMonthBounds,
  leaseRentMonths,
  leaseStateOn,
  makeCtx,
  monthIndex,
  monthKey,
  monthLabel,
  monthScopeFor,
  occupancyFor,
  pickBestOffer,
  recon,
  reconciliation,
  rentMonthsRange,
  rentOn,
  resolveOptions,
  round0,
  round2,
  round6,
  scopedCash,
  sumAmounts,
  yearBounds,
  yearKeyOf,
  yearLabel,
  yearScope,
  yearsBetween,
  type BuildOptions,
  type CashData,
  type DashboardInput,
  type LeaseInput,
} from "./calculations";
import type {
  AnnualReport,
  DepositRow,
  RentLedger,
  RentLedgerRow,
  UnitReport,
  UnitReportLease,
} from "./dashboard-types";
import { MS_PER_DAY, formatDate, parseDateInput, todayIST } from "./dates";
import { formatINR } from "./format";

const DAY = MS_PER_DAY;
const fromDay = (n: number) => new Date(n * DAY);
const isoDay = (n: number) => fromDay(n).toISOString();
const iso = (d: Date) => isoDay(dayNum(d));
const sum2 = (values: number[]) => round2(values.reduce((s, v) => s + v, 0));
const ratio = (a: number, b: number) => (b > 0 ? round6(a / b) : 0);
const fINR = (n: number) => formatINR(n, !Number.isInteger(round2(n)));

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ───────────────────────────── query schemas (shared by /api/dashboard and /api/reports) ─────────────────────────────

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const zYearMode = z.preprocess(
  (v) => (typeof v === "string" ? blankToUndefined(v.trim().toLowerCase()) : blankToUndefined(v)),
  z.enum(["fy", "calendar"], { message: "must be fy or calendar" }).default("fy"),
);

/** GET /api/dashboard?asOf=YYYY-MM-DD&yearMode=fy|calendar — asOf can't be after today (IST). */
export const dashboardQuerySchema = z.object({
  asOf: z.preprocess(
    blankToUndefined,
    z
      .string({ message: "must be a date (YYYY-MM-DD or D/M/YYYY)" })
      .transform((v, ctx) => {
        const d = parseDateInput(v);
        if (!d) {
          ctx.addIssue({ code: "custom", message: "must be a valid date (YYYY-MM-DD or D/M/YYYY)" });
          return z.NEVER;
        }
        if (d.getTime() > todayIST().getTime()) {
          ctx.addIssue({ code: "custom", message: "can't be in the future — the time scrubber goes back from today" });
          return z.NEVER;
        }
        return d;
      })
      .optional(),
  ),
  yearMode: zYearMode,
});

/** GET /api/reports/annual?year=<start year>&yearMode= (year defaults to the current FY / calendar year). */
export const annualReportQuerySchema = z.object({
  year: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ message: "must be a year like 2025" })
      .int("must be a whole year like 2025")
      .min(2000, "must be 2000 or later")
      .max(2100, "must be 2100 or earlier")
      .optional(),
  ),
  yearMode: zYearMode,
});

export const yearModeQuerySchema = z.object({ yearMode: zYearMode });

// ───────────────────────────── shared pieces ─────────────────────────────

type Opts = Pick<BuildOptions, "today" | "now" | "yearMode">;

/** Cash data (payments, expenses, rent months) as of A, optionally for one unit. */
function cashDataAt(input: DashboardInput, asOf: Date, unitId?: string): CashData {
  const a = dayNum(asOf);
  const leases = input.leases.filter((l) => (unitId ? l.unitId === unitId : true));
  const leaseIds = new Set(leases.map((l) => l.id));
  const payments = input.payments.filter((p) => dayNum(p.paymentDate) <= a && (!unitId || leaseIds.has(p.leaseId)));
  return {
    payments,
    expenses: input.expenses.filter((e) => dayNum(e.expenseDate) <= a && (!unitId || e.unitId === unitId)),
    months: allRentMonths({ ...input, payments }, asOf, leases),
  };
}

const unitNameIn = (input: DashboardInput) => {
  const m = new Map(input.units.map((u) => [u.id, u.name]));
  return (id: string | null) => (id === null ? "Whole plot" : (m.get(id) ?? "Unknown unit"));
};

// ───────────────────────────── annual statement ─────────────────────────────

/** Annual statement for the year `year` (FY start year or calendar year; default: the year containing today). */
export function buildAnnualReport(input: DashboardInput, o: Opts & { year?: number }): AnnualReport {
  const { now, today, mode } = resolveOptions(o);
  const key = o.year ?? yearKeyOf(today, mode);
  const { start, end } = yearBounds(key, mode);
  const s = dayNum(start);
  const e = dayNum(end);
  const t = dayNum(today);
  const through = Math.max(s - 1, Math.min(e, t)); // a future year counts nothing
  const asOf = fromDay(through);
  const ctx = makeCtx(input, asOf, mode);
  const unitName = unitNameIn(input);
  const scope = yearScope(key, mode, asOf);
  const data = cashDataAt(input, asOf);
  const totals = scopedCash(ctx, scope, data).summary;

  // Cash flow by month (all 12; months after `through` are zero).
  const first = monthIndex(start.getUTCFullYear(), start.getUTCMonth() + 1);
  const months = Array.from({ length: 12 }, (_, i) => {
    const mi = first + i;
    const y = Math.floor(mi / 12);
    const m = (mi % 12) + 1;
    const sm = scopedCash(ctx, monthScopeFor(y, m, asOf), data).summary;
    const future = dayNum(new Date(Date.UTC(y, m - 1, 1))) > through;
    return {
      year: y,
      month: m,
      key: monthKey(y, m),
      label: monthLabel(y, m),
      rentCollected: future ? 0 : sm.rentCollected,
      rentExpected: future ? 0 : sm.rentExpected,
      rentReceivedForMonth: future ? 0 : sm.rentReceivedForScope,
      expenses: future ? 0 : sm.expenses,
      net: future ? 0 : sm.net,
    };
  });

  // Cash flow by unit (units owned by `through`, in dashboard order) + whole plot.
  const owned = input.units.filter((u) => dayNum(u.purchaseDate) <= through).sort(compareUnits);
  const unitRows: AnnualReport["units"] = owned.map((u) => {
    const us = scopedCash(ctx, scope, cashDataAt(input, asOf, u.id), u).summary;
    return {
      unitId: u.id,
      unitName: u.name,
      rentCollected: us.rentCollected,
      rentExpected: us.rentExpected,
      collectionPct: us.collectionPct,
      expenses: us.expenses,
      net: us.net,
    };
  });
  const inYear = (d: Date) => dayNum(d) >= s && dayNum(d) <= through;
  const yearExpenses = input.expenses.filter((x) => inYear(x.expenseDate));
  // Rent from leases on units that weren't owned yet can't happen through the API; keep any such rows visible.
  const ownedIds = new Set(owned.map((u) => u.id));
  const orphanRent = sumAmounts(
    data.payments.filter((p) => inYear(p.paymentDate) && !ownedIds.has(ctx.leaseById.get(p.leaseId)?.unitId ?? "")),
  );
  const orphanExp = sumAmounts(yearExpenses.filter((x) => x.unitId !== null && !ownedIds.has(x.unitId)));
  const wholePlot = sumAmounts(yearExpenses.filter((x) => x.unitId === null));
  unitRows.push({
    unitId: null,
    unitName: "Whole plot",
    rentCollected: orphanRent,
    rentExpected: 0,
    collectionPct: null,
    expenses: round2(wholePlot + orphanExp),
    net: round2(orphanRent - wholePlot - orphanExp),
  });

  const categoryName = new Map(input.categories.map((c) => [c.id, c.name]));
  const expenses = [...yearExpenses]
    .sort((x, y) => x.expenseDate.getTime() - y.expenseDate.getTime() || x.id.localeCompare(y.id))
    .map((x) => ({
      id: x.id,
      date: iso(x.expenseDate),
      unitId: x.unitId,
      unitName: unitName(x.unitId),
      categoryId: x.categoryId,
      categoryName: categoryName.get(x.categoryId) ?? "Uncategorised",
      description: x.description ?? null,
      amount: round2(x.amount),
    }));
  const expensesByCategory = expenseSlices(yearExpenses, input.categories);

  // Deposits: position the day before the year starts vs on `through`.
  const openAt = fromDay(s - 1);
  const depositRows: DepositRow[] = [];
  let opening = 0;
  let closing = 0;
  let received = 0;
  let refunded = 0;
  let kept = 0;
  for (const l of input.leases) {
    const close = depositRowFor(l, unitName(l.unitId), asOf);
    if (!close) continue;
    const open = depositRowFor(l, unitName(l.unitId), openAt);
    const o0 = open ? round2(open.held + open.awaitingRefund) : 0;
    const c0 = round2(close.held + close.awaitingRefund);
    const rec = open ? 0 : close.deposit;
    const ref = round2(close.refunded - (open?.refunded ?? 0));
    const kp = round2(close.kept - (open?.kept ?? 0));
    if (o0 === 0 && c0 === 0 && rec === 0 && ref === 0 && kp === 0) continue;
    opening += o0;
    closing += c0;
    received += rec;
    refunded += ref;
    kept += kp;
    depositRows.push(close);
  }
  depositRows.sort((x, y) => x.receivedDate.localeCompare(y.receivedDate));
  const deposits = {
    opening: round2(opening),
    received: round2(received),
    refunded: round2(refunded),
    kept: round2(kept),
    closing: round2(closing),
    rows: depositRows,
  };

  // Occupancy inside the year: owned days [max(purchase, year start), min(year end + 1, today)).
  const windowEnd = Math.min(e + 1, t);
  const occupancy = owned.map((u) => {
    const occ = occupancyFor(
      u.purchaseDate,
      fromDay(windowEnd),
      input.leases.filter((l) => l.unitId === u.id),
      start,
    );
    return {
      unitId: u.id,
      unitName: u.name,
      daysInYear: occ.daysOwned,
      daysOccupied: occ.daysOccupied,
      vacantDays: occ.vacantDays,
      occupancyPct: ratio(occ.daysOccupied, occ.daysOwned),
      rentLost: occ.unrealizedLoss,
      vacantPeriods: occ.vacantPeriods,
    };
  });

  const rec = reconciliation([
    recon("monthsRent", "Σ monthly rent = rent collected", totals.rentCollected, sum2(months.map((m) => m.rentCollected))),
    recon("monthsExpenses", "Σ monthly expenses = expenses", totals.expenses, sum2(months.map((m) => m.expenses))),
    recon("monthsDue", "Σ monthly rent due = rent that fell due", totals.rentExpected, sum2(months.map((m) => m.rentExpected))),
    recon("unitsRent", "Σ unit rent = rent collected", totals.rentCollected, sum2(unitRows.map((u) => u.rentCollected))),
    recon("unitsExpenses", "Unit expenses + whole-plot expenses = expenses", totals.expenses, sum2(unitRows.map((u) => u.expenses))),
    recon("categories", "Σ expense categories = expenses", totals.expenses, sum2(expensesByCategory.map((c) => c.amount))),
    recon("expenseList", "Σ expense list = expenses", totals.expenses, sum2(expenses.map((x) => x.amount))),
    recon("net", "Rent collected − expenses = net cash", round2(totals.rentCollected - totals.expenses), totals.net),
    recon(
      "deposits",
      "Opening deposits + received − refunded − kept = closing",
      deposits.closing,
      round2(deposits.opening + deposits.received - deposits.refunded - deposits.kept),
    ),
  ]);

  return {
    generatedAt: now.toISOString(),
    today: today.toISOString(),
    yearMode: mode,
    year: key,
    label: yearLabel(key, mode),
    start: start.toISOString(),
    end: end.toISOString(),
    through: isoDay(Math.max(through, s)),
    isPartial: through < e,
    totals,
    months,
    units: unitRows,
    expensesByCategory,
    expenses,
    deposits,
    occupancy,
    reconciliation: rec,
  };
}

// ───────────────────────────── unit report ─────────────────────────────

/** The purchase → today story of one unit; null when it doesn't exist. */
export function buildUnitReport(input: DashboardInput, unitId: string, o: Opts): UnitReport | null {
  const { now, today, mode } = resolveOptions(o);
  const u = input.units.find((x) => x.id === unitId);
  if (!u) return null;
  const t = dayNum(today);
  const ctx = makeCtx(input, today, mode);
  const dash = buildDashboard(input, { asOf: today, today, now, yearMode: mode });
  const card = dash.units.find((x) => x.id === unitId) ?? null;
  const leases = input.leases.filter((l) => l.unitId === unitId).sort((x, y) => x.startDate.getTime() - y.startDate.getTime());
  const leaseIds = new Set(leases.map((l) => l.id));
  const payments = input.payments.filter((p) => leaseIds.has(p.leaseId) && dayNum(p.paymentDate) <= t);
  const paymentsByLease = groupBy(payments, (p) => p.leaseId);
  const unitExpenses = input.expenses.filter((x) => x.unitId === unitId && dayNum(x.expenseDate) <= t);
  const offers = input.offers.filter((x) => x.unitId === unitId && dayNum(x.offerDate) <= t);
  const best = pickBestOffer(offers);

  const leaseRows: UnitReportLease[] = leases.map((l) => {
    const months = leaseRentMonths(l, paymentsByLease.get(l.id) ?? [], input.settings, today);
    const due = months.filter((m) => m.dueDay < t);
    const expected = sum2(due.map((m) => m.due));
    const receivedForDue = sum2(due.map((m) => Math.min(Math.max(0, m.paid), m.due)));
    return {
      leaseId: l.id,
      tenantId: l.tenantId,
      tenantName: l.tenantName,
      tenantPhone: l.tenantPhone,
      start: iso(l.startDate),
      end: l.endDate ? iso(l.endDate) : null,
      state: leaseStateOn(l, today),
      monthlyRent: round2(rentOn(l, today)),
      months: months.length,
      rentExpected: expected,
      rentCollected: sumAmounts(paymentsByLease.get(l.id) ?? []),
      rentUnpaid: round2(expected - receivedForDue),
      deposit: depositRowFor(l, u.name, today) ?? emptyDeposit(l, u.name),
    };
  });

  const vacancies = occupancyFor(u.purchaseDate, today, leases).vacantPeriods;

  // Per year from the purchase year to today's year.
  const data = cashDataAt(input, today, unitId);
  const byYear: UnitReport["byYear"] = [];
  const firstKey = yearKeyOf(u.purchaseDate, mode);
  const lastKey = yearKeyOf(today, mode);
  for (let key = firstKey; key <= lastKey; key++) {
    const ys = scopedCash(ctx, yearScope(key, mode, today), data, u).summary;
    const { start, end } = yearBounds(key, mode);
    const occ = occupancyFor(u.purchaseDate, fromDay(Math.min(dayNum(end) + 1, t)), leases, start);
    byYear.push({
      year: key,
      label: yearLabel(key, mode),
      rentCollected: ys.rentCollected,
      rentExpected: ys.rentExpected,
      collectionPct: ys.collectionPct,
      expenses: ys.expenses,
      net: ys.net,
      daysOwned: occ.daysOwned,
      vacantDays: occ.vacantDays,
      occupancyPct: ratio(occ.daysOccupied, occ.daysOwned),
      rentLost: occ.unrealizedLoss,
    });
  }

  // Value growth: purchase, each year start since, today.
  const points = [dayNum(u.purchaseDate)];
  for (let key = firstKey + 1; key <= lastKey; key++) points.push(dayNum(yearBounds(key, mode).start));
  if (t > points[points.length - 1]) points.push(t);
  const valueGrowth = points.map((day) => {
    const d = fromDay(day);
    const bestThen = pickBestOffer(offers.filter((x) => dayNum(x.offerDate) <= day));
    return {
      date: d.toISOString(),
      label: day === dayNum(u.purchaseDate) ? "Bought" : day === t ? "Today" : yearLabel(yearKeyOf(d, mode), mode),
      estimate: round0(appreciatedValue(u.purchasePrice, u.annualAppreciationRate, yearsBetween(u.purchaseDate, d))),
      bestOfferToDate: bestThen ? round2(bestThen.amount) : null,
    };
  });

  const categoryName = new Map(input.categories.map((c) => [c.id, c.name]));
  const story: UnitReport["story"] = [
    { date: iso(u.purchaseDate), kind: "purchase", text: `Bought ${u.name} for ${fINR(u.purchasePrice)}`, amount: round2(u.purchasePrice) },
  ];
  for (const l of leases) {
    if (dayNum(l.startDate) <= t) {
      story.push({ date: iso(l.startDate), kind: "lease-start", text: `${l.tenantName} moved in at ${fINR(l.monthlyRent)} a month`, amount: round2(l.monthlyRent) });
    } else {
      story.push({ date: iso(l.startDate), kind: "lease-start", text: `${l.tenantName} moves in at ${fINR(l.monthlyRent)} a month`, amount: round2(l.monthlyRent) });
    }
    for (const c of l.rentChanges ?? []) {
      if (dayNum(c.effectiveFrom) > t) continue;
      story.push({ date: iso(c.effectiveFrom), kind: "rent-change", text: `${l.tenantName}'s rent became ${fINR(c.monthlyRent)} a month`, amount: round2(c.monthlyRent) });
    }
    if (l.endDate && dayNum(l.endDate) <= t) {
      story.push({ date: iso(l.endDate), kind: "lease-end", text: `${l.tenantName}'s last day of tenancy`, amount: null });
    }
  }
  for (const p of vacancies) {
    story.push({
      date: p.start,
      kind: "vacant",
      text: p.ongoing
        ? `Empty since ${formatDate(p.start)} — ${p.days} days so far${p.noRentHistory ? "" : ` (rent lost ${fINR(p.unrealizedLoss)})`}`
        : `Empty for ${p.days} days${p.noRentHistory ? "" : ` (rent lost ${fINR(p.unrealizedLoss)})`}`,
      amount: p.unrealizedLoss,
    });
  }
  for (const x of offers) {
    story.push({ date: iso(x.offerDate), kind: "offer", text: `Offer of ${fINR(x.amount)}${x.notes ? ` — ${x.notes}` : ""}`, amount: round2(x.amount) });
  }
  for (const x of unitExpenses) {
    if (x.amount < BIG_EXPENSE_MIN) continue;
    story.push({
      date: iso(x.expenseDate),
      kind: "expense",
      text: `${categoryName.get(x.categoryId) ?? "Expense"}${x.description ? ` — ${x.description}` : ""}: ${fINR(x.amount)}`,
      amount: round2(x.amount),
    });
  }
  const KIND_ORDER = { purchase: 0, "lease-end": 1, vacant: 2, "lease-start": 3, "rent-change": 4, offer: 5, expense: 6 } as const;
  story.sort((x, y) => x.date.localeCompare(y.date) || KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);

  const rentCollected = sumAmounts(payments);
  const expensesTotal = sumAmounts(unitExpenses);
  const rentLost = sum2(vacancies.map((p) => p.unrealizedLoss));
  const vacantDays = vacancies.reduce((n, p) => n + p.days, 0);
  const expensesByCategory = expenseSlices(unitExpenses, input.categories);

  const items = [
    recon("leasesRent", "Σ rent per lease = rent collected", rentCollected, sum2(leaseRows.map((l) => l.rentCollected))),
    recon("yearsRent", "Σ yearly rent = rent collected", rentCollected, sum2(byYear.map((y) => y.rentCollected))),
    recon("yearsExpenses", "Σ yearly expenses = expenses", expensesTotal, sum2(byYear.map((y) => y.expenses))),
    recon("categories", "Σ expense categories = expenses", expensesTotal, sum2(expensesByCategory.map((c) => c.amount))),
    recon("vacantDays", "Σ yearly vacant days = vacant days", vacantDays, byYear.reduce((n, y) => n + y.vacantDays, 0)),
  ];
  if (card) {
    items.push(recon("dashboardRent", "Rent collected = dashboard unit card", card.rentCollected, rentCollected));
    items.push(recon("dashboardExpenses", "Expenses = dashboard unit card", card.expenses, expensesTotal));
    items.push(recon("dashboardRentLost", "Rent lost = dashboard unit card", card.unrealizedLoss, rentLost));
  }

  return {
    generatedAt: now.toISOString(),
    today: today.toISOString(),
    yearMode: mode,
    unit: {
      id: u.id,
      name: u.name,
      type: u.type,
      address: u.address ?? null,
      position: u.position,
      floors: u.floors,
      builtUpSqft: u.builtUpSqft,
      isActive: u.isActive,
      status: card?.status ?? (u.isActive ? "vacant" : "inactive"),
      electricityConsumerNumber: u.electricityConsumerNumber,
    },
    purchase: {
      date: iso(u.purchaseDate),
      price: round2(u.purchasePrice),
      perSqft: u.builtUpSqft > 0 ? round0(u.purchasePrice / u.builtUpSqft) : null,
      annualAppreciationRate: u.annualAppreciationRate,
    },
    now: card,
    offers: [...offers]
      .sort((x, y) => x.offerDate.getTime() - y.offerDate.getTime())
      .map((x) => ({ id: x.id, date: iso(x.offerDate), amount: round2(x.amount), isBest: x === best, notes: x.notes ?? null })),
    leases: leaseRows,
    vacancies,
    byYear,
    expensesByCategory,
    valueGrowth,
    story,
    totals: { rentCollected, expenses: expensesTotal, netCash: round2(rentCollected - expensesTotal), rentLost, vacantDays },
    reconciliation: reconciliation(items),
  };
}

function emptyDeposit(l: LeaseInput, unitName: string): DepositRow {
  return {
    leaseId: l.id,
    tenantName: l.tenantName,
    unitId: l.unitId,
    unitName,
    deposit: round2(l.securityDeposit),
    receivedDate: iso(l.startDate),
    refunded: 0,
    refundDate: null,
    kept: 0,
    awaitingRefund: 0,
    held: 0,
  };
}

// ───────────────────────────── rent ledger ─────────────────────────────

/** Month-by-month rent ledger of one lease, as of today; null when it doesn't exist. */
export function buildRentLedger(input: DashboardInput, leaseId: string, o: Opts): RentLedger | null {
  const { now, today } = resolveOptions(o);
  const l = input.leases.find((x) => x.id === leaseId);
  if (!l) return null;
  const t = dayNum(today);
  const unit = input.units.find((x) => x.id === l.unitId);
  const unitName = unit?.name ?? "Unknown unit";
  const all = input.payments.filter((p) => p.leaseId === leaseId && dayNum(p.paymentDate) <= t);
  const { first, last } = leaseMonthBounds(l);
  const inLease = (mi: number) => mi >= first && (last === null || mi <= last);
  const byMonth = groupBy(all, (p) => monthIndex(p.periodYear, p.periodMonth));
  const unmatched = all.filter((p) => !inLease(monthIndex(p.periodYear, p.periodMonth)));

  // Months through min(last month, this month) + any later month already paid (advance).
  const months = leaseRentMonths(l, all, input.settings, today);
  const lastListed = months.length ? months[months.length - 1].index : first - 1;
  const advanceIdx = [...byMonth.keys()].filter((mi) => inLease(mi) && mi > lastListed).sort((x, y) => x - y);
  const todayMonth = monthIndex(today.getUTCFullYear(), today.getUTCMonth() + 1);
  const ext = advanceIdx.flatMap((mi) => rentMonthsRange(l, all, input.settings, today, mi, mi));

  let running = 0;
  const rows: RentLedgerRow[] = [...months, ...ext].map((m) => {
    const isDue = m.dueDay < t;
    running = round2(running + (isDue ? m.due : 0) - m.paid);
    const status: RentLedgerRow["status"] =
      m.paid >= m.due ? (m.index > todayMonth ? "advance" : "paid") : m.paid > 0 ? "part-paid" : isDue ? "unpaid" : "not-due";
    return {
      year: m.year,
      month: m.month,
      key: m.key,
      label: m.label,
      dueDate: isoDay(m.dueDay),
      expected: m.due,
      paid: m.paid,
      outstanding: m.outstanding,
      runningBalance: running,
      status,
      payments: (byMonth.get(m.index) ?? [])
        .sort((x, y) => x.paymentDate.getTime() - y.paymentDate.getTime() || x.invoiceSeq - y.invoiceSeq)
        .map((p) => ({ id: p.id, date: iso(p.paymentDate), amount: round2(p.amount), invoiceNumber: p.invoiceNumber, method: p.method ?? null })),
    };
  });

  const arrears = arrearsFrom(months);
  const expected = sum2(rows.filter((r) => dayNum(new Date(r.dueDate)) < t).map((r) => r.expected));
  const paid = sum2(rows.map((r) => r.paid));
  const outstanding = round2(expected - paid);
  const deposit = depositRowFor(l, unitName, today) ?? emptyDeposit(l, unitName);

  return {
    generatedAt: now.toISOString(),
    today: today.toISOString(),
    lease: {
      id: l.id,
      start: iso(l.startDate),
      end: l.endDate ? iso(l.endDate) : null,
      state: leaseStateOn(l, today),
      monthlyRent: round2(rentOn(l, today)),
      tenant: { id: l.tenantId, name: l.tenantName, phone: l.tenantPhone },
      unit: { id: l.unitId, name: unitName },
    },
    rows,
    totals: { expected, paid, outstanding, lateFees: arrears.lateFees },
    unmatchedPayments: unmatched.map((p) => ({
      id: p.id,
      date: iso(p.paymentDate),
      amount: round2(p.amount),
      invoiceNumber: p.invoiceNumber,
      periodLabel: monthLabel(p.periodYear, p.periodMonth),
    })),
    deposit,
    arrears,
    reconciliation: reconciliation([
      recon("payments", "Σ ledger payments + unmatched = all payments on this lease", sumAmounts(all), round2(paid + sumAmounts(unmatched))),
      recon("balance", "Rent due − paid = closing balance", outstanding, rows.length ? rows[rows.length - 1].runningBalance : 0),
      recon(
        "arrears",
        "Σ overdue unpaid months = arrears",
        arrears.total,
        sum2(rows.filter((r) => dayNum(new Date(r.dueDate)) < t && r.outstanding > 0).map((r) => r.outstanding)),
      ),
      recon(
        "deposit",
        "Deposit = held + refunded + kept + awaiting refund",
        deposit.deposit,
        round2(deposit.held + deposit.refunded + deposit.kept + deposit.awaitingRefund),
      ),
    ]),
  };
}
