"use client";
import { CircleCheck, Landmark, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, EmptyState, StatusPill, Table, type Column } from "@/components/ui";
import { ChoiceGroup, Facts, PropertyTaxForm, drawerFrame, quickAdd, usePropertyTax } from "@/components/forms";
import { ProofHead, ProofMark, ProofStrip, proofCount } from "@/components/proof";
import { sumAmounts } from "@/lib/calculations";
import { formatDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";
import {
  DataPanel,
  DeleteButton,
  DetailSection,
  DrawerLoading,
  DetailHero,
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
import type { TabProps } from "./tabs";
import s from "./data.module.css";

type Filter = "all" | "Due" | "Paid";
const money = (n: number) => formatINR(n, n % 1 !== 0);

export function PropertyTaxTab({ openId, onOpened, goto, newSignal }: TabProps) {
  const taxes = usePropertyTax();
  const narrow = useNarrow();
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);
  const [filter, setFilter] = useState<Filter>("all");

  const all = taxes.data?.items;
  const rows = useMemo(() => all?.filter((t) => filter === "all" || t.status === filter), [all, filter]);
  const due = useMemo(() => (all ?? []).filter((t) => t.status === "Due"), [all]);
  const shownPaid = sumAmounts((rows ?? []).filter((t) => t.status === "Paid"));
  const shownDue = sumAmounts((rows ?? []).filter((t) => t.status === "Due"));

  const markPaid = (t: PropertyTaxDTO) => quickAdd("markTaxPaid", { tax: t });
  const action = (t: PropertyTaxDTO) =>
    t.status === "Due" ? (
      <Button
        size="sm"
        variant="secondary"
        icon={<CircleCheck />}
        onClick={(e) => {
          e.stopPropagation();
          markPaid(t);
        }}
      >
        Mark paid
      </Button>
    ) : (
      <span className={s.linked} title="Counted in Expenses under Property Tax">
        In expenses
      </span>
    );

  const footer = rows?.length ? (
    <span className={s.totalLabel}>
      <span>Shown</span>
      {shownPaid > 0 && (
        <span>
          Paid <b className="neg num">{money(shownPaid)}</b>
        </span>
      )}
      {shownDue > 0 && (
        <span>
          Due <b className={`${s.dueAmt} num`}>{money(shownDue)}</b>
        </span>
      )}
    </span>
  ) : undefined;

  const columns: Column<PropertyTaxDTO>[] = narrow
    ? [
        {
          key: "what",
          header: "Tax",
          wrap: true,
          cell: (t) => (
            <Stack2
              top={
                <>
                  {t.year} · {t.unit.name} <ProofMark count={proofCount(t)} />
                </>
              }
              bottom={t.paymentDate ? `Paid ${formatDate(t.paymentDate)}` : "Not paid yet"}
            />
          ),
          footer,
        },
        // phones: amount with the Mark paid button / Paid pill under it — two columns, nothing runs off the screen
        {
          key: "amount",
          header: "Amount",
          numeric: true,
          cell: (t) => (
            <span className={s.taxAmt}>
              <span className="num neg">{money(t.amount)}</span>
              {t.status === "Due" ? action(t) : <StatusPill status="paid" size="sm" />}
            </span>
          ),
        },
      ]
    : [
        { key: "year", header: "Tax year", sortValue: (t) => t.year, cell: (t) => <span className="num">{t.year}</span>, footer },
        { key: "unit", header: "Unit", sortValue: (t) => t.unit.name, cell: (t) => t.unit.name },
        { key: "amount", header: "Amount", numeric: true, sortValue: (t) => t.amount, cell: (t) => <span className="neg">{money(t.amount)}</span> },
        { key: "status", header: "Status", sortValue: (t) => t.status, cell: (t) => <StatusPill status={t.status === "Paid" ? "paid" : "due"} size="sm" /> },
        { key: "paid", header: "Paid on", sortValue: (t) => t.paymentDate ?? "", cell: (t) => (t.paymentDate ? <span className="num">{formatDate(t.paymentDate)}</span> : <span className="faint">—</span>) },
        { key: "proof", header: <ProofHead />, align: "center", width: 44, cell: (t) => <ProofMark count={proofCount(t)} /> },
        { key: "action", header: "", align: "right", cell: action },
      ];

  const thisYear = todayIST().getUTCFullYear();
  const overdueDue = due.filter((t) => t.year < thisYear).length;

  return (
    <>
      <DataPanel
        eyebrow={due.length ? `${due.length} due${overdueDue ? ` · ${overdueDue} from past years` : ""}` : "All paid"}
        title="Property tax"
        actions={
          <>
            <ChoiceGroup
              name="taxFilter"
              aria-label="Show"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "Due", label: `Due ${due.length}` },
                { value: "Paid", label: "Paid" },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Plus />} onClick={create.start}>
              Add tax
            </Button>
          </>
        }
      >
        <Table
          fill
          columns={columns}
          rows={rows}
          loading={taxes.loading}
          rowKey={(t) => t.id}
          onRowClick={(t) => sel.select(t.id)}
          selectedKey={sel.selected}
          defaultSort={{ key: "year", dir: "desc" }}
          caption="Property tax"
          empty={
            <EmptyState
              compact={Boolean(all?.length)}
              title={all?.length ? (filter === "Due" ? "Nothing due — all property tax is paid" : "Nothing paid yet") : "No property tax recorded yet"}
              action={
                all?.length ? null : (
                  <Button size="sm" variant="primary" icon={<Landmark />} onClick={create.start}>
                    Add property tax
                  </Button>
                )
              }
            />
          }
        />
      </DataPanel>

      <PropertyTaxForm
        key={`new-${create.key}`}
        frame={drawerFrame({ open: create.open, onClose: create.close, eyebrow: "Property tax", title: "Add property tax" })}
        onCancel={create.close}
        onSaved={create.close}
      />
      <TaxDrawer sel={sel} goto={goto} items={all} />
    </>
  );
}

function TaxDrawer({ sel, goto, items }: { sel: ReturnType<typeof useSelection>; goto: TabProps["goto"]; items?: PropertyTaxDTO[] }) {
  const t = items?.find((x) => x.id === sel.shown);
  const view = t ? (
    <div className={s.detail}>
      <DetailHero
        label={t.status === "Paid" ? "Paid" : "Due"}
        tone={t.status === "Paid" ? "coral" : "marigold"}
        value={money(t.amount)}
        sub={`Property tax ${t.year} · ${t.unit.name}`}
      />
      <Facts
        items={[
          { label: "Unit", value: t.unit.name },
          { label: "Tax year", value: t.year, num: true },
          { label: "Status", value: <StatusPill status={t.status === "Paid" ? "paid" : "due"} size="sm" /> },
          { label: "Paid on", value: t.paymentDate ? formatDate(t.paymentDate) : <span className="faint">not yet</span>, num: Boolean(t.paymentDate) },
          {
            label: "In expenses",
            value: t.expense ? (
              <button type="button" className={s.inlineLink} onClick={() => goto("expenses", t.expense!.id)}>
                Yes — open the expense
              </button>
            ) : (
              <span className="faint">added when marked Paid</span>
            ),
          },
        ]}
      />
      <DetailSection title="Proof">
        <ProofStrip owner={{ propertyTaxId: t.id }} />
      </DetailSection>
    </div>
  ) : (
    <DrawerLoading />
  );

  return (
    <RecordDrawer
      open={sel.open}
      onClose={sel.close}
      eyebrow="Property tax"
      title={t ? `${t.year} · ${t.unit.name}` : "Property tax"}
      editing={sel.editing && Boolean(t)}
      view={view}
      edit={t && <PropertyTaxForm key={t.id} tax={t} frame={editInDrawer} onCancel={() => sel.setEditing(false)} onSaved={() => sel.setEditing(false)} />}
      viewActions={
        t && (
          <>
            <DeleteButton
              path={`/api/property-tax/${t.id}`}
              what={`property tax ${t.year}`}
              onDeleted={sel.close}
              confirmMessage={t.status === "Paid" ? `Its ${money(t.amount)} expense under Property Tax is removed too.` : undefined}
            />
            <Spacer />
            {t.status === "Due" && (
              <Button variant="secondary" icon={<CircleCheck />} onClick={() => quickAdd("markTaxPaid", { tax: t })}>
                Mark paid
              </Button>
            )}
            <EditButton onClick={sel.edit} />
          </>
        )
      }
    />
  );
}
