"use client";
// Data → Reports (owner chose "report library", sample 1): eight small reports, each answering ONE question on one page.
// The home shows a card per report with its key number; a card opens that report (‹ Reports goes back). Every report
// prints / saves as a light A4 PDF. Figures come from the same APIs as the dashboard (calculations.ts) — nothing is
// re-computed here except plain column totals (sumAmounts).
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, EmptyState, IconButton, LinkButton, Panel, Select, Skeleton, cx } from "@/components/ui";
import { ChoiceGroup, currentYear, useLeases, usePropertyTax, useUnits, useYearMode, yearLabel, yearOf, type YearMode } from "@/components/forms";
import { sumAmounts } from "@/lib/calculations";
import { useApi } from "@/lib/client";
import type { AnnualReport, DashboardData, RentLedger } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/format";
import s from "./rlib.module.css";

type ReportId = "income" | "rentroll" | "dues" | "occupancy" | "tenant" | "value" | "tax" | "deposits";

const REPORTS: { id: ReportId; title: string; line: string }[] = [
  { id: "income", title: "Income & expenses", line: "What came in, what went out" },
  { id: "rentroll", title: "Rent roll", line: "Who lives where and pays what" },
  { id: "dues", title: "Dues & arrears", line: "Who owes you, how late" },
  { id: "occupancy", title: "Occupancy & vacancy", line: "Days let vs empty, rent lost" },
  { id: "tenant", title: "Tenant statement", line: "One tenant's rent, month by month" },
  { id: "value", title: "Property value & returns", line: "Invested vs worth today" },
  { id: "tax", title: "Property tax", line: "Paid and due, year by year" },
  { id: "deposits", title: "Deposits held", line: "Tenant money you hold" },
];

const inr = (n: number | null | undefined) => (n == null ? "—" : formatINR(n));
const dash = (n: number) => (n ? formatINR(n) : "—");
const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

/** Old deep links (/data?report=ledger&lease=…#reports) open the tenant statement. */
function initialFromUrl(): { open: ReportId | null; leaseId: string | null } {
  if (typeof window === "undefined") return { open: null, leaseId: null };
  const p = new URLSearchParams(window.location.search);
  const r = p.get("report");
  if (r === "ledger") return { open: "tenant", leaseId: p.get("lease") };
  if (r === "annual") return { open: "income", leaseId: null };
  if (r === "unit") return { open: "value", leaseId: null };
  return { open: null, leaseId: null };
}

export function ReportLibrary() {
  const [open, setOpen] = useState<ReportId | null>(null);
  const [leasePick, setLeasePick] = useState<string | null>(null);
  useEffect(() => {
    const i = initialFromUrl();
    if (i.open) setOpen(i.open);
    if (i.leaseId) setLeasePick(i.leaseId);
  }, []);
  const [yearMode, setYearMode] = useYearMode();
  const units = useUnits();
  const leases = useLeases();
  const tax = usePropertyTax();
  const dashQ = useApi<DashboardData>(`/api/dashboard?yearMode=${yearMode}`, { keepPrevious: true });

  // ---- the year (income & occupancy): one FY / calendar year, or ALL TIME (owner 8/10)
  const unitList = useMemo(() => units.data?.items ?? [], [units.data]);
  const lastYear = currentYear(yearMode);
  const firstYear = unitList.length ? Math.min(...unitList.map((u) => yearOf(u.purchaseDate, yearMode))) : lastYear;
  const [yearPick, setYearPick] = useState<number | "all" | null>(null);
  const allTime = yearPick === "all";
  const year = Math.min(lastYear, Math.max(firstYear, typeof yearPick === "number" ? yearPick : lastYear));
  const annual = useApi<AnnualReport>(unitList.length ? `/api/reports/annual?year=${allTime ? "all" : year}&yearMode=${yearMode}` : null, { keepPrevious: true });

  // ---- the lease (tenant statement)
  const leaseList = useMemo(() => [...(leases.data?.items ?? [])].sort((a, z) => z.startDate.localeCompare(a.startDate)), [leases.data]);
  const leaseId = leaseList.some((l) => l.id === leasePick) ? leasePick : (leaseList.find((l) => !l.endDate)?.id ?? leaseList[0]?.id ?? null);
  const ledger = useApi<RentLedger>(open === "tenant" && leaseId ? `/api/reports/rent-ledger/${encodeURIComponent(leaseId)}` : null, { keepPrevious: true });

  const d = dashQ.data;
  const a =
    annual.data && annual.data.yearMode === yearMode && (allTime ? annual.data.kind === "allTime" : annual.data.kind === "year" && annual.data.year === year)
      ? annual.data
      : null;
  const taxItems = tax.data?.items ?? [];
  const yLabel = allTime ? "All time" : yearLabel(year, yearMode);
  const today = d ? formatDate(d.today) : "";

  if (units.data && unitList.length === 0)
    return (
      <Panel fill title="Reports" eyebrow="Reports">
        <EmptyState
          title="Reports appear once you add a unit"
          action={
            <LinkButton href="/config#units" variant="primary" size="sm">
              Add a unit
            </LinkButton>
          }
        />
      </Panel>
    );

  const yearControl = (
    <div className={s.controls}>
      <IconButton size="sm" variant="ghost" label="Previous year" icon={<ChevronLeft />} disabled={allTime || year <= firstYear} onClick={() => setYearPick(year - 1)} />
      <Select compact aria-label="Year" value={allTime ? "all" : String(year)} onChange={(e) => setYearPick(e.target.value === "all" ? "all" : Number(e.target.value))} className={s.year}>
        <option value="all">All time</option>
        {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i).map((y) => (
          <option key={y} value={y}>
            {yearLabel(y, yearMode)}
          </option>
        ))}
      </Select>
      <IconButton size="sm" variant="ghost" label="Next year" icon={<ChevronRight />} disabled={allTime || year >= lastYear} onClick={() => setYearPick(year + 1)} />
      <ChoiceGroup<YearMode>
        name="yearMode"
        size="sm"
        aria-label="Year type"
        value={yearMode}
        onChange={setYearMode}
        options={[
          { value: "fy", label: "FY" },
          { value: "calendar", label: "Calendar" },
        ]}
      />
    </div>
  );

  // ---- one report's body
  const body = (id: ReportId): ReactNode => {
    if (!d) return <Loading />;
    switch (id) {
      case "income":
        return a ? <IncomeReport a={a} /> : <Loading />;
      case "rentroll":
        return <RentRoll d={d} leases={leaseList} />;
      case "dues":
        return <Dues d={d} />;
      case "occupancy":
        return a ? <Occupancy a={a} /> : <Loading />;
      case "tenant":
        return ledger.data && ledger.data.lease.id === leaseId ? <TenantStatement l={ledger.data} /> : leaseId ? <Loading /> : <EmptyState compact title="No leases yet" />;
      case "value":
        return <Value d={d} />;
      case "tax":
        return <Tax items={taxItems} />;
      case "deposits":
        return <Deposits d={d} />;
    }
  };

  // ---- home: the library
  if (!open) {
    const k = d?.kpis;
    const taxPaid = sumAmounts(taxItems.filter((t) => t.status === "Paid"));
    const taxDue = taxItems.filter((t) => t.status === "Due");
    const curLease = d?.units.find((u) => u.activeLease)?.activeLease;
    const headline: Record<ReportId, { big: string; sub: string; tone?: string }> = {
      income: { big: a ? inr(a.totals.net) : "…", sub: `net cash · ${yLabel}`, tone: a ? netTone(a.totals.net) : undefined },
      rentroll: { big: k ? `${k.unitsOccupied} of ${k.unitsActive}` : "…", sub: k ? `units let · ${inr(k.monthlyRentRoll)}/mo` : "", tone: "" },
      dues: { big: k ? inr(k.overdueAmount) : "…", sub: k ? (k.overdueAmount ? `owed · ${k.overdueMonths} ${k.overdueMonths === 1 ? "month" : "months"}` : "nothing owed") : "", tone: k?.overdueAmount ? s.red : s.teal },
      occupancy: { big: a ? pct(avgOcc(a)) : "…", sub: a ? `occupied · ${sumOf(a.occupancy.map((o) => o.vacantDays))} days empty · ${yLabel}` : "", tone: "" },
      tenant: { big: curLease ? curLease.tenantName.split(" ")[0] : "—", sub: curLease ? `since ${formatDate(curLease.startDate)}` : "no current tenant", tone: "" },
      value: { big: k ? formatINRCompact(k.bestOfferTotal) : "…", sub: k ? `worth now · gain ${formatINRCompact(k.appreciation)}` : "", tone: s.teal },
      tax: { big: inr(taxPaid), sub: taxDue.length ? `paid · ${taxDue.length} still due` : "paid · nothing due", tone: s.red },
      deposits: { big: k ? inr(k.securityDepositsHeld) : "…", sub: "held for tenants", tone: s.mari },
    };
    return (
      <Panel fill padding="none" title="Reports" eyebrow={`${REPORTS.length} reports`} actions={yearControl} className={s.panel}
        data-wrap-head>
        {dashQ.error && !d ? (
          <EmptyState
            title="Reports couldn't load"
            description={dashQ.error.message}
            action={
              <Button size="sm" icon={<RotateCcw />} onClick={() => void dashQ.reload()}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className={s.grid}>
            {REPORTS.map((r) => {
              const h = headline[r.id];
              return (
                <button key={r.id} type="button" className={s.card} onClick={() => setOpen(r.id)}>
                  <span className={s.cardTitle}>{r.title}</span>
                  <span className={cx(s.cardBig, h.tone)}>{h.big}</span>
                  <span className={s.cardSub}>{h.sub}</span>
                  <span className={s.cardFoot}>
                    {r.line}
                    <ChevronRight aria-hidden />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    );
  }

  // ---- one report
  const meta = REPORTS.find((r) => r.id === open)!;
  const usesYear = open === "income" || open === "occupancy";
  const controls =
    open === "tenant" ? (
      <div className={s.controls}>
        <Select compact aria-label="Lease" value={leaseId ?? ""} onChange={(e) => setLeasePick(e.target.value)} className={s.lease}>
          {leaseList.map((l) => (
            <option key={l.id} value={l.id}>
              {l.tenant.name} · {l.unit.name}
              {l.endDate ? ` (to ${formatDate(l.endDate)})` : ""}
            </option>
          ))}
        </Select>
      </div>
    ) : usesYear ? (
      yearControl
    ) : (
      <span className={s.asOf}>As of {today}</span>
    );

  return (
    <>
      <Panel
        fill
        padding="none"
        className={s.panel}
        data-wrap-head
        eyebrow={
          <button type="button" className={s.back} onClick={() => setOpen(null)}>
            <ChevronLeft aria-hidden /> Reports
          </button>
        }
        title={meta.title}
        actions={
          <div className={s.actions}>
            {controls}
          </div>
        }
      >
        <div className={s.body}>{body(open)}</div>
      </Panel>
    </>
  );
}

export default ReportLibrary;

// ---------------------------------------------------------------- helpers

const sumOf = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
/** days-weighted occupancy over the year (the annual report's own per-unit days) */
function avgOcc(a: AnnualReport): number | null {
  const days = sumOf(a.occupancy.map((o) => o.daysInYear));
  return days ? sumOf(a.occupancy.map((o) => o.daysOccupied)) / days : null;
}

function Loading() {
  return (
    <div className={s.loading} aria-busy="true">
      <Skeleton height={64} block />
      <Skeleton lines={6} />
    </div>
  );
}

function Kpis({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className={s.kpis}>
      {items.map((k) => (
        <div key={k.label} className={s.kpi}>
          <span className={s.kpiLabel}>{k.label}</span>
          <span className={cx(s.kpiValue, k.tone)}>{k.value}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- 1 · income & expenses

/** Net money: green when more came in than went out, red when less (owner 7/10: income green, expenses red). */
const netTone = (n: number) => (n > 0 ? s.teal : n < 0 ? s.red : undefined);

function IncomeReport({ a }: { a: AnnualReport }) {
  const t = a.totals;
  const all = a.kind === "allTime";
  // all time: one row per FY / calendar year, oldest first; one year: its 12 months in order
  const rows = all ? a.years : a.months;
  return (
    <>
      <Kpis
        items={[
          { label: "Rent collected", value: inr(t.rentCollected), tone: s.teal },
          { label: "Expenses", value: inr(t.expenses), tone: s.red },
          { label: "Net cash", value: inr(t.net), tone: netTone(t.net) },
        ]}
      />
      <div className={s.two}>
        <Section title={all ? "Year by year" : "Month by month"}>
          <TableBox>
            <thead>
              <tr>
                <th>{all ? "Year" : "Month"}</th>
                <th className={s.r}>Rent in</th>
                <th className={s.r}>Expenses</th>
                <th className={s.r}>Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td className={cx(s.r, s.teal)}>{dash(m.rentCollected)}</td>
                  <td className={cx(s.r, s.red)}>{dash(m.expenses)}</td>
                  <td className={cx(s.r, netTone(m.net))}>{m.rentCollected || m.expenses ? inr(m.net) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className={cx(s.r, s.teal)}>{inr(t.rentCollected)}</td>
                <td className={cx(s.r, s.red)}>{inr(t.expenses)}</td>
                <td className={cx(s.r, netTone(t.net))}>{inr(t.net)}</td>
              </tr>
            </tfoot>
          </TableBox>
        </Section>
        <div>
          <Section title="Where the money went">
            {/* a plain table like the others (owner: no bars, no notes) */}
            <TableBox>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className={s.r}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {a.expensesByCategory.length ? (
                  a.expensesByCategory.map((c) => (
                    <tr key={c.categoryId}>
                      <td>{c.name}</td>
                      <td className={cx(s.r, s.red)}>{inr(c.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>—</td>
                    <td className={s.r}>—</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={cx(s.r, s.red)}>{inr(t.expenses)}</td>
                </tr>
              </tfoot>
            </TableBox>
          </Section>
          <Section title="By unit">
            <TableBox>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th className={s.r}>Rent in</th>
                  <th className={s.r}>Expenses</th>
                  <th className={s.r}>Net</th>
                </tr>
              </thead>
              <tbody>
                {a.units.map((u) => (
                  <tr key={u.unitId ?? "plot"}>
                    <td>{u.unitName}</td>
                    <td className={cx(s.r, s.teal)}>{dash(u.rentCollected)}</td>
                    <td className={cx(s.r, s.red)}>{dash(u.expenses)}</td>
                    <td className={cx(s.r, netTone(u.net))}>{inr(u.net)}</td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          </Section>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 2 · rent roll

function RentRoll({ d, leases }: { d: DashboardData; leases: { id: string; rentTiming: string; rentDueDay: number | null }[] }) {
  const rows = d.units.filter((u) => u.isActive);
  return (
    <>
      <Kpis
        items={[
          { label: "Units let", value: `${d.kpis.unitsOccupied} of ${d.kpis.unitsActive}` },
          { label: "Rent each month", value: inr(d.kpis.monthlyRentRoll), tone: s.teal },
          { label: "Deposits held", value: inr(d.kpis.securityDepositsHeld), tone: s.mari },
        ]}
      />
      <TableBox>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Tenant</th>
            <th>Phone</th>
            <th>Since</th>
            <th className={s.r}>Rent</th>
            <th>Billing</th>
            <th className={s.r}>Deposit</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const l = u.activeLease;
            const extra = l ? leases.find((x) => x.id === l.id) : undefined;
            const due = extra?.rentDueDay ?? d.settings.rentDueDay;
            return (
              <tr key={u.id}>
                <td className={s.strong}>{u.name}</td>
                <td>{l?.tenantName ?? "—"}</td>
                <td>{l?.tenantPhone ?? "—"}</td>
                <td>{l ? formatDate(l.startDate) : "—"}</td>
                <td className={s.r}>{l ? inr(l.monthlyRent) : "—"}</td>
                <td>{l ? `${extra?.rentTiming === "arrears" ? "IN ARREARS" : "IN ADVANCE"} · day ${due}` : "—"}</td>
                <td className={s.r}>{l ? inr(l.securityDeposit) : "—"}</td>
                <td>
                  {/* plain status words like every other report (no screen badge) */}
                  <span className={cx(s.status, u.status === "occupied" ? s["st-paid"] : u.status === "incoming" ? s["st-advance"] : s["st-not-due"])}>
                    {u.status === "occupied" ? "Occupied" : u.status === "incoming" ? "Incoming" : "Vacant"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td />
            <td />
            <td />
            <td className={s.r}>{inr(d.kpis.monthlyRentRoll)}</td>
            <td />
            <td className={s.r}>{inr(d.kpis.securityDepositsHeld)}</td>
            <td />
          </tr>
        </tfoot>
      </TableBox>
    </>
  );
}

// ---------------------------------------------------------------- 3 · dues & arrears

function Dues({ d }: { d: DashboardData }) {
  const owing = d.units.filter((u) => u.nextPayment && u.nextPayment.arrears.months.length > 0);
  return (
    <>
      <Kpis
        items={[
          { label: "Owed now", value: inr(d.kpis.overdueAmount), tone: d.kpis.overdueAmount ? s.red : s.teal },
          { label: "Months late", value: String(d.kpis.overdueMonths) },
          { label: "Late fees", value: inr(d.kpis.lateFeesTotal) },
        ]}
      />
      {owing.length === 0 ? (
        <p className={s.allClear}>Nobody owes rent.</p>
      ) : (
        owing.map((u) => {
          const ar = u.nextPayment!.arrears;
          return (
            <Section key={u.id} title={`${u.name} · ${u.activeLease?.tenantName ?? ""}`}>
              <TableBox>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Was due</th>
                    <th className={s.r}>Rent</th>
                    <th className={s.r}>Paid</th>
                    <th className={s.r}>Owed</th>
                    <th className={s.r}>Late fee</th>
                    <th className={s.r}>Late by</th>
                  </tr>
                </thead>
                <tbody>
                  {ar.months.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td>{formatDate(m.dueDate)}</td>
                      <td className={s.r}>{inr(m.due)}</td>
                      <td className={cx(s.r, s.teal)}>{dash(m.paid)}</td>
                      <td className={cx(s.r, s.red)}>{inr(m.outstanding)}</td>
                      <td className={s.r}>{dash(m.lateFee)}</td>
                      <td className={s.r}>
                        {m.daysOverdue} {m.daysOverdue === 1 ? "day" : "days"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td />
                    <td />
                    <td />
                    <td className={cx(s.r, s.red)}>{inr(ar.total)}</td>
                    <td className={s.r}>{dash(ar.lateFees)}</td>
                    <td className={cx(s.r, s.red)}>{inr(ar.totalWithFees)}</td>
                  </tr>
                </tfoot>
              </TableBox>
            </Section>
          );
        })
      )}
    </>
  );
}

// ---------------------------------------------------------------- 4 · occupancy & vacancy

function Occupancy({ a }: { a: AnnualReport }) {
  const lost = sumOf(a.occupancy.map((o) => o.rentLost));
  const empty = sumOf(a.occupancy.map((o) => o.vacantDays));
  const gaps = a.occupancy.flatMap((o) => o.vacantPeriods.map((p) => ({ unit: o.unitName, ...p })));
  return (
    <>
      <Kpis
        items={[
          { label: "Occupancy", value: pct(avgOcc(a)) },
          { label: "Days empty", value: String(empty) },
          { label: "Rent lost (empty days)", value: inr(lost), tone: lost ? s.red : undefined },
        ]}
      />
      <div className={s.two}>
        <Section title="By unit">
          <TableBox>
            <thead>
              <tr>
                <th>Unit</th>
                <th className={s.r}>Days owned</th>
                <th className={s.r}>Let</th>
                <th className={s.r}>Empty</th>
                <th className={s.r}>Occupancy</th>
                <th className={s.r}>Rent lost</th>
              </tr>
            </thead>
            <tbody>
              {a.occupancy.map((o) => (
                <tr key={o.unitId}>
                  <td className={s.strong}>{o.unitName}</td>
                  <td className={s.r}>{o.daysInYear}</td>
                  <td className={s.r}>{o.daysOccupied}</td>
                  <td className={s.r}>{o.vacantDays}</td>
                  <td className={s.r}>{pct(o.occupancyPct)}</td>
                  <td className={cx(s.r, o.rentLost ? s.red : undefined)}>{dash(o.rentLost)}</td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        </Section>
        <Section title="Empty periods">
          {gaps.length ? (
            <TableBox>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>From</th>
                  <th>To</th>
                  <th className={s.r}>Days</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={`${g.unit}-${g.start}`}>
                    <td>{g.unit}</td>
                    <td>{formatDate(g.start)}</td>
                    <td>{g.ongoing ? "now" : formatDate(g.lastDay)}</td>
                    <td className={s.r}>{g.days}</td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          ) : (
            <p className={s.allClear}>No empty days this year.</p>
          )}
        </Section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 5 · tenant statement

function TenantStatement({ l }: { l: RentLedger }) {
  const label: Record<string, string> = { paid: "Paid", "part-paid": "Part paid", unpaid: "Unpaid", "not-due": "Not due", advance: "Advance" };
  return (
    <>
      <div className={s.party}>
        <div>
          <span className={s.kpiLabel}>Tenant</span>
          <b>{l.lease.tenant.name}</b>
          <span>{l.lease.tenant.phone ?? ""}</span>
        </div>
        <div>
          <span className={s.kpiLabel}>Unit</span>
          <b>{l.lease.unit.name}</b>
          <span>
            {formatDate(l.lease.start)} – {l.lease.end ? formatDate(l.lease.end) : "now"}
          </span>
        </div>
        <div>
          <span className={s.kpiLabel}>Rent</span>
          <b>{inr(l.lease.monthlyRent)} / month</b>
          <span>Deposit {inr(l.deposit.deposit)}</span>
        </div>
      </div>
      <Kpis
        items={[
          { label: "Rent due so far", value: inr(l.totals.expected) },
          { label: "Paid", value: inr(l.totals.paid), tone: s.teal },
          { label: "Balance", value: inr(l.totals.outstanding), tone: l.totals.outstanding > 0 ? s.red : undefined },
        ]}
      />
      <TableBox>
        <thead>
          <tr>
            <th>Month</th>
            <th>Due</th>
            <th className={s.r}>Rent</th>
            <th className={s.r}>Paid</th>
            <th>Receipt</th>
            <th className={s.r}>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {[...l.rows].reverse().map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{formatDate(r.dueDate)}</td>
              <td className={s.r}>{inr(r.expected)}</td>
              <td className={cx(s.r, s.teal)}>{dash(r.paid)}</td>
              <td className={s.dim}>{r.payments.map((p) => p.invoiceNumber).join(", ") || "—"}</td>
              <td className={cx(s.r, r.runningBalance > 0 ? s.red : undefined)}>{inr(r.runningBalance)}</td>
              <td className={cx(s.status, s[`st-${r.status}`])}>{label[r.status] ?? r.status}</td>
            </tr>
          ))}
        </tbody>
      </TableBox>
    </>
  );
}

// ---------------------------------------------------------------- 6 · value & returns

function Value({ d }: { d: DashboardData }) {
  const k = d.kpis;
  const rows = d.units.filter((u) => u.isActive);
  return (
    <>
      <Kpis
        items={[
          { label: "Invested", value: inr(k.invested) },
          { label: "Worth now (est.)", value: inr(k.bestOfferTotal), tone: s.teal },
          { label: "Gain", value: inr(k.appreciation), tone: k.appreciation >= 0 ? s.teal : s.red },
          { label: "Growth per year", value: k.cagr == null ? "—" : pct(k.cagr) },
        ]}
      />
      <TableBox>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Bought</th>
            <th className={s.r}>Price</th>
            <th className={s.r}>Worth now</th>
            <th>Based on</th>
            <th className={s.r}>Gain</th>
            <th className={s.r}>× bought</th>
            <th className={s.r}>Per year</th>
            <th className={s.r}>Rent collected</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className={s.strong}>{u.name}</td>
              <td>{formatDate(u.purchaseDate)}</td>
              <td className={s.r}>{inr(u.purchasePrice)}</td>
              <td className={cx(s.r, s.teal)}>{inr(u.valuation)}</td>
              <td className={s.dim}>{u.valuationSource === "offer" ? "Best offer" : "Growth estimate"}</td>
              <td className={cx(s.r, u.appreciation >= 0 ? s.teal : s.red)}>{inr(u.appreciation)}</td>
              <td className={s.r}>{u.capitalMultiplier == null ? "—" : `×${u.capitalMultiplier.toFixed(2)}`}</td>
              <td className={s.r}>{u.cagr == null ? "—" : pct(u.cagr)}</td>
              <td className={cx(s.r, s.teal)}>{inr(u.rentCollected)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td />
            <td className={s.r}>{inr(k.invested)}</td>
            <td className={cx(s.r, s.teal)}>{inr(k.bestOfferTotal)}</td>
            <td />
            <td className={s.r}>{inr(k.appreciation)}</td>
            <td className={s.r}>{k.capitalMultiplier == null ? "—" : `×${k.capitalMultiplier.toFixed(2)}`}</td>
            <td className={s.r}>{k.cagr == null ? "—" : pct(k.cagr)}</td>
            <td className={cx(s.r, s.teal)}>{inr(k.rentCollected)}</td>
          </tr>
        </tfoot>
      </TableBox>
    </>
  );
}

// ---------------------------------------------------------------- 7 · property tax

function Tax({ items }: { items: { id: string; year: number; amount: number; status: string; paymentDate: string | null; unit: { name: string } }[] }) {
  const years = [...new Set(items.map((t) => t.year))].sort((a, z) => z - a);
  const unitNames = [...new Set(items.map((t) => t.unit.name))].sort();
  const paid = items.filter((t) => t.status === "Paid");
  const due = items.filter((t) => t.status !== "Paid");
  return (
    <>
      <Kpis
        items={[
          { label: "Paid in total", value: inr(sumAmounts(paid)), tone: s.red },
          { label: "Still to pay", value: inr(sumAmounts(due)), tone: due.length ? s.mari : undefined },
          { label: "Years recorded", value: String(years.length) },
        ]}
      />
      {items.length === 0 ? (
        <p className={s.none}>No property tax recorded</p>
      ) : (
        <TableBox>
          <thead>
            <tr>
              <th>Year</th>
              {unitNames.map((n) => (
                <th key={n} className={s.r}>
                  {n}
                </th>
              ))}
              <th className={s.r}>Year total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const rows = items.filter((t) => t.year === y);
              const allPaid = rows.every((t) => t.status === "Paid");
              const lastPaid = rows.map((t) => t.paymentDate).filter(Boolean).sort().pop();
              return (
                <tr key={y}>
                  <td className={s.strong}>{y}</td>
                  {unitNames.map((n) => {
                    const t = rows.find((x) => x.unit.name === n);
                    return (
                      <td key={n} className={cx(s.r, t && (t.status !== "Paid" ? s.mari : s.red))}>
                        {t ? inr(t.amount) : "—"}
                      </td>
                    );
                  })}
                  <td className={s.r}>{inr(sumAmounts(rows))}</td>
                  <td className={cx(s.status, allPaid ? s["st-paid"] : s["st-unpaid"])}>{allPaid ? `Paid${lastPaid ? ` ${formatDate(lastPaid)}` : ""}` : "Due"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              {unitNames.map((n) => (
                <td key={n} className={s.r}>
                  {inr(sumAmounts(items.filter((t) => t.unit.name === n)))}
                </td>
              ))}
              <td className={s.r}>{inr(sumAmounts(items))}</td>
              <td />
            </tr>
          </tfoot>
        </TableBox>
      )}
    </>
  );
}

// ---------------------------------------------------------------- 8 · deposits

function Deposits({ d }: { d: DashboardData }) {
  const dl = d.deposits;
  return (
    <>
      <Kpis
        items={[
          { label: "Held now", value: inr(dl.held), tone: s.mari },
          { label: "Received in total", value: inr(dl.received) },
          { label: "Refunded", value: inr(dl.refunded) },
          { label: "Kept back", value: inr(dl.kept) },
        ]}
      />
      <TableBox>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Unit</th>
            <th>Received</th>
            <th className={s.r}>Deposit</th>
            <th className={s.r}>Refunded</th>
            <th className={s.r}>Kept</th>
            <th className={s.r}>Held now</th>
          </tr>
        </thead>
        <tbody>
          {dl.rows.map((r) => (
            <tr key={r.leaseId}>
              <td className={s.strong}>{r.tenantName}</td>
              <td>{r.unitName}</td>
              <td>{formatDate(r.receivedDate)}</td>
              <td className={s.r}>{inr(r.deposit)}</td>
              <td className={s.r}>{dash(r.refunded)}</td>
              <td className={s.r}>{dash(r.kept)}</td>
              <td className={cx(s.r, r.held ? s.mari : undefined)}>{dash(r.held + r.awaitingRefund)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td />
            <td />
            <td className={s.r}>{inr(dl.received)}</td>
            <td className={s.r}>{dash(dl.refunded)}</td>
            <td className={s.r}>{dash(dl.kept)}</td>
            <td className={cx(s.r, s.mari)}>{inr(dl.held + dl.awaitingRefund)}</td>
          </tr>
        </tfoot>
      </TableBox>
    </>
  );
}

/** A report table. On phones every row becomes a small card (column name left, value right): each cell gets its
 *  column's header text as data-label, read from the table's own header row. */
function TableBox({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const table = ref.current;
    if (!table) return;
    const label = () => {
      const heads: string[] = [];
      table.querySelectorAll("thead tr:last-child th").forEach((th) => {
        const span = (th as HTMLTableCellElement).colSpan || 1;
        for (let i = 0; i < span; i++) heads.push(th.textContent?.trim() ?? "");
      });
      table.querySelectorAll("tbody tr, tfoot tr").forEach((tr) => {
        let col = 0;
        tr.querySelectorAll("td, th").forEach((cell) => {
          cell.setAttribute("data-label", heads[col] ?? "");
          col += (cell as HTMLTableCellElement).colSpan || 1;
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(table, { childList: true, subtree: true });
    return () => mo.disconnect();
  });
  return (
    <div className={s.tableBox}>
      <table ref={ref} className={s.table}>
        {children}
      </table>
    </div>
  );
}
