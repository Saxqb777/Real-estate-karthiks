// GET /api/reports/annual?year=<start year>|all&yearMode=fy|calendar — annual statement (AnnualReport):
// cash flow by month (by year for all time) and by unit, expenses by category, deposits ledger, occupancy, reconciliation.
// year = FY start year (2025 → FY 2025-26) or calendar year; "all" = all time; default = the year containing today.
import { badRequest, handler, json, parseQuery } from "@/lib/api";
import { yearKeyOf, yearLabel } from "@/lib/calculations";
import { loadDashboardInput } from "@/lib/dashboard";
import { todayIST } from "@/lib/dates";
import { annualReportQuerySchema, buildAnnualReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const { year, yearMode } = parseQuery(req, annualReportQuerySchema);
  const now = new Date();
  const today = todayIST(now);
  const current = yearKeyOf(today, yearMode);
  if (typeof year === "number" && year > current) {
    throw badRequest(`${yearLabel(year, yearMode)} hasn't started yet — the latest statement is ${yearLabel(current, yearMode)}`, [
      { field: "year", message: `must be ${current} or earlier` },
    ]);
  }
  return json(buildAnnualReport(await loadDashboardInput(), { year, yearMode, today, now }));
});
