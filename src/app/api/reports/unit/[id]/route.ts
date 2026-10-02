// GET /api/reports/unit/[id]?yearMode=fy|calendar — one unit's purchase → today story (UnitReport):
// purchase, offers, every lease, vacancies with rent lost, rent / expenses per year, value growth, reconciliation.
import { handler, json, notFound, param, parseQuery } from "@/lib/api";
import { loadDashboardInput } from "@/lib/dashboard";
import { todayIST } from "@/lib/dates";
import { buildUnitReport, yearModeQuerySchema } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = handler(async (req, ctx) => {
  const id = await param(ctx, "id");
  const { yearMode } = parseQuery(req, yearModeQuerySchema);
  const now = new Date();
  const report = buildUnitReport(await loadDashboardInput(), id, { yearMode, today: todayIST(now), now });
  if (!report) throw notFound("Unit");
  return json(report);
});
