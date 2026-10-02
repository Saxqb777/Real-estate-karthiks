// GET /api/dashboard — every KPI, chart series, unit card and vacancy figure in one payload (DashboardData).
// Formulas live in src/lib/calculations.ts; loading in src/lib/dashboard.ts.
import { handler, json } from "@/lib/api";
import { loadDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json(await loadDashboard()));
