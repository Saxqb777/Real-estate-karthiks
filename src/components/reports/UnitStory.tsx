"use client";
// Unit story (GET /api/reports/unit/[id]): purchase → today. Property value (paper), cash flow (cash),
// tenants and deposits, occupancy, the story timeline, and the checks. Same component for screen and print.
import { CalendarX2, DoorClosed, DoorOpen, Flag, HandCoins, Info, KeyRound, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { UnitReport } from "@/lib/dashboard-types";
import { fmt } from "@/components/hud/format";
import { OccupancyStrip, StripLegend, ValueChart } from "./charts";
import {
  CategoryBars,
  Checks,
  Doc,
  Dash,
  DocHeader,
  Drill,
  Equation,
  Facts,
  Keep,
  More,
  Money,
  Note,
  PaperTag,
  RTable,
  Scope,
  Section,
  Sub,
  Tag,
  TotalLabel,
  Two,
  d,
  days,
  pct,
  type DocMode,
} from "./parts";
import s from "./reports.module.css";

type LeaseRow = UnitReport["leases"][number];
type YearRow = UnitReport["byYear"][number];
type OfferRow = UnitReport["offers"][number];
type Story = UnitReport["story"][number];

const STATUS: Record<UnitReport["unit"]["status"], { tone: "teal" | "sky" | "grey" | "marigold"; label: string }> = {
  occupied: { tone: "teal", label: "Occupied" },
  incoming: { tone: "sky", label: "Tenant moving in" },
  vacant: { tone: "sky", label: "Vacant" },
  inactive: { tone: "grey", label: "Inactive" },
};

const STORY_ICON: Record<Story["kind"], ReactNode> = {
  purchase: <KeyRound aria-hidden />,
  "lease-start": <DoorOpen aria-hidden />,
  "lease-end": <DoorClosed aria-hidden />,
  vacant: <CalendarX2 aria-hidden />,
  offer: <HandCoins aria-hidden />,
  expense: <Wrench aria-hidden />,
};

const LEASE_STATE = { current: { tone: "teal", label: "Current" }, incoming: { tone: "sky", label: "Moving in" }, ended: { tone: "grey", label: "Ended" } } as const;

export function UnitStory({ data, mode, onLedger }: { data: UnitReport; mode: DocMode; onLedger?: (leaseId: string) => void }) {
  const u = data.unit;
  const now = data.now;
  const t = data.totals;
  const since = `Since ${d(data.purchase.date)}`;
  const allTime = <Scope>All time</Scope>;
  const asOf = <Scope>As of {d(data.today)}</Scope>;
  const pos = u.position === "front" ? "Front" : u.position === "back" ? "Back" : null;
  const st = STATUS[u.status];
  const yearsLabel = data.byYear.length ? `${data.byYear[0].label} – ${data.byYear[data.byYear.length - 1].label}` : "";

  const yearCols = [
    { key: "y", header: "Year", cell: (y: YearRow) => y.label, footer: <TotalLabel sub={since}>Total</TotalLabel> },
    {
      key: "due",
      header: "Rent fell due",
      num: true,
      wide: true,
      cell: (y: YearRow) => <Two top={<Money v={y.rentExpected} />} bottom={y.collectionPct === null ? "nothing due" : `${pct(y.collectionPct)} received`} />,
    },
    { key: "rent", header: "Rent collected", num: true, cell: (y: YearRow) => <Money v={y.rentCollected} tone="inc" />, footer: <Money v={t.rentCollected} tone="inc" /> },
    { key: "exp", header: "Expenses", num: true, cell: (y: YearRow) => <Money v={y.expenses} tone="exp" />, footer: <Money v={t.expenses} tone="exp" /> },
    { key: "net", header: "Net cash", num: true, cell: (y: YearRow) => <Money v={y.net} tone="signed" />, footer: <Money v={t.netCash} tone="signed" /> },
  ];

  const occCols = [
    { key: "y", header: "Year", cell: (y: YearRow) => y.label, footer: <TotalLabel sub={since}>Total</TotalLabel> },
    { key: "own", header: "Days owned", num: true, wide: true, cell: (y: YearRow) => <span className="num">{fmt(y.daysOwned, "count")}</span>, footer: now ? <span className="num">{fmt(now.daysOwned, "count")}</span> : undefined },
    { key: "vac", header: "Days empty", num: true, cell: (y: YearRow) => <span className="num">{fmt(y.vacantDays, "count")}</span>, footer: <span className="num">{fmt(t.vacantDays, "count")}</span> },
    { key: "occ", header: "Let", num: true, cell: (y: YearRow) => <span className={`num ${s.tOcc}`}>{pct(y.occupancyPct)}</span>, footer: now ? <span className={`num ${s.tOcc}`}>{pct(now.occupancyPct)}</span> : undefined },
    { key: "lost", header: "Rent lost (vacant)", num: true, cell: (y: YearRow) => <Money v={y.rentLost} tone={y.rentLost > 0 ? "occ" : "plain"} />, footer: <Money v={t.rentLost} tone="occ" /> },
  ];

  const leaseCols = [
    {
      key: "who",
      header: "Tenant",
      cell: (l: LeaseRow) => (
        <Two
          top={
            <span className={s.withTag}>
              <Drill onClick={onLedger && (() => onLedger(l.leaseId))} hint={`Open ${l.tenantName}'s rent ledger`}>
                {l.tenantName}
              </Drill>{" "}
              <Tag tone={LEASE_STATE[l.state].tone}>{LEASE_STATE[l.state].label}</Tag>
            </span>
          }
          bottom={`${d(l.start)} – ${l.end ? d(l.end) : "open-ended"} · ${fmt(l.months, "count")} ${l.months === 1 ? "month" : "months"}`}
        />
      ),
      footer: <TotalLabel sub={`${data.leases.length} ${data.leases.length === 1 ? "lease" : "leases"}`}>Total</TotalLabel>,
    },
    { key: "rent", header: "Rent / month", num: true, wide: true, cell: (l: LeaseRow) => <Money v={l.monthlyRent} /> },
    { key: "due", header: "Rent fell due", num: true, wide: true, cell: (l: LeaseRow) => <Money v={l.rentExpected} /> },
    { key: "got", header: "Rent collected", num: true, cell: (l: LeaseRow) => <Money v={l.rentCollected} tone="inc" />, footer: <Money v={t.rentCollected} tone="inc" /> },
    {
      key: "unpaid",
      header: "Unpaid",
      num: true,
      cell: (l: LeaseRow) => (l.rentUnpaid > 0 ? <Money v={l.rentUnpaid} tone="exp" /> : <Dash why="Nothing unpaid" />),
    },
    {
      key: "dep",
      header: "Deposit",
      num: true,
      cell: (l: LeaseRow) => {
        const x = l.deposit;
        const where =
          x.held > 0
            ? "held"
            : x.awaitingRefund > 0
              ? "to refund"
              : x.refunded > 0 || x.kept > 0
                ? [x.refunded > 0 ? `${fmt(x.refunded, "inr")} back${x.refundDate ? ` ${d(x.refundDate)}` : ""}` : null, x.kept > 0 ? `${fmt(x.kept, "inr")} kept` : null].filter(Boolean).join(" · ")
                : x.deposit > 0
                  ? "—"
                  : "none taken";
        return <Two top={<Money v={x.deposit} />} bottom={where} />;
      },
    },
  ];

  const offerCols = [
    { key: "date", header: "Date", width: "96px", cell: (o: OfferRow) => <span className="num">{d(o.date)}</span> },
    { key: "note", header: "From", cell: (o: OfferRow) => o.notes ?? <Dash why="No note recorded" /> },
    {
      key: "amt",
      header: "Offer",
      num: true,
      cell: (o: OfferRow) => (
        <span className={s.withTag}>
          {o.isBest && <Tag tone="marigold">Best</Tag>}
          <Money v={o.amount} tone="val" />
        </span>
      ),
    },
  ];

  return (
    <Doc mode={mode}>
      <DocHeader
        kind="Unit story"
        title={pos ? `${u.name} · ${pos}` : u.name}
        sub={[u.type, `${u.floors} ${u.floors === 1 ? "floor" : "floors"}`, `${fmt(u.builtUpSqft, "count")} sqft`, u.address].filter(Boolean).join(" · ")}
        chips={
          <>
            <Scope>{d(data.purchase.date)} – {d(data.today)}</Scope>
            <Tag tone={st.tone}>{st.label}</Tag>
          </>
        }
        generated={data.today}
        rec={data.reconciliation}
      />

      {/* ─────────── PROPERTY VALUE (paper) ─────────── */}
      <Section bucket="value" title="Property value" scope={asOf} note="On paper — estimates and offers, not cash.">
        {now ? (
          <>
            <Equation
              terms={[
                {
                  label: "Worth now (est.)",
                  value: now.valuation,
                  tone: "val",
                  paper: now.valuationSource === "offer" ? "offer" : "est.",
                  sub: now.valuationSource === "offer" ? `best offer, ${d(now.bestOfferDate)}` : `growth estimate at ${now.annualAppreciationRate}% a year`,
                },
                { op: "−", label: "Invested", value: data.purchase.price, sub: `paid ${d(data.purchase.date)}` },
                { op: "=", label: "Gain", value: now.appreciation, tone: "val", paper: "est.", result: true, sub: `${pct(now.appreciationPct)} on the price` },
              ]}
            />
            <Facts
              cols={4}
              items={[
                { label: "Level (worth ÷ invested)", value: <span className={`num ${s.tVal}`}>{now.capitalMultiplier === null ? "—" : fmt(now.capitalMultiplier, "multiplier")}</span> },
                {
                  label: "Yearly growth (CAGR)",
                  value: now.cagr === null ? <span title={now.cagrNote ?? undefined}>— {now.cagrNote ? `(${now.cagrNote})` : ""}</span> : <span className={`num ${s.tVal}`}>{pct(now.cagr)} a year</span>,
                },
                { label: "Held for", value: <span className="num">{fmt(now.yearsHeld, "years")}</span> },
                {
                  label: "Per sqft",
                  value: (
                    <span className="num">
                      {fmt(data.purchase.perSqft, "inrPerSqft")} → {fmt(now.offeredAtPerSqft, "inrPerSqft")}
                    </span>
                  ),
                },
              ]}
            />
            {now.valuationSource === "offer" && (
              <p className={s.lineNote}>
                Worth now uses the best offer received. The growth estimate ({now.annualAppreciationRate}% a year from the price paid) would be{" "}
                <Money v={now.currentValue} tone="val" /> <PaperTag kind="est." />.
              </p>
            )}
            {now.valuationSource === "estimate" && (
              <Note tone="marigold" icon={<Info aria-hidden />}>
                No offer yet for {u.name} — worth now is the growth estimate ({now.annualAppreciationRate}% a year from the price paid).
              </Note>
            )}
          </>
        ) : (
          <p className={s.calm}>Bought after today — nothing to value yet.</p>
        )}
        <div className={s.cols2}>
          <Sub title="Value over time" keep>
            <ValueChart points={data.valueGrowth.map((p) => ({ date: p.date, label: p.label, estimate: p.estimate, offer: p.bestOfferToDate }))} price={data.purchase.price} />
          </Sub>
          <Sub title={`Offers received · ${data.offers.length}`} keep>
            {data.offers.length ? (
              <RTable caption="Offers" cols={offerCols} rows={data.offers} rowKey={(o) => o.id} dense />
            ) : (
              <p className={s.calm}>No offers recorded yet.</p>
            )}
          </Sub>
        </div>
      </Section>

      {/* ─────────── CASH FLOW ─────────── */}
      <Section bucket="cash" title="Cash flow" scope={allTime} note={`Rent from ${u.name}'s tenants and expenses tagged to ${u.name}. Whole-plot expenses are in the annual statement.`}>
        <Equation
          terms={[
            { label: "Rent collected", value: t.rentCollected, tone: "inc" },
            { op: "−", label: "Expenses", value: t.expenses, tone: "exp" },
            { op: "=", label: "Net cash", value: t.netCash, tone: "signed", result: true },
          ]}
        />
        <div className={s.cols2}>
          <Sub title={`By year · ${yearsLabel}`}>
            <RTable caption="Cash flow by year" cols={yearCols} rows={data.byYear} rowKey={(y) => String(y.year)} dense />
          </Sub>
          <Sub title="Where the money went" keep>
            <CategoryBars slices={data.expensesByCategory} total={t.expenses} scope="All time" />
          </Sub>
        </div>
      </Section>

      {/* ─────────── TENANTS & DEPOSITS ─────────── */}
      <Section bucket="deposits" title="Tenants and deposits" scope={allTime} note="Every lease on this unit. Deposits are the tenants' money held by you — not income.">
        <RTable caption="Leases" cols={leaseCols} rows={data.leases} rowKey={(l) => l.leaseId} empty="No leases yet." keep />
        {now?.nextPayment && now.nextPayment.arrears.months.length > 0 && (
          <Note tone="coral">
            {now.activeLease?.tenantName ?? "The tenant"} owes <Money v={now.nextPayment.arrears.total} tone="exp" /> for{" "}
            {now.nextPayment.arrears.months.map((m) => m.label).join(", ")}
            {now.nextPayment.arrears.lateFees > 0 && (
              <>
                {" "}
                + late fees <Money v={now.nextPayment.arrears.lateFees} tone="exp" /> = <Money v={now.nextPayment.arrears.totalWithFees} tone="exp" />
              </>
            )}
            .{" "}
            {now.activeLease && onLedger && mode === "screen" ? (
              <Drill onClick={() => onLedger(now.activeLease!.id)} hint="Open the rent ledger">
                See each month in the rent ledger
              </Drill>
            ) : (
              "The rent ledger shows each month."
            )}
          </Note>
        )}
      </Section>

      {/* ─────────── OCCUPANCY ─────────── */}
      <Section bucket="occupancy" title="Occupancy" scope={allTime} note="Days let or empty since purchase. Rent lost is what the empty days could have earned — never subtracted from cash.">
        {now && (
          <Equation
            compact
            terms={[
              { label: "Days owned", value: null, text: fmt(now.daysOwned, "count") },
              { op: "−", label: "Days empty", value: null, text: fmt(now.vacantDays, "count") },
              { op: "=", label: "Days let", value: null, text: fmt(now.daysOccupied, "count"), tone: "occ", result: true, sub: `${pct(now.occupancyPct)} of the time` },
            ]}
          />
        )}
        <Keep>
        <OccupancyStrip
          from={data.purchase.date}
          to={data.today}
          ownedFrom={data.purchase.date}
          through={data.today}
          vacant={data.vacancies}
          lets={data.leases.map((l) => ({ start: l.start, end: l.end ?? data.today, label: l.tenantName.split(" ")[0] }))}
          ticks={data.byYear.slice(1).map((y) => ({ at: data.valueGrowth.find((p) => p.label === y.label)?.date ?? "", label: y.label.replace("FY ", "") })).filter((x) => x.at)}
        />
        <StripLegend />
        {data.vacancies.length > 0 && (
          <ul className={s.vacList}>
            {data.vacancies.map((v) => (
              <li key={v.start}>
                Empty {d(v.start)} – {v.ongoing ? `${d(v.lastDay)} (still empty)` : d(v.lastDay)} · {days(v.days)}
                {v.noRentHistory ? (
                  <> · no rent history, so no loss counted</>
                ) : (
                  <>
                    {" "}
                    · <Money v={v.rentBasis} />
                    /month ({v.rentBasisSource === "next-lease" ? "next tenant's rent" : "last tenant's rent"}) × {v.days} ÷ 30 = <Money v={v.unrealizedLoss} tone="occ" />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        </Keep>
        <More label={(open) => (open ? "Hide occupancy by year" : "Occupancy by year")}>
          <Sub title="Occupancy by year">
            <RTable caption="Occupancy by year" cols={occCols} rows={data.byYear} rowKey={(y) => String(y.year)} dense />
          </Sub>
        </More>
      </Section>

      {/* ─────────── STORY ─────────── */}
      <Section bucket="people" title="The story so far" scope={allTime} className={s.storySec}>
        <ol className={s.story}>
          {data.story.map((x, i) => (
            <li key={i} className={s.storyItem} data-kind={x.kind}>
              <span className={s.storyIcon}>{STORY_ICON[x.kind]}</span>
              <span className={`num ${s.storyDate}`}>{d(x.date)}</span>
              <span className={s.storyText}>{x.text}</span>
            </li>
          ))}
          <li className={s.storyItem} data-kind="today">
            <span className={s.storyIcon}>
              <Flag aria-hidden />
            </span>
            <span className={`num ${s.storyDate}`}>{d(data.today)}</span>
            <span className={s.storyText}>
              Today — {st.label.toLowerCase()}
              {now?.activeLease ? `, ${now.activeLease.tenantName} at ${fmt(now.activeLease.monthlyRent, "inr")} a month` : ""}
            </span>
          </li>
        </ol>
        <p className={s.tableNote}>Expenses of ₹20,000 or more are shown in the story; the cash-flow tables include every expense.</p>
      </Section>

      <Checks rec={data.reconciliation} scope={allTime} />
    </Doc>
  );
}
