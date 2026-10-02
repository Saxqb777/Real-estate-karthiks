// GET /api/dashboard data loader: reads every table in one consistent snapshot, converts Decimal → number
// and hands plain inputs to the pure buildDashboard() in calculations.ts. No formulas live here.
import { Prisma } from "@prisma/client";
import { buildDashboard, type DashboardInput, type SettingsInput } from "./calculations";
import type { DashboardData } from "./dashboard-types";
import { todayIST } from "./dates";
import { prisma } from "./db";

/** Used only if the Settings singleton has not been seeded yet (matches the schema defaults). */
const DEFAULT_SETTINGS: SettingsInput = {
  brandName: "Pattukottai Estates",
  subtitle: null,
  currency: "INR",
  rentDueDay: 1,
  lateFeeEnabled: false,
  lateFeeAmount: 0,
  lateFeeGraceDays: 0,
};

const num = (d: Prisma.Decimal) => d.toNumber();
const numOrNull = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

export async function loadDashboardInput(): Promise<DashboardInput> {
  const [settings, plot, units, offers, leases, payments, expenses, categories, actions] = await prisma.$transaction(
    [
      prisma.settings.findUnique({ where: { id: 1 } }),
      prisma.plot.findUnique({ where: { id: 1 } }),
      prisma.unit.findMany(),
      prisma.offer.findMany({ select: { id: true, unitId: true, amount: true, offerDate: true } }),
      prisma.lease.findMany({ include: { tenant: { select: { name: true, phone: true } } } }),
      prisma.payment.findMany({
        select: {
          id: true,
          leaseId: true,
          amount: true,
          paymentDate: true,
          periodMonth: true,
          periodYear: true,
          invoiceSeq: true,
          invoiceNumber: true,
        },
      }),
      prisma.expense.findMany({ select: { id: true, unitId: true, categoryId: true, expenseDate: true, amount: true } }),
      prisma.expenseCategory.findMany({ select: { id: true, name: true, color: true } }),
      prisma.actionItem.findMany({ where: { isDone: false } }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return {
    settings: settings
      ? {
          brandName: settings.brandName,
          subtitle: settings.subtitle,
          currency: settings.currency,
          rentDueDay: settings.rentDueDay,
          lateFeeEnabled: settings.lateFeeEnabled,
          lateFeeAmount: num(settings.lateFeeAmount),
          lateFeeGraceDays: settings.lateFeeGraceDays,
        }
      : DEFAULT_SETTINGS,
    plot: {
      frontWidthFt: numOrNull(plot?.frontWidthFt ?? null),
      backWidthFt: numOrNull(plot?.backWidthFt ?? null),
      depthFt: numOrNull(plot?.depthFt ?? null),
      areaSqft: numOrNull(plot?.areaSqft ?? null),
      townName: plot?.townName ?? "Pattukottai",
      sitePlanImageUrl: plot?.sitePlanImageUrl ?? null,
    },
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      type: u.type,
      position: u.position,
      floors: u.floors,
      isActive: u.isActive,
      builtUpSqft: num(u.builtUpSqft),
      footprintWidthFt: numOrNull(u.footprintWidthFt),
      footprintDepthFt: numOrNull(u.footprintDepthFt),
      purchaseDate: u.purchaseDate,
      purchasePrice: num(u.purchasePrice),
      annualAppreciationRate: num(u.annualAppreciationRate),
      electricityConsumerNumber: u.electricityConsumerNumber,
      electricityPayUrl: u.electricityPayUrl,
      createdAt: u.createdAt,
    })),
    offers: offers.map((o) => ({ ...o, amount: num(o.amount) })),
    leases: leases.map((l) => ({
      id: l.id,
      unitId: l.unitId,
      tenantId: l.tenantId,
      tenantName: l.tenant.name,
      tenantPhone: l.tenant.phone,
      startDate: l.startDate,
      endDate: l.endDate,
      monthlyRent: num(l.monthlyRent),
      securityDeposit: num(l.securityDeposit),
    })),
    payments: payments.map((p) => ({ ...p, amount: num(p.amount) })),
    expenses: expenses.map((e) => ({ ...e, amount: num(e.amount) })),
    categories,
    actions: actions.map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      dueDate: a.dueDate,
      isDone: a.isDone,
      unitId: a.unitId,
    })),
  };
}

/** Full dashboard payload; "today" is the current date in India. */
export async function loadDashboard(now: Date = new Date()): Promise<DashboardData> {
  return buildDashboard(await loadDashboardInput(), todayIST(now), now);
}
