"use client";
import { Lock, Plus, ReceiptIndianRupee } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Select, Table, type Column } from "@/components/ui";
import {
  ChoiceGroup,
  Dot,
  ExpenseForm,
  Facts,
  currentYear,
  drawerFrame,
  unitLabel,
  useCategories,
  useExpenses,
  useUnits,
  useYearMode,
  yearLabel,
  yearOf,
} from "@/components/forms";
import { useApi } from "@/lib/client";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { WHOLE_PLOT, type ExpenseDTO } from "@/lib/schemas/expense";
import {
  BlockedNote,
  DataPanel,
  DeleteButton,
  DrawerLoading,
  DetailHero,
  EditButton,
  RecordDrawer,
  Spacer,
  Stack2,
  TotalLabel,
  editInDrawer,
  useCreate,
  useNarrow,
  useNewSignal,
  useSelection,
} from "./shared";
import type { TabProps } from "./tabs";
import s from "./data.module.css";

const money = (n: number) => formatINR(n, n % 1 !== 0);

export function ExpensesTab({ openId, onOpened, goto, newSignal }: TabProps) {
  const [mode, setMode] = useYearMode();
  const [year, setYear] = useState<number | "all">(() => currentYear(mode));
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const narrow = useNarrow();
  const sel = useSelection(openId, onOpened);
  const create = useCreate();
  useNewSignal(newSignal, create.start);

  const all = useExpenses({});
  const list = useExpenses({ year: year === "all" ? null : year, yearMode: mode, unitId: unitId || null, categoryId: categoryId || null });
  const units = useUnits();
  const cats = useCategories();

  const years = useMemo(() => {
    const set = new Set<number>([currentYear(mode)]);
    for (const e of all.data?.items ?? []) set.add(yearOf(e.expenseDate, mode));
    if (year !== "all") set.add(year);
    return [...set].sort((a, b) => b - a);
  }, [all.data, mode, year]);

  const unitName = unitId === WHOLE_PLOT ? "Whole plot" : units.data?.items.find((u) => u.id === unitId)?.name;
  const catName = cats.data?.items.find((c) => c.id === categoryId)?.name;
  const scope = [year === "all" ? "All time" : yearLabel(year, mode), unitName, catName].filter(Boolean).join(" · ");
  const filtered = year !== "all" || Boolean(unitId) || Boolean(categoryId);

  const data = list.data;
  const rows = data?.items;
  const footerLabel = rows?.length ? <TotalLabel scope={scope} count={data!.count} noun={["expense", "expenses"]} /> : undefined;
  const footerTotal = rows?.length ? <span className="neg">{money(data!.total)}</span> : undefined;

  const category = (e: ExpenseDTO) => (
    <span className={s.cat}>
      <Dot color={e.category.color} />
      {e.category.name}
    </span>
  );
  const what = (e: ExpenseDTO) => (
    <span className={s.desc}>
      {e.description ?? <span className="faint">—</span>}
      {e.propertyTaxId && (
        <Badge size="sm" tone="neutral" icon={<Lock aria-hidden />} title="Added automatically when property tax was marked Paid">
          Auto
        </Badge>
      )}
    </span>
  );

  const columns: Column<ExpenseDTO>[] = narrow
    ? [
        {
          key: "what",
          header: "Expense", wrap: true,
          cell: (e) => <Stack2 top={category(e)} bottom={`${formatDate(e.expenseDate)} · ${e.unit?.name ?? "Whole plot"}${e.description ? ` · ${e.description}` : ""}`} />,
          footer: footerLabel,
        },
        { key: "amount", header: "Amount", numeric: true, cell: (e) => money(e.amount), footer: footerTotal },
      ]
    : [
        { key: "date", header: "Paid on", sortValue: (e) => e.expenseDate, cell: (e) => <span className="num">{formatDate(e.expenseDate)}</span>, footer: footerLabel },
        { key: "category", header: "Category", sortValue: (e) => e.category.name, cell: category },
        { key: "unit", header: "For", sortValue: (e) => e.unit?.name ?? "", cell: (e) => e.unit?.name ?? <span className="dim">Whole plot</span> },
        { key: "desc", header: "What for", wrap: true, cell: what },
        { key: "amount", header: "Amount", numeric: true, sortValue: (e) => e.amount, cell: (e) => money(e.amount), footer: footerTotal },
      ];

  const clear = () => {
    setYear("all");
    setUnitId("");
    setCategoryId("");
  };

  return (
    <>
      <DataPanel
        eyebrow="Cash · money out"
        title="Expenses"
        actions={
          <Button variant="primary" size="sm" icon={<Plus />} onClick={create.start}>
            Add expense
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
              name="yearMode"
              aria-label="Year type"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: "fy", label: "FY" },
                { value: "calendar", label: "Calendar" },
              ]}
            />
            <Select compact aria-label="Unit" value={unitId} onChange={(e) => setUnitId(e.target.value)} className={s.filterSelect}>
              <option value="">All units</option>
              {(units.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(u)}
                </option>
              ))}
              <option value={WHOLE_PLOT}>Whole plot (shared)</option>
            </Select>
            <Select compact aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={s.filterSelect}>
              <option value="">All categories</option>
              {(cats.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {(unitId || categoryId) && (
              <button
                type="button"
                className={s.clear}
                onClick={() => {
                  setUnitId("");
                  setCategoryId("");
                }}
              >
                Clear filters
              </button>
            )}
          </>
        }
      >
        <Table
          fill
          columns={columns}
          rows={rows}
          loading={list.loading}
          rowKey={(e) => e.id}
          onRowClick={(e) => sel.select(e.id)}
          selectedKey={sel.selected}
          caption="Expenses"
          empty={
            <EmptyState
              compact={Boolean(all.data?.count)}
              title={all.data?.count ? `No expenses in ${scope}` : "No expenses yet"}
              description={all.data?.count ? undefined : "Repairs, bills and fees you pay for the property show up here, by unit or for the whole plot."}
              action={
                all.data?.count && filtered ? (
                  <Button size="sm" variant="secondary" onClick={clear}>
                    Show all expenses
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" icon={<ReceiptIndianRupee />} onClick={create.start}>
                    Add expense
                  </Button>
                )
              }
            />
          }
        />
      </DataPanel>

      <ExpenseForm
        key={`new-${create.key}`}
        defaults={{ unitId: unitId && unitId !== WHOLE_PLOT ? unitId : "", categoryId }}
        frame={drawerFrame({ open: create.open, onClose: create.close, eyebrow: "Expenses", title: "Add expense" })}
        onCancel={create.close}
        onSaved={create.close}
      />
      <ExpenseDrawer sel={sel} goto={goto} />
    </>
  );
}

function ExpenseDrawer({ sel, goto }: { sel: ReturnType<typeof useSelection>; goto: TabProps["goto"] }) {
  const detail = useApi<ExpenseDTO>(sel.shown ? `/api/expenses/${sel.shown}` : null);
  const e = detail.data?.id === sel.shown ? detail.data : undefined;
  const linked = Boolean(e?.propertyTaxId);

  const view = e ? (
    <div className={s.detail}>
      <DetailHero label="Spent" tone="coral" value={money(e.amount)} sub={`${e.category.name} · ${e.unit?.name ?? "Whole plot"}`} />
      <Facts
        items={[
          { label: "Paid on", value: formatDate(e.expenseDate), num: true },
          {
            label: "Category",
            value: (
              <span className={s.cat}>
                <Dot color={e.category.color} />
                {e.category.name}
              </span>
            ),
          },
          { label: "For", value: e.unit?.name ?? "Whole plot (shared)" },
          { label: "What for", value: e.description ?? <span className="faint">—</span> },
        ]}
      />
      {linked && (
        <BlockedNote>
          Added automatically when property tax was marked Paid, so it can only be changed there.{" "}
          <button type="button" className={s.inlineLink} onClick={() => goto("property-tax", e.propertyTaxId!)}>
            Open the property tax entry
          </button>
        </BlockedNote>
      )}
    </div>
  ) : (
    <DrawerLoading error={detail.error?.message} />
  );

  return (
    <RecordDrawer
      open={sel.open}
      onClose={sel.close}
      eyebrow="Expense"
      title={e ? `${e.category.name} · ${money(e.amount)}` : "Expense"}
      editing={sel.editing && Boolean(e) && !linked}
      view={view}
      edit={e && <ExpenseForm key={e.id} expense={e} frame={editInDrawer} onCancel={() => sel.setEditing(false)} onSaved={() => sel.setEditing(false)} />}
      viewActions={
        e && (
          <>
            <DeleteButton
              path={`/api/expenses/${e.id}`}
              what="this expense"
              blocked={linked ? "Created by Property Tax — change it there" : null}
              onDeleted={sel.close}
              confirmMessage={`${money(e.amount)} · ${e.category.name} on ${formatDate(e.expenseDate)}.`}
            />
            <Spacer />
            {!linked && <EditButton onClick={sel.edit} />}
          </>
        )
      }
    />
  );
}
