// Owner's DONE CHECK — enters 2 units, 1 offer, 1 tenant, 1 lease, 3 payments and 2 expenses (one through a Paid
// property tax) through the real API, then recomputes every dashboard figure with an INDEPENDENT implementation of the
// spec formulas (nothing imported from src/) and checks that totals are identical everywhere they appear.
//
// Usage (against a dev server on an EMPTY database):
//   node scripts/done-check.mjs                      # BASE defaults to http://localhost:3300
//   BASE=http://localhost:3207 node scripts/done-check.mjs --cleanup   # delete the records afterwards
// Flags: --cleanup  remove everything this script created at the end
//        --force    run even if units already exist (expected values assume an empty database — don't use on real data)
// Exit code 1 if any check fails.
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3300";
const args = new Set(process.argv.slice(2));
const CLEANUP = args.has("--cleanup");
const FORCE = args.has("--force");

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && !args.has("--allow-remote")) {
  console.error(`Refusing to run against ${BASE}: this script writes test records. Use a local dev server.`);
  process.exit(2);
}

const password =
  process.env.APP_PASSWORD || /APP_PASSWORD="([^"]*)"/.exec(fs.readFileSync(".env", "utf8"))?.[1];
const username = process.env.APP_USERNAME || "estates";

// ───────────── tiny API client ─────────────
let cookie = "";
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${typeof data === "object" ? JSON.stringify(data) : data}`);
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  return data;
}
const get = (p) => call("GET", p);
const post = (p, b) => call("POST", p, b);
const del = (p) => call("DELETE", p);

// ───────────── independent date / money helpers ─────────────
const DAY = 86_400_000;
const d = (iso) => new Date(iso.slice(0, 10) + "T00:00:00.000Z");
const ymd = (dt) => dt.toISOString().slice(0, 10);
const days = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY);
const addDays = (dt, n) => new Date(dt.getTime() + n * DAY);
const monthStart = (y, m) => new Date(Date.UTC(y, m - 1, 1)); // m = 1..12
const shiftMonth = (y, m, delta) => {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r0 = (n) => Math.round(n);
const inr = (n) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

// ───────────── checks table ─────────────
const rows = [];
function check(label, expected, actual, tol = 0.01, fmt = inr) {
  const ok =
    expected === null || actual === null || expected === undefined || actual === undefined
      ? expected == actual
      : typeof expected === "number"
        ? Math.abs(expected - actual) <= tol
        : expected === actual;
  rows.push({ label, expected: typeof expected === "number" ? fmt(expected) : String(expected), actual: typeof actual === "number" ? fmt(actual) : String(actual), ok });
}
function section(title) {
  rows.push({ section: title });
}
const pct = (n) => `${(n * 100).toFixed(4)}%`;
const num = (n) => String(Number(n.toFixed(6)));

// ───────────── run ─────────────
const created = { units: [], offers: [], tenants: [], leases: [], payments: [], expenses: [], taxes: [] };

async function main() {
  await post("/api/auth/login", { username, password });
  const existing = await get("/api/units");
  if (existing.items.length && !FORCE) {
    throw new Error(`Database already has ${existing.items.length} unit(s). Run on an empty database (or --force).`);
  }

  const dash0 = await get("/api/dashboard");
  const today = d(dash0.today);
  const ty = today.getUTCFullYear();
  const tm = today.getUTCMonth() + 1;
  const dueDay = dash0.settings.rentDueDay;
  console.log(`Today (IST): ${ymd(today)} · rent due day ${dueDay}\n`);

  // ── the owner's test data ──
  const A = { name: "Done-check Unit A", position: "front", builtUpSqft: 1120, purchaseDate: "2019-06-15", purchasePrice: 3850000, annualAppreciationRate: 7.5, floors: 2 };
  const B = { name: "Done-check Unit B", position: "back", builtUpSqft: 1120, purchaseDate: "2021-03-10", purchasePrice: 4200000, annualAppreciationRate: 8, floors: 2 };
  const unitA = await post("/api/units", A);
  const unitB = await post("/api/units", B);
  created.units.push(unitB.id, unitA.id);

  const OFFER = { amount: 6150000, offerDate: "2025-02-01" };
  const offer = await post("/api/offers", { unitId: unitA.id, ...OFFER, notes: "Done-check offer" });
  created.offers.push(offer.id);

  const tenant = await post("/api/tenants", { name: "Done-check Tenant", phone: "+91 98765 43210" });
  created.tenants.push(tenant.id);

  const leaseStartYM = shiftMonth(ty, tm, -3);
  const leaseStart = monthStart(leaseStartYM.y, leaseStartYM.m);
  const RENT = 12500;
  const DEPOSIT = 75000;
  const lease = await post("/api/leases", {
    unitId: unitA.id,
    tenantId: tenant.id,
    startDate: ymd(leaseStart),
    monthlyRent: RENT,
    securityDeposit: DEPOSIT,
  });
  created.leases.push(lease.id);

  const pays = [];
  for (let i = 0; i < 3; i++) {
    const p = shiftMonth(leaseStartYM.y, leaseStartYM.m, i);
    const paymentDate = new Date(Date.UTC(p.y, p.m - 1, 5));
    const pay = await post("/api/payments", { leaseId: lease.id, amount: RENT, paymentDate: ymd(paymentDate), periodMonth: p.m, periodYear: p.y, method: "upi" });
    created.payments.push(pay.id);
    pays.push({ amount: RENT, date: paymentDate, invoice: pay.invoiceNumber });
  }

  const cats = await get("/api/expense-categories");
  const maintenance = cats.items.find((c) => c.name === "Maintenance");
  const EXP1 = { amount: 6200, date: addDays(today, -20) };
  const exp = await post("/api/expenses", { unitId: "", categoryId: maintenance.id, expenseDate: ymd(EXP1.date), amount: EXP1.amount, description: "Done-check: gutter cleaning" });
  created.expenses.push(exp.id);

  const TAX = { amount: 4321.5, date: addDays(today, -10), year: ty };
  const tax = await post("/api/property-tax", { unitId: unitB.id, year: TAX.year, amount: TAX.amount, status: "Paid", paymentDate: ymd(TAX.date) });
  created.taxes.push(tax.id);

  // ── fetch everything ──
  const dash = await get("/api/dashboard");
  const kp = dash.kpis;
  const uA = dash.units.find((u) => u.id === unitA.id);
  const uB = dash.units.find((u) => u.id === unitB.id);
  const expensesApi = await get("/api/expenses");
  const catsAfter = await get("/api/expense-categories");
  const paymentsApi = await get("/api/payments");
  const annual = await get(`/api/reports/annual?yearMode=${dash.yearMode}`);
  const ledger = await get(`/api/reports/rent-ledger/${lease.id}`);

  // ── independent maths (spec formulas) ──
  const yrs = (purchase) => Math.max(0, days(d(purchase), today)) / 365.25;
  const yA = yrs(A.purchaseDate);
  const yB = yrs(B.purchaseDate);
  const cvA = r0(A.purchasePrice * Math.pow(1 + A.annualAppreciationRate / 100, yA));
  const cvB = r0(B.purchasePrice * Math.pow(1 + B.annualAppreciationRate / 100, yB));
  const valA = OFFER.amount; // best offer exists
  const valB = cvB; // no offer → estimate
  const gainA = valA - A.purchasePrice;
  const gainB = valB - B.purchasePrice;
  const invested = A.purchasePrice + B.purchasePrice;
  const worth = valA + valB;
  const gain = gainA + gainB;
  const holding = (A.purchasePrice * yA + B.purchasePrice * yB) / invested;
  const multiplier = worth / invested;
  const cagr = Math.pow(worth / invested, 1 / holding) - 1;
  const rentCollected = pays.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = r2(EXP1.amount + TAX.amount);
  const net = r2(rentCollected - totalExpenses);
  const sqft = A.builtUpSqft + B.builtUpSqft;

  // vacancy: owned [purchase, today); open lease occupies [start, today)
  const ownedA = days(d(A.purchaseDate), today);
  const ownedB = days(d(B.purchaseDate), today);
  const occA = days(leaseStart, today);
  const vacA = ownedA - occA;
  const vacB = ownedB;
  const lostA = r0((vacA * RENT) / 30); // gap before the first lease → next lease's rent
  const lostB = 0; // never leased → 0 + flag

  // next payment: months start..start+2 paid → next = today's month, due on dueDay (clamped)
  const dim = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const nextDue = new Date(Date.UTC(ty, tm - 1, Math.min(dueDay, dim)));
  const overdue = nextDue.getTime() < today.getTime();

  // FY / calendar scope of today
  const fyStartYear = dash.yearMode === "fy" ? (tm >= 4 ? ty : ty - 1) : ty;
  const yStart = dash.yearMode === "fy" ? new Date(Date.UTC(fyStartYear, 3, 1)) : new Date(Date.UTC(ty, 0, 1));
  const inYear = (dt) => dt.getTime() >= yStart.getTime() && dt.getTime() <= today.getTime();
  const yearRent = pays.filter((p) => inYear(p.date)).reduce((s, p) => s + p.amount, 0);
  const yearExp = r2([EXP1, TAX].filter((e) => inYear(e.date)).reduce((s, e) => s + e.amount, 0));

  // ── compare: spec formulas vs /api/dashboard ──
  section("SPEC FORMULAS (independent maths) vs /api/dashboard");
  check("Unit A current value  P×(1+r)^years", cvA, uA.currentValue, 1);
  check("Unit B current value  P×(1+r)^years", cvB, uB.currentValue, 1);
  check("Unit A best offer", OFFER.amount, uA.bestOffer);
  check("Unit A best offer date", OFFER.offerDate, uA.bestOfferDate?.slice(0, 10));
  check("Unit A appreciation = offer − price", gainA, uA.appreciation, 1);
  check("Unit B appreciation = value − price (no offer)", gainB, uB.appreciation, 1);
  check("Invested total", invested, kp.invested);
  check("Best-offer total (offer, else estimate)", worth, kp.bestOfferTotal, 1);
  check("Appreciation total", gain, kp.appreciation, 2);
  check("Capital multiplier = worth ÷ invested", multiplier, kp.capitalMultiplier, 1e-5, num);
  check("Holding years (investment-weighted)", holding, kp.holdingYears, 1e-5, num);
  check("CAGR = (worth÷invested)^(1/years) − 1", cagr, kp.cagr, 1e-5, pct);
  check("Rent collected = Σ payments", rentCollected, kp.rentCollected);
  check("Total expenses = Σ expenses (incl. tax)", totalExpenses, kp.totalExpenses);
  check("Net = rent − expenses", net, kp.netProfit);
  check("Security deposits held", DEPOSIT, kp.securityDepositsHeld);
  check("Total return = appreciation + rent", gain + rentCollected, kp.totalReturn, 2);
  check("Bought at / sqft", r0(invested / sqft), kp.boughtAtPerSqft, 1);
  check("Offered at / sqft", r0(worth / sqft), kp.offeredAtPerSqft, 1);
  check("Unit A vacant days (purchase → lease)", vacA, uA.vacantDays, 0, String);
  check("Unit B vacant days (never let)", vacB, uB.vacantDays, 0, String);
  check("Unit A rent lost = days × rent ÷ 30", lostA, uA.unrealizedLoss, 1);
  check("Unit B rent lost (no lease ever → 0)", lostB, uB.unrealizedLoss);
  check("Unit B flagged 'no rent history'", true, uB.vacantPeriods.every((p) => p.noRentHistory));
  check("Rent lost total", lostA + lostB, kp.unrealizedLoss, 1);
  check("Unit A occupancy = occupied ÷ owned", occA / ownedA, uA.occupancyPct, 1e-5, pct);
  check("Portfolio occupancy", occA / (ownedA + ownedB), kp.occupancyPct, 1e-5, pct);
  check("Next payment due date", ymd(nextDue), uA.nextPayment?.dueDate?.slice(0, 10));
  check("Overdue (due date before today)", overdue, uA.nextPayment?.isOverdue);
  check("Overdue amount", overdue ? RENT : 0, kp.overdueAmount);
  check("Late fee only when enabled (off)", false, uA.nextPayment?.lateFeeApplied ?? false);
  check("Monthly rent roll", RENT, kp.monthlyRentRoll);
  check("Unit A status", "occupied", uA.status);
  check("Unit B status", "vacant", uB.status);

  // ── identical totals everywhere ──
  section("TOTALS IDENTICAL EVERYWHERE");
  const catTotal = r2(catsAfter.items.reduce((s, c) => s + (c.total ?? 0), 0));
  const unitExp = r2(dash.units.reduce((s, u) => s + u.expenses, 0) + kp.wholePlotExpenses);
  check("Expenses: /api/expenses total", totalExpenses, expensesApi.total);
  check("Expenses: /api/expense-categories Σ totals", totalExpenses, catTotal);
  check("Expenses: dashboard periods.allTime", totalExpenses, dash.periods.allTime.expenses);
  check("Expenses: Σ unit cards + whole plot", totalExpenses, unitExp);
  check("Expenses: Σ expense composition (all time)", totalExpenses, r2(dash.expenseComposition.allTime.reduce((s, x) => s + x.amount, 0)));
  check("Expenses: explain['expenses'] value", totalExpenses, dash.explain.expenses?.value ?? null);
  check("Expenses this year: dashboard periods.year", yearExp, dash.periods.year.expenses);
  check("Expenses this year: annual report", yearExp, annual.totals.expenses);
  check("Rent: /api/payments total", rentCollected, paymentsApi.total);
  check("Rent: Σ unit cards", rentCollected, r2(dash.units.reduce((s, u) => s + u.rentCollected, 0)));
  check("Rent: dashboard periods.allTime", rentCollected, dash.periods.allTime.rentCollected);
  check("Rent: explain['rentCollected'] value", rentCollected, dash.explain.rentCollected?.value ?? null);
  check("Rent this year: periods.year = annual report", yearRent, annual.totals.rentCollected);
  check("Rent: rent ledger paid", rentCollected, ledger.totals.paid);
  check("Net: explain['netCash'] value", net, dash.explain.netCash?.value ?? null);
  check("Dashboard ledger balanced", true, dash.checks.ledgerBalanced);
  check("Annual report ledger balanced", true, annual.reconciliation.ledgerBalanced);
  check("Rent ledger balanced", true, ledger.reconciliation.ledgerBalanced);
}

async function cleanup() {
  const tryDel = async (path) => {
    try {
      await del(path);
    } catch (e) {
      console.error(`  cleanup: ${e.message}`);
    }
  };
  for (const id of created.payments) await tryDel(`/api/payments/${id}`);
  for (const id of created.taxes) await tryDel(`/api/property-tax/${id}`);
  for (const id of created.expenses) await tryDel(`/api/expenses/${id}`);
  for (const id of created.leases) await tryDel(`/api/leases/${id}`);
  for (const id of created.tenants) await tryDel(`/api/tenants/${id}`);
  for (const id of created.offers) await tryDel(`/api/offers/${id}`);
  for (const id of created.units) await tryDel(`/api/units/${id}`);
  console.log("\nCleanup: removed the done-check records.");
}

let failed = false;
try {
  await main();
} catch (e) {
  console.error(`\nERROR: ${e.message}`);
  failed = true;
} finally {
  if (rows.length) {
    const checks = rows.filter((r) => !r.section);
    const w = Math.max(...checks.map((r) => r.label.length));
    for (const r of rows) {
      if (r.section) console.log(`\n${r.section}`);
      else console.log(`${r.ok ? "✓" : "✗"} ${r.label.padEnd(w)}  expected ${r.expected.padStart(16)}  got ${r.actual.padStart(16)}`);
    }
    const bad = checks.filter((r) => !r.ok).length;
    console.log(`\n${checks.length - bad}/${checks.length} checks passed${bad ? ` — ${bad} FAILED` : ""}`);
    if (bad) failed = true;
  }
  if (CLEANUP) await cleanup();
}
process.exit(failed ? 1 : 0);
