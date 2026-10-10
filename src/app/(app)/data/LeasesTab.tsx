"use client";
import { Coins, DoorOpen, FileSignature, Plus, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, StatusPill } from "@/components/ui";
import {
  ChoiceGroup,
  Facts,
  LeaseForm,
  RenewAgreementButton,
  agreementText,
  drawerFrame,
  leasePhase,
  leaseSpan,
  quickAdd,
  useDashboard,
  useLeases,
  type LeasePhase,
} from "@/components/forms";
import { ProofStrip } from "@/components/proof";
import { useApi } from "@/lib/client";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { leaseDeleteBlockedMessage, type LeaseDetail } from "@/lib/schemas/lease";
import {
  BlockedNote,
  DataPanel,
  DeleteButton,
  DrawerLoading,
  DetailHero,
  DetailSection,
  EditButton,
  RecordDrawer,
  Spacer,
  Stack2,
  editInDrawer,
  useCreate,
  useNewSignal,
  useSelection,
} from "./shared";
import { CardGrid, GameCard, initials } from "./cards";
import { RentChanges } from "./RentChanges";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

type Filter = "current" | "incoming" | "past" | "all";

export function PhasePill({ phase, size = "sm" }: { phase: LeasePhase; size?: "sm" | "md" }) {
  if (phase === "current") return <StatusPill status="active" label="Current" size={size} />;
  if (phase === "incoming")
    return (
      <Badge tone="sky" marker size={size}>
        Incoming
      </Badge>
    );
  return <StatusPill status="past" size={size} />;
}

export function LeasesTab({ openId, onOpened, newSignal }: TabProps) {
  const leases = useLeases();
  const dash = useDashboard();
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);
  const [filter, setFilter] = useState<Filter>("current");

  const all = leases.data?.items;
  const counts = useMemo(() => {
    const c = { current: 0, incoming: 0, past: 0 };
    for (const l of all ?? []) c[leasePhase(l)]++;
    return c;
  }, [all]);
  const rows = useMemo(() => (all ? all.filter((l) => filter === "all" || leasePhase(l) === filter) : undefined), [all, filter]);


  const emptyText: Record<Filter, string> = {
    current: "Nobody is renting right now.",
    incoming: "No upcoming leases.",
    past: "No past leases yet.",
    all: "No leases yet.",
  };

  return (
    <>
      <DataPanel
        eyebrow="Agreements"
        title="Leases"
        actions={
          <>
            <ChoiceGroup
              name="leaseFilter"
              aria-label="Show leases"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "current", label: `Current ${counts.current}` },
                { value: "incoming", label: `Incoming ${counts.incoming}` },
                { value: "past", label: `Past ${counts.past}` },
                { value: "all", label: "All" },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Plus />} onClick={create.start}>
              Sign lease
            </Button>
          </>
        }
      >
        <CardGrid
          loading={leases.loading && !rows}
          addLabel="Sign lease"
          onAdd={create.start}
          empty={
            <EmptyState
              compact={Boolean(all?.length)}
              title={emptyText[filter]}
              action={
                all?.length && filter !== "all" ? (
                  <Button size="sm" variant="secondary" onClick={() => setFilter("all")}>
                    Show all leases
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" icon={<FileSignature />} onClick={create.start}>
                    Sign a lease
                  </Button>
                )
              }
            />
          }
        >
          {(rows ?? []).map((l) => {
            const phase = leasePhase(l);
            // agreement renewal reminder (owner 8/10): due soon = marigold, ended = coral
            const renew = dash.data?.renewals.find((r) => r.leaseId === l.id);
            return (
              <GameCard
                key={l.id}
                badge={initials(l.tenant.name)}
                title={l.tenant.name}
                tag={
                  renew
                    ? { text: `Agreement ${agreementText(renew.daysLeft)}`, tone: renew.state === "expired" ? "coral" : "marigold" }
                    : { text: l.unit.name, tone: phase === "current" ? "teal" : phase === "incoming" ? "marigold" : "muted" }
                }
                line={renew ? `${l.unit.name} · ${leaseSpan(l)}` : leaseSpan(l)}
                stats={[
                  { label: "Rent", value: `${formatINR(l.monthlyRent)} /mo`, tone: phase === "past" ? "muted" : "teal" },
                  { label: "Collected", value: formatINR(l.paymentsTotal, l.paymentsTotal % 1 !== 0) },
                ]}
                selected={sel.selected === l.id}
                onOpen={() => sel.select(l.id)}
              />
            );
          })}
        </CardGrid>
      </DataPanel>

      <LeaseForm
        key={`new-${create.key}`}
        frame={drawerFrame({ open: create.open, onClose: create.close, eyebrow: "Leases", title: "Sign a lease" })}
        onCancel={create.close}
        onSaved={(l) => {
          create.close();
          sel.select(l.id);
        }}
      />
      <LeaseDrawer sel={sel} />
    </>
  );
}

function LeaseDrawer({ sel }: { sel: ReturnType<typeof useSelection> }) {
  const detail = useApi<LeaseDetail>(sel.shown ? `/api/leases/${sel.shown}` : null);
  const dash = useDashboard();
  const l = detail.data?.id === sel.shown ? detail.data : undefined;
  const next = l ? dash.data?.units.find((u) => u.nextPayment?.leaseId === l.id)?.nextPayment : undefined;
  const phase = l ? leasePhase(l) : "current";
  const blocked = l ? leaseDeleteBlockedMessage(l.tenant.name, l.unit.name, l.paymentsCount) : null;
  const [showAll, setShowAll] = useState(false);
  const renew = l ? dash.data?.renewals.find((r) => r.leaseId === l.id) : undefined;

  const view = l ? (
    <div className={s.detail}>
      <DetailHero
        label="Rent collected"
        scope="All time"
        tone="teal"
        value={formatINR(l.paymentsTotal, l.paymentsTotal % 1 !== 0)}
        sub={
          <>
            {l.paymentsCount} payment{l.paymentsCount === 1 ? "" : "s"} · last paid {l.lastPaidPeriod ? periodLabel(l.lastPaidPeriod) : "—"}
          </>
        }
      />
      {next && next.arrears.months.length > 0 && (
        <div className={s.arrears} role="status">
          <div className={s.arrearsHead}>
            <span>Overdue</span>
            <span className="num">{formatINR(next.arrears.totalWithFees)}</span>
          </div>
          <ul>
            {(showAll ? next.arrears.months : next.arrears.months.slice(0, 3)).map((m) => (
              <li key={m.key}>
                <span>
                  {m.label} <span className="faint">· {m.daysOverdue} day{m.daysOverdue === 1 ? "" : "s"} late</span>
                </span>
                <span className="num">
                  {formatINR(m.outstanding)}
                  {m.lateFee ? <span className="faint"> + {formatINR(m.lateFee)} fee</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {next.arrears.months.length > 3 && (
            <button type="button" className={s.inlineLink} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `+ ${next.arrears.months.length - 3} more months`}
            </button>
          )}
        </div>
      )}
      {next && next.arrears.months.length === 0 && (
        <p className={s.nextDue}>
          Next: <b>{next.label}</b> rent {formatINR(next.amountDue)} due {formatDate(next.dueDate)}
        </p>
      )}
      <Facts
        items={[
          { label: "Status", value: <PhasePill phase={phase} /> },
          { label: "Unit", value: l.unit.name },
          { label: "Tenant", value: l.tenant.phone ? `${l.tenant.name} · ${l.tenant.phone}` : l.tenant.name },
          { label: "First day", value: formatDate(l.startDate), num: true },
          { label: "Last day of tenancy", value: l.endDate ? formatDate(l.endDate) : <span className="faint">open — still living there</span>, num: Boolean(l.endDate) },
          (Boolean(l.agreementEndDate) || phase !== "past") && {
            label: "Agreement ends",
            value: l.agreementEndDate ? (
              <span className={s.agreement}>
                <span className="num">{formatDate(l.agreementEndDate)}</span>
                {renew && (
                  <>
                    <Badge size="sm" tone={renew.state === "expired" ? "coral" : "marigold"}>
                      {agreementText(renew.daysLeft)}
                    </Badge>
                    <RenewAgreementButton lease={l} tenantName={l.tenant.name} variant="ghost" />
                  </>
                )}
              </span>
            ) : (
              <span className="faint">not recorded</span>
            ),
          },
          { label: "Monthly rent", value: formatINR(l.monthlyRent), num: true },
          { label: "Rent billing", value: l.rentTiming === "arrears" ? "IN ARREARS" : "IN ADVANCE" },
          {
            label: "Security deposit",
            value: l.securityDeposit ? formatINR(l.securityDeposit) : <span className="faint">none</span>,
            num: Boolean(l.securityDeposit),
            hint:
              l.depositRefundedAmount != null
                ? `${formatINR(l.depositRefundedAmount)} refunded${l.depositRefundDate ? ` on ${formatDate(l.depositRefundDate)}` : ""}`
                : l.securityDeposit
                  ? "Held for the tenant — not income"
                  : undefined,
          },
          (l.securityDeposit > 0 || Boolean(l.depositReference)) && {
            label: "Deposit ref no.",
            value: l.depositReference ? <span className="num">{l.depositReference}</span> : <span className="faint">—</span>,
          },
          { label: "Rent reminders", value: l.reminderEnabled ? "On" : "Off" },
          l.moveOutNotes ? { label: "Move-out notes", value: l.moveOutNotes } : null,
        ]}
      />
      {l.securityDeposit > 0 && (
        <DetailSection title="Deposit attachment">
          <ProofStrip owner={{ leaseId: l.id }} />
        </DetailSection>
      )}
      <RentChanges lease={l} />
      <DetailSection title="Payments" aside={<span className="faint">{l.payments.length ? "newest first" : null}</span>}>
        {l.payments.length ? (
          <ul className={s.miniList}>
            {l.payments.map((p) => (
              <li key={p.id}>
                <div className={s.miniRow} data-static>
                  <Stack2 top={periodLabel({ month: p.periodMonth, year: p.periodYear })} bottom={`Received ${formatDate(p.paymentDate)} · ${p.invoiceNumber}`} />
                  <span className={s.miniRight}>
                    <span className="num pos">{formatINR(p.amount, p.amount % 1 !== 0)}</span>
                    <a className={s.iconLink} href={`/invoice/${p.id}`} target="_blank" rel="noopener" aria-label={`Receipt ${p.invoiceNumber}`} title="Open receipt">
                      <ReceiptText aria-hidden />
                    </a>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.quiet}>No rent recorded on this lease yet.</p>
        )}
      </DetailSection>
      {blocked && <BlockedNote>{blocked}</BlockedNote>}
    </div>
  ) : (
    <DrawerLoading error={detail.error?.message} />
  );

  return (
    <RecordDrawer
      open={sel.open}
      onClose={sel.close}
      eyebrow="Lease"
      title={l ? `${l.tenant.name} · ${l.unit.name}` : "Lease"}
      editing={sel.editing && Boolean(l)}
      view={view}
      edit={l && <LeaseForm key={l.id} lease={l} frame={editInDrawer} onCancel={() => sel.setEditing(false)} onSaved={() => sel.setEditing(false)} />}
      viewActions={
        l && (
          <>
            <DeleteButton
              path={`/api/leases/${l.id}`}
              what={`${l.tenant.name}'s lease`}
              blocked={blocked}
              onDeleted={sel.close}
              confirmMessage="Only for a lease entered by mistake — it has no rent recorded."
            />
            <Spacer />
            {!l.endDate && phase !== "past" && (
              <Button variant="secondary" icon={<DoorOpen />} onClick={() => quickAdd("moveOut", { lease: l })}>
                Move out
              </Button>
            )}
            <Button variant="secondary" icon={<Coins />} onClick={() => quickAdd("payment", { defaults: { leaseId: l.id } })}>
              Record rent
            </Button>
            <EditButton onClick={sel.edit} />
          </>
        )
      }
    />
  );
}
