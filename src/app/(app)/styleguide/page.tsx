"use client";

// Living style guide — every UI-kit component in every state. Used for visual review.
// Deep links for screenshots: /styleguide?demo=modal | drawer | confirm | palette | toasts

import {
  CalendarPlus,
  Coins,
  Filter,
  House,
  IndianRupee,
  Pencil,
  Plus,
  ReceiptIndianRupee,
  Search,
  Trash,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  AnimatedNumber,
  Badge,
  Button,
  ConfirmDialog,
  DateInput,
  Drawer,
  EmptyState,
  Field,
  FormGrid,
  IconButton,
  InspectCard,
  Input,
  Kbd,
  LevelBadge,
  LinkButton,
  Modal,
  NumberInput,
  PageHeader,
  Panel,
  Screen,
  ScrollArea,
  SegmentedBar,
  Select,
  Skeleton,
  Sparkline,
  StatTile,
  StatusPill,
  Table,
  Tabs,
  Textarea,
  Toggle,
  Tooltip,
  confirmDialog,
  toast,
  useCommandPalette,
  useRegisterCommands,
  type Column,
  type StatusKind,
} from "@/components/ui";
import { sumAmounts } from "@/lib/calculations";
import { api, useApi, useMutation } from "@/lib/client";
import type { SettingsDTO } from "@/lib/schemas/settings";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import styles from "./styleguide.module.css";

const SECTIONS = [
  ["tokens", "Tokens"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["tabs", "Tabs"],
  ["status", "Status"],
  ["readouts", "Readouts"],
  ["table", "Table"],
  ["overlays", "Overlays"],
  ["feedback", "Feedback"],
  ["panels", "Panels"],
  ["data", "Data hooks"],
] as const;

function Section({ id, n, title, note, children }: { id: string; n: number; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNo}>{String(n).padStart(2, "0")}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {note && <span className={styles.sectionNote}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- sample data

interface PaymentRow {
  id: string;
  date: string;
  unit: string;
  tenant: string;
  period: string;
  method: string;
  amount: number;
  status: StatusKind;
}

const PAYMENTS: PaymentRow[] = [
  { id: "p1", date: "2026-10-01", unit: "Front unit", tenant: "R. Senthil Kumar", period: "Oct 2026", method: "UPI", amount: 18000, status: "paid" },
  { id: "p2", date: "2026-09-03", unit: "Front unit", tenant: "R. Senthil Kumar", period: "Sep 2026", method: "UPI", amount: 18000, status: "paid" },
  { id: "p3", date: "2026-09-12", unit: "Back unit", tenant: "M. Lakshmi", period: "Sep 2026", method: "Cash", amount: 16500, status: "overdue" },
  { id: "p4", date: "2026-08-02", unit: "Back unit", tenant: "M. Lakshmi", period: "Aug 2026", method: "Bank", amount: 16500, status: "paid" },
  { id: "p5", date: "2026-08-01", unit: "Front unit", tenant: "R. Senthil Kumar", period: "Aug 2026", method: "UPI", amount: 18000, status: "paid" },
];

const COLUMNS: Column<PaymentRow>[] = [
  { key: "date", header: "Paid on", cell: (r) => <span className="num">{formatDate(r.date)}</span>, sortValue: (r) => r.date, footer: <span className="eyebrow">Total</span> },
  { key: "unit", header: "Unit", cell: (r) => r.unit, sortValue: (r) => r.unit },
  { key: "tenant", header: "Tenant", cell: (r) => r.tenant },
  { key: "period", header: "For", cell: (r) => <span className="dim">{r.period}</span> },
  { key: "method", header: "Method", cell: (r) => <Badge size="sm">{r.method}</Badge> },
  { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} size="sm" /> },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    cell: (r) => formatINR(r.amount),
    sortValue: (r) => r.amount,
    footer: <span className="pos">{formatINR(sumAmounts(PAYMENTS))}</span>,
  },
];

const NET_TREND = [12000, 18000, 15500, 34500, 30000, 34500, 21000, 34500, 33000, 34500, 18000, 34500];
const VALUE_TREND = [62, 63, 63.5, 64, 66, 67, 67.5, 69, 70, 71.5, 72, 74.2];

export default function StyleguidePage() {
  // forms
  const [name, setName] = useState("R. Senthil Kumar");
  const [rent, setRent] = useState<number | null>(18000);
  const [price, setPrice] = useState<number | null>(4520000);
  const [badNum, setBadNum] = useState<number | null>(45);
  const [date, setDate] = useState("2026-10-05");
  const [unit, setUnit] = useState("front");
  const [notes, setNotes] = useState("Pays by UPI on the 1st. Prefers WhatsApp reminders.");
  const [late, setLate] = useState(true);
  const [emails, setEmails] = useState(false);
  // readouts
  const [collected, setCollected] = useState(412500);
  const [occupancy, setOccupancy] = useState(0.82);
  // overlays
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [inspect, setInspect] = useState<{ x: number; y: number; unit: "Front" | "Back" } | null>(null);
  const palette = useCommandPalette();
  const openInspect = (e: React.MouseEvent<HTMLButtonElement>, unit: "Front" | "Back") => {
    const r = e.currentTarget.getBoundingClientRect();
    setInspect({ x: r.left + r.width / 2, y: r.top + r.height / 2, unit });
  };

  useRegisterCommands([
    {
      id: "sg:pay",
      group: "Actions",
      title: "Record payment",
      subtitle: "Log rent received for a lease",
      keywords: ["rent", "collect", "money"],
      icon: <IndianRupee />,
      perform: () => toast.coin("Rent collected · Front unit", { amount: 18000, description: "October 2026 · UPI" }),
    },
    { id: "sg:expense", group: "Actions", title: "Add expense", subtitle: "Repairs, tax, utilities…", keywords: ["cost", "bill"], icon: <ReceiptIndianRupee />, perform: () => setDrawer(true) },
    { id: "sg:action", group: "Actions", title: "Add action", subtitle: "A to-do with a due date", keywords: ["todo", "task", "reminder"], icon: <CalendarPlus />, perform: () => setModal(true) },
    { id: "sg:tenant", group: "Actions", title: "Add tenant", keywords: ["person", "renter"], icon: <Users />, perform: () => setModal(true) },
  ]);

  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get("demo");
    const t = window.setTimeout(() => {
      if (demo === "modal") setModal(true);
      if (demo === "drawer") setDrawer(true);
      if (demo === "confirm") setConfirm(true);
      if (demo === "palette") palette.setOpen(true);
      if (demo === "toasts") {
        toast.success("Lease saved", { description: "Front unit · R. Senthil Kumar from 1/10/2026" });
        toast.error("Rent amount must be greater than 0");
        toast.info("Back unit vacant 42 days", { description: "Estimated loss so far ₹23,100" });
        toast.coin("Rent collected · Front unit", { amount: 18000, description: "October 2026 · UPI" });
      }
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const form = (
    <FormGrid cols={2}>
      <Field label="Tenant name" required hint="As written on the rental agreement">
        <Input value={name} onChange={(e) => setName(e.target.value)} icon={<Users />} />
      </Field>
      <Field label="Unit" required>
        <Select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          options={[
            { value: "front", label: "Front unit (A)" },
            { value: "back", label: "Back unit (B)" },
          ]}
        />
      </Field>
      <Field label="Monthly rent" required>
        <NumberInput currency value={rent} onValueChange={setRent} />
      </Field>
      <Field label="Lease start" required>
        <DateInput value={date} onValueChange={setDate} />
      </Field>
      <Field label="Notes" span="full" aside="optional">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormGrid>
  );

  return (
    <Screen>
      <PageHeader
        eyebrow="Design system · v1"
        title="HUD style guide"
        description="Every component of the Pattukottai Estates UI kit in each of its states. Import from @/components/ui."
        actions={
          <>
            <Button variant="secondary" icon={<Search />} onClick={palette.toggle}>
              Commands
            </Button>
            <LinkButton href="/" variant="primary">
              Overview
            </LinkButton>
          </>
        }
      />
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Style guide sections">
          {SECTIONS.map(([id, label], i) => (
            <a key={id} href={`#${id}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </nav>

        <ScrollArea className={styles.sections} fade onScroll={() => inspect && setInspect(null)}>
          {/* ------------------------------------------------ tokens */}
          <Section id="tokens" n={1} title="Tokens" note="warm-dark neutrals · one accent · meaning colours">
            <Panel eyebrow="Colour" title="Palette">
              <div className="stack">
                {[
                  ["Surfaces", ["--bg-0", "--bg-1", "--bg-2", "--bg-3", "--panel", "--panel-strong"]],
                  ["Text & lines", ["--text", "--text-dim", "--text-faint", "--line", "--line-strong"]],
                  ["Brand & meaning", ["--marigold", "--saffron", "--teal", "--coral", "--sky"]],
                  ["Site materials", ["--laterite", "--terracotta", "--palm", "--plaster"]],
                ].map(([group, vars]) => (
                  <div key={group as string} className="stack" style={{ ["--gap" as string]: "8px" }}>
                    <span className="eyebrow">{group as string}</span>
                    <div className={styles.swatches}>
                      {(vars as string[]).map((v) => (
                        <div key={v} className={styles.swatch}>
                          <div className={styles.chip} style={{ background: `var(${v})` }} />
                          <div className={styles.swatchText}>
                            <code>{v}</code>
                            <span>{SWATCH_NOTES[v] ?? ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel eyebrow="Type" title="Rajdhani · Manrope · Noto Sans Tamil">
              <div className={styles.typeRow}>
                <span className="eyebrow">Display 52</span>
                <span className={styles.d52}>₹1,24,50,000</span>
              </div>
              <div className={styles.typeRow}>
                <span className="eyebrow">Display 36</span>
                <span className={styles.d36}>Rent roll ₹34,500 / month</span>
              </div>
              <div className={styles.typeRow}>
                <span className="eyebrow">Title 22</span>
                <span className={styles.d22}>Back unit vacant 42 days</span>
              </div>
              <div className={styles.typeRow}>
                <span className="eyebrow">Label</span>
                <span className="eyebrow">Occupancy · last 12 months</span>
              </div>
              <div className={styles.typeRow}>
                <span className="eyebrow">Body 15</span>
                <p className={styles.body15}>
                  Rent is due on the 1st. A late fee of ₹500 applies after 5 days. Front unit is let to R. Senthil Kumar from 1/10/2026 at
                  ₹18,000 a month with a ₹54,000 deposit.
                </p>
              </div>
              <div className={styles.typeRow}>
                <span className="eyebrow">Tamil</span>
                <span className={styles.tamilSample} lang="ta">
                  பட்டுக்கோட்டை
                </span>
              </div>
              <div className={styles.typeRow}>
                <span className="eyebrow">Frieze</span>
                <div className={styles.bandSample} />
              </div>
            </Panel>
          </Section>

          {/* ------------------------------------------------ buttons */}
          <Section id="buttons" n={2} title="Buttons" note="uppercase Rajdhani · bevelled primary">
            <Panel>
              <div className="stack">
                {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
                  <div key={v} className={styles.row}>
                    <span className={styles.label}>{v}</span>
                    <Button variant={v} size="sm" icon={v === "danger" ? <Trash /> : <Plus />}>
                      Small
                    </Button>
                    <Button variant={v} icon={v === "danger" ? <Trash /> : <Plus />}>
                      {v === "danger" ? "Delete unit" : "Record payment"}
                    </Button>
                    <Button variant={v} size="lg">
                      Large
                    </Button>
                    <Button variant={v} loading>
                      Saving
                    </Button>
                    <Button variant={v} disabled>
                      Disabled
                    </Button>
                  </div>
                ))}
                <div className={styles.row}>
                  <span className={styles.label}>Icon</span>
                  <IconButton label="Edit" icon={<Pencil />} />
                  <IconButton label="Edit" icon={<Pencil />} variant="secondary" />
                  <IconButton label="Filter" icon={<Filter />} variant="secondary" size="sm" />
                  <IconButton label="Delete payment" icon={<Trash />} variant="danger" />
                  <IconButton label="Add" icon={<Plus />} variant="primary" />
                  <IconButton label="Saving" icon={<Plus />} variant="secondary" loading />
                  <span className={styles.label} style={{ marginLeft: 16 }}>
                    Link
                  </span>
                  <LinkButton href="/config" variant="secondary" icon={<Wrench />}>
                    Go to config
                  </LinkButton>
                </div>
              </div>
            </Panel>
          </Section>

          {/* ------------------------------------------------ forms */}
          <Section id="forms" n={3} title="Forms" note="Field wires labels, hints & errors">
            <div className={styles.split}>
              <Panel eyebrow="Lease" title="New lease" accent="marigold">
                {form}
              </Panel>
              <div className="stack">
                <Panel eyebrow="States" title="Validation">
                  <div className="stack">
                    <Field label="Purchase price" hint="What you paid, including registration">
                      <NumberInput currency value={price} onValueChange={setPrice} />
                    </Field>
                    <Field label="Rent due day" error="must be at most 31">
                      <NumberInput value={badNum} onValueChange={setBadNum} decimals={0} hideHint />
                    </Field>
                    <Field label="Built-up area">
                      <NumberInput value={1120} onValueChange={() => {}} suffix="sqft" min={100} max={1000} decimals={0} />
                    </Field>
                    <Field label="Consumer no." hint="TANGEDCO electricity number">
                      <Input placeholder="e.g. 04-123-456-789" />
                    </Field>
                    <Field label="Disabled">
                      <Input value="Locked while a lease is active" disabled readOnly />
                    </Field>
                  </div>
                </Panel>
                <Panel eyebrow="Switches" title="Toggles">
                  <div className="stack" style={{ ["--gap" as string]: "14px" }}>
                    <Toggle checked={late} onChange={setLate} label="Late fee" description="₹500 after 5 grace days" />
                    <Toggle checked={emails} onChange={setEmails} label="Email me pending actions" />
                    <Toggle checked size="sm" onChange={() => {}} label="Small, on" />
                    <Toggle checked={false} disabled onChange={() => {}} label="Disabled" />
                  </div>
                </Panel>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ tabs */}
          <Section id="tabs" n={4} title="Tabs" note="arrow keys · hash-aware option">
            <Panel>
              <div className="stack" style={{ ["--gap" as string]: "26px" }}>
                <Tabs
                  label="Data sections"
                  items={[
                    { id: "tenants", label: "Tenants", icon: <Users />, count: 2 },
                    { id: "leases", label: "Leases", count: 3 },
                    { id: "payments", label: "Payments", icon: <Wallet />, count: 14 },
                    { id: "expenses", label: "Expenses", count: 9 },
                    { id: "tax", label: "Property tax", count: 1, alert: true },
                    { id: "actions", label: "Actions", count: 4 },
                  ]}
                  hash
                >
                  {(active) => (
                    <div className={styles.tabDemo}>
                      <EmptyState compact title={`${active[0].toUpperCase()}${active.slice(1)} panel`} description="Hash-aware: the URL becomes /styleguide#… and survives reloads." />
                    </div>
                  )}
                </Tabs>
                <div className={styles.row}>
                  <Tabs
                    label="Year"
                    variant="segment"
                    defaultValue="2026"
                    items={[
                      { id: "all", label: "All time" },
                      { id: "2024", label: "2024" },
                      { id: "2025", label: "2025" },
                      { id: "2026", label: "2026" },
                    ]}
                  />
                  <Tabs
                    label="Scope"
                    variant="segment"
                    size="sm"
                    items={[
                      { id: "plot", label: "Whole plot" },
                      { id: "front", label: "Front" },
                      { id: "back", label: "Back" },
                    ]}
                  />
                </div>
              </div>
            </Panel>
          </Section>

          {/* ------------------------------------------------ status */}
          <Section id="status" n={5} title="Status" note="same language as the 3D world">
            <Panel>
              <div className="stack">
                <div className={styles.row}>
                  <span className={styles.label}>Units</span>
                  <StatusPill status="occupied" />
                  <StatusPill status="vacant" />
                  <StatusPill status="inactive" />
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>Rent</span>
                  <StatusPill status="paid" />
                  <StatusPill status="due-soon" label="Due 5 Oct" />
                  <StatusPill status="overdue" label="Overdue 6 days" />
                  <StatusPill status="none" />
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>Other</span>
                  <StatusPill status="pending" />
                  <StatusPill status="done" />
                  <StatusPill status="due" />
                  <StatusPill status="active" size="sm" />
                  <StatusPill status="past" size="sm" />
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>Badges</span>
                  {(["neutral", "marigold", "teal", "coral", "sky", "laterite", "grey", "ghost"] as const).map((t) => (
                    <Badge key={t} tone={t}>
                      {t}
                    </Badge>
                  ))}
                  <Badge tone="marigold" icon={<House />}>
                    2BHK
                  </Badge>
                </div>
              </div>
            </Panel>
          </Section>

          {/* ------------------------------------------------ readouts */}
          <Section id="readouts" n={6} title="Readouts" note="one dominant number per section">
            <div className={styles.kpiGrid}>
              <StatTile
                size="hero"
                roll
                label="Portfolio value"
                icon={<Coins />}
                value={12450000}
                format="inr"
                tone="marigold"
                delta={{ value: 0.083, label: "CAGR" }}
                caption="Best offers for both units · bought for ₹74.2 L in 2019"
                sparkline={<Sparkline data={VALUE_TREND} tone="marigold" height={44} label="Value, last 12 months" />}
              />
              <StatTile
                label="Rent collected"
                value={collected}
                format="inr"
                delta={{ value: 0.12, label: "vs 2025" }}
                caption="All time, 2 units"
                sparkline={<Sparkline data={NET_TREND} tone="teal" />}
                footer={
                  <div className={styles.row} style={{ justifyContent: "space-between" }}>
                    <span>Change the value</span>
                    <Button size="sm" variant="secondary" onClick={() => setCollected((c) => c + 18000)}>
                      +₹18,000
                    </Button>
                  </div>
                }
              />
              <div className="stack">
                <Panel padding="sm">
                  <LevelBadge value={1.68} title="Capital multiplier" caption="Next tier at 2.00×" />
                </Panel>
                <Panel padding="sm">
                  <SegmentedBar label="Occupancy" value={occupancy} tone="teal" marker={0.9} ticks />
                  <div className={styles.row} style={{ marginTop: 10 }}>
                    <Button size="sm" variant="ghost" onClick={() => setOccupancy((o) => Math.max(0, +(o - 0.1).toFixed(2)))}>
                      −10%
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOccupancy((o) => Math.min(1, +(o + 0.1).toFixed(2)))}>
                      +10%
                    </Button>
                  </div>
                </Panel>
              </div>
            </div>
            <Panel eyebrow="Supporting figures" title="Rail readouts">
              <div className={styles.rails}>
                <StatTile variant="rail" size="sm" label="Monthly rent roll" value={34500} format="inr" />
                <StatTile variant="rail" size="sm" label="Expenses (2026)" value={48210} format="inr" tone="coral" delta={{ value: -0.06, goodWhen: "down" }} />
                <StatTile variant="rail" size="sm" label="Vacant days" value={42} caption="Back unit" />
                <StatTile variant="rail" size="sm" label="Deposits held" value={87000} format="inr-compact" />
              </div>
            </Panel>
            <div className={styles.split3}>
              <Panel eyebrow="Levels" title="Tiers">
                <div className="stack" style={{ ["--gap" as string]: "14px" }}>
                  <LevelBadge value={0.92} size="sm" title="Below cost" showTier={false} caption="0.92× of invested" />
                  <LevelBadge value={1.12} size="sm" title="Capital ×" />
                  <LevelBadge value={1.48} size="sm" title="Capital ×" />
                  <LevelBadge value={2.3} size="sm" title="Capital ×" />
                </div>
              </Panel>
              <Panel eyebrow="Progress" title="Segmented bars">
                <div className="stack">
                  <SegmentedBar label="Quest log" value={3} max={6} segments={6} valueLabel="3 / 6" size="lg" />
                  <SegmentedBar label="Collected this month" value={0.5} tone="marigold" />
                  <SegmentedBar label="Overdue share" value={0.18} tone="coral" size="sm" />
                  <SegmentedBar label="Empty" value={0} tone="sky" size="sm" />
                </div>
              </Panel>
              <Panel eyebrow="Numbers" title="Animated">
                <div className="stack">
                  <div className={styles.row}>
                    <span className={styles.label}>Count</span>
                    <AnimatedNumber value={collected} format="inr" className={styles.d22} />
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Roll</span>
                    <AnimatedNumber value={collected} format="inr" mode="roll" className={styles.d22} />
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Compact</span>
                    <AnimatedNumber value={collected * 30} format="inr-compact" className={styles.d22} />
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Percent</span>
                    <AnimatedNumber value={occupancy} format="percent" className={styles.d22} />
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Empty</span>
                    <AnimatedNumber value={null} className={styles.d22} />
                  </div>
                </div>
              </Panel>
            </div>
          </Section>

          {/* ------------------------------------------------ table */}
          <Section id="table" n={7} title="Table" note="sortable · sticky header · totals via sumAmounts()">
            <Panel
              eyebrow="Ledger"
              title="Rent payments"
              padding="none"
              actions={
                <>
                  <Select compact defaultValue="2026" options={[{ value: "2026", label: "2026" }, { value: "2025", label: "2025" }]} aria-label="Year" />
                  <Button size="sm" variant="primary" icon={<Plus />}>
                    Record
                  </Button>
                </>
              }
            >
              <Table columns={COLUMNS} rows={PAYMENTS} rowKey={(r) => r.id} onRowClick={(r) => toast.info(`Open payment ${r.id}`)} selectedKey="p3" maxHeight={340} defaultSort={{ key: "date", dir: "desc" }} caption="Rent payments" />
            </Panel>
            <div className={styles.split}>
              <Panel eyebrow="Loading" title="Skeleton rows" padding="none">
                <Table columns={COLUMNS.slice(0, 4)} rows={undefined} rowKey={(r) => r.id} loading dense />
              </Panel>
              <Panel eyebrow="Empty" title="No expenses yet" padding="none">
                <Table
                  columns={COLUMNS.slice(0, 3)}
                  rows={[]}
                  rowKey={(r) => r.id}
                  empty={<EmptyState compact title="No expenses in 2026" description="Repairs, tax and bills you add show up here." action={<Button size="sm" variant="primary" icon={<Plus />}>Add expense</Button>} />}
                />
              </Panel>
            </div>
          </Section>

          {/* ------------------------------------------------ overlays */}
          <Section id="overlays" n={8} title="Overlays" note="focus-trapped · Esc closes · Ctrl/⌘K">
            <Panel>
              <div className="stack">
                <div className={styles.demoBar}>
                  <Button variant="secondary" onClick={() => setModal(true)}>
                    Open modal
                  </Button>
                  <Button variant="secondary" onClick={() => setDrawer(true)}>
                    Open drawer
                  </Button>
                  <Button variant="danger" icon={<Trash />} onClick={() => setConfirm(true)}>
                    Delete (confirm)
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const ok = await confirmDialog({ title: "Mark tax as paid?", message: "This also adds a ₹4,820 expense under Property Tax.", confirmLabel: "Mark paid" });
                      toast.info(ok ? "Confirmed" : "Cancelled");
                    }}
                  >
                    confirmDialog()
                  </Button>
                  <Button variant="secondary" icon={<Search />} onClick={palette.toggle}>
                    Command palette <Kbd keys={["mod", "k"]} />
                  </Button>
                </div>
                <div className={styles.demoBar}>
                  <Button size="sm" variant="secondary" onClick={() => toast.success("Lease saved", { description: "Front unit · R. Senthil Kumar from 1/10/2026" })}>
                    Success toast
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => toast.error("Rent amount must be greater than 0")}>
                    Error toast
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => toast.info("Back unit vacant 42 days", { description: "Estimated loss so far ₹23,100", action: { label: "Find a tenant", onClick: () => {} } })}>
                    Info toast
                  </Button>
                  <Button size="sm" variant="primary" icon={<Coins />} onClick={() => toast.coin("Rent collected · Front unit", { amount: 18000, description: "October 2026 · UPI" })}>
                    Coin toast
                  </Button>
                </div>
              </div>
            </Panel>
          </Section>

          {/* ------------------------------------------------ feedback */}
          <Section id="feedback" n={9} title="Feedback" note="empty · loading · hints">
            <div className={styles.split}>
              <div className="stack">
                <EmptyState
                  title="No tenants yet"
                  description="Add the people renting your units. You'll pick them when you sign a lease."
                  action={
                    <>
                      <Button variant="primary" icon={<Plus />}>
                        Add tenant
                      </Button>
                      <LinkButton href="/config" variant="ghost">
                        Set up units first
                      </LinkButton>
                    </>
                  }
                />
                <EmptyState compact title="Nothing pending" description="All actions are done." />
              </div>
              <Panel eyebrow="Loading" title="Skeletons">
                <div className="stack">
                  <Skeleton width="40%" height={28} />
                  <Skeleton lines={3} />
                  <Skeleton block height={90} />
                </div>
              </Panel>
            </div>
            <Panel eyebrow="Hints" title="Tooltips & keys">
              <div className={styles.row}>
                <Tooltip content="Due on the 1st of each month; late fee after 5 days">
                  <Badge tone="marigold" marker>
                    Due 1st
                  </Badge>
                </Tooltip>
                <Tooltip content="Best offer ₹62 L received 12/8/2026" placement="bottom">
                  <Button size="sm" variant="ghost">
                    Hover me
                  </Button>
                </Tooltip>
                <IconButton label="Delete this payment" icon={<Trash />} variant="secondary" />
                <span className="dim" style={{ marginLeft: 12 }}>
                  Open palette
                </span>
                <Kbd keys={["mod", "k"]} />
                <span className="dim">close</span>
                <Kbd>Esc</Kbd>
                <span className="dim">move</span>
                <Kbd keys={["up"]} />
                <Kbd keys={["down"]} />
              </div>
            </Panel>
          </Section>

          {/* ------------------------------------------------ panels */}
          <Section id="panels" n={10} title="Panels" note="solid textured · blur only over the 3D scene">
            <div className={styles.split3}>
              <Panel eyebrow="Default" title="Front unit" actions={<StatusPill status="occupied" size="sm" />}>
                <p className="dim">Solid panel, grain texture, corner brackets, marigold lead-in under the header.</p>
              </Panel>
              <Panel eyebrow="Strong + accent" title="Rent overdue" variant="strong" accent="coral" actions={<StatusPill status="overdue" size="sm" />}>
                <p className="dim">Back unit · M. Lakshmi · ₹16,500 for September, 6 days late.</p>
              </Panel>
              <Panel eyebrow="Hero" title="Quest log" band accent="marigold" interactive footer={<Button size="sm" variant="primary">Continue</Button>}>
                <SegmentedBar value={3} max={6} segments={6} valueLabel="3 of 6 done" label="Setup" />
              </Panel>
              <Panel variant="sunken" padding="sm">
                <p className="dim">Sunken well — for grouped inputs or secondary detail.</p>
              </Panel>
              <Panel eyebrow="Laterite" title="Plot" accent="laterite" padding="sm">
                <p className="dim">22′3″ front · 23′3″ back · 76′ deep · 1,744 sqft</p>
              </Panel>
              <Panel eyebrow="Teal" title="Paid up" accent="teal" padding="sm">
                <p className="dim">Both units paid for October.</p>
              </Panel>
            </div>
            <div className={styles.scene}>
              <button type="button" className={styles.marker} style={{ left: "30%", top: "62%" }} onClick={(e) => openInspect(e, "Front")} aria-label="Inspect front unit" />
              <button type="button" className={styles.marker} style={{ left: "70%", top: "70%" }} onClick={(e) => openInspect(e, "Back")} aria-label="Inspect back unit" />
              <Panel variant="glass" eyebrow="Over the 3D scene" title="Front unit" padding="sm" className={styles.sceneHud} actions={<StatusPill status="paid" size="sm" />}>
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <span className="dim">R. Senthil Kumar</span>
                  <span className="num" style={{ fontSize: 20 }}>
                    ₹18,000
                  </span>
                </div>
              </Panel>
            </div>
          </Section>

          {/* ------------------------------------------------ data hooks */}
          <Section id="data" n={11} title="Data hooks" note="src/lib/client.ts — live against /api/settings">
            <LiveApiDemo />
          </Section>
        </ScrollArea>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        eyebrow="Leases"
        title="New lease"
        description="Front unit · rent due on the 1st"
        size="lg"
        closeOnBackdrop={false}
        onSubmit={(e) => {
          e.preventDefault();
          setModal(false);
          toast.success("Lease saved", { description: `${name} · ${formatINR(rent)} / month` });
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save lease
            </Button>
          </>
        }
      >
        {form}
      </Modal>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        eyebrow="Expenses"
        title="Add expense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDrawer(false);
                toast.success("Expense added", { description: "Plumbing · Back unit · ₹2,400" });
              }}
            >
              Add expense
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Amount" required>
            <NumberInput currency value={2400} onValueChange={() => {}} />
          </Field>
          <Field label="Date" required>
            <DateInput value="2026-09-28" />
          </Field>
          <Field label="Category">
            <Select defaultValue="repairs" options={[{ value: "repairs", label: "Repairs" }, { value: "tax", label: "Property Tax" }, { value: "eb", label: "Electricity" }]} />
          </Field>
          <Field label="Applies to">
            <Tabs label="Applies to" variant="segment" size="sm" items={[{ id: "plot", label: "Whole plot" }, { id: "front", label: "Front" }, { id: "back", label: "Back" }]} defaultValue="back" />
          </Field>
          <Field label="Note">
            <Textarea defaultValue="Kitchen tap replaced by Murugan" />
          </Field>
        </div>
      </Drawer>

      <InspectCard
        open={Boolean(inspect)}
        anchor={inspect}
        onClose={() => setInspect(null)}
        onExpand={() => {
          setInspect(null);
          setDrawer(true);
        }}
        eyebrow="Inspect · unit"
        title={`${inspect?.unit ?? "Front"} unit`}
        aside={<StatusPill status={inspect?.unit === "Back" ? "overdue" : "paid"} size="sm" />}
        actions={
          <>
            <Button size="sm" variant="primary" icon={<IndianRupee />} onClick={() => toast.coin("Rent collected · Front unit", { amount: 18000 })}>
              Record rent
            </Button>
            <Button size="sm" variant="secondary" icon={<ReceiptIndianRupee />} onClick={() => setDrawer(true)}>
              Expense
            </Button>
          </>
        }
      >
        <div className="stack" style={{ ["--gap" as string]: "10px" }}>
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <span className="dim">{inspect?.unit === "Back" ? "M. Lakshmi" : "R. Senthil Kumar"}</span>
            <span className="num" style={{ fontSize: 20 }}>
              {inspect?.unit === "Back" ? "₹16,500" : "₹18,000"}
            </span>
          </div>
          <SegmentedBar label="Occupancy" value={inspect?.unit === "Back" ? 0.71 : 0.94} tone="teal" size="sm" />
        </div>
      </InspectCard>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => new Promise((r) => setTimeout(r, 900)).then(() => toast.success("Unit deleted"))}
        tone="danger"
        title="Delete Back unit?"
        message={
          <>
            This removes <b>Back unit</b> and its 2 offers. Units with leases or expenses can’t be deleted — mark them inactive instead.
          </>
        }
        confirmLabel="Delete unit"
      />
    </Screen>
  );
}

function LiveApiDemo() {
  const { data, loading, error, refreshing, reload } = useApi<SettingsDTO>("/api/settings");
  const save = useMutation((body: Partial<SettingsDTO>) => api<SettingsDTO>("/api/settings", { method: "PUT", body }), {
    success: "Settings saved · open panels refreshed",
  });
  const bad = useMutation(() => api<SettingsDTO>("/api/settings", { method: "PUT", body: { rentDueDay: 99 } }), { invalidate: false });
  return (
    <Panel
      eyebrow="Live"
      title="useApi · useMutation · invalidate"
      actions={
        <Badge tone={refreshing ? "marigold" : "teal"} marker>
          {refreshing ? "Fetching" : "Cached"}
        </Badge>
      }
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => void reload()}>
            Reload
          </Button>
          <Button size="sm" variant="danger" loading={bad.loading} onClick={() => void bad.run()}>
            Send invalid value
          </Button>
          <Button size="sm" variant="primary" loading={save.loading} disabled={!data} onClick={() => data && void save.run({ brandName: data.brandName })}>
            Re-save settings
          </Button>
        </>
      }
    >
      {loading ? (
        <Skeleton lines={3} />
      ) : error ? (
        <EmptyState compact title="Couldn’t load settings" description={error.message} action={<Button size="sm" onClick={() => void reload()}>Try again</Button>} />
      ) : (
        <FormGrid cols={3}>
          <Field label="Brand name" hint="Shown in the HUD bar">
            <Input value={data?.brandName ?? ""} readOnly />
          </Field>
          <Field label="Rent due day" error={bad.fieldErrors.rentDueDay}>
            <Input value={String(data?.rentDueDay ?? "")} readOnly />
          </Field>
          <Field label="Late fee">
            <Input value={data?.lateFeeEnabled ? `${formatINR(data.lateFeeAmount)} after ${data.lateFeeGraceDays} days` : "Off"} readOnly />
          </Field>
        </FormGrid>
      )}
    </Panel>
  );
}

const SWATCH_NOTES: Record<string, string> = {
  "--bg-0": "page",
  "--bg-1": "bars, table heads",
  "--bg-2": "raised",
  "--bg-3": "tooltips",
  "--panel": "panels",
  "--panel-strong": "dialogs",
  "--text": "primary text",
  "--text-dim": "secondary",
  "--text-faint": "tertiary",
  "--line": "hairlines",
  "--line-strong": "borders",
  "--marigold": "brand · focus · primary",
  "--saffron": "brand gradient end",
  "--teal": "income · paid · occupied",
  "--coral": "expense · overdue",
  "--sky": "info · vacant blueprint",
  "--laterite": "red earth",
  "--terracotta": "parapet · bronze",
  "--palm": "coconut palm",
  "--plaster": "lime plaster · kolam",
};
