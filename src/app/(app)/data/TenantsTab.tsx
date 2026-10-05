"use client";
import { FileSignature, MessageCircle, Phone, Plus, UserPlus } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { Facts, TenantForm, drawerFrame, leasePhase, leaseSpan, quickAdd, useTenants } from "@/components/forms";
import { useApi } from "@/lib/client";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { TenantDetail } from "@/lib/schemas/tenant";
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
import { PhasePill } from "./LeasesTab";
import { CardGrid, GameCard, initials } from "./cards";
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
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);
  const items = tenants.data?.items;


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
        <CardGrid
          loading={tenants.loading && !items}
          addLabel="New tenant"
          onAdd={create.start}
          empty={
            <EmptyState
              title="No tenants yet"
              action={
                <Button variant="primary" size="sm" icon={<UserPlus />} onClick={create.start}>
                  Add tenant
                </Button>
              }
            />
          }
        >
          {[...(items ?? [])]
            .sort((a, b) => Number(Boolean(b.activeLease)) - Number(Boolean(a.activeLease)) || a.name.localeCompare(b.name))
            .map((t) => (
              <GameCard
                key={t.id}
                badge={initials(t.name)}
                title={t.name}
                tag={t.activeLease ? { text: t.activeLease.unitName, tone: "teal" } : { text: "Not renting", tone: "muted" }}
                line={
                  t.phone ? (
                    <span className={s.tel}>
                      <Phone aria-hidden />
                      {t.phone}
                    </span>
                  ) : undefined
                }
                stats={
                  t.activeLease
                    ? [
                        { label: "Rent", value: `${formatINR(t.activeLease.monthlyRent)} /mo`, tone: "teal" },
                        { label: "Since", value: formatDate(t.activeLease.startDate) },
                      ]
                    : [
                        { label: "Leases", value: `${t.leasesCount} past` },
                        { label: "Rent", value: "—", tone: "muted" },
                      ]
                }
                selected={sel.selected === t.id}
                onOpen={() => sel.select(t.id)}
              />
            ))}
        </CardGrid>
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
