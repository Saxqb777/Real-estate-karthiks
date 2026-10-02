"use client";
import { Lock, Plus } from "lucide-react";
import { Button, Panel, Table, Tooltip, type Column } from "@/components/ui";
import { Dot, ScopeChip, closeQuickAdd, quickAdd, useCategories } from "@/components/forms";
import { sumAmounts } from "@/lib/calculations";
import { formatINR } from "@/lib/format";
import { categoryInUseMessage, defaultCategoryDeleteMessage, type ExpenseCategoryDTO } from "@/lib/schemas/expense-category";
import { DeleteButton, useNarrow } from "../data/shared";
import s from "./config.module.css";

const LOCK_TIP = "Built-in — reports and automatic property-tax expenses use this name, so it can't be renamed or deleted. Its colour can change.";

/** Expense categories with their colour, how many expenses use them and the all-time total. */
export function CategoriesTab() {
  const cats = useCategories();
  const narrow = useNarrow();
  const items = cats.data?.items;
  const total = items ? sumAmounts(items.map((c) => ({ amount: c.total }))) : 0;
  const count = items?.reduce((n, c) => n + c.expenseCount, 0) ?? 0;

  const edit = (c: ExpenseCategoryDTO) => {
    const blocked = c.isDefault ? defaultCategoryDeleteMessage(c.name) : c.expenseCount ? categoryInUseMessage(c.name, c.expenseCount) : null;
    quickAdd("category", {
      category: c,
      actionsLeft: <DeleteButton path={`/api/expense-categories/${c.id}`} what={`category “${c.name}”`} blocked={blocked} onDeleted={closeQuickAdd} />,
    });
  };

  const columns: Column<ExpenseCategoryDTO>[] = [
    {
      key: "name",
      header: "Category",
      cell: (c) => (
        <span className={s.catName}>
          <Dot color={c.color} size={12} />
          {c.name}
          {c.isDefault && (
            <Tooltip content={LOCK_TIP}>
              <span className={s.lock} tabIndex={0} aria-label="Built-in category">
                <Lock aria-hidden />
              </span>
            </Tooltip>
          )}
        </span>
      ),
      footer: items?.length ? (
        <span className={s.footLabel}>
          Total <ScopeChip>All time</ScopeChip>
        </span>
      ) : undefined,
    },
    ...(narrow ? [] : [{ key: "colour", header: "Colour", cell: (c: ExpenseCategoryDTO) => <span className={`${s.hex} num`}>{c.color}</span> }]),
    { key: "count", header: "Expenses", numeric: true, sortValue: (c) => c.expenseCount, cell: (c) => (c.expenseCount ? c.expenseCount : <span className="faint">0</span>), footer: items?.length ? count : undefined },
    {
      key: "total",
      header: "Spent",
      numeric: true,
      sortValue: (c) => c.total,
      cell: (c) => (c.total ? formatINR(c.total, c.total % 1 !== 0) : <span className="faint">₹0</span>),
      footer: items?.length ? <span className="neg">{formatINR(total, total % 1 !== 0)}</span> : undefined,
    },
  ];

  return (
    <Panel
      fill
      padding="none"
      eyebrow="Expenses"
      title="Categories"
      actions={
        <Button size="sm" variant="primary" icon={<Plus />} onClick={() => quickAdd("category")}>
          New category
        </Button>
      }
    >
      <p className={s.panelNote}>
        <Lock aria-hidden /> Built-in categories keep their names (reports and the automatic property-tax expenses rely on them) — you can still recolour them.
        Each colour is used for its category in every chart, table and legend.
      </p>
      <Table fill columns={columns} rows={items} loading={cats.loading} rowKey={(c) => c.id} onRowClick={edit} caption="Expense categories" />
    </Panel>
  );
}
