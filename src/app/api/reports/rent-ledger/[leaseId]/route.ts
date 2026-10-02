// GET /api/reports/rent-ledger/[leaseId] — month-by-month rent ledger of one lease (RentLedger):
// expected vs paid vs outstanding with a running balance, arrears, the deposit received / refunded, reconciliation.
import { handler, json, notFound, param } from "@/lib/api";
import { loadDashboardInput } from "@/lib/dashboard";
import { todayIST } from "@/lib/dates";
import { buildRentLedger } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req, ctx) => {
  const leaseId = await param(ctx, "leaseId");
  const now = new Date();
  const ledger = buildRentLedger(await loadDashboardInput(), leaseId, { today: todayIST(now), now });
  if (!ledger) throw notFound("Lease");
  return json(ledger);
});
