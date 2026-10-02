"use client";
// "ⓘ How is this calculated?" — the four layers from docs/DESIGN.md, driven ONLY by data.explain[key]
// (built by the same code that computes the figure, so the maths shown is exactly the maths used):
//   1 In words · 2 The formula · 3 With your numbers (steps animate in order) · 4 What went into it (+ marigold notes)
import { ArrowUpRight, ChevronRight, Info } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import type { Explain, ExplainInput, ExplainStep } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { BUCKETS, fmt } from "./format";
import { BucketIcon, Fig, ScopeChip } from "./Figure";
import s from "./explain.module.css";

export interface ExplainViewProps {
  explain: Explain;
  /** A record in layer 4 was clicked (category → its expenses, lease → its payments, …). Return false if not handled. */
  onInput?: (input: ExplainInput) => void;
  /** Which inputs can be opened (default: all when onInput is set). */
  canOpenInput?: (input: ExplainInput) => boolean;
  /** Other figures this one is made of / related to; steps whose label matches a related title become clickable. */
  related?: Explain[];
  onRelated?: (key: string) => void;
  /** Category colours for "category" inputs. */
  colorOf?: (input: ExplainInput) => string | undefined;
  /** Hide the big value header (when the caller already shows it). */
  hideHeader?: boolean;
  /** "past" when the as-of date isn't today. */
  pastScope?: boolean;
  className?: string;
}

const OPS = /[=×÷+−^]|\s-\s/;

/** The four layers, in plain English first. */
export function ExplainView({ explain: e, onInput, canOpenInput, related = [], onRelated, colorOf, hideHeader, pastScope, className }: ExplainViewProps) {
  const relatedByTitle = new Map(related.map((r) => [r.title.toLowerCase(), r]));
  const usedRelated = new Set<string>();
  const stepTarget = (st: ExplainStep) => {
    const r = relatedByTitle.get(st.label.toLowerCase());
    if (r) usedRelated.add(r.key);
    return r;
  };
  const steps = e.steps.map((st) => ({ st, target: onRelated ? stepTarget(st) : undefined }));
  const extra = related.filter((r) => !usedRelated.has(r.key));
  const last = e.steps.length - 1;
  const isPaper = e.bucket === "value";
  const paperKind = isPaper && e.format === "inr" ? (/offer/i.test(e.title) ? "offer" : "est.") : null;

  return (
    <div className={cx(s.root, className)} data-bucket={e.bucket}>
      {!hideHeader && (
        <header className={s.head}>
          <div className={s.headTop}>
            <BucketIcon bucket={e.bucket} />
            <span className={s.bucket}>{BUCKETS[e.bucket].label}</span>
            <ScopeChip kind={e.scope.startsWith("As of") ? "asOf" : "period"} past={pastScope}>
              {e.scope}
            </ScopeChip>
          </div>
          <div className={s.titleRow}>
            <h3 className={s.title}>{e.title}</h3>
            <Fig value={e.value} format={e.format} size="hero" compact={false} tone={e.bucket === "cash" ? "signed" : "neutral"} paper={paperKind} />
          </div>
        </header>
      )}

      <Layer n={1} title="In words">
        <p className={s.plain}>{e.plain}</p>
      </Layer>

      <Layer n={2} title="The formula">
        <p className={s.formula}>{e.formula}</p>
      </Layer>

      <Layer n={3} title="With your numbers">
        <ol className={s.steps}>
          {steps.map(({ st, target }, i) => {
            const inline = !OPS.test(st.expression);
            const final = i === last && e.steps.length > 1;
            const body = (
              <>
                <span className={s.stepLabel}>
                  {st.label}
                  {target && <ChevronRight className={s.stepChev} aria-hidden />}
                </span>
                <span className={cx(s.stepExpr, inline && s.stepExprInline)}>{st.expression}</span>
              </>
            );
            return (
              <motion.li
                key={i}
                className={cx(s.step, inline && s.stepInline, final && s.stepFinal)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: 0.12 + i * 0.14, ease: [0.22, 1, 0.36, 1] }}
              >
                {target ? (
                  <button type="button" className={s.stepBtn} onClick={() => onRelated?.(target.key)} title={`Open ${target.title}`}>
                    {body}
                  </button>
                ) : (
                  <div className={s.stepBody}>{body}</div>
                )}
              </motion.li>
            );
          })}
        </ol>
        {extra.length > 0 && onRelated && (
          <div className={s.related}>
            <span className={s.relatedLabel}>See also</span>
            {extra.map((r) => (
              <button key={r.key} type="button" className={s.relatedChip} onClick={() => onRelated(r.key)}>
                {r.title}
                <span className="num">{fmt(r.value, r.format, true)}</span>
              </button>
            ))}
          </div>
        )}
      </Layer>

      {(e.inputs.length > 0 || e.notes.length > 0) && (
        <Layer n={4} title="What went into it" aside={e.inputsNote}>
          {e.inputs.length > 0 && (
            <ul className={s.inputs}>
              {e.inputs.map((inp, i) => {
                const open = onInput && (canOpenInput ? canOpenInput(inp) : true);
                const color = colorOf?.(inp);
                const content = (
                  <>
                    <span className={s.inKind} data-kind={inp.kind}>
                      {color ? <span className={s.inSwatch} style={{ background: color }} /> : KIND_LABEL[inp.kind]}
                    </span>
                    <span className={s.inLabel}>
                      <span>{inp.label}</span>
                      {inp.date && inp.kind !== "unit" && <span className={s.inDate}>{formatDate(inp.date)}</span>}
                    </span>
                    <span className={cx(s.inValue, "num")}>{inp.value === null ? "—" : fmt(inp.value, "inr")}</span>
                    {open && (inp.kind === "offer" || inp.kind === "setting" ? <ArrowUpRight className={s.inChev} aria-hidden /> : <ChevronRight className={s.inChev} aria-hidden />)}
                  </>
                );
                return (
                  <motion.li
                    key={`${inp.kind}-${inp.id ?? i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: 0.12 + (last + 1) * 0.14 + i * 0.04 }}
                  >
                    {open ? (
                      <button type="button" className={cx(s.input, s.inputBtn)} onClick={() => onInput!(inp)}>
                        {content}
                      </button>
                    ) : (
                      <div className={s.input}>{content}</div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
          {e.notes.length > 0 && (
            <div className={s.notes} role="note">
              <span className={s.notesHead}>Assumptions</span>
              <ul>
                {e.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </Layer>
      )}
    </div>
  );
}

const KIND_LABEL: Record<ExplainInput["kind"], string> = {
  unit: "Unit",
  offer: "Offer",
  payment: "Rent",
  expense: "Spent",
  lease: "Lease",
  setting: "Setting",
  category: "Type",
};

function Layer({ n, title, aside, children }: { n: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.layer}>
      <div className={s.layerHead}>
        <span className={s.layerNum}>{n}</span>
        <span className={s.layerTitle}>{title}</span>
        {aside && <span className={s.layerAside}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** "ⓘ How is this calculated?" link-button used under figures. */
export function HowLink({ onClick, label = "How is this calculated?" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={s.how} onClick={onClick}>
      <Info aria-hidden />
      {label}
    </button>
  );
}
