"use client";
import { Coins, ExternalLink, Plus, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, LinkButton, Select, Table, type Column } from "@/components/ui";
import {
  ChoiceGroup,
  Facts,
  METHOD_LABEL,
  PaymentForm,
  currentYear,
  drawerFrame,
  leaseLabel,
  leasePhase,
  leaseSpan,
  useLeases,
  usePayments,
  useYearMode,
  yearLabel,
  yearOf,
} from "@/components/forms";
import { useApi } from "@/lib/client";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { PaymentDetail, PaymentListItem } from "@/lib/schemas/payment";
import { DataPanel, DeleteButton, DrawerLoading, DetailHero, RecordDrawer, Spacer, Stack2, TotalLabel, shortPeriod, useCreate, useNarrow, useNewSignal, useSelection } from "./shared";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

const money = (n: number) => formatINR(n, n % 1 !== 0);

export function PaymentsTab({ openId, onOpened, newSignal }: TabProps) {
  const [leaseId, setLeaseId] = useState("");
  // year by the day the rent was received (cash), like Expenses; records start on All time (owner 8/10)
  const [mode, setMode] = useYearMode();
  const [year, setYear] = useState<number | "all">("all");
  const payments = usePayments(leaseId || null, { year: year === "all" ? null : year, yearMode: mode });
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
    if (year !== "all") set.add(year);
    return [...set].sort((a, b) => b - a);
  }, [all.data, mode, year]);
  const scope = [year === "all" ? "All time" : yearLabel(year, mode), lease?.tenant.name].filter(Boolean).join(" · ");
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
          cell: (p) => <Stack2 top={`${shortPeriod(p)} · ${p.lease.tenant.name}`} bottom={`${p.lease.unit.name} · ${formatDate(p.paymentDate)} · ${METHOD_LABEL[p.method]}`} />,
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
        { key: "receipt", header: "Receipt", cell: receipt },
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
            <Select compact aria-label="Year" value={String(year)} onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))} className={s.filterSelect}>
              <option value="all">All time</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {yearLabel(y, mode)}
                </option>
              ))}
            </Select>
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
                year !== "all" ? `No rent received in ${yearLabel(year, mode)}${lease ? ` from ${lease.tenant.name}` : ""}` : lease ? `No rent recorded for ${lease.tenant.name} yet` : "No rent recorded yet"
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

  const view = p ? (
    <div className={s.detail}>
      <DetailHero label="Rent received" tone="teal" value={money(p.amount)} sub={`For ${periodLabel({ month: p.periodMonth, year: p.periodYear })} · ${p.lease.unit.name}`} />
      <Facts
        items={[
          { label: "Tenant", value: p.lease.tenant.phone ? `${p.lease.tenant.name} · ${p.lease.tenant.phone}` : p.lease.tenant.name },
          { label: "Unit", value: p.lease.unit.name },
          { label: "Rent for", value: periodLabel({ month: p.periodMonth, year: p.periodYear }) },
          { label: "Received on", value: formatDate(p.paymentDate), num: true },
          { label: "Paid by", value: METHOD_LABEL[p.method] },
          { label: "Receipt no.", value: p.invoiceNumber, num: true },
          { label: "Lease rent", value: formatINR(p.lease.monthlyRent), num: true, hint: `Lease ${leaseSpan(p.lease)}` },
          p.notes ? { label: "Note", value: p.notes } : null,
        ]}
      />
      <p className={s.quiet}>
        Payments can&rsquo;t be edited, so receipts always match what was recorded. If something is wrong, delete it and record it again — the
        receipt number is not reused.
      </p>
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
