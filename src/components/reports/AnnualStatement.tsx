"use client";
// Annual statement (GET /api/reports/annual): cash flow by month and by unit, expenses by category,
// deposits held for tenants, occupancy, and the reconciliation checks. Same component for screen and print.
import type { AnnualReport } from "@/lib/dashboard-types";
import { MS_PER_DAY } from "@/lib/dates";
import { MonthBars, OccupancyStrip, StripLegend } from "./charts";
import {
  CategoryBars,
  Checks,
  Doc,
  Dash,
  DocHeader,
  Drill,
  Equation,
  More,
  Money,
  RTable,
  Scope,
  Section,
  Sub,
  Tag,
  TotalLabel,
  Two,
  d,
  days,
  pct,
  type DocMode,
} from "./parts";
import s from "./reports.module.css";

type Row = AnnualReport["months"][number];
type UnitRow = AnnualReport["units"][number];
type ExpenseRow = AnnualReport["expenses"][number];
type DepositRow = AnnualReport["deposits"]["rows"][number];

const MODE_NAME = { fy: "Indian financial year (Apr – Mar)", calendar: "Calendar year (Jan – Dec)" } as const;

export interface AnnualStatementProps {
  data: AnnualReport;
  mode: DocMode;
  /** screen: open another report */
  onUnit?: (unitId: string) => void;
  onLedger?: (leaseId: string) => void;
}

export function AnnualStatement({ data, mode, onUnit, onLedger }: AnnualStatementProps) {
  const t = data.totals;
  const scope = <Scope>{data.label}</Scope>;
  const throughKey = data.through.slice(0, 7);
  const isFuture = (m: Row) => m.key > throughKey;
  const monthsCounted = data.months.filter((m) => !isFuture(m)).length;
  const dueLater = t.rentDueLater > 0;
  // first owned day in the year for each unit = last counted day − days owned + 1 (drawing only)
  const ownedFrom = (daysInYear: number) => new Date(new Date(data.through).getTime() - (daysInYear - 1) * MS_PER_DAY).toISOString();

  const unitCols = [
    {
      key: "unit",
      header: "Unit",
      cell: (u: UnitRow) =>
        u.unitId ? (
          <Drill onClick={onUnit && (() => onUnit(u.unitId!))} hint={`Open ${u.unitName}'s story`}>
            {u.unitName}
          </Drill>
        ) : (
          <Two top="Whole plot" bottom="Not tagged to one unit" />
        ),
      footer: <TotalLabel sub={data.label}>Total</TotalLabel>,
    },
    {
      key: "due",
      header: "Rent fell due",
      num: true,
      wide: true,
      cell: (u: UnitRow) =>
        u.unitId ? <Two top={<Money v={u.rentExpected} />} bottom={u.collectionPct === null ? "nothing due" : `${pct(u.collectionPct)} received`} /> : <Dash why="Rent always belongs to a unit" />,
      footer: <Two top={<Money v={t.rentExpected} />} bottom={t.collectionPct === null ? "nothing due" : `${pct(t.collectionPct)} received`} />,
    },
    { key: "rent", header: "Rent collected", num: true, cell: (u: UnitRow) => <Money v={u.rentCollected} tone="inc" />, footer: <Money v={t.rentCollected} tone="inc" /> },
    { key: "exp", header: "Expenses", num: true, cell: (u: UnitRow) => <Money v={u.expenses} tone="exp" />, footer: <Money v={t.expenses} tone="exp" /> },
    { key: "net", header: "Net cash", num: true, cell: (u: UnitRow) => <Money v={u.net} tone="signed" />, footer: <Money v={t.net} tone="signed" /> },
  ];

  const monthCols = [
    {
      key: "m",
      header: "Month",
      cell: (m: Row) => (isFuture(m) ? <span className={s.dim}>{m.label}</span> : m.label),
      footer: <TotalLabel sub={`${monthsCounted} ${monthsCounted === 1 ? "month" : "months"}`}>Total</TotalLabel>,
    },
    {
      key: "rent",
      header: "Rent collected",
      num: true,
      cell: (m: Row) => (isFuture(m) ? <Later /> : <Money v={m.rentCollected} tone="inc" />),
      footer: <Money v={t.rentCollected} tone="inc" />,
    },
    {
      key: "exp",
      header: "Expenses",
      num: true,
      cell: (m: Row) => (isFuture(m) ? <Later /> : <Money v={m.expenses} tone="exp" />),
      footer: <Money v={t.expenses} tone="exp" />,
    },
    {
      key: "net",
      header: "Net cash",
      num: true,
      cell: (m: Row) => (isFuture(m) ? <Later /> : <Money v={m.net} tone="signed" />),
      footer: <Money v={t.net} tone="signed" />,
    },
  ];

  const expenseCols = [
    { key: "date", header: "Date", width: "92px", cell: (x: ExpenseRow) => <span className="num">{d(x.date)}</span>, footer: <TotalLabel sub={`${data.expenses.length} records`}>Total</TotalLabel> },
    { key: "unit", header: "Unit", wide: true, cell: (x: ExpenseRow) => x.unitName },
    {
      key: "what",
      header: "Category · note",
      cell: (x: ExpenseRow) => <Two top={x.categoryName} bottom={x.description ?? undefined} />,
    },
    { key: "amt", header: "Amount", num: true, cell: (x: ExpenseRow) => <Money v={x.amount} tone="exp" />, footer: <Money v={t.expenses} tone="exp" /> },
  ];

  const depositCols = [
    {
      key: "who",
      header: "Tenant",
      cell: (r: DepositRow) => (
        <Two
          top={
            <Drill onClick={onLedger && (() => onLedger(r.leaseId))} hint={`Open ${r.tenantName}'s rent ledger`}>
              {r.tenantName}
            </Drill>
          }
          bottom={`${r.unitName} · taken ${d(r.receivedDate)}`}
        />
      ),
      footer: <TotalLabel sub={`${data.deposits.rows.length} ${data.deposits.rows.length === 1 ? "deposit" : "deposits"}`}>Held on {d(data.through)}</TotalLabel>,
    },
    { key: "dep", header: "Deposit", num: true, cell: (r: DepositRow) => <Money v={r.deposit} /> },
    {
      key: "back",
      header: "Paid back",
      num: true,
      wide: true,
      cell: (r: DepositRow) => (r.refunded > 0 ? <Two top={<Money v={r.refunded} />} bottom={r.refundDate ? d(r.refundDate) : undefined} /> : <Dash why="Nothing paid back" />),
    },
    { key: "kept", header: "Kept back", num: true, wide: true, cell: (r: DepositRow) => (r.kept > 0 ? <Money v={r.kept} /> : <Dash why="Nothing kept back" />) },
    {
      key: "held",
      header: `Held on ${d(data.through)}`,
      num: true,
      cell: (r: DepositRow) =>
        r.awaitingRefund > 0 ? (
          <Two top={<Money v={r.awaitingRefund} />} bottom={<Tag tone="marigold">to refund</Tag>} />
        ) : r.held > 0 ? (
          <Money v={r.held} />
        ) : (
          <Dash why="Not held any more" />
        ),
      footer: <Money v={data.deposits.closing} />,
    },
  ];

  return (
    <Doc mode={mode}>
      <DocHeader
        kind="Annual statement"
        title={data.label}
        sub={
          <>
            {d(data.start)} – {d(data.end)} · {MODE_NAME[data.yearMode]}
            {data.isPartial && <> · still running, so everything is counted up to {d(data.through)}</>}
          </>
        }
        chips={
          <>
            {scope}
            {data.isPartial ? (
              <Scope past title="This year is still running">
                To {d(data.through)}
              </Scope>
            ) : (
              <span className={s.complete}>Complete year</span>
            )}
          </>
        }
        generated={data.today}
        rec={data.reconciliation}
      />

      {/* ─────────── CASH FLOW ─────────── */}
      <Section bucket="cash" title="Cash flow" scope={scope} note="Real money that moved: rent that came in and money spent.">
        <Equation
          terms={[
            { label: "Rent collected", value: t.rentCollected, tone: "inc" },
            { op: "−", label: "Expenses", value: t.expenses, tone: "exp" },
            { op: "=", label: "Net cash", value: t.net, tone: "signed", result: true },
          ]}
        />
        <p className={s.lineNote}>
          Rent that fell due in {data.label}: <Money v={t.rentExpected} /> · received for it <Money v={t.rentReceivedForScope} tone="inc" />
          {t.collectionPct !== null && <> ({pct(t.collectionPct)})</>}
          {t.rentUnpaid > 0 ? (
            <>
              {" "}
              · <b className={s.tExp}>still unpaid</b> <Money v={t.rentUnpaid} tone="exp" />
            </>
          ) : t.rentExpected > 0 ? (
            <> · nothing unpaid</>
          ) : null}
          {dueLater && (
            <>
              {" "}
              · due later <Money v={t.rentDueLater} />
            </>
          )}
          .
        </p>

        <div className={s.cols2}>
          <Sub title="By month">
            <MonthBars
              months={data.months.map((m) => ({ key: m.key, label: m.label, rent: m.rentCollected, expenses: m.expenses, net: m.net, future: isFuture(m) }))}
              totals={{ rent: t.rentCollected, expenses: t.expenses, net: t.net, label: data.label }}
            />
            <RTable caption={`Cash flow by month, ${data.label}`} cols={monthCols} rows={data.months} rowKey={(m) => m.key} rowClass={(m) => (isFuture(m) ? s.rowFuture : undefined)} dense />
          </Sub>
          <div className={s.stackCol}>
            <Sub title="By unit" keep>
              <RTable caption={`Cash flow by unit, ${data.label}`} cols={unitCols} rows={data.units} rowKey={(u) => u.unitId ?? "plot"} />
              <p className={s.tableNote}>Unit rows + whole plot = the totals above. Rent is counted when it was received.</p>
            </Sub>
            <Sub title="Where the money went" keep>
              <CategoryBars slices={data.expensesByCategory} total={t.expenses} scope={data.label} />
            </Sub>
          </div>
        </div>

        {data.expenses.length > 0 && (
          <More label={(open) => (open ? "Hide the expense list" : `Every expense in ${data.label} (${data.expenses.length})`)}>
            <Sub title={`Every expense · ${data.expenses.length}`} className={s.breakAvoidNot}>
              <RTable caption={`Expenses, ${data.label}`} cols={expenseCols} rows={data.expenses} rowKey={(x) => x.id} dense />
            </Sub>
          </More>
        )}
      </Section>

      {/* ─────────── DEPOSITS ─────────── */}
      <Section
        bucket="deposits"
        title="Deposits held for tenants"
        scope={scope}
        note="Security deposits are the tenants' money held by you — not income. They are never added to rent."
      >
        <Equation
          compact
          terms={[
            { label: `Held on ${d(new Date(new Date(data.start).getTime() - MS_PER_DAY).toISOString())}`, value: data.deposits.opening },
            { op: "+", label: "Taken", value: data.deposits.received },
            { op: "−", label: "Paid back", value: data.deposits.refunded },
            { op: "−", label: "Kept back", value: data.deposits.kept },
            { op: "=", label: `Held on ${d(data.through)}`, value: data.deposits.closing, result: true },
          ]}
        />
        {data.deposits.rows.length > 0 ? (
          <RTable caption={`Deposits, ${data.label}`} cols={depositCols} rows={data.deposits.rows} rowKey={(r) => r.leaseId} keep />
        ) : (
          <p className={s.calm}>No deposits were held in {data.label}.</p>
        )}
        {data.deposits.kept > 0 && <p className={s.tableNote}>&ldquo;Kept back&rdquo; is the part of a deposit you kept at move-out (for damage or dues).</p>}
      </Section>

      {/* ─────────── OCCUPANCY ─────────── */}
      <Section
        bucket="occupancy"
        title="Occupancy"
        scope={scope}
        note="Days each unit was let or empty. Rent lost is what the empty days could have earned — it is never subtracted from cash."
        breakBefore={false}
      >
        {data.occupancy.length === 0 ? (
          <p className={s.calm}>No units were owned in {data.label}.</p>
        ) : (
          <div className={s.occList}>
            {data.occupancy.map((o) => (
              <div key={o.unitId} className={s.occRow}>
                <div className={s.occHead}>
                  <span className={s.occName}>{o.unitName}</span>
                  <span className={s.occPct}>
                    <b className={`num ${s.tOcc}`}>{pct(o.occupancyPct)}</b> let
                  </span>
                  <span className={s.occFacts}>
                    <span>
                      <b className="num">{days(o.daysOccupied)}</b> let of {days(o.daysInYear)}
                    </span>
                    <span>
                      <b className="num">{days(o.vacantDays)}</b> empty
                    </span>
                    <span>
                      Rent lost (vacant) <Money v={o.rentLost} tone={o.rentLost > 0 ? "occ" : "plain"} />
                    </span>
                  </span>
                </div>
                <OccupancyStrip from={data.start} to={data.end} ownedFrom={ownedFrom(o.daysInYear)} through={data.through} vacant={o.vacantPeriods} />
                {o.vacantPeriods.length > 0 && (
                  <ul className={s.vacList}>
                    {o.vacantPeriods.map((v) => (
                      <li key={v.start}>
                        Empty {d(v.start)} – {d(v.lastDay)}
                        {v.ongoing ? (data.isPartial ? " (still empty)" : " (still empty when the year ended)") : ""} · {days(v.days)}
                        {v.noRentHistory ? (
                          <> · no rent history, so no loss counted</>
                        ) : (
                          <>
                            {" "}
                            · <Money v={v.rentBasis} />
                            /month ({v.rentBasisSource === "next-lease" ? "next tenant's rent" : "last tenant's rent"}) × {v.days} ÷ 30 = <Money v={v.unrealizedLoss} tone="occ" />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <StripLegend notOwned={data.occupancy.some((o) => new Date(ownedFrom(o.daysInYear)) > new Date(data.start))} future={data.isPartial} />
          </div>
        )}
      </Section>

      <Checks rec={data.reconciliation} scope={scope} />
    </Doc>
  );
}

function Later() {
  return (
    <span className={s.dash} title="Hasn't happened yet">
      not yet
    </span>
  );
}
