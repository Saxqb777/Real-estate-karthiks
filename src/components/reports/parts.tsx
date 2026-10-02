"use client";
// Building blocks shared by the three reports. Each report renders twice from the same components:
//   mode "screen" → the dark, interactive version inside Data → Reports
//   mode "print"  → the light A4 version (portal, only visible when printing)
// Numbers are printed exactly as the API sends them (formatting only — never re-computed here).
import { Check, ChevronDown, IndianRupee, Landmark, CalendarDays, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatedNumber, cx } from "@/components/ui";
import { fmt, inr } from "@/components/hud/format";
import type { ExpenseSlice, Reconciliation, ReconciliationItem } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import s from "./reports.module.css";

export type DocMode = "screen" | "print";

const ModeContext = createContext<DocMode>("screen");
export const useDocMode = () => useContext(ModeContext);

/** Root of one report document (sets the theme and the container for responsive columns). */
export function Doc({ mode, children, className }: { mode: DocMode; children: ReactNode; className?: string }) {
  return (
    <ModeContext.Provider value={mode}>
      <article className={cx(s.doc, mode === "print" ? s.paper : s.screen, className)}>{children}</article>
    </ModeContext.Provider>
  );
}

// ---------------------------------------------------------------- figures

export type Tone = "inc" | "exp" | "signed" | "val" | "occ" | "dim" | "plain";

const toneClass = (tone: Tone, value: number | null | undefined) => {
  if (value === 0 && (tone === "inc" || tone === "exp" || tone === "signed")) return undefined; // ₹0 is calm
  if (tone === "signed") return typeof value === "number" && value < 0 ? s.tExp : undefined;
  return tone === "inc" ? s.tInc : tone === "exp" ? s.tExp : tone === "val" ? s.tVal : tone === "occ" ? s.tOcc : tone === "dim" ? s.tDim : undefined;
};

/** Exact rupees (whole unless paise exist), real minus sign, coloured by meaning. */
export function Money({ v, tone = "plain", className }: { v: number | null | undefined; tone?: Tone; className?: string }) {
  return <span className={cx("num", s.money, toneClass(tone, v), className)}>{inr(v)}</span>;
}

/** "100.0%" */
export const pct = (v: number | null | undefined) => fmt(v, "pct");
/** "335 days" */
export const days = (v: number | null | undefined) => fmt(v, "days");
/** D/M/YYYY */
export const d = (iso: string | null | undefined) => formatDate(iso);

/** Count-up money on screen (game feel), plain text in print. */
function BigMoney({ v, tone }: { v: number | null | undefined; tone: Tone }) {
  const mode = useDocMode();
  const cls = cx("num", s.bigNum, toneClass(tone, v));
  if (mode === "print" || v === null || v === undefined) return <span className={cls}>{inr(v)}</span>;
  const whole = Number.isInteger(Math.round(v * 100) / 100);
  return (
    <span className={cls}>
      <AnimatedNumber value={v} flash={false} duration={0.8} format={(x) => inr(whole ? Math.round(x) : Math.round(x * 100) / 100)} />
    </span>
  );
}

/** "est." / "offer" — paper values never look like cash. */
export function PaperTag({ kind }: { kind: "est." | "offer" }) {
  return (
    <span className={cx(s.paperTag, kind === "offer" && s.paperOffer)} title={kind === "est." ? "Estimate — not cash" : "Best offer received — not cash"}>
      {kind}
    </span>
  );
}

// ---------------------------------------------------------------- equation strip

export interface Term {
  label: ReactNode;
  value: number | null | undefined;
  tone?: Tone;
  /** operator BEFORE this term */
  op?: "+" | "−" | "=" | "×" | "÷";
  /** small line under the value */
  sub?: ReactNode;
  paper?: "est." | "offer";
  /** The result term (stronger frame). */
  result?: boolean;
  /** Custom text instead of money (e.g. ×1.60). */
  text?: string;
}

/** Totals show their arithmetic inline: Rent collected − Expenses = Net cash. */
export function Equation({ terms, className, compact }: { terms: Term[]; className?: string; compact?: boolean }) {
  return (
    <div className={cx(s.eq, compact && s.eqCompact, className)} role="group">
      {terms.map((t, i) => (
        <div key={i} className={s.eqPart}>
          {t.op && (
            <span className={s.eqOp} aria-label={t.op === "−" ? "minus" : t.op === "+" ? "plus" : t.op === "=" ? "equals" : t.op}>
              {t.op}
            </span>
          )}
          <div className={cx(s.eqTerm, t.result && s.eqResult)}>
            <span className={s.eqLabel}>{t.label}</span>
            <span className={cx(s.eqValue, t.paper && s.paperVal)}>
              {t.text !== undefined ? <span className={cx("num", s.bigNum, t.tone && toneClass(t.tone, 1))}>{t.text}</span> : <BigMoney v={t.value} tone={t.tone ?? "plain"} />}
              {t.paper && <PaperTag kind={t.paper} />}
            </span>
            {t.sub && <span className={s.eqSub}>{t.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- sections

export type Bucket = "cash" | "deposits" | "value" | "occupancy" | "people" | "checks";

const BUCKET: Record<Bucket, { icon: ReactNode; color: string }> = {
  cash: { icon: <IndianRupee aria-hidden />, color: "var(--r-inc)" },
  deposits: { icon: <Wallet aria-hidden />, color: "var(--r-ink-dim)" },
  value: { icon: <Landmark aria-hidden />, color: "var(--r-val)" },
  occupancy: { icon: <CalendarDays aria-hidden />, color: "var(--r-occ)" },
  people: { icon: <Wallet aria-hidden />, color: "var(--r-ink-dim)" },
  checks: { icon: <ShieldCheck aria-hidden />, color: "var(--r-inc)" },
};

/** "₹ CASH FLOW ··········· [FY 2025-26]" + a plain one-line note. */
export function Section({
  bucket,
  title,
  scope,
  note,
  children,
  className,
  breakBefore,
}: {
  bucket: Bucket;
  title: ReactNode;
  scope?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  /** print: start this section on a new page */
  breakBefore?: boolean;
}) {
  const b = BUCKET[bucket];
  return (
    <section className={cx(s.section, breakBefore && s.breakBefore, className)} style={{ "--b": b.color } as CSSProperties}>
      <header className={s.secHead}>
        <span className={s.secChip}>{b.icon}</span>
        <h3 className={s.secTitle}>{title}</h3>
        <span className={s.secRule} aria-hidden />
        {scope}
      </header>
      {note && <p className={s.secNote}>{note}</p>}
      {children}
    </section>
  );
}

/** Smaller heading inside a section ("By month", "By unit"). */
export function Sub({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx(s.sub, className)}>
      <div className={s.subHead}>
        <h4 className={s.subTitle}>{title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}

/** "FY 2025-26" / "ALL TIME" / "TO 3/10/2026" */
export function Scope({ children, past, title }: { children: ReactNode; past?: boolean; title?: string }) {
  return (
    <span className={cx(s.scope, past && s.scopePast)} title={title}>
      <CalendarDays aria-hidden />
      {children}
    </span>
  );
}

export function Note({ tone = "plain", children, icon }: { tone?: "plain" | "marigold" | "coral" | "teal"; children: ReactNode; icon?: ReactNode }) {
  return (
    <p className={cx(s.note, tone !== "plain" && s[`note-${tone}`])}>
      {icon}
      <span>{children}</span>
    </p>
  );
}

/** Two-column label / value list. */
export function Facts({ items, cols = 2 }: { items: ({ label: ReactNode; value: ReactNode } | null | false)[]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={s.facts} style={{ "--cols": cols } as CSSProperties}>
      {items.filter(Boolean).map((it, i) => {
        const f = it as { label: ReactNode; value: ReactNode };
        return (
          <div key={i} className={s.fact}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// ---------------------------------------------------------------- tables

export interface Col<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  num?: boolean;
  /** hidden when the report is narrow (phones); always printed */
  wide?: boolean;
  footer?: ReactNode;
  width?: string;
  className?: string;
}

/**
 * Ledger table: hairline rows, right-aligned tabular numbers, and a total row with the accountant's
 * double rule. The total row's figures are the API's totals (they reconcile with the rows — see Checks).
 */
export function RTable<T>({
  cols,
  rows,
  rowKey,
  caption,
  rowClass,
  empty,
  className,
  dense,
}: {
  cols: Col<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  caption: string;
  rowClass?: (row: T) => string | undefined;
  empty?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  const hasFoot = cols.some((c) => c.footer !== undefined);
  const cls = (c: Col<T>) => cx(c.num && s.numCell, c.wide && s.wide, c.className);
  return (
    <div className={cx(s.tableWrap, className)}>
      <table className={cx(s.table, dense && s.dense)}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} className={c.wide ? s.wide : undefined} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col" className={cls(c)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className={s.emptyCell}>
                {empty ?? "Nothing recorded"}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={rowKey(r, i)} className={rowClass?.(r)}>
                {cols.map((c) => (
                  <td key={c.key} className={cls(c)}>
                    {c.cell(r, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {hasFoot && rows.length > 0 && (
          <tfoot>
            <tr>
              {cols.map((c) => (
                <td key={c.key} className={cls(c)}>
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

/** Two-line cell. */
export function Two({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  return (
    <span className={s.two}>
      <span>{top}</span>
      {bottom && <span className={s.twoSub}>{bottom}</span>}
    </span>
  );
}

/** Footer label: "Total · 12 months". */
export function TotalLabel({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className={s.totalLabel}>
      <span>{children}</span>
      {sub && <span className={s.totalSub}>{sub}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- expenses by category

/** Category bars (each category keeps its own colour everywhere). Σ slices = the total in the footer. */
export function CategoryBars({ slices, total, scope }: { slices: ExpenseSlice[]; total: number; scope: ReactNode }) {
  if (slices.length === 0) return <p className={s.calm}>No expenses in this period.</p>;
  const max = Math.max(...slices.map((x) => x.amount), 1);
  return (
    <div className={s.cats}>
      {slices.map((c) => (
        <div key={c.categoryId} className={s.cat}>
          <span className={s.catName}>
            <span className={s.swatch} style={{ background: c.color }} aria-hidden />
            {c.name}
          </span>
          <span className={s.catTrack} aria-hidden>
            <span className={s.catFill} style={{ width: `${(c.amount / max) * 100}%`, background: c.color }} />
          </span>
          <span className={cx("num", s.catShare)}>{pct(c.share)}</span>
          <Money v={c.amount} className={s.catAmt} />
        </div>
      ))}
      <div className={cx(s.cat, s.catTotal)}>
        <span className={s.catName}>
          Total expenses <span className={s.inlineScope}>{scope}</span>
        </span>
        <span />
        <span className={cx("num", s.catShare)}>{pct(1)}</span>
        <Money v={total} tone="exp" className={s.catAmt} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- reconciliation

const isCount = (it: ReconciliationItem) => /days/i.test(it.key) || /days/i.test(it.label);

/** "Ledger balanced ✓" + every check (expected = actual). A failing check is shown in coral — never silently. */
export function Checks({ rec, scope }: { rec: Reconciliation; scope?: ReactNode }) {
  const mode = useDocMode();
  const failing = rec.items.filter((i) => !i.ok);
  const ok = rec.ledgerBalanced && failing.length === 0;
  const [open, setOpen] = useState(!ok);
  const show = mode === "print" || open;
  const value = (it: ReconciliationItem, v: number) => (isCount(it) ? fmt(v, "days") : inr(v));
  return (
    <Section bucket="checks" title="Checks" scope={scope} className={s.checksSec}>
      <div className={cx(s.checks, !ok && s.checksBad)}>
        <div className={s.checksHead}>
          <span className={s.checksBadge}>
            {ok ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
            {ok ? "Ledger balanced" : failing.length === 1 ? "1 total doesn't add up" : `${failing.length} totals don't add up`}
          </span>
          <span className={s.checksText}>
            {ok
              ? `${rec.items.length} checks — every total in this report equals the sum of its parts.`
              : "Something here doesn't reconcile. The rows in coral show what differs — please check those records."}
          </span>
          {mode === "screen" && (
            <button type="button" className={s.checksToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Hide" : "Show"} checks
              <ChevronDown aria-hidden className={cx(s.chev, open && s.chevOpen)} />
            </button>
          )}
        </div>
        {show && (
          <ul className={s.checkList}>
            {rec.items.map((it) => (
              <li key={it.key} className={cx(s.checkItem, !it.ok && s.checkBad)}>
                <span className={s.checkMark} aria-hidden>
                  {it.ok ? "✓" : "!"}
                </span>
                <span className={s.checkLabel}>{it.label}</span>
                <span className={cx("num", s.checkVals)}>
                  {it.ok ? value(it, it.actual) : `${value(it, it.expected)} ≠ ${value(it, it.actual)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

/** Small "Ledger balanced ✓" chip for document headers. */
export function BalancedChip({ rec }: { rec: Reconciliation }) {
  const failing = rec.items.filter((i) => !i.ok).length;
  const ok = rec.ledgerBalanced && failing === 0;
  return (
    <span className={cx(s.balanced, !ok && s.unbalanced)} title={ok ? `${rec.items.length} checks passed` : "See the checks at the end"}>
      {ok ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
      {ok ? "Ledger balanced" : `${failing} ${failing === 1 ? "total doesn't" : "totals don't"} add up`}
    </span>
  );
}

// ---------------------------------------------------------------- document header

/** Title block: kind eyebrow, big title, scope line, generated date, ledger chip. */
export function DocHeader({
  kind,
  title,
  sub,
  chips,
  generated,
  rec,
  right,
}: {
  kind: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  chips?: ReactNode;
  generated: string;
  rec: Reconciliation;
  right?: ReactNode;
}) {
  return (
    <header className={s.docHead}>
      <div className={s.docTitles}>
        <div className={s.docKind}>
          <span className={s.pip} aria-hidden />
          {kind}
        </div>
        <h2 className={s.docTitle}>{title}</h2>
        {sub && <p className={s.docSub}>{sub}</p>}
        {chips && <div className={s.docChips}>{chips}</div>}
      </div>
      <div className={s.docMeta}>
        {right}
        <BalancedChip rec={rec} />
        <span className={s.generated}>Generated {d(generated)}</span>
      </div>
    </header>
  );
}

/** Screen-only "show all" disclosure; in print the content is always shown. */
export function More({ label, children, defaultOpen = false }: { label: (open: boolean) => ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const mode = useDocMode();
  const [open, setOpen] = useState(defaultOpen);
  if (mode === "print") return <>{children}</>;
  return (
    <div className={s.more}>
      <button type="button" className={s.moreBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronDown aria-hidden className={cx(s.chev, open && s.chevOpen)} />
        {label(open)}
      </button>
      {open && <div className={s.moreBody}>{children}</div>}
    </div>
  );
}

/** Coloured status tag used in tables. */
export function Tag({ tone, children, title }: { tone: "teal" | "marigold" | "coral" | "sky" | "grey"; children: ReactNode; title?: string }) {
  return (
    <span className={cx(s.tag, s[`tag-${tone}`])} title={title}>
      {children}
    </span>
  );
}
