"use client";
import { FileSignature, MessageCircle, Phone, Plus, UserPlus } from "lucide-react";
import { Button, EmptyState, Table, type Column } from "@/components/ui";
import { Facts, TenantForm, drawerFrame, leasePhase, leaseSpan, quickAdd, useTenants } from "@/components/forms";
import { useApi } from "@/lib/client";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { TenantDetail, TenantListItem } from "@/lib/schemas/tenant";
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
  useNarrow,
  useNewSignal,
  useSelection,
} from "./shared";
import { PhasePill } from "./LeasesTab";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
/** wa.me needs the country code; Indian 10-digit numbers get 91. */
const waHref = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
};

export function TenantsTab({ openId, onOpened, goto, newSignal }: TabProps) {
  const tenants = useTenants();
  const narrow = useNarrow();
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);
  const items = tenants.data?.items;

  const columns: Column<TenantListItem>[] = narrow
    ? [
        {
          key: "name",
          header: "Tenant", wrap: true,
          cell: (t) => <Stack2 top={t.name} bottom={t.activeLease ? `${t.activeLease.unitName} · since ${formatDate(t.activeLease.startDate)}` : "Not renting now"} />,
        },
        { key: "rent", header: "Rent / mo", numeric: true, cell: (t) => (t.activeLease ? formatINR(t.activeLease.monthlyRent) : <span className="faint">—</span>) },
      ]
    : [
        { key: "name", header: "Name", sortValue: (t) => t.name, cell: (t) => <span className={s.strong}>{t.name}</span> },
        {
          key: "phone",
          header: "Phone",
          cell: (t) =>
            t.phone ? (
              <a href={telHref(t.phone)} className={s.tel} onClick={(e) => e.stopPropagation()}>
                <Phone aria-hidden />
                {t.phone}
              </a>
            ) : (
              <span className="faint">—</span>
            ),
        },
        {
          key: "unit",
          header: "Lives in",
          sortValue: (t) => t.activeLease?.unitName ?? "",
          cell: (t) => (t.activeLease ? t.activeLease.unitName : <span className="faint">Not renting now</span>),
        },
        {
          key: "since",
          header: "Since",
          sortValue: (t) => t.activeLease?.startDate ?? "",
          cell: (t) => (t.activeLease ? <span className="num">{formatDate(t.activeLease.startDate)}</span> : <span className="faint">—</span>),
        },
        {
          key: "rent",
          header: "Rent / month",
          numeric: true,
          sortValue: (t) => t.activeLease?.monthlyRent ?? null,
          cell: (t) => (t.activeLease ? formatINR(t.activeLease.monthlyRent) : <span className="faint">—</span>),
        },
        { key: "leases", header: "Leases", numeric: true, sortValue: (t) => t.leasesCount, cell: (t) => t.leasesCount },
      ];
  if (items?.length) columns[0] = { ...columns[0], footer: <span className={s.totalLabel}>{items.length} {items.length === 1 ? "tenant" : "tenants"}</span> };

  return (
    <>
      <DataPanel
        eyebrow="People"
        title="Tenants"
        actions={
          <Button variant="primary" size="sm" icon={<Plus />} onClick={create.start}>
            Add tenant
          </Button>
        }
      >
        <Table
          fill
          columns={columns}
          rows={items}
          loading={tenants.loading}
          rowKey={(t) => t.id}
          onRowClick={(t) => sel.select(t.id)}
          selectedKey={sel.selected}
          defaultSort={{ key: "name", dir: "asc" }}
          caption="Tenants"
          empty={
            <EmptyState
              title="No tenants yet"
              description="Add the people who rent your units. Then sign a lease to link each one to a unit."
              action={
                <Button variant="primary" size="sm" icon={<UserPlus />} onClick={create.start}>
                  Add tenant
                </Button>
              }
            />
          }
        />
      </DataPanel>

      <TenantForm
        key={`new-${create.key}`}
        frame={drawerFrame({ open: create.open, onClose: create.close, eyebrow: "Tenants", title: "New tenant" })}
        onCancel={create.close}
        onSaved={(t) => {
          create.close();
          sel.select(t.id);
        }}
      />
      <TenantDrawer sel={sel} goto={goto} />
    </>
  );
}

function TenantDrawer({ sel, goto }: { sel: ReturnType<typeof useSelection>; goto: TabProps["goto"] }) {
  const detail = useApi<TenantDetail>(sel.shown ? `/api/tenants/${sel.shown}` : null);
  const t = detail.data?.id === sel.shown ? detail.data : undefined;
  const blocked = t && t.leasesCount > 0 ? `${t.name} has ${t.leasesCount} lease${t.leasesCount === 1 ? "" : "s"} on record, so they're kept for your records.` : null;

  const view = t ? (
    <div className={s.detail}>
      <DetailHero
        label="Rent paid"
        scope="All time"
        tone="teal"
        value={formatINR(t.paymentsTotal)}
        sub={t.activeLease ? `Lives in ${t.activeLease.unitName} since ${formatDate(t.activeLease.startDate)}` : "Not renting from you now"}
      />
      {t.phone && (
        <div className={s.contactRow}>
          <a className={s.contact} href={telHref(t.phone)}>
            <Phone aria-hidden /> Call {t.phone}
          </a>
          <a className={s.contact} href={waHref(t.phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </div>
      )}
      <Facts
        items={[
          { label: "Phone", value: t.phone ?? <span className="faint">—</span> },
          { label: "Email", value: t.email ? <a href={`mailto:${t.email}`}>{t.email}</a> : <span className="faint">—</span> },
          { label: "ID proof", value: t.idProofRef ?? <span className="faint">—</span> },
        ]}
      />
      <DetailSection
        title="Leases"
        aside={
          <Button size="sm" variant="secondary" icon={<FileSignature />} onClick={() => quickAdd("lease", { defaults: { tenantId: t.id } })}>
            New lease
          </Button>
        }
      >
        {t.leases.length ? (
          <ul className={s.miniList}>
            {t.leases.map((l) => {
              const phase = leasePhase(l);
              return (
                <li key={l.id}>
                  <button type="button" className={s.miniRow} onClick={() => goto("leases", l.id)}>
                    <Stack2 top={l.unit.name} bottom={`${leaseSpan(l)} · last paid ${l.lastPaidPeriod ? periodLabel(l.lastPaidPeriod) : "—"}`} />
                    <span className={s.miniRight}>
                      <span className="num">{formatINR(l.monthlyRent)}</span>
                      <PhasePill phase={phase} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={s.quiet}>No leases yet. Sign one to link {t.name} to a unit.</p>
        )}
      </DetailSection>
      {blocked && <BlockedNote>{blocked} Tenants with lease history can&rsquo;t be deleted.</BlockedNote>}
    </div>
  ) : (
    <DrawerLoading error={detail.error?.message} />
  );

  return (
    <RecordDrawer
      open={sel.open}
      onClose={sel.close}
      eyebrow="Tenant"
      title={t?.name ?? "Tenant"}
      editing={sel.editing && Boolean(t)}
      view={view}
      edit={t && <TenantForm key={t.id} tenant={t} frame={editInDrawer} onCancel={() => sel.setEditing(false)} onSaved={() => sel.setEditing(false)} />}
      viewActions={
        t && (
          <>
            <DeleteButton path={`/api/tenants/${t.id}`} what={t.name} blocked={blocked} onDeleted={sel.close} confirmMessage="This removes the tenant and their contact details." />
            <Spacer />
            <EditButton onClick={sel.edit} />
          </>
        )
      }
    />
  );
}
