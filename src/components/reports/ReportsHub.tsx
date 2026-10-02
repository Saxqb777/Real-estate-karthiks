"use client";
// Data → Reports: pick a report (Annual statement · Unit story · Rent ledger), read it on screen in the app's dark
// style, and print / save it as a clean light A4 PDF. Every figure comes from /api/reports/* (the same
// calculations as the dashboard), so a report always matches the HUD.
import { BookOpenText, CalendarRange, ChevronLeft, ChevronRight, Home, Printer, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Button, EmptyState, IconButton, Kbd, LinkButton, Panel, Select, Skeleton, cx } from "@/components/ui";
import { ChoiceGroup, currentYear, leasePhase, unitLabel, useLeases, useUnits, useYearMode, yearLabel, yearOf, type YearMode } from "@/components/forms";
import { useBrandName } from "@/components/shell/HudBar";
import { useApi } from "@/lib/client";
import type { AnnualReport, RentLedger, UnitReport } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { AnnualStatement } from "./AnnualStatement";
import { RentLedgerReport } from "./RentLedgerReport";
import { UnitStory } from "./UnitStory";
import { Letterhead, PrintPortal, printDocument } from "./print";
import { useReportSelection, type ReportKind } from "./selection";
import s from "./reports.module.css";

const KINDS: { id: ReportKind; label: string; short: string; icon: ReactNode }[] = [
  { id: "annual", label: "Annual statement", short: "Annual", icon: <CalendarRange aria-hidden /> },
  { id: "unit", label: "Unit story", short: "Unit", icon: <Home aria-hidden /> },
  { id: "ledger", label: "Rent ledger", short: "Ledger", icon: <BookOpenText aria-hidden /> },
];

const narrowQuery = "(max-width: 767px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(narrowQuery);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
}

export function ReportsHub() {
  const [sel, update] = useReportSelection();
  const [yearMode, setYearMode] = useYearMode();
  const units = useUnits();
  const leases = useLeases();
  const brand = useBrandName();
  const narrow = useNarrow();
  const bodyRef = useRef<HTMLDivElement>(null);

  // ---- choices
  const unitList = useMemo(() => units.data?.items ?? [], [units.data]);
  const leaseList = useMemo(() => leases.data?.items ?? [], [leases.data]);
  const firstYear = useMemo(() => {
    if (!unitList.length) return null;
    return Math.min(...unitList.map((u) => yearOf(u.purchaseDate, yearMode)));
  }, [unitList, yearMode]);
  const lastYear = currentYear(yearMode);
  const year = firstYear === null ? lastYear : Math.min(lastYear, Math.max(firstYear, sel.year ?? lastYear));

  const unitId = unitList.some((u) => u.id === sel.unitId) ? sel.unitId : (unitList.find((u) => u.isActive)?.id ?? unitList[0]?.id ?? null);
  const leaseGroups = useMemo(
    () => ({
      current: leaseList.filter((l) => leasePhase(l) === "current"),
      incoming: leaseList.filter((l) => leasePhase(l) === "incoming"),
      past: leaseList.filter((l) => leasePhase(l) === "past"),
    }),
    [leaseList],
  );
  const leaseId = leaseList.some((l) => l.id === sel.leaseId)
    ? sel.leaseId
    : (leaseGroups.current[0]?.id ?? leaseGroups.incoming[0]?.id ?? leaseGroups.past[0]?.id ?? null);

  // ---- data (one hook per kind; only the open one fetches)
  const kind = sel.kind;
  const annual = useApi<AnnualReport>(kind === "annual" && unitList.length ? `/api/reports/annual?year=${year}&yearMode=${yearMode}` : null, { keepPrevious: true });
  const unit = useApi<UnitReport>(kind === "unit" && unitId ? `/api/reports/unit/${encodeURIComponent(unitId)}?yearMode=${yearMode}` : null, { keepPrevious: true });
  const ledger = useApi<RentLedger>(kind === "ledger" && leaseId ? `/api/reports/rent-ledger/${encodeURIComponent(leaseId)}` : null, { keepPrevious: true });
  const q = kind === "annual" ? annual : kind === "unit" ? unit : ledger;

  // is the shown data the one asked for? (keepPrevious shows the last report dimmed while the next loads)
  const fresh =
    kind === "annual"
      ? annual.data?.year === year && annual.data?.yearMode === yearMode
      : kind === "unit"
        ? unit.data?.unit.id === unitId && unit.data?.yearMode === yearMode
        : ledger.data?.lease.id === leaseId;

  const selKey = `${kind}|${year}|${unitId}|${leaseId}|${yearMode}`;
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [selKey]);

  // ---- titles (scope words for the tabs, the PDF file name and the running print header)
  const unitRow = unitList.find((u) => u.id === unitId);
  const leaseRow = leaseList.find((l) => l.id === leaseId);
  const scopeOf: Record<ReportKind, string> = {
    annual: yearLabel(year, yearMode),
    unit: unitRow ? unitLabel(unitRow) : "Pick a unit",
    ledger: leaseRow ? `${leaseRow.tenant.name}` : "Pick a lease",
  };
  const docName = `${KINDS.find((k) => k.id === kind)!.label} · ${scopeOf[kind]}`;
  const loaded = q.data && fresh && !q.error ? q.data : null;
  const rec = loaded ? (loaded as { reconciliation: { ledgerBalanced: boolean } }).reconciliation : null;
  const generated = loaded ? formatDate((loaded as { today: string }).today) : "";

  const print = () => printDocument(`${brand} — ${docName} — ${generated}`);

  // ---- render
  const noUnits = units.data && unitList.length === 0;
  const noLeases = kind === "ledger" && leases.data && leaseList.length === 0;

  let content: ReactNode;
  if (noUnits) {
    content = (
      <EmptyState
        title="Reports appear once you add a unit"
        description="Add your townhouses in Config → Units. The annual statement, unit story and rent ledger then fill in on their own."
        action={
          <LinkButton href="/config#units" variant="primary" size="sm">
            Add a unit
          </LinkButton>
        }
      />
    );
  } else if (noLeases) {
    content = (
      <EmptyState
        title="No leases yet"
        description="A rent ledger follows one lease month by month. Sign a lease in Data → Leases first."
        action={
          <LinkButton href="/data#leases" variant="primary" size="sm">
            Go to leases
          </LinkButton>
        }
      />
    );
  } else if (q.error && !q.refreshing) {
    content = (
      <EmptyState
        title="This report couldn't load"
        description={q.error.message}
        action={
          <Button size="sm" icon={<RotateCcw />} onClick={() => void q.reload()}>
            Try again
          </Button>
        }
      />
    );
  } else if (!q.data) {
    content = <DocSkeleton />;
  } else {
    content = (
      <div className={cx(s.docWrap, !fresh && s.stale)} aria-busy={!fresh || undefined}>
        {kind === "annual" && annual.data && <AnnualStatement data={annual.data} mode="screen" />}
        {kind === "unit" && unit.data && <UnitStory data={unit.data} mode="screen" />}
        {kind === "ledger" && ledger.data && <RentLedgerReport data={ledger.data} mode="screen" />}
      </div>
    );
  }

  const yearToggle = (
    <ChoiceGroup<YearMode>
      name="yearMode"
      size="sm"
      aria-label="Year type"
      value={yearMode}
      onChange={setYearMode}
      options={[
        { value: "fy", label: "FY" },
        { value: "calendar", label: "Calendar" },
      ]}
    />
  );

  const years = firstYear === null ? [lastYear] : Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i);
  const scopeControls =
    kind === "annual" ? (
      <div className={s.scopeRow}>
        <div className={s.stepper}>
          <IconButton size="sm" variant="ghost" label="Previous year" icon={<ChevronLeft />} disabled={year <= (firstYear ?? lastYear)} onClick={() => update({ year: year - 1 })} />
          <Select compact aria-label="Year" value={String(year)} onChange={(e) => update({ year: Number(e.target.value) })} className={s.yearSelect}>
            {years.map((y) => (
              <option key={y} value={y}>
                {yearLabel(y, yearMode)}
              </option>
            ))}
          </Select>
          <IconButton size="sm" variant="ghost" label="Next year" icon={<ChevronRight />} disabled={year >= lastYear} onClick={() => update({ year: year + 1 })} />
        </div>
        {yearToggle}
      </div>
    ) : kind === "unit" ? (
      <div className={s.scopeRow}>
        <Select compact aria-label="Unit" value={unitId ?? ""} onChange={(e) => update({ unitId: e.target.value })} className={s.pick}>
          {unitList.map((u) => (
            <option key={u.id} value={u.id}>
              {unitLabel(u)}
              {u.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </Select>
        {yearToggle}
      </div>
    ) : (
      <div className={s.scopeRow}>
        <Select compact aria-label="Lease" value={leaseId ?? ""} onChange={(e) => update({ leaseId: e.target.value })} className={s.pickWide}>
          {(["current", "incoming", "past"] as const).map((g) =>
            leaseGroups[g].length ? (
              <optgroup key={g} label={g === "current" ? "Current" : g === "incoming" ? "Moving in" : "Ended"}>
                {leaseGroups[g].map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.tenant.name} · {l.unit.name}
                    {g === "past" && l.endDate ? ` (to ${formatDate(l.endDate)})` : ""}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </Select>
      </div>
    );

  return (
    <>
      <Panel
        fill
        padding="none"
        eyebrow={narrow ? "Printable" : "Printable · same numbers as the dashboard"}
        title="Reports"
        className={s.hub}
        actions={
          <Button variant="primary" size="sm" icon={<Printer />} onClick={print} disabled={!loaded} title="Opens the print window — choose “Save as PDF” to keep a file">
            {narrow ? "Print" : "Print / Save PDF"}
          </Button>
        }
      >
        <div className={s.toolbar}>
          <KindSwitch value={kind} onChange={(k) => update({ kind: k })} scopes={scopeOf} narrow={narrow} />
          {!noUnits && scopeControls}
        </div>
        <div ref={bodyRef} className={s.hubBody}>
          {content}
        </div>
        <div className={s.hint}>
          <span>
            <Kbd keys={["mod", "p"]} /> prints this report
          </span>
          <span className={s.hintSep} aria-hidden />
          <span>In the print window choose &ldquo;Save as PDF&rdquo; to keep a file</span>
          {rec && (
            <span className={s.hintRight}>
              {rec.ledgerBalanced ? "Ledger balanced ✓" : "Some totals don't add up — see Checks"} · generated {generated}
            </span>
          )}
        </div>
      </Panel>

      {loaded && (
        <PrintPortal
          running={{
            topLeft: `${brand} · பட்டுக்கோட்டை`,
            topRight: docName,
            bottomLeft: `Generated ${generated}${rec ? (rec.ledgerBalanced ? " · Ledger balanced ✓" : " · Totals don't add up — see Checks") : ""}`,
          }}
        >
          <Letterhead brand={brand} town="Pattukottai" right={<span>Generated {generated}</span>} />
          {kind === "annual" && annual.data && <AnnualStatement data={annual.data} mode="print" />}
          {kind === "unit" && unit.data && <UnitStory data={unit.data} mode="print" />}
          {kind === "ledger" && ledger.data && <RentLedgerReport data={ledger.data} mode="print" />}
        </PrintPortal>
      )}
    </>
  );
}

export default ReportsHub;

/** The three reports as document tabs, each showing what it is set to (FY 2026-27 · Unit A · tenant). */
function KindSwitch({ value, onChange, scopes, narrow }: { value: ReportKind; onChange: (k: ReportKind) => void; scopes: Record<ReportKind, string>; narrow: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    const i = KINDS.findIndex((k) => k.id === value);
    let next: ReportKind | undefined;
    if (e.key === "ArrowRight") next = KINDS[(i + 1) % KINDS.length].id;
    else if (e.key === "ArrowLeft") next = KINDS[(i - 1 + KINDS.length) % KINDS.length].id;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-kind="${next}"]`)?.focus());
  };
  return (
    <div ref={ref} role="tablist" aria-label="Report" className={s.kinds} onKeyDown={onKey}>
      {KINDS.map((k) => {
        const on = k.id === value;
        return (
          <button
            key={k.id}
            type="button"
            role="tab"
            data-kind={k.id}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={s.kind}
            onClick={() => onChange(k.id)}
          >
            <span className={s.kindIcon}>{k.icon}</span>
            <span className={s.kindText}>
              <span className={s.kindLabel}>{narrow ? k.short : k.label}</span>
              {!narrow && <span className={s.kindScope}>{scopes[k.id]}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DocSkeleton() {
  return (
    <div className={s.skel} aria-busy="true" aria-label="Loading report">
      <Skeleton width="22%" height={12} />
      <Skeleton width="40%" height={30} />
      <Skeleton width="55%" height={12} />
      <div className={s.skelEq}>
        <Skeleton height={58} block />
        <Skeleton height={58} block />
        <Skeleton height={58} block />
      </div>
      <Skeleton lines={6} />
    </div>
  );
}
