"use client";
import { Coins, ExternalLink, Pencil, Plus, ReceiptText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Input, LinkButton, Select, Table, cx, toast, type Column } from "@/components/ui";
import {
  Facts,
  METHOD_LABEL,
  PaymentForm,
  PeriodPicker,
  currentYear,
  drawerFrame,
  leaseLabel,
  leasePhase,
  leaseSpan,
  periodText,
  useLeases,
  usePayments,
  useYearMode,
  yearOf,
  type PeriodPick,
} from "@/components/forms";
import { ProofClip, ProofHead, ProofMark, proofCount } from "@/components/proof";
import { api, useApi, useMutation } from "@/lib/client";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { sumAmounts } from "@/lib/calculations";
import type { DepositKeptItem, PaymentDetail, PaymentListItem } from "@/lib/schemas/payment";
import { DataPanel, DeleteButton, DrawerLoading, DetailHero, RecordDrawer, Spacer, Stack2, TotalLabel, shortPeriod, useCreate, useNarrow, useNewSignal, useSelection } from "./shared";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

const money = (n: number) => formatINR(n, n % 1 !== 0);

/** A row: a rent payment, or a deposit kept back at move-out — money in on the move-out day (owner 2/11/2026). */
type Row = { kind: "payment"; id: string; date: string; p: PaymentListItem } | { kind: "kept"; id: string; date: string; k: DepositKeptItem };
const leaseOf = (r: Row) => (r.kind === "payment" ? r.p.lease : r.k.lease);
const amountOf = (r: Row) => (r.kind === "payment" ? r.p.amount : r.k.amount);

export function PaymentsTab({ openId, onOpened, newSignal }: TabProps) {
  const [leaseId, setLeaseId] = useState("");
  // the year, by the day the rent was received (cash), like Expenses — years only (owner 1/11/2026)
  const [mode, setMode] = useYearMode();
  const [period, setPeriod] = useState<PeriodPick>(() => ({ kind: "year", year: currentYear(mode) }));
  const year = period.kind === "year" ? period.year : null;
  const range = period.kind === "range" ? period : null;
  const payments = usePayments(leaseId || null, { year, yearMode: mode, from: range?.from, to: range?.to });
  const all = usePayments();
  const leases = useLeases();
  const narrow = useNarrow();
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);

  const lease = leases.data?.items.find((l) => l.id === leaseId);
  const years = useMemo(() => {
    const set = new Set<number>([currentYear(mode)]);
    for (const p of all.data?.items ?? []) set.add(yearOf(p.paymentDate, mode));
    for (const k of all.data?.depositsKept ?? []) set.add(yearOf(k.date, mode));
    if (year !== null) set.add(year);
    return [...set].sort((a, b) => b - a);
  }, [all.data, mode, year]);
  const scope = [periodText(period, mode), lease?.tenant.name].filter(Boolean).join(" · ");
  const data = payments.data;
  // newest first; a kept deposit sits on its move-out day among the payments
  const rows: Row[] | undefined = data
    ? [
        ...data.items.map((p): Row => ({ kind: "payment", id: p.id, date: p.paymentDate, p })),
        ...(data.depositsKept ?? []).map((k): Row => ({ kind: "kept", id: k.id, date: k.date, k })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : undefined;
  const moneyIn = data ? sumAmounts([{ amount: data.total }, { amount: data.keptTotal ?? 0 }]) : 0;

  const groups = useMemo(() => {
    const items = leases.data?.items ?? [];
    return { current: items.filter((l) => leasePhase(l) !== "past"), past: items.filter((l) => leasePhase(l) === "past") };
  }, [leases.data]);

  const footerLabel = rows?.length ? <TotalLabel scope={scope} count={rows.length} noun={["payment", "payments"]} /> : undefined;
  const footerTotal = rows?.length ? <span className="pos">{money(moneyIn)}</span> : undefined;

  const receipt = (p: PaymentListItem) => (
    <a className={s.receipt} href={`/invoice/${p.id}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} title="Open the printable receipt">
      <ReceiptText aria-hidden />
      {p.invoiceNumber}
    </a>
  );
  const none = <span className="faint">—</span>;

  const columns: Column<Row>[] = narrow
    ? [
        {
          key: "what",
          header: "Payment", wrap: true,
          cell: (r) =>
            r.kind === "kept" ? (
              <Stack2 top={`Deposit kept · ${r.k.lease.tenant.name}`} bottom={`${r.k.lease.unit.name} · ${formatDate(r.k.date)} · moved out`} />
            ) : (
              <Stack2
                top={
                  <>
                    {shortPeriod(r.p)} · {r.p.lease.tenant.name} <ProofMark count={proofCount(r.p)} />
                  </>
                }
                bottom={`${r.p.lease.unit.name} · ${formatDate(r.p.paymentDate)} · ${METHOD_LABEL[r.p.method]}${r.p.reference ? ` ${r.p.reference}` : ""}`}
              />
            ),
          footer: footerLabel,
        },
        { key: "amount", header: "Amount", numeric: true, cell: (r) => <span className="pos">{money(amountOf(r))}</span>, footer: footerTotal },
      ]
    : [
        { key: "date", header: "Received", sortValue: (r) => r.date, cell: (r) => <span className="num">{formatDate(r.date)}</span>, footer: footerLabel },
        {
          key: "period",
          header: "Rent for",
          sortValue: (r) => (r.kind === "payment" ? r.p.periodYear * 12 + r.p.periodMonth : 0),
          cell: (r) => (r.kind === "payment" ? shortPeriod(r.p) : "Deposit kept"),
        },
        { key: "unit", header: "Unit", sortValue: (r) => leaseOf(r).unit.name, cell: (r) => leaseOf(r).unit.name },
        { key: "tenant", header: "Tenant", sortValue: (r) => leaseOf(r).tenant.name, cell: (r) => leaseOf(r).tenant.name },
        {
          key: "method",
          header: "Paid by",
          cell: (r) =>
            r.kind === "payment" ? (
              <Badge size="sm" tone="neutral">
                {METHOD_LABEL[r.p.method]}
              </Badge>
            ) : (
              none
            ),
        },
        { key: "ref", header: "Ref no.", cell: (r) => (r.kind === "payment" && r.p.reference ? <span className="num">{r.p.reference}</span> : none) },
        { key: "receipt", header: "Receipt", cell: (r) => (r.kind === "payment" ? receipt(r.p) : none) },
        { key: "proof", header: <ProofHead />, align: "center", width: 44, cell: (r) => (r.kind === "payment" ? <ProofMark count={proofCount(r.p)} /> : null) },
        { key: "amount", header: "Amount", numeric: true, sortValue: (r) => amountOf(r), cell: (r) => <span className="pos">{money(amountOf(r))}</span>, footer: footerTotal },
      ];

  return (
    <>
      <DataPanel
        eyebrow="Cash · money in"
        title="Rent payments"
        actions={
          <Button variant="primary" size="sm" icon={<Plus />} onClick={create.start} disabled={!leases.data?.items.length}>
            Record rent
          </Button>
        }
        toolbar={
          <>
            <PeriodPicker value={period} onChange={setPeriod} years={years} mode={mode} onModeChange={setMode} className={s.filterPeriod} />
            <Select compact aria-label="Show payments for" value={leaseId} onChange={(e) => setLeaseId(e.target.value)} className={s.filterSelect}>
              <option value="">All leases</option>
              {groups.current.length > 0 && (
                <optgroup label="Current">
                  {groups.current.map((l) => (
                    <option key={l.id} value={l.id}>
                      {leaseLabel(l)}
                    </option>
                  ))}
                </optgroup>
              )}
              {groups.past.length > 0 && (
                <optgroup label="Past">
                  {groups.past.map((l) => (
                    <option key={l.id} value={l.id}>
                      {leaseLabel(l)} ({leaseSpan(l)})
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </>
        }
      >
        <Table
          fill
          columns={columns}
          rows={rows}
          loading={payments.loading}
          rowKey={(r) => r.id}
          onRowClick={(r) => r.kind === "payment" && sel.select(r.id)}
          selectedKey={sel.selected}
          caption="Rent payments"
          empty={
            <EmptyState
              title={
                period.kind !== "all"
                  ? `No rent received${period.kind === "year" ? " in" : ""} ${periodText(period, mode)}${lease ? ` from ${lease.tenant.name}` : ""}`
                  : lease
                    ? `No rent recorded for ${lease.tenant.name} yet`
                    : "No rent recorded yet"
              }
              action={
                leases.data?.items.length ? (
                  <Button size="sm" variant="primary" icon={<Coins />} onClick={create.start}>
                    Record rent
                  </Button>
                ) : null
              }
            />
          }
        />
      </DataPanel>

      <PaymentForm
        key={`new-${create.key}`}
        defaults={leaseId ? { leaseId } : undefined}
        frame={drawerFrame({ open: create.open, onClose: create.close, eyebrow: "Payments", title: "Record rent" })}
        onCancel={create.close}
        onSaved={create.close}
      />
      <PaymentDrawer sel={sel} />
    </>
  );
}

function PaymentDrawer({ sel }: { sel: ReturnType<typeof useSelection> }) {
  const detail = useApi<PaymentDetail>(sel.shown ? `/api/payments/${sel.shown}` : null);
  const p = detail.data?.id === sel.shown ? detail.data : undefined;
  // the clip sits on the Ref no. line (owner, 10/10/2026); a cash payment has none, so it sits on its Paid by line
  const refLine = p ? p.method !== "cash" || Boolean(p.reference) : false;

  const view = p ? (
    <div className={s.detail}>
      <DetailHero label="Rent received" tone="teal" value={money(p.amount)} sub={`For ${periodLabel({ month: p.periodMonth, year: p.periodYear })} · ${p.lease.unit.name}`} />
      <Facts
        items={[
          { label: "Tenant", value: p.lease.tenant.phone ? `${p.lease.tenant.name} · ${p.lease.tenant.phone}` : p.lease.tenant.name },
          { label: "Unit", value: p.lease.unit.name },
          { label: "Rent for", value: periodLabel({ month: p.periodMonth, year: p.periodYear }) },
          { label: "Received on", value: formatDate(p.paymentDate), num: true },
          {
            label: "Paid by",
            value: refLine ? (
              METHOD_LABEL[p.method]
            ) : (
              <span className={s.refView}>
                {METHOD_LABEL[p.method]}
                <ProofClip owner={{ paymentId: p.id }} />
              </span>
            ),
          },
          refLine ? { label: "Ref no.", value: <RefNo key={p.id} payment={p} /> } : null,
          { label: "Receipt no.", value: p.invoiceNumber, num: true },
          { label: "Lease rent", value: formatINR(p.lease.monthlyRent), num: true, hint: `Lease ${leaseSpan(p.lease)}` },
          p.notes ? { label: "Note", value: p.notes } : null,
        ]}
      />
    </div>
  ) : (
    <DrawerLoading error={detail.error?.message} />
  );

  return (
    <RecordDrawer
      open={sel.open}
      onClose={sel.close}
      eyebrow="Payment"
      title={p ? `${p.invoiceNumber} · ${money(p.amount)}` : "Payment"}
      editing={false}
      view={view}
      edit={null}
      viewActions={
        p && (
          <>
            <DeleteButton
              path={`/api/payments/${p.id}`}
              what={`payment ${p.invoiceNumber}`}
              onDeleted={sel.close}
              confirmMessage={`${money(p.amount)} for ${periodLabel({ month: p.periodMonth, year: p.periodYear })} from ${p.lease.tenant.name} will be removed, and its receipt cancelled.`}
            />
            <Spacer />
            <LinkButton variant="primary" href={`/invoice/${p.id}`} target="_blank" icon={<ExternalLink />}>
              Open receipt
            </LinkButton>
          </>
        )
      }
    />
  );
}

/**
 * The bank / UPI ref no. (UTR) in the payment drawer (owner, 10/10/2026): the number with a pencil, or "Add" when there
 * is none; both open a small box in place. The only part of a payment that can change after it is recorded.
 */
function RefNo({ payment: p }: { payment: PaymentDetail }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const save = useMutation(
    () => api<{ reference: string | null }>(`/api/payments/${p.id}`, { method: "PATCH", body: { reference: value } }),
    {
      success: (r) => (r.reference ? "Ref no. saved" : "Ref no. removed"),
      onSuccess: () => setEditing(false),
      toastError: false,
      onError: (e) => toast.error(e.fieldErrors.reference ? `Ref no. ${e.fieldErrors.reference}` : e.message),
    },
  );
  const start = () => {
    setValue(p.reference ?? "");
    setEditing(true);
  };

  if (!editing) {
    return (
      <span className={s.refView}>
        {p.reference ? (
          <>
            <span className={cx("num", s.refNum)}>{p.reference}</span>
            <button type="button" className={s.iconLink} aria-label="Change the ref no." onClick={start}>
              <Pencil aria-hidden />
            </button>
          </>
        ) : (
          <button type="button" className={s.inlineLink} onClick={start}>
            Add
          </button>
        )}
        <ProofClip owner={{ paymentId: p.id }} />
      </span>
    );
  }
  return (
    <form
      className={s.refEdit}
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
    >
      <Input
        compact
        autoFocus
        aria-label="Ref no. (UTR)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={s.refBox}
        maxLength={60}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
      <Button type="submit" size="sm" variant="primary" loading={save.loading}>
        Save
      </Button>
      <button type="button" className={s.iconLink} aria-label="Cancel" onClick={() => setEditing(false)}>
        <X aria-hidden />
      </button>
    </form>
  );
}
