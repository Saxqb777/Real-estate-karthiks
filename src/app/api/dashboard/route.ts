// GET /api/dashboard?asOf=YYYY-MM-DD&yearMode=fy|calendar — every KPI, scoped cash summary, unit card, chart series,
// "show the maths" explanation, reconciliation check and the occupancy timeline in one payload (DashboardData).
// asOf (default today, IST; never in the future) recomputes everything as it was on that date; yearMode defaults to fy.
// Formulas live in src/lib/calculations.ts; loading in src/lib/dashboard.ts.
import { handler, json, parseQuery } from "@/lib/api";
import { loadDashboard } from "@/lib/dashboard";
import { dashboardQuerySchema } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const q = parseQuery(req, dashboardQuerySchema);
  return json(await loadDashboard({ asOf: q.asOf, yearMode: q.yearMode }));
});
