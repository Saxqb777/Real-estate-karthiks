"use client";
import { Coins, ExternalLink, Pencil, Plus, ReceiptText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Input, LinkButton, Select, Table, cx, toast, type Column } from "@/components/ui";
import {
  ChoiceGroup,
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
import type { PaymentDetail, PaymentListItem } from "@/lib/schemas/payment";
import { DataPanel, DeleteButton, DrawerLoading, DetailHero, RecordDrawer, Spacer, Stack2, TotalLabel, shortPeriod, useCreate, useNarrow, useNewSignal, useSelection } from "./shared";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

const money = (n: number) => formatINR(n, n % 1 !== 0);

export function PaymentsTab({ openId, onOpened, newSignal }: TabProps) {
  const [leaseId, setLeaseId] = useState("");
  // year / custom dates by the day the rent was received (cash), like Expenses; records start on All time (owner 8/10)
  const [mode, setMode] = useYearMode();
  const [period, setPeriod] = useState<PeriodPick>({ kind: "all" });
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
    if (year !== null) set.add(year);
    return [...set].sort((a, b) => b - a);
  }, [all.data, mode, year]);
  const scope = [periodText(period, mode), lease?.tenant.name].filter(Boolean).join(" · ");
  const data = payments.data;
  const rows = data?.items;

  const groups = useMemo(() => {
    const items = leases.data?.items ?? [];
    return { current: items.filter((l) => leasePhase(l) !== "past"), past: items.filter((l) => leasePhase(l) === "past") };
  }, [leases.data]);

  const footerLabel = rows?.length ? <TotalLabel scope={scope} count={data!.count} noun={["payment", "payments"]} /> : undefined;
  const footerTotal = rows?.length ? <span className="pos">{money(data!.total)}</span> : undefined;

  const receipt = (p: PaymentListItem) => (
    <a className={s.receipt} href={`/invoice/${p.id}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} title="Open the printable receipt">
      <ReceiptText aria-hidden />
      {p.invoiceNumber}
    </a>
  );

  const columns: Column<PaymentListItem>[] = narrow
    ? [
        {
          key: "what",
          header: "Payment", wrap: true,
          cell: (p) => (
            <Stack2
              top={
                <>
                  {shortPeriod(p)} · {p.lease.tenant.name} <ProofMark count={proofCount(p)} />
                </>
              }
              bottom={`${p.lease.unit.name} · ${formatDate(p.paymentDate)} · ${METHOD_LABEL[p.method]}${p.reference ? ` ${p.reference}` : ""}`}
            />
          ),
          footer: footerLabel,
        },
        { key: "amount", header: "Amount", numeric: true, cell: (p) => <span className="pos">{money(p.amount)}</span>, footer: footerTotal },
      ]
    : [
        { key: "date", header: "Received", sortValue: (p) => p.paymentDate, cell: (p) => <span className="num">{formatDate(p.paymentDate)}</span>, footer: footerLabel },
        { key: "period", header: "Rent for", sortValue: (p) => p.periodYear * 12 + p.periodMonth, cell: (p) => shortPeriod(p) },
        { key: "unit", header: "Unit", sortValue: (p) => p.lease.unit.name, cell: (p) => p.lease.unit.name },
        { key: "tenant", header: "Tenant", sortValue: (p) => p.lease.tenant.name, cell: (p) => p.lease.tenant.name },
        {
          key: "method",
          header: "Paid by",
          cell: (p) => (
            <Badge size="sm" tone="neutral">
              {METHOD_LABEL[p.method]}
            </Badge>
          ),
        },
        { key: "ref", header: "Ref no.", cell: (p) => (p.reference ? <span className="num">{p.reference}</span> : <span className="faint">—</span>) },
        { key: "receipt", header: "Receipt", cell: receipt },
        { key: "proof", header: <ProofHead />, align: "center", width: 44, cell: (p) => <ProofMark count={proofCount(p)} /> },
        { key: "amount", header: "Amount", numeric: true, sortValue: (p) => p.amount, cell: (p) => <span className="pos">{money(p.amount)}</span>, footer: footerTotal },
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
            <PeriodPicker value={period} onChange={setPeriod} years={years} mode={mode} className={s.filterPeriod} />
            <ChoiceGroup
              name="paymentsYearMode"
              aria-label="Year type"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: "fy", label: "FY" },
                { value: "calendar", label: "Calendar" },
              ]}
            />
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
          rowKey={(p) => p.id}
          onRowClick={(p) => sel.select(p.id)}
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
