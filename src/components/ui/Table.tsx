"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { EmptyState } from "./EmptyState";
import styles from "./Table.module.css";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Right-aligned, Rajdhani tabular figures (money, counts, days). */
  numeric?: boolean;
  align?: "left" | "center" | "right";
  width?: CSSProperties["width"];
  /** Cells don't wrap by default (narrow screens scroll the table sideways); set for long text like notes. */
  wrap?: boolean;
  /** Enables click-to-sort on this column. */
  sortValue?: (row: T) => number | string | null | undefined;
  /** Footer cell (e.g. totals — compute them with sumAmounts()). */
  footer?: ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  loading?: boolean;
  /** Shown when rows is empty and not loading. */
  empty?: ReactNode;
  caption?: string;
  dense?: boolean;
  /** Constrain height to get a scrolling body with a sticky header. */
  maxHeight?: CSSProperties["maxHeight"];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Hide the footer row even if columns define footers. */
  hideFooter?: boolean;
  /** Fill the parent flex column (e.g. a <Panel fill padding="none">) and scroll inside with a sticky header. */
  fill?: boolean;
  className?: string;
}

type Sort = { key: string; dir: "asc" | "desc" } | null;

/** Data table: sticky header, zebra rows with marigold hover rail, numeric alignment, sorting, empty + loading states. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  loading = false,
  empty,
  caption,
  dense,
  maxHeight,
  defaultSort,
  hideFooter,
  fill,
  className,
}: TableProps<T>) {
  const [sort, setSort] = useState<Sort>(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const out = [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "en-IN", { numeric: true });
      return sort.dir === "asc" ? r : -r;
    });
    return out;
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));

  const alignClass = (c: Column<T>) =>
    cx(c.numeric && styles.numCell, c.align === "right" && styles.right, c.align === "center" && styles.center, c.wrap && styles.wrapText);

  const hasFooter = !hideFooter && columns.some((c) => c.footer !== undefined);
  const showSkeleton = loading && (!rows || rows.length === 0);

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={cx(styles.wrap, fill && styles.fill, className)} style={{ maxHeight }} aria-busy={loading || undefined}>
      <table className={cx(styles.table, dense && styles.dense)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cx(styles.th, alignClass(c), c.className)}
                  style={{ width: c.width }}
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" className={cx(styles.sortBtn, active && styles.sorted)} onClick={() => toggleSort(c.key)}>
                      {c.numeric && (active ? sort!.dir === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden /> : <ArrowUpDown aria-hidden />)}
                      {c.header}
                      {!c.numeric && (active ? sort!.dir === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden /> : <ArrowUpDown aria-hidden />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {showSkeleton
            ? Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className={styles.row}>
                  {columns.map((c, j) => (
                    <td key={c.key} className={cx(styles.td, alignClass(c))}>
                      <div className={styles.skel} style={{ width: `${c.numeric ? 50 : 40 + ((i * 17 + j * 23) % 45)}%`, marginLeft: c.numeric ? "auto" : undefined }} />
                    </td>
                  ))}
                </tr>
              ))
            : sorted && sorted.length > 0
              ? sorted.map((row, i) => {
                  const key = rowKey(row);
                  return (
                    <tr
                      key={key}
                      className={cx(styles.row, onRowClick && styles.clickable, selectedKey === key && styles.selected)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-current={selectedKey === key ? "true" : undefined}
                    >
                      {columns.map((c) => (
                        <td key={c.key} className={cx(styles.td, alignClass(c), c.className)}>
                          {c.cell(row, i)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              : (
                  <tr>
                    <td colSpan={columns.length} className={styles.emptyCell}>
                      {empty ?? <EmptyState compact title="Nothing here yet" />}
                    </td>
                  </tr>
                )}
        </tbody>
        {hasFooter && !showSkeleton && sorted && sorted.length > 0 && (
          <tfoot className={styles.tfoot}>
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={cx(styles.td, alignClass(c))}>
                  {c.footer}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
