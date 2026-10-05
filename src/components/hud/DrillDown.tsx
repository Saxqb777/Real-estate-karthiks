"use client";
// Every number drills down, inside the side panel, with a breadcrumb:
//   Property › Net cash › Expenses › Maintenance › "Monsoon prep — gutter & drain clearing" (inline edit)
// Levels are DrillView values (types.ts). Figures come from data.explain; record lists come from the API and are
// only *selected* to the figure's scope here — totals shown are the API's own (never re-added in the UI).
import { ExternalLink, FileText, Lock, Pencil, Plus, ReceiptIndianRupee } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Button, EmptyState, LinkButton, Skeleton, cx } from "@/components/ui";
import { ExpenseForm, METHOD_LABEL, inlineFrame } from "@/components/forms";
import { useApi } from "@/lib/client";
import type { DashboardData, ExplainInput } from "@/lib/dashboard-types";
import { formatDate, periodLabel } from "@/lib/dates";
import type { ExpenseDTO, ExpenseListResponse } from "@/lib/schemas/expense";
import type { PaymentDetail, PaymentListResponse } from "@/lib/schemas/payment";
import { ExplainView } from "./ExplainView";
import { Fig, Rupees, ScopeChip } from "./Figure";
import { useFormDrawer } from "./FormDrawer";
import { HudPanel, type Crumb, type HudPanelProps } from "./HudPanel";
import { inr } from "./format";
import { parseExplainKey, relatedExplains } from "./explain-keys";
import { useEscape } from "./store";
import type { DrillView } from "./types";
import s from "./drill.module.css";

// ---------------------------------------------------------------- stack

export interface DrillStack {
  stack: DrillView[];
  current: DrillView | null;
  push: (v: DrillView) => void;
  pop: () => void;
  popTo: (depth: number) => void;
  reset: () => void;
}

/** Navigation stack for one panel. Esc pops one level (before the panel itself closes). */
export function useDrillStack(initial: DrillView[] = []): DrillStack {
  const [stack, setStack] = useState<DrillView[]>(initial);
  const push = useCallback((v: DrillView) => setStack((st) => [...st, v]), []);
  const pop = useCallback(() => setStack((st) => st.slice(0, -1)), []);
  const popTo = useCallback((depth: number) => setStack((st) => st.slice(0, depth)), []);
  const reset = useCallback(() => setStack([]), []);
  useEscape(stack.length > 0, pop);
  return { stack, current: stack[stack.length - 1] ?? null, push, pop, popTo, reset };
}

export function drillLabel(data: DashboardData, v: DrillView): string {
  switch (v.kind) {
    case "metric":
      return data.explain[v.key]?.title ?? "Figure";
    case "category":
      return v.name;
    case "lease":
    case "expense":
    case "payment":
      return v.label;
    case "checks":
      return "Ledger check";
  }
}

// ---------------------------------------------------------------- panel with drill-down

export interface DrillPanelProps extends Omit<HudPanelProps, "crumbs" | "onBack" | "bodyKey" | "children"> {
  data: DashboardData;
  drill: DrillStack;
  /** Breadcrumb root ("Property", "Unit A"). */
  rootLabel: string;
  /** The panel's own content (depth 0). */
  children: ReactNode;
  /** A unit input was clicked (e.g. "Unit A — bought 15/6/2019") — open that unit. */
  onOpenUnit?: (unitId: string) => void;
}

/** A HudPanel whose body is either its own content or the current drill-down level. */
export function DrillPanel({ data, drill, rootLabel, children, onOpenUnit, actions, ...panel }: DrillPanelProps) {
  const crumbs: Crumb[] = [{ label: rootLabel, onClick: drill.reset }, ...drill.stack.map((v, i) => ({ label: drillLabel(data, v), onClick: () => drill.popTo(i + 1) }))];
  const cur = drill.current;
  const flush = cur?.kind === "expense";
  return (
    <HudPanel
      {...panel}
      crumbs={crumbs}
      onBack={drill.pop}
      bodyKey={`d${drill.stack.length}`}
      bodyFlush={flush}
      actions={cur ? undefined : actions}
      hint={cur ? null : panel.hint}
    >
      {cur ? <DrillContent view={cur} data={data} push={drill.push} onOpenUnit={onOpenUnit} /> : children}
    </HudPanel>
  );
}

// ---------------------------------------------------------------- one level

export interface DrillContentProps {
  view: DrillView;
  data: DashboardData;
  push: (v: DrillView) => void;
  onOpenUnit?: (unitId: string) => void;
}

/** Renders one drill-down level. Usable on its own (e.g. inside an InspectCard or a custom panel). */
export function DrillContent({ view, data, push, onOpenUnit }: DrillContentProps) {
  switch (view.kind) {
    case "metric":
      return <MetricView data={data} explainKey={view.key} push={push} onOpenUnit={onOpenUnit} />;
    case "category":
      return <CategoryView data={data} view={view} push={push} />;
    case "lease":
      return <LeaseView data={data} leaseId={view.leaseId} push={push} />;
    case "expense":
      return <ExpenseView id={view.id} />;
    case "payment":
      return <PaymentView id={view.id} />;
    case "checks":
      return <ChecksView data={data} />;
  }
}

/** Drill view for one input of an explanation, or null when it opens elsewhere / nowhere. */
export function inputDrill(data: DashboardData, explainKey: string, inp: ExplainInput): DrillView | null {
  if (!inp.id) return null;
  const { unitId, period } = parseExplainKey(explainKey);
  switch (inp.kind) {
    case "category": {
      const name = inp.label.split(" — ")[0] ?? inp.label;
      return { kind: "category", categoryId: inp.id, name, period, unitId, color: categoryColor(data, inp.id) };
    }
    case "lease":
      return { kind: "lease", leaseId: inp.id, label: inp.label.split(" · ")[0] ?? "Lease" };
    case "payment":
      return { kind: "payment", id: inp.id, label: inp.label.split(" · ")[0] ?? "Payment" };
    case "expense":
      return { kind: "expense", id: inp.id, label: shorten(inp.label.split(" — ")[1]?.split(" · ")[0] ?? inp.label) };
    default:
      return null;
  }
}

const shorten = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

export function categoryColor(data: DashboardData, categoryId: string): string | undefined {
  for (const sl of data.expenseComposition.allTime) if (sl.categoryId === categoryId) return sl.color;
  for (const u of data.expenseComposition.byUnit) for (const sl of u.slices) if (sl.categoryId === categoryId) return sl.color;
  return undefined;
}

function MetricView({ data, explainKey, push, onOpenUnit }: { data: DashboardData; explainKey: string; push: (v: DrillView) => void; onOpenUnit?: (id: string) => void }) {
  const e = data.explain[explainKey];
  if (!e) return <EmptyState compact title="No breakdown for this figure yet" description="It will appear once there are records behind it." />;
  const canOpen = (inp: ExplainInput) =>
    Boolean(inputDrill(data, explainKey, inp)) || (inp.kind === "unit" && Boolean(onOpenUnit && inp.unitId)) || inp.kind === "offer" || inp.kind === "setting";
  const onInput = (inp: ExplainInput) => {
    const v = inputDrill(data, explainKey, inp);
    if (v) return push(v);
    if (inp.kind === "unit" && inp.unitId) return onOpenUnit?.(inp.unitId);
    if (inp.kind === "offer") return window.location.assign("/config#offers");
    if (inp.kind === "setting") return window.location.assign("/config#settings");
  };
  return (
    <ExplainView
      explain={e}
      related={relatedExplains(data, explainKey)}
      onRelated={(key) => push({ kind: "metric", key })}
      onInput={onInput}
      canOpenInput={canOpen}
      colorOf={(inp) => (inp.kind === "category" && inp.id ? categoryColor(data, inp.id) : undefined)}
      pastScope={!data.isLive}
    />
  );
}

// ---------------------------------------------------------------- records

/** Is a date-only ISO string inside a period summary's [start, end]? (selection only) */
function inScope(date: string, start: string | null, end: string) {
  const t = new Date(date).getTime();
  return (start === null || t >= new Date(start).getTime()) && t <= new Date(end).getTime();
}

function categoryTotal(data: DashboardData, v: Extract<DrillView, { kind: "category" }>): number | null {
  const find = (slices: { categoryId: string; amount: number }[]) => slices.find((x) => x.categoryId === v.categoryId)?.amount ?? 0;
  if (!v.unitId) {
    if (v.period === "allTime") return find(data.expenseComposition.allTime);
    if (v.period === "month") return find(data.expenseComposition.month);
    const y = data.expenseComposition.byYear.find((b) => String(b.year) === data.periods.year.key);
    return y ? find(y.slices) : null;
  }
  if (v.period === "allTime") {
    const u = data.expenseComposition.byUnit.find((b) => b.unitId === v.unitId);
    return u ? find(u.slices) : null;
  }
  return null;
}

function CategoryView({ data, view, push }: { data: DashboardData; view: Extract<DrillView, { kind: "category" }>; push: (v: DrillView) => void }) {
  const period = data.periods[view.period];
  const q = new URLSearchParams({ categoryId: view.categoryId });
  if (view.period !== "allTime") {
    q.set("year", data.periods.year.key);
    q.set("yearMode", data.yearMode);
  }
  if (view.unitId) q.set("unitId", view.unitId);
  const res = useApi<ExpenseListResponse>(`/api/expenses?${q}`);
  const forms = useFormDrawer();
  const exact = view.period === "year" && data.isLive; // the API's own filter is exactly this scope
  const rows = (res.data?.items ?? []).filter((x) => exact || inScope(x.expenseDate, period.start, period.end));
  const total = categoryTotal(data, view) ?? (exact ? (res.data?.total ?? null) : null);
  const unitName = view.unitId ? data.units.find((u) => u.id === view.unitId)?.name : null;

  return (
    <div className={s.view}>
      <header className={s.head}>
        <div className={s.headTop}>
          {view.color && <span className={s.swatch} style={{ background: view.color }} aria-hidden />}
          <span className={s.kicker}>Expenses{unitName ? ` · ${unitName}` : ""}</span>
          <ScopeChip past={!data.isLive}>{period.label}</ScopeChip>
        </div>
        <div className={s.titleRow}>
          <h3 className={s.title}>{view.name}</h3>
          {total !== null && <Fig value={total} size="lg" tone="expense" compact={false} />}
        </div>
      </header>
      {res.loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState compact title={`No ${view.name.toLowerCase()} expenses in ${period.label}`} />
      ) : (
        <ul className={s.list}>
          {rows.map((x) => (
            <li key={x.id}>
              <button type="button" className={s.row} onClick={() => push({ kind: "expense", id: x.id, label: shorten(x.description || view.name) })}>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{x.description || view.name}</span>
                  <span className={s.rowSub}>
                    <span className="num">{formatDate(x.expenseDate)}</span> · {x.unit?.name ?? "Whole plot"}
                    {x.propertyTaxId && " · from property tax"}
                  </span>
                </span>
                <Rupees value={x.amount} className={s.rowAmt} />
                <Pencil className={s.rowIcon} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer className={s.foot}>
        <span>
          {rows.length} {rows.length === 1 ? "expense" : "expenses"}
        </span>
        {total !== null && (
          <span className={s.footTotal}>
            Total <b className="num">{inr(total)}</b>
          </span>
        )}
      </footer>
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus />}
        onClick={() => forms.open({ kind: "expense", props: { defaults: { categoryId: view.categoryId, unitId: view.unitId ?? "" } } })}
      >
        Add {view.name.toLowerCase()} expense
      </Button>
      {forms.element}
    </div>
  );
}

function LeaseView({ data, leaseId, push }: { data: DashboardData; leaseId: string; push: (v: DrillView) => void }) {
  const res = useApi<PaymentListResponse>(`/api/payments?leaseId=${encodeURIComponent(leaseId)}`);
  const forms = useFormDrawer();
  const rows = (res.data?.items ?? []).filter((p) => data.isLive || inScope(p.paymentDate, null, data.asOf));
  const first = res.data?.items[0];
  const lease = data.timeline.units.flatMap((u) => u.leases.map((l) => ({ ...l, unitName: u.unitName }))).find((l) => l.leaseId === leaseId);
  return (
    <div className={s.view}>
      <header className={s.head}>
        <div className={s.headTop}>
          <span className={s.kicker}>Rent received · {lease?.unitName ?? first?.lease.unit.name ?? "Lease"}</span>
          <ScopeChip>{lease ? `${formatDate(lease.start)} – ${lease.end ? formatDate(lease.end) : "now"}` : "Lease"}</ScopeChip>
        </div>
        <div className={s.titleRow}>
          <h3 className={s.title}>{lease?.tenantName ?? first?.lease.tenant.name ?? "Payments"}</h3>
          {data.isLive && res.data && <Fig value={res.data.total} size="lg" tone="income" compact={false} />}
        </div>
        {lease && <p className={s.sub}>Rent {inr(lease.monthlyRent)} a month · counted on the day it was received</p>}
      </header>
      {res.loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState compact title="No rent recorded for this lease yet" />
      ) : (
        <ul className={s.list}>
          {rows.map((p) => (
            <li key={p.id}>
              <button type="button" className={s.row} onClick={() => push({ kind: "payment", id: p.id, label: p.invoiceNumber })}>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>Rent for {periodLabel({ month: p.periodMonth, year: p.periodYear })}</span>
                  <span className={s.rowSub}>
                    received <span className="num">{formatDate(p.paymentDate)}</span> · {p.invoiceNumber}
                    {p.method ? ` · ${METHOD_LABEL[p.method] ?? p.method}` : ""}
                  </span>
                </span>
                <Rupees value={p.amount} tone="income" className={s.rowAmt} />
                <FileText className={s.rowIcon} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer className={s.foot}>
        <span>
          {rows.length} {rows.length === 1 ? "payment" : "payments"}
        </span>
        {data.isLive && res.data && (
          <span className={s.footTotal}>
            Total <b className="num">{inr(res.data.total)}</b>
          </span>
        )}
      </footer>
      {lease?.state !== "ended" && (
        <Button size="sm" variant="primary" icon={<ReceiptIndianRupee />} onClick={() => forms.open({ kind: "payment", props: { defaults: { leaseId } } })}>
          Record rent
        </Button>
      )}
      {forms.element}
    </div>
  );
}

function ExpenseView({ id }: { id: string }) {
  const res = useApi<ExpenseDTO>(`/api/expenses/${encodeURIComponent(id)}`);
  const [editing, setEditing] = useState(false);
  const x = res.data;
  if (res.loading || !x)
    return (
      <div className={cx(s.view, s.pad)}>
        {res.error ? <EmptyState compact title="This expense could not be loaded" description={res.error.message} /> : <ListSkeleton />}
      </div>
    );
  if (editing && !x.propertyTaxId)
    return <ExpenseForm expense={x} frame={inlineFrame} submitLabel="Save changes" onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />;
  return (
    <div className={cx(s.view, s.pad, s.scroll)}>
      <header className={s.head}>
        <div className={s.headTop}>
          <span className={s.swatch} style={{ background: x.category.color }} aria-hidden />
          <span className={s.kicker}>{x.category.name}</span>
          <ScopeChip>{formatDate(x.expenseDate)}</ScopeChip>
        </div>
        <div className={s.titleRow}>
          <h3 className={s.title}>{x.description || x.category.name}</h3>
          <Fig value={x.amount} size="lg" tone="expense" compact={false} />
        </div>
      </header>
      <dl className={s.facts}>
        <div>
          <dt>Paid on</dt>
          <dd className="num">{formatDate(x.expenseDate)}</dd>
        </div>
        <div>
          <dt>For</dt>
          <dd>{x.unit?.name ?? "Whole plot"}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{x.category.name}</dd>
        </div>
      </dl>
      {x.propertyTaxId ? (
        <p className={s.locked}>
          <Lock aria-hidden />
          Added automatically when property tax was marked paid — change it from the tax office (property tax).
        </p>
      ) : (
        <Button variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
          Edit this expense
        </Button>
      )}
    </div>
  );
}

function PaymentView({ id }: { id: string }) {
  const res = useApi<PaymentDetail>(`/api/payments/${encodeURIComponent(id)}`);
  const p = res.data;
  if (res.loading || !p)
    return <div className={s.view}>{res.error ? <EmptyState compact title="This payment could not be loaded" description={res.error.message} /> : <ListSkeleton />}</div>;
  return (
    <div className={s.view}>
      <header className={s.head}>
        <div className={s.headTop}>
          <span className={s.kicker}>Rent · {p.lease.unit.name}</span>
          <ScopeChip>{formatDate(p.paymentDate)}</ScopeChip>
        </div>
        <div className={s.titleRow}>
          <h3 className={s.title}>{p.invoiceNumber}</h3>
          <Fig value={p.amount} size="lg" tone="income" compact={false} />
        </div>
      </header>
      <dl className={s.facts}>
        <div>
          <dt>For month</dt>
          <dd>{periodLabel({ month: p.periodMonth, year: p.periodYear })}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd className="num">{formatDate(p.paymentDate)}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>{p.lease.tenant.name}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>{p.method ? (METHOD_LABEL[p.method] ?? p.method) : "—"}</dd>
        </div>
      </dl>
      <LinkButton href={`/invoice/${p.id}`} target="_blank" variant="secondary" icon={<ExternalLink />}>
        Open receipt
      </LinkButton>
    </div>
  );
}

function ChecksView({ data }: { data: DashboardData }) {
  const c = data.checks;
  return (
    <div className={s.view}>
      <header className={s.head}>
        <div className={s.headTop}>
          <span className={s.kicker}>Reconciliation</span>
          <ScopeChip kind="asOf" past={!data.isLive}>
            {data.scopeLabels.asOf}
          </ScopeChip>
        </div>
        <div className={s.titleRow}>
          <h3 className={s.title}>{c.ledgerBalanced ? "Ledger balanced" : "Something doesn't add up"}</h3>
        </div>
        <p className={s.sub}>Every total is checked against its parts. Each line below must match to the paisa.</p>
      </header>
      <ul className={s.checks}>
        {c.items.map((it) => (
          <li key={it.key} className={cx(s.check, !it.ok && s.checkBad)}>
            <span className={s.checkMark} aria-label={it.ok ? "matches" : "does not match"}>
              {it.ok ? "✓" : "!"}
            </span>
            <span className={s.checkLabel}>{it.label}</span>
            <span className={cx(s.checkVal, "num")}>{it.ok ? inr(it.actual) : `${inr(it.expected)} ≠ ${inr(it.actual)}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className={s.skel}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={34} />
      ))}
    </div>
  );
}
