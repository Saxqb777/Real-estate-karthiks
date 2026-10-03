// Realistic sample dataset for demos, screenshots and UI work. Idempotent: wipes every non-default row first
// (keeps the 6 default expense categories, resets Settings / Plot and the invoice counter), then inserts the same
// data every time.
//
//   DATABASE_URL=postgresql://estates:estates@localhost:5432/estates_demo npx tsx scripts/seed-demo.ts
//
// Refuses to run against a non-local database unless SEED_DEMO_ALLOW_REMOTE=1 (it deletes data).
//
// The story ("today" ≈ 2/10/2026):
//  • Unit A (front) bought 15/6/2019 for ₹38,50,000 · 7.5%/yr. Murugan 1/8/2019 – 31/5/2023, empty Jun–Aug 2023
//    (repainted), Lakshmi from 1/9/2023 (open). Jul 2026 part-paid, Aug + Sep 2026 unpaid → arrears / overdue.
//  • Unit B (back) bought 10/3/2021 for ₹42,00,000 · 8%/yr. Empty until 1/7/2021, Karthikeyan to 30/4/2025,
//    vacant since → "vacant" state + rent lost. No offer yet → valued by estimate.
//  • 3 offers on Unit A, expenses in every category (incl. whole-plot), property tax per year per unit
//    (2026 still Due), a handful of to-dos.
import { PrismaClient, type PaymentMethod, type Priority } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url) && process.env.SEED_DEMO_ALLOW_REMOTE !== "1") {
  console.error("seed-demo wipes data — refusing to run against a non-local DATABASE_URL (set SEED_DEMO_ALLOW_REMOTE=1 to override).");
  process.exit(1);
}

const prisma = new PrismaClient();

/** Same 6 built-ins as prisma/seed.ts (kept, never deleted). */
const DEFAULT_CATEGORIES = [
  { name: "Maintenance", color: "#4F9DFF" },
  { name: "Professional Fees", color: "#A78BFA" },
  { name: "Renovation", color: "#F59E0B" },
  { name: "Utilities", color: "#22C55E" },
  { name: "Property Tax", color: "#EF4444" },
  { name: "Unrecovered Dues", color: "#EC4899" },
] as const;
type CategoryName = (typeof DEFAULT_CATEGORIES)[number]["name"];

/** "2019-06-15" → UTC-midnight date-only value. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Deterministic PRNG (mulberry32) so every run produces identical data. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RENT_DUE_DAY = 5;

interface PaymentPlan {
  /** "YYYY-MM" rent periods covered, inclusive */
  from: string;
  to: string;
  rent: number;
  /** period "YYYY-MM" → paid late on this date */
  late?: Record<string, string>;
  /** period "YYYY-MM" → split / partial instalments */
  custom?: Record<string, { date: string; amount: number }[]>;
  seed: number;
}

function monthsBetween(from: string, to: string): { year: number; month: number }[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: { year: number; month: number }[] = [];
  for (let i = fy * 12 + fm - 1; i <= ty * 12 + tm - 1; i++) out.push({ year: Math.floor(i / 12), month: (i % 12) + 1 });
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
const METHODS: PaymentMethod[] = ["upi", "upi", "bank", "cash"];

/** One payment per month, usually 1–6 days around the due day; late / custom months as listed. */
function planPayments(plan: PaymentPlan) {
  const r = rng(plan.seed);
  const rows: { date: Date; amount: number; year: number; month: number; method: PaymentMethod; notes: string | null }[] = [];
  for (const p of monthsBetween(plan.from, plan.to)) {
    const key = `${p.year}-${pad(p.month)}`;
    const method = METHODS[Math.floor(r() * METHODS.length)];
    const custom = plan.custom?.[key];
    if (custom) {
      custom.forEach((c, i) =>
        rows.push({
          date: d(c.date),
          amount: c.amount,
          ...p,
          method,
          notes: c.amount < plan.rent ? `Part payment ${i + 1}` : null,
        }),
      );
      continue;
    }
    const late = plan.late?.[key];
    const day = Math.max(1, Math.min(9, RENT_DUE_DAY - 2 + Math.floor(r() * 6)));
    rows.push({
      date: late ? d(late) : d(`${key}-${pad(day)}`),
      amount: plan.rent,
      ...p,
      method,
      notes: late ? "Paid late" : null,
    });
  }
  return rows;
}

async function wipe() {
  // Children first (FKs are Restrict on unit / tenant / category).
  await prisma.payment.deleteMany();
  await prisma.propertyTax.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.expenseCategory.deleteMany({ where: { name: { notIn: DEFAULT_CATEGORIES.map((c) => c.name) } } });
  // Invoice numbers restart at PE-<year>-0001 so re-runs are identical.
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('payment', 'invoice_seq'), 1, false)`);
}

async function main() {
  await wipe();

  // ── settings, plot, categories ───────────────────────────────────────────────────────────────
  const settings = {
    brandName: "Pattukottai Estates",
    subtitle: "Two townhouses · one plot",
    ownerEmail: null,
    currency: "INR",
    dateFormat: "D/M/YYYY",
    rentDueDay: RENT_DUE_DAY,
    lateFeeEnabled: true,
    lateFeeAmount: 500,
    lateFeeGraceDays: 5,
  };
  await prisma.settings.upsert({ where: { id: 1 }, update: settings, create: { id: 1, ...settings } });
  const plot = { frontWidthFt: 22.25, backWidthFt: 23.25, depthFt: 76.66, areaSqft: 1744, sitePlanImageUrl: null, townName: "Pattukottai" };
  await prisma.plot.upsert({ where: { id: 1 }, update: plot, create: { id: 1, ...plot } });
  const cat: Record<string, string> = {};
  for (const c of DEFAULT_CATEGORIES) {
    const row = await prisma.expenseCategory.upsert({
      where: { name: c.name },
      update: { isDefault: true, color: c.color },
      create: { ...c, isDefault: true },
    });
    cat[c.name] = row.id;
  }

  // ── units ────────────────────────────────────────────────────────────────────────────────────
  const unitA = await prisma.unit.create({
    data: {
      name: "Unit A",
      type: "Townhouse",
      address: "Door 14/2, Kamaraj Nagar 3rd Street, Pattukottai 614601",
      floors: 1,
      builtUpSqft: 1120,
      purchaseDate: d("2019-06-15"),
      purchasePrice: 3850000,
      annualAppreciationRate: 7.5,
      electricityConsumerNumber: "07-614-012-3456",
      electricityPayUrl: "https://www.tnebltd.gov.in/",
      footprintWidthFt: 20,
      footprintDepthFt: 28,
      position: "front",
      createdAt: new Date("2019-06-15T06:30:00.000Z"),
    },
  });
  const unitB = await prisma.unit.create({
    data: {
      name: "Unit B",
      type: "Townhouse",
      address: "Door 14/3, Kamaraj Nagar 3rd Street, Pattukottai 614601",
      floors: 1,
      builtUpSqft: 1120,
      purchaseDate: d("2021-03-10"),
      purchasePrice: 4200000,
      annualAppreciationRate: 8,
      electricityConsumerNumber: "07-614-012-3457",
      electricityPayUrl: "https://www.tnebltd.gov.in/",
      footprintWidthFt: 20,
      footprintDepthFt: 28,
      position: "back",
      createdAt: new Date("2021-03-10T06:30:00.000Z"),
    },
  });

  // ── offers (all on Unit A; Unit B has none, so it is valued by its estimate) ───────────────────
  await prisma.offer.createMany({
    data: [
      { unitId: unitA.id, amount: 4500000, offerDate: d("2021-09-12"), notes: "Neighbour's enquiry, verbal" },
      { unitId: unitA.id, amount: 5200000, offerDate: d("2023-02-20"), notes: "Broker — Sri Murugan Realty" },
      { unitId: unitA.id, amount: 6150000, offerDate: d("2025-11-08"), notes: "Local buyer, written offer" },
    ],
  });

  // ── tenants + leases (endDate = last day of tenancy) ─────────────────────────────────────────
  const murugan = await prisma.tenant.create({
    data: { name: "Murugan Selvaraj", phone: "+91 98432 17654", email: null, idProofRef: "Aadhaar ••••4821" },
  });
  const karthikeyan = await prisma.tenant.create({
    data: { name: "Karthikeyan Ramasamy", phone: "+91 94437 50218", email: "karthi.ram@example.com", idProofRef: "Aadhaar ••••1937" },
  });
  const lakshmi = await prisma.tenant.create({
    data: { name: "Lakshmi Narayanan", phone: "+91 90036 42871", email: null, idProofRef: "Aadhaar ••••6604" },
  });

  const leaseA1 = await prisma.lease.create({
    data: {
      unitId: unitA.id,
      tenantId: murugan.id,
      startDate: d("2019-08-01"),
      endDate: d("2023-05-31"),
      monthlyRent: 9500,
      securityDeposit: 50000,
      depositRefundedAmount: 45000,
      depositRefundDate: d("2023-06-06"),
      moveOutNotes: "Moved to Thanjavur. ₹5,000 kept from the deposit for broken window panes and wall damage.",
    },
  });
  const leaseB1 = await prisma.lease.create({
    data: {
      unitId: unitB.id,
      tenantId: karthikeyan.id,
      startDate: d("2021-07-01"),
      endDate: d("2025-04-30"),
      monthlyRent: 11000,
      securityDeposit: 60000,
      depositRefundedAmount: 60000,
      depositRefundDate: d("2025-05-03"),
      moveOutNotes: "Transferred to Chennai. Deposit refunded in full.",
    },
  });
  const leaseA2 = await prisma.lease.create({
    data: {
      unitId: unitA.id,
      tenantId: lakshmi.id,
      startDate: d("2023-09-01"),
      endDate: null,
      monthlyRent: 12500,
      securityDeposit: 75000,
      reminderEnabled: true,
    },
  });

  // ── payments (invoice numbers assigned in date order, like real recording) ────────────────────
  const plans: { leaseId: string; plan: PaymentPlan }[] = [
    {
      leaseId: leaseA1.id,
      plan: {
        from: "2019-08",
        to: "2023-05",
        rent: 9500,
        seed: 11,
        late: { "2019-12": "2019-12-24", "2020-04": "2020-05-28", "2020-05": "2020-05-28", "2022-11": "2022-11-27" },
      },
    },
    {
      leaseId: leaseB1.id,
      plan: {
        from: "2021-07",
        to: "2025-04",
        rent: 11000,
        seed: 23,
        late: { "2022-03": "2022-03-29", "2024-06": "2024-07-02", "2025-01": "2025-01-22" },
      },
    },
    {
      leaseId: leaseA2.id,
      plan: {
        from: "2023-09",
        to: "2026-07",
        rent: 12500,
        seed: 37,
        late: { "2024-12": "2024-12-26", "2026-05": "2026-05-21" },
        custom: {
          "2025-01": [
            { date: "2025-01-06", amount: 6000 },
            { date: "2025-01-21", amount: 6500 },
          ],
          // July 2026 part-paid; August and September 2026 not paid at all → arrears.
          "2026-07": [{ date: "2026-07-18", amount: 10000 }],
        },
      },
    },
  ];
  const payments = plans
    .flatMap(({ leaseId, plan }) => planPayments(plan).map((p) => ({ leaseId, ...p })))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.leaseId.localeCompare(b.leaseId) || a.year * 12 + a.month - (b.year * 12 + b.month));
  for (const p of payments) {
    const row = await prisma.payment.create({
      data: {
        leaseId: p.leaseId,
        amount: p.amount,
        paymentDate: p.date,
        periodMonth: p.month,
        periodYear: p.year,
        method: p.method,
        notes: p.notes,
        invoiceNumber: `PENDING-${p.leaseId}-${p.year}-${p.month}-${p.date.getTime()}-${p.amount}`,
      },
      select: { id: true, invoiceSeq: true },
    });
    await prisma.payment.update({
      where: { id: row.id },
      data: { invoiceNumber: `PE-${p.date.getUTCFullYear()}-${String(row.invoiceSeq).padStart(4, "0")}` },
    });
  }

  // ── expenses (unit-tagged and whole-plot) ────────────────────────────────────────────────────
  const A = unitA.id;
  const B = unitB.id;
  const expenses: [string, string | null, CategoryName, number, string][] = [
    // Professional fees
    ["2019-06-15", A, "Professional Fees", 18000, "Document writer & legal scrutiny (purchase)"],
    ["2019-07-28", A, "Professional Fees", 2500, "Rental agreement drafting"],
    ["2021-03-10", B, "Professional Fees", 21000, "Document writer & legal scrutiny (purchase)"],
    ["2021-06-25", B, "Professional Fees", 3000, "Rental agreement drafting"],
    ["2023-08-20", A, "Professional Fees", 3500, "Rental agreement drafting & registration"],
    ["2024-07-12", null, "Professional Fees", 6500, "Auditor — rental income tax filing FY 2023-24"],
    ["2025-07-15", null, "Professional Fees", 7500, "Auditor — rental income tax filing FY 2024-25"],
    // Renovation
    ["2019-07-08", A, "Renovation", 125000, "Repainting + granite kitchen platform"],
    ["2021-04-18", B, "Renovation", 92000, "Bathroom retiling and new doors"],
    ["2023-06-22", A, "Renovation", 68000, "Repaint and electrical rewiring between tenants"],
    ["2025-06-12", B, "Renovation", 54000, "Terrace waterproofing"],
    // Maintenance
    ["2020-01-18", null, "Maintenance", 4200, "Sump & overhead tank cleaning"],
    ["2020-11-09", A, "Maintenance", 2800, "Plumbing — kitchen leak"],
    ["2021-09-14", null, "Maintenance", 6500, "Compound wall plastering patch"],
    ["2022-02-11", B, "Maintenance", 3400, "Ceiling fan + switchboard repair"],
    ["2022-08-27", null, "Maintenance", 5200, "Coconut tree trimming & cleaning"],
    ["2023-01-16", A, "Maintenance", 7800, "Water pump motor rewinding"],
    ["2023-11-03", null, "Maintenance", 4600, "Tank cleaning + pipe replacement"],
    ["2024-03-21", B, "Maintenance", 2900, "Door lock and hinge replacement"],
    ["2024-10-05", null, "Maintenance", 8400, "Gate repaint and rust treatment"],
    ["2025-02-08", A, "Maintenance", 3600, "Drain unclogging"],
    ["2025-09-17", null, "Maintenance", 5800, "Coconut tree trimming"],
    ["2026-01-24", A, "Maintenance", 4200, "Geyser repair"],
    ["2026-08-12", null, "Maintenance", 6200, "Monsoon prep — gutter & drain clearing"],
    // Utilities (bi-monthly TNPDCL minimum bills while a unit stands empty; summer water tankers)
    ["2021-04-22", B, "Utilities", 420, "TNPDCL bill (vacant)"],
    ["2021-06-21", B, "Utilities", 380, "TNPDCL bill (vacant)"],
    ["2023-07-20", A, "Utilities", 520, "TNPDCL bill (vacant)"],
    ["2024-05-14", null, "Utilities", 1800, "Water tanker (summer)"],
    ["2025-06-19", B, "Utilities", 450, "TNPDCL bill (vacant)"],
    ["2025-08-18", B, "Utilities", 410, "TNPDCL bill (vacant)"],
    ["2025-10-20", B, "Utilities", 390, "TNPDCL bill (vacant)"],
    ["2025-12-19", B, "Utilities", 400, "TNPDCL bill (vacant)"],
    ["2026-02-18", B, "Utilities", 380, "TNPDCL bill (vacant)"],
    ["2026-04-20", B, "Utilities", 460, "TNPDCL bill (vacant)"],
    ["2026-05-09", null, "Utilities", 2100, "Water tanker (summer)"],
    ["2026-06-19", B, "Utilities", 480, "TNPDCL bill (vacant)"],
    ["2026-08-19", B, "Utilities", 470, "TNPDCL bill (vacant)"],
    // Unrecovered dues
    ["2025-05-15", B, "Unrecovered Dues", 3200, "Unpaid electricity bill left by outgoing tenant"],
  ];
  await prisma.expense.createMany({
    data: expenses.map(([date, unitId, category, amount, description]) => ({
      expenseDate: d(date),
      unitId,
      categoryId: cat[category],
      amount,
      description,
    })),
  });

  // ── property tax: one row per unit per year; Paid rows own their "Property Tax" expense ──────
  const taxes: [string, number, number, string | null][] = [
    [A, 2019, 2180, "2019-10-14"],
    [A, 2020, 2180, "2020-11-02"],
    [A, 2021, 2290, "2021-09-27"],
    [A, 2022, 2290, "2022-09-23"],
    [A, 2023, 2520, "2023-10-09"],
    [A, 2024, 2520, "2024-09-25"],
    [A, 2025, 2640, "2025-09-26"],
    [A, 2026, 2640, null],
    [B, 2021, 2350, "2021-09-27"],
    [B, 2022, 2350, "2022-09-23"],
    [B, 2023, 2590, "2023-10-09"],
    [B, 2024, 2590, "2024-09-25"],
    [B, 2025, 2720, "2025-09-26"],
    [B, 2026, 2720, null],
  ];
  for (const [unitId, year, amount, paid] of taxes) {
    let expenseId: string | null = null;
    if (paid) {
      const e = await prisma.expense.create({
        data: { unitId, categoryId: cat["Property Tax"], expenseDate: d(paid), amount, description: `Property tax ${year}` },
        select: { id: true },
      });
      expenseId = e.id;
    }
    await prisma.propertyTax.create({
      data: { unitId, year, amount, status: paid ? "Paid" : "Due", paymentDate: paid ? d(paid) : null, expenseId },
    });
  }

  // ── to-dos ───────────────────────────────────────────────────────────────────────────────────
  const actions: { title: string; type: string; priority: Priority; dueDate: string | null; unitId: string | null; doneAt?: string }[] = [
    { title: "Collect Aug & Sep rent from Lakshmi", type: "Rent", priority: "High", dueDate: "2026-10-05", unitId: A },
    { title: "Fix leaking bathroom tap", type: "Maintenance", priority: "Medium", dueDate: "2026-09-25", unitId: A },
    { title: "Put up TO-LET board and list Unit B online", type: "Leasing", priority: "High", dueDate: "2026-10-10", unitId: B },
    { title: "Pay property tax 2026 for both units", type: "Tax", priority: "Medium", dueDate: "2026-10-31", unitId: null },
    { title: "Service the water pump motor", type: "Maintenance", priority: "Low", dueDate: "2026-11-15", unitId: null },
    { title: "Renew building insurance", type: "Custom", priority: "Low", dueDate: null, unitId: null },
    { title: "Waterproof Unit B terrace", type: "Maintenance", priority: "Medium", dueDate: "2025-06-15", unitId: B, doneAt: "2025-06-12T10:00:00.000Z" },
    { title: "Refund Karthikeyan's deposit", type: "Rent", priority: "High", dueDate: "2025-05-05", unitId: B, doneAt: "2025-05-03T09:00:00.000Z" },
  ];
  for (const a of actions) {
    await prisma.actionItem.create({
      data: {
        title: a.title,
        type: a.type,
        priority: a.priority,
        dueDate: a.dueDate ? d(a.dueDate) : null,
        unitId: a.unitId,
        isDone: Boolean(a.doneAt),
        doneAt: a.doneAt ? new Date(a.doneAt) : null,
      },
    });
  }

  const counts = await Promise.all([
    prisma.unit.count(),
    prisma.tenant.count(),
    prisma.lease.count(),
    prisma.payment.count(),
    prisma.expense.count(),
    prisma.propertyTax.count(),
    prisma.offer.count(),
    prisma.actionItem.count(),
  ]);
  const [u, t, l, p, e, pt, o, ac] = counts;
  console.log(`Demo data ready: ${u} units, ${t} tenants, ${l} leases, ${p} payments, ${e} expenses, ${pt} property-tax rows, ${o} offers, ${ac} to-dos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
