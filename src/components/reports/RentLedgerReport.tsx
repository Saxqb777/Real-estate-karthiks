"use client";
// Rent ledger (GET /api/reports/rent-ledger/[leaseId]): one lease month by month — rent due vs paid,
// running balance, arrears with late fees, the deposit, and the checks. Same component for screen and print.
import { Info, ReceiptText, TriangleAlert } from "lucide-react";
import type { RentLedger, RentLedgerRow } from "@/lib/dashboard-types";
import { fmt } from "@/components/hud/format";
import { METHOD_LABEL } from "@/components/forms/data";
import { cx } from "@/components/ui";
import {
  Checks,
  Doc,
  DocHeader,
  Equation,
  Facts,
  Money,
  Note,
  RTable,
  Scope,
  Section,
  Sub,
  Tag,
  TotalLabel,
  Two,
  d,
  useDocMode,
  type DocMode,
} from "./parts";
import s from "./reports.module.css";

const STATUS: Record<RentLedgerRow["status"], { tone: "teal" | "marigold" | "coral" | "grey" | "sky"; label: string }> = {
  paid: { tone: "teal", label: "Paid" },
  "part-paid": { tone: "marigold", label: "Part paid" },
  unpaid: { tone: "coral", label: "Unpaid" },
  "not-due": { tone: "grey", label: "Not due yet" },
  advance: { tone: "sky", label: "Paid ahead" },
};

const LEASE_STATE = { current: { tone: "teal", label: "Current" }, incoming: { tone: "sky", label: "Moving in" }, ended: { tone: "grey", label: "Ended" } } as const;

/** Rows whose due date has passed count towards "rent fell due" (same rule as the API's totals). */
const isDue = (r: RentLedgerRow, today: string) => r.dueDate < today;

export function RentLedgerReport({ data, mode }: { data: RentLedger; mode: DocMode }) {
  const l = data.lease;
  const t = data.totals;
  const dueRows = data.rows.filter((r) => isDue(r, data.today));
  const scope = <Scope>{l.end ? `${d(l.start)} – ${d(l.end)}` : `${d(l.start)} – ${d(data.today)}`}</Scope>;
  const st = LEASE_STATE[l.state];
  const owed = data.arrears.months.length > 0;

  const cols = [
    {
      key: "m",
      header: "Rent for",
      width: "15%",
      cell: (r: RentLedgerRow) => r.label,
      footer: <TotalLabel sub={`${dueRows.length} ${dueRows.length === 1 ? "month" : "months"} fell due`}>Total</TotalLabel>,
    },
    { key: "on", header: "Due on", wide: true, width: "12%", cell: (r: RentLedgerRow) => <span className={`num ${s.dim}`}>{d(r.dueDate)}</span> },
    {
      key: "due",
      header: "Rent due",
      num: true,
      width: "13%",
      cell: (r: RentLedgerRow) => (isDue(r, data.today) ? <Money v={r.expected} /> : <span className={s.dash} title={`${fmt(r.expected, "inr")} falls due on ${d(r.dueDate)}`}>not due yet</span>),
      footer: <Money v={t.expected} />,
    },
    {
      key: "paid",
      header: "Paid",
      num: true,
      width: "13%",
      cell: (r: RentLedgerRow) => (r.paid > 0 ? <Money v={r.paid} tone="inc" /> : <span className={s.dash}>—</span>),
      footer: <Money v={t.paid} tone="inc" />,
    },
    {
      key: "bal",
      header: "Balance",
      num: true,
      width: "14%",
      cell: (r: RentLedgerRow) => <Balance v={r.runningBalance} />,
      footer: <Balance v={t.outstanding} strong />,
    },
    {
      key: "st",
      header: "Status",
      wide: true,
      width: "12%",
      className: s.statusCell,
      cell: (r: RentLedgerRow) => <Tag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Tag>,
    },
    {
      key: "rcpt",
      header: "Receipts",
      wide: true,
      cell: (r: RentLedgerRow) => (r.payments.length ? <Receipts payments={r.payments} /> : <span className={s.dash}>—</span>),
    },
  ];

  return (
    <Doc mode={mode}>
      <DocHeader
        kind="Rent ledger"
        title={`${l.tenant.name} · ${l.unit.name}`}
        sub={
          <>
            {fmt(l.monthlyRent, "inr")} a month · from {d(l.start)} {l.end ? `· last day of tenancy ${d(l.end)}` : "· open-ended"}
            {l.tenant.phone ? ` · ${l.tenant.phone}` : ""}
          </>
        }
        chips={
          <>
            {scope}
            <Tag tone={st.tone}>{st.label}</Tag>
          </>
        }
        generated={data.today}
        rec={data.reconciliation}
      />

      <Section bucket="cash" title="Rent account" scope={<Scope>To {d(data.today)}</Scope>} note="Rent that fell due (its due date has passed) against rent received for it.">
        <Equation
          terms={[
            { label: "Rent fell due", value: t.expected, sub: `${dueRows.length} ${dueRows.length === 1 ? "month" : "months"} × ${fmt(l.monthlyRent, "inr")}` },
            { op: "−", label: "Paid", value: t.paid, tone: "inc" },
            {
              op: "=",
              label: t.outstanding < 0 ? "Paid ahead" : "Balance owed",
              value: Math.abs(t.outstanding),
              tone: t.outstanding > 0 ? "exp" : "plain",
              result: true,
              sub: t.outstanding === 0 ? "all settled" : t.outstanding < 0 ? "credit for coming months" : undefined,
            },
          ]}
        />
        <MonthStrip rows={data.rows} />

        {owed ? (
          <Note tone="coral" icon={<TriangleAlert aria-hidden />}>
            {data.arrears.months.length === 1 ? "1 month is" : `${data.arrears.months.length} months are`} overdue:{" "}
            {data.arrears.months.map((m, i) => (
              <span key={m.key}>
                {i > 0 && ", "}
                {m.label} (<Money v={m.outstanding} tone="exp" />
                {m.paid > 0 ? " left" : ""}, {fmt(m.daysOverdue, "days")} late)
              </span>
            ))}
            .{" "}
            {data.arrears.lateFees > 0 ? (
              <>
                Rent <Money v={data.arrears.total} tone="exp" /> + late fees <Money v={data.arrears.lateFees} tone="exp" /> ={" "}
                <b>
                  <Money v={data.arrears.totalWithFees} tone="exp" />
                </b>{" "}
                to collect.
              </>
            ) : (
              <>
                <Money v={data.arrears.total} tone="exp" /> to collect.
              </>
            )}
          </Note>
        ) : t.expected > 0 ? (
          <Note tone="teal">Every month that fell due is paid.</Note>
        ) : null}
        {t.lateFees > 0 && (
          <p className={s.tableNote}>Late fees follow your settings and are shown separately — they are not part of the rent balance.</p>
        )}

        <Sub title={`Month by month · ${data.rows.length}`}>
          <RTable
            caption={`Rent ledger, ${l.tenant.name}`}
            cols={cols}
            rows={data.rows}
            rowKey={(r) => r.key}
            rowClass={(r) => cx(r.status === "unpaid" && s.rowBad, r.status === "part-paid" && s.rowWarn, !isDue(r, data.today) && s.rowFuture)}
            dense
          />
          <p className={s.tableNote}>
            Balance = rent due so far − paid so far, month by month. Months not yet due are listed but not counted.
          </p>
        </Sub>
      </Section>

      {data.unmatchedPayments.length > 0 && (
        <Note tone="coral" icon={<TriangleAlert aria-hidden />}>
          {data.unmatchedPayments.length} payment{data.unmatchedPayments.length === 1 ? " is" : "s are"} recorded for a month outside this lease:{" "}
          {data.unmatchedPayments.map((p) => `${p.invoiceNumber} (${p.periodLabel}, ${fmt(p.amount, "inr")})`).join(", ")}. Please check them in Data → Payments.
        </Note>
      )}

      <Section bucket="deposits" title="Security deposit" scope={<Scope>As of {d(data.today)}</Scope>} note="The tenant's money held by you — not income, never added to rent.">
        <Facts
          cols={4}
          items={[
            { label: "Taken", value: <Two top={<Money v={data.deposit.deposit} />} bottom={d(data.deposit.receivedDate)} /> },
            { label: "Paid back", value: data.deposit.refunded > 0 ? <Two top={<Money v={data.deposit.refunded} />} bottom={d(data.deposit.refundDate)} /> : <span className={s.dash}>—</span> },
            { label: "Kept back", value: data.deposit.kept > 0 ? <Money v={data.deposit.kept} /> : <span className={s.dash}>—</span> },
            {
              label: data.deposit.awaitingRefund > 0 ? "To refund" : "Still held",
              value: data.deposit.awaitingRefund > 0 ? <Money v={data.deposit.awaitingRefund} tone="exp" /> : data.deposit.held > 0 ? <Money v={data.deposit.held} /> : <span className={s.dash}>—</span>,
            },
          ]}
        />
        {data.deposit.awaitingRefund > 0 && (
          <Note tone="marigold" icon={<Info aria-hidden />}>
            The tenancy has ended and no refund is recorded yet.
          </Note>
        )}
      </Section>

      <Checks rec={data.reconciliation} scope={<Scope>This lease</Scope>} />
    </Doc>
  );
}

function Balance({ v, strong }: { v: number; strong?: boolean }) {
  if (v === 0) return <span className={cx("num", s.money, s.settled, strong && s.strong)}>₹0</span>;
  if (v < 0)
    return (
      <span className={cx("num", s.money, s.tOcc, strong && s.strong)} title="Paid ahead">
        {fmt(-v, "inr")} ahead
      </span>
    );
  return <Money v={v} tone="exp" className={strong ? s.strong : undefined} />;
}

function Receipts({ payments }: { payments: RentLedgerRow["payments"] }) {
  const mode = useDocMode();
  return (
    <span className={s.receipts}>
      {payments.map((p) =>
        mode === "screen" ? (
          <a key={p.id} href={`/invoice/${p.id}`} target="_blank" rel="noopener" className={s.receipt} title={`${fmt(p.amount, "inr")} on ${d(p.date)}${p.method ? ` · ${METHOD_LABEL[p.method] ?? p.method}` : ""} — open the receipt`}>
            <ReceiptText aria-hidden />
            {p.invoiceNumber}
            {payments.length > 1 && <em className="num">{fmt(p.amount, "inr")}</em>}
          </a>
        ) : (
          <span key={p.id} className={s.receipt}>
            {p.invoiceNumber} · {d(p.date)}
            {payments.length > 1 ? ` · ${fmt(p.amount, "inr")}` : ""}
          </span>
        ),
      )}
    </span>
  );
}

/** One square per month, coloured by status — the payment history at a glance. */
function MonthStrip({ rows }: { rows: RentLedgerRow[] }) {
  if (rows.length === 0) return null;
  const years = new Map<number, RentLedgerRow[]>();
  for (const r of rows) {
    const list = years.get(r.year);
    if (list) list.push(r);
    else years.set(r.year, [r]);
  }
  return (
    <div className={s.mstrip} aria-label="Payment history by month">
      {[...years.entries()].map(([y, list]) => (
        <div key={y} className={s.mstripYear}>
          <span className={cx("num", s.mstripLabel)}>{y}</span>
          <span className={s.mstripCells}>
            {Array.from({ length: 12 }, (_, i) => {
              const r = list.find((x) => x.month === i + 1);
              return (
                <span
                  key={i}
                  className={cx(s.mcell, r ? s[`mc-${r.status}`] : s.mcEmpty)}
                  title={r ? `${r.label} · ${STATUS[r.status].label}${r.paid ? ` · paid ${fmt(r.paid, "inr")}` : ""}` : undefined}
                />
              );
            })}
          </span>
        </div>
      ))}
      <div className={s.legend} aria-hidden>
        <span>
          <i className={cx(s.mcell, s["mc-paid"])} /> Paid
        </span>
        <span>
          <i className={cx(s.mcell, s["mc-part-paid"])} /> Part paid
        </span>
        <span>
          <i className={cx(s.mcell, s["mc-unpaid"])} /> Unpaid
        </span>
        <span>
          <i className={cx(s.mcell, s["mc-not-due"])} /> Not due yet
        </span>
      </div>
    </div>
  );
}
