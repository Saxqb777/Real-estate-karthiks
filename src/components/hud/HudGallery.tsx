"use client";
// /hud-gallery — every HUD building block with live /api/dashboard data, in the arrangements the Overview uses.
// Stages (?stage=): game (the composed game screen) · panels · inspect · explain · dock · bits
// Screenshot params: left=1 · right=unit:<id|front|back>|mailbox|noticeboard|pole|tax · tab=<dock tab> · world=0|1
//                    card=<kind>[:front|back] · hover=<kind>[:front|back] · radial=front|back · key=<explain key> · drill=<a>,<b>,… · asof=YYYY-MM-DD
import { Map as MapIcon, PanelLeft } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import EstateSceneLazy from "@/components/estate/EstateSceneLazy";
import { Button, EmptyState, Kbd, Screen, Skeleton, cx } from "@/components/ui";
import { usePropertyTax } from "@/components/forms";
import type { DashboardData } from "@/lib/dashboard-types";
import { sceneUnitsFromBreakdown } from "@/lib/site-layout";
import { Dock, DOCK_TABS } from "./Dock";
import { DrillPanel, useDrillStack, type DrillStack } from "./DrillDown";
import { ExplainView } from "./ExplainView";
import { BucketHead, Fig, FigLine, PaperTag, ScopeChip } from "./Figure";
import { HudPanelFor, InspectLayer, useInspect, WorldHint, type InspectController } from "./Inspect";
import { LedgerBadge } from "./LedgerBadge";
import { PeriodControl, useHudDashboard } from "./PeriodControl";
import { PropertyPanel } from "./PropertyPanel";
import { StatusChips } from "./StatusChips";
import { usePeriod } from "./store";
import type { ChipTarget, DockTab, DrillView, PanelTarget, SceneObject, SceneObjectKind } from "./types";
import s from "./gallery.module.css";

export type GalleryStage = "game" | "panels" | "inspect" | "explain" | "dock" | "bits";
export type GalleryParams = Partial<Record<"stage" | "left" | "right" | "tab" | "world" | "card" | "hover" | "radial" | "key" | "drill" | "period" | "asof", string>>;

const STAGES: { id: GalleryStage; label: string }[] = [
  { id: "game", label: "Game screen" },
  { id: "panels", label: "Panels" },
  { id: "inspect", label: "Inspect" },
  { id: "explain", label: "Show the maths" },
  { id: "dock", label: "Dock" },
  { id: "bits", label: "Chips & bits" },
];

export default function HudGallery({ initial }: { initial: GalleryParams }) {
  const dash = useHudDashboard(initial.asof);
  const [stage, setStage] = useState<GalleryStage>((STAGES.find((x) => x.id === initial.stage)?.id ?? "game") as GalleryStage);
  const [storedPeriod, setPeriod] = usePeriod();
  const period = (initial.period as typeof storedPeriod | undefined) ?? storedPeriod;
  const data = dash.data;

  const go = (id: GalleryStage) => {
    setStage(id);
    const u = new URL(window.location.href);
    u.search = id === "game" ? "" : `?stage=${id}`;
    window.history.replaceState(null, "", u);
  };

  return (
    <Screen flush contained={false} className={s.screen}>
      <header className={s.top}>
        <div className={s.brand}>
          <span className={s.kicker}>Round 2 · building blocks</span>
          <h1 className={s.h1}>HUD gallery</h1>
        </div>
        <nav className={s.stages} aria-label="Gallery stages">
          {STAGES.map((st) => (
            <button key={st.id} type="button" className={cx(s.stageBtn, st.id === stage && s.stageOn)} onClick={() => go(st.id)}>
              {st.label}
            </button>
          ))}
        </nav>
        {data && stage !== "game" && <PeriodControl data={data} period={period} onPeriodChange={setPeriod} size="sm" />}
      </header>
      <div className={s.stage}>
        {!data ? (
          dash.error ? (
            <EmptyState title="Couldn't load the dashboard" description={dash.error.message} />
          ) : (
            <div className={s.loading}>
              <Skeleton block height={240} />
            </div>
          )
        ) : stage === "game" ? (
          <GameStage data={data} period={period} initial={initial} />
        ) : stage === "panels" ? (
          <PanelsStage data={data} period={period} />
        ) : stage === "inspect" ? (
          <InspectStage data={data} period={period} initial={initial} />
        ) : stage === "explain" ? (
          <ExplainStage data={data} initialKey={initial.key} />
        ) : stage === "dock" ? (
          <DockStage data={data} period={period} initial={initial} />
        ) : (
          <BitsStage data={data} period={period} />
        )}
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------- helpers

function resolveUnit(data: DashboardData, ref?: string): string | undefined {
  if (!ref) return undefined;
  const u = data.units.find((x) => x.id === ref || x.position === ref || x.name.toLowerCase() === ref.toLowerCase());
  return u?.id;
}

function parseTarget(data: DashboardData, raw?: string): PanelTarget | null {
  if (!raw) return null;
  const [kind, ref] = raw.split(":");
  if (kind === "unit") {
    const id = resolveUnit(data, ref) ?? data.units[0]?.id;
    return id ? { kind: "unit", unitId: id } : null;
  }
  if (kind === "mailbox" || kind === "noticeboard" || kind === "pole" || kind === "tax" || kind === "property") return { kind } as PanelTarget;
  return null;
}

/** "netCash,expenses,category:<id>" → drill views (for screenshots). */
function parseDrill(data: DashboardData, raw?: string): DrillView[] {
  if (!raw) return [];
  return raw.split(",").flatMap((part): DrillView[] => {
    if (part === "checks") return [{ kind: "checks" }];
    if (part.startsWith("category:")) {
      const name = part.slice(9);
      const sl = data.expenseComposition.allTime.find((c) => c.categoryId === name || c.name.toLowerCase() === name.toLowerCase());
      return sl ? [{ kind: "category", categoryId: sl.categoryId, name: sl.name, period: "allTime", color: sl.color }] : [];
    }
    return data.explain[part] ? [{ kind: "metric", key: part }] : [];
  });
}

// ---------------------------------------------------------------- game stage (the composed overview)

function GameStage({ data, period, initial }: { data: DashboardData; period: ReturnType<typeof usePeriod>[0]; initial: GalleryParams }) {
  const tax = usePropertyTax();
  const inspect = useInspect({ initialPanel: parseTarget(data, initial.right) });
  const [leftOpen, setLeftOpen] = useState(initial.left !== "0");
  const [tab, setTab] = useState<DockTab | null>((initial.tab as DockTab) || null);
  const propDrill = useDrillStack(parseDrill(data, initial.drill));
  const world = initial.world !== "0";
  const hints = inspect.explored.dots(["unit", "mailbox", ...DOCK_TABS.map((d) => d.id)]);

  const onChip = (t: ChipTarget) => {
    if (t.kind === "dock") setTab(t.tab);
    else if (t.kind === "property") setLeftOpen(true);
    else inspect.openPanel(t);
  };
  const onDrill = (v: DrillView) => {
    setLeftOpen(true);
    propDrill.reset();
    propDrill.push(v);
  };
  const openUnit = (unitId: string) => inspect.openPanel({ kind: "unit", unitId });
  const selected = inspect.panel?.kind === "unit" ? inspect.panel.unitId : null;
  const dimmed = Boolean(tab) || Boolean(inspect.panel) || leftOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement)?.closest?.("input,textarea,select")) setLeftOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={s.game}>
      <div className={cx(s.world, dimmed && s.worldDim)}>
        {world ? (
          <EstateSceneLazy
            className={s.scene}
            plot={data.plot}
            units={sceneUnitsFromBreakdown(data.units)}
            mode="hero"
            selectedUnitId={selected}
            onSelectUnit={(id) => (id ? openUnit(id) : inspect.closePanel())}
            showLabels
            intro={false}
          />
        ) : (
          <Sketch data={data} inspect={inspect} />
        )}
      </div>
      <div className={s.hud} data-left={leftOpen || undefined} data-right={inspect.panel ? true : undefined} data-dock={tab ? true : undefined}>
        <div className={s.hudTop}>
          <button type="button" className={cx(s.propChip, leftOpen && s.propChipOn)} onClick={() => setLeftOpen((o) => !o)} title="Property panel (P)">
            <PanelLeft aria-hidden />
            Property
            <Kbd>P</Kbd>
          </button>
          <StatusChips data={data} taxes={tax.data?.items} onSelect={onChip} className={s.hudChips} />
          <span className={s.flex} />
          <PeriodControl data={data} period={period} size="sm" className={s.hudPeriod} />
        </div>
        {leftOpen && (
          <div className={s.left}>
            <PropertyPanel data={data} period={period} drill={propDrill} onClose={() => setLeftOpen(false)} onOpenUnit={openUnit} />
          </div>
        )}
        {inspect.panel && (
          <div className={s.right}>
            <HudPanelFor target={inspect.panel} data={data} period={period} onClose={inspect.closePanel} onOpenUnit={openUnit} />
          </div>
        )}
        <div className={s.bottom}>
          <Dock data={data} period={period} tab={tab} onTabChange={(t) => { setTab(t); if (t) inspect.explored.markExplored(t); }} onDrill={onDrill} onOpenUnit={openUnit} hints={hints} />
        </div>
      </div>
      <InspectLayer data={data} inspect={inspect} />
    </div>
  );
}

// ---------------------------------------------------------------- 2D sketch with hotspots (stands in for the 3D world's object events)

const SPOTS: { kind: SceneObjectKind; pos?: "front" | "back"; x: number; y: number; label: string }[] = [
  { kind: "unit", pos: "back", x: 50, y: 25, label: "Back house" },
  { kind: "unit", pos: "front", x: 50, y: 58, label: "Front house" },
  { kind: "tenant", pos: "front", x: 66, y: 74, label: "Tenant" },
  { kind: "tolet", pos: "back", x: 70, y: 37, label: "TO-LET" },
  { kind: "mailbox", x: 31, y: 85, label: "Mailbox" },
  { kind: "noticeboard", x: 40, y: 88, label: "Property manager" },
  { kind: "taxstamp", x: 59, y: 87, label: "Tax office" },
  { kind: "pole", x: 82, y: 90, label: "Pole" },
  { kind: "plot", x: 24, y: 42, label: "Plot" },
];

function Sketch({ data, inspect, autoCard, autoHover, autoRadial }: { data: DashboardData; inspect: InspectController; autoCard?: string; autoHover?: string; autoRadial?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const objFor = useCallback(
    (sp: (typeof SPOTS)[number], el: HTMLElement): SceneObject => {
      const r = el.getBoundingClientRect();
      const unitId = sp.pos ? data.units.find((u) => u.position === sp.pos)?.id : undefined;
      return { kind: sp.kind, unitId, screen: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
    },
    [data.units],
  );
  // screenshot helpers: ?card=unit:front / ?hover=mailbox
  useLayoutEffect(() => {
    const t = window.setTimeout(() => {
      const find = (raw?: string) => {
        if (!raw) return null;
        const [k, p] = raw.split(":");
        const i = SPOTS.findIndex((sp) => sp.kind === k && (!p || sp.pos === p));
        const el = ref.current?.querySelector<HTMLElement>(`[data-spot="${i}"]`);
        return i >= 0 && el ? objFor(SPOTS[i], el) : null;
      };
      const c = find(autoCard);
      if (c) inspect.onObjectClick(c);
      const h = find(autoHover);
      if (h) inspect.onObjectHover(h);
      const r = find(autoRadial ? `unit:${autoRadial}` : undefined);
      if (r?.unitId && r.screen) inspect.onUnitContextMenu(r.unitId, r.screen);
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCard, autoHover, autoRadial]);

  const units = data.units;
  const tone = (pos: "front" | "back") => {
    const u = units.find((x) => x.position === pos);
    if (!u) return "none";
    return u.rentState === "overdue" ? "coral" : u.rentState === "due-soon" ? "marigold" : u.status === "occupied" ? "teal" : "sky";
  };
  const dots = inspect.explored.dots(["unit", "mailbox", "noticeboard"]);
  return (
    <div ref={ref} className={s.sketch}>
      <svg className={s.sketchSvg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <rect x="0" y="92" width="100" height="8" className={s.road} />
        <path d="M30 80 L70 80 L71 6 L29 6 Z" className={s.plotShape} />
        <rect x="36" y="44" width="30" height="28" className={s.house} data-tone={tone("front")} />
        <rect x="36" y="11" width="30" height="28" className={s.house} data-tone={tone("back")} />
        <line x1="30" y1="80" x2="70" y2="80" className={s.wall} />
      </svg>
      {SPOTS.map((sp, i) => (
        <button
          key={i}
          type="button"
          data-spot={i}
          className={s.spot}
          style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
          onMouseEnter={(e) => inspect.onObjectHover(objFor(sp, e.currentTarget))}
          onMouseLeave={() => inspect.onObjectHover(null)}
          onClick={(e) => inspect.onObjectClick(objFor(sp, e.currentTarget))}
          onContextMenu={(e) => {
            const o = objFor(sp, e.currentTarget);
            if (sp.kind !== "unit" || !o.unitId) return;
            e.preventDefault();
            inspect.onUnitContextMenu(o.unitId, { x: e.clientX || o.screen!.x, y: e.clientY || o.screen!.y });
          }}
        >
          <span className={s.spotDot} />
          <span className={s.spotLabel}>{sp.label}</span>
          {dots.has(sp.kind) && <span className={s.unexplored} aria-label="not opened yet" />}
        </button>
      ))}
      <p className={s.sketchNote}>
        <MapIcon aria-hidden /> Sketch stand-in for the 3D world&rsquo;s object events (hover = hint, click = inspect card, Enter = side panel)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- inspect stage

function InspectStage({ data, period, initial }: { data: DashboardData; period: ReturnType<typeof usePeriod>[0]; initial: GalleryParams }) {
  const inspect = useInspect({ initialPanel: parseTarget(data, initial.right) });
  return (
    <div className={s.game}>
      <div className={s.world}>
        <Sketch data={data} inspect={inspect} autoCard={initial.card} autoHover={initial.hover} autoRadial={initial.radial} />
      </div>
      <div className={s.hud}>
        {inspect.panel && (
          <div className={s.right}>
            <HudPanelFor target={inspect.panel} data={data} period={period} onClose={inspect.closePanel} onOpenUnit={(id) => inspect.openPanel({ kind: "unit", unitId: id })} />
          </div>
        )}
      </div>
      <InspectLayer data={data} inspect={inspect} />
    </div>
  );
}

// ---------------------------------------------------------------- panels stage

function PanelsStage({ data, period }: { data: DashboardData; period: ReturnType<typeof usePeriod>[0] }) {
  const targets: PanelTarget[] = [
    { kind: "property" },
    ...data.units.map((u) => ({ kind: "unit" as const, unitId: u.id })),
    { kind: "mailbox" },
    { kind: "noticeboard" },
    { kind: "pole" },
    { kind: "tax" },
  ];
  return (
    <div className={s.panelsRow}>
      {targets.map((t, i) => (
        <div key={i} className={s.panelCol}>
          <HudPanelFor target={t} data={data} period={period} onClose={() => {}} side="inline" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- explain stage

const EXPLAIN_PICKS = ["netCash", "year:collection", "worthNow", "cagr", "rentLost", "overdue", "depositsHeld", "totalReturn"];

function ExplainStage({ data, initialKey }: { data: DashboardData; initialKey?: string }) {
  const [key, setKey] = useState(initialKey && data.explain[initialKey] ? initialKey : "netCash");
  const drill: DrillStack = useDrillStack([{ kind: "metric", key }]);
  const { reset, push } = drill;
  useEffect(() => {
    reset();
    push({ kind: "metric", key });
  }, [key, reset, push]);
  const e = data.explain[key];
  const picks = useMemo(() => [...EXPLAIN_PICKS, ...data.units.map((u) => `unit:${u.id}:overdue`)].filter((k) => data.explain[k]), [data]);
  return (
    <div className={s.explainStage}>
      <aside className={s.keyList}>
        <span className={s.kicker}>data.explain · {Object.keys(data.explain).length} keys</span>
        {picks.map((k) => (
          <button key={k} type="button" className={cx(s.keyBtn, k === key && s.keyOn)} onClick={() => setKey(k)}>
            <span>
              {data.explain[k].title}
              {k.startsWith("unit:") ? ` · ${data.units.find((u) => k.includes(u.id))?.name ?? "unit"}` : ""}
            </span>
            <span className={s.keyScope}>{data.explain[k].scope}</span>
          </button>
        ))}
      </aside>
      <section className={s.explainCard}>{e && <ExplainView explain={e} onRelated={setKey} related={[]} />}</section>
      <div className={s.explainPanel}>
        <DrillPanel data={data} drill={drill} rootLabel="Property" side="inline" title="Inside a side panel" eyebrow="Drill-down" pinId="gallery" onClose={() => {}}>
          <p className="dim">Pick a figure on the left.</p>
        </DrillPanel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dock stage

function DockStage({ data, period, initial }: { data: DashboardData; period: ReturnType<typeof usePeriod>[0]; initial: GalleryParams }) {
  const [tab, setTab] = useState<DockTab | null>((initial.tab as DockTab) || "income");
  const drill = useDrillStack();
  return (
    <div className={s.dockStage}>
      <div className={s.dockSide}>
        {drill.current ? (
          <PropertyPanel data={data} period={period} drill={drill} side="inline" onClose={drill.reset} />
        ) : (
          <p className={s.dockHint}>
            Click a total, a category or a lease in a chart — its breakdown opens here (in the game screen: in the property panel). Keys <Kbd>1</Kbd>–<Kbd>6</Kbd> switch tabs, <Kbd>Esc</Kbd> closes.
          </p>
        )}
      </div>
      <div className={s.dockBottom}>
        <Dock data={data} period={period} tab={tab} onTabChange={setTab} onDrill={(v) => { drill.reset(); drill.push(v); }} hints={["growth", "payments"]} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bits stage

function BitsStage({ data, period }: { data: DashboardData; period: ReturnType<typeof usePeriod>[0] }) {
  const tax = usePropertyTax();
  const calm = useMemo<DashboardData>(
    () => ({
      ...data,
      units: data.units.map((u) => (u.activeLease ? { ...u, rentState: "paid" as const, nextPayment: u.nextPayment && { ...u.nextPayment, isOverdue: false, arrears: { months: [], total: 0, lateFees: 0, totalWithFees: 0 } } } : u)),
      actions: { pending: data.actions.pending.slice(0, 1).map((a) => ({ ...a, isOverdue: false })) },
    }),
    [data],
  );
  const broken = useMemo(() => ({ ...data.checks, ledgerBalanced: false, items: data.checks.items.map((i, n) => (n === 1 ? { ...i, actual: i.actual - 1200, ok: false } : i)) }), [data.checks]);
  const p = data.periods[period];
  return (
    <div className={s.bits}>
      <Tile title="Status chips — live">
        <StatusChips data={data} taxes={tax.data?.items} onSelect={() => {}} />
      </Tile>
      <Tile title="Status chips — calm state (sample: everyone paid)">
        <StatusChips data={calm} onSelect={() => {}} />
      </Tile>
      <Tile title="Period control (remembers the choice; FY / Cal refetches the dashboard)">
        <PeriodControl data={data} />
      </Tile>
      <Tile title="Scope chips">
        <div className="cluster">
          <ScopeChip>{data.scopeLabels.allTime}</ScopeChip>
          <ScopeChip>{data.scopeLabels.year}</ScopeChip>
          <ScopeChip>{data.scopeLabels.month}</ScopeChip>
          <ScopeChip kind="asOf">{data.scopeLabels.asOf}</ScopeChip>
          <ScopeChip kind="asOf" past>
            As of 1/4/2024
          </ScopeChip>
        </div>
      </Tile>
      <Tile title="Ledger badge — balanced / not balanced">
        <div className="cluster">
          <LedgerBadge checks={data.checks} />
          <LedgerBadge checks={broken} />
          <LedgerBadge checks={data.checks} size="md" />
        </div>
      </Tile>
      <Tile title="Three kinds of numbers">
        <div className={s.kinds}>
          <div>
            <BucketHead bucket="cash" scope={<ScopeChip>{p.label}</ScopeChip>} />
            <Fig value={p.net} size="hero" tone="signed" onClick={() => {}} />
            <FigLine label="Rent collected" value={p.rentCollected} sign="+" tone="income" onClick={() => {}} />
            <FigLine label="Expenses" value={p.expenses} sign="−" tone="expense" onClick={() => {}} />
          </div>
          <div>
            <BucketHead bucket="value" scope={<ScopeChip kind="asOf">{data.scopeLabels.asOf}</ScopeChip>} />
            <Fig value={data.kpis.bestOfferTotal} size="hero" paper="est." onClick={() => {}} />
            <FigLine label="Best offer" value={data.kpis.bestOfferSum} paper="offer" onClick={() => {}} />
            <FigLine label="No offer (missing)" value={null} missing="No offer yet" />
          </div>
          <div>
            <BucketHead bucket="occupancy" scope={<ScopeChip>{data.scopeLabels.allTime}</ScopeChip>} />
            <Fig value={data.kpis.occupancyPct} format="pct" size="hero" onClick={() => {}} />
            <FigLine label="Vacant days" value={data.kpis.vacantDays} format="days" onClick={() => {}} />
            <FigLine label="Rent lost (vacant)" value={data.kpis.unrealizedLoss} tone="dim" onClick={() => {}} />
          </div>
        </div>
        <p className={s.tileNote}>
          Paper values carry <PaperTag kind="est." /> or <PaperTag kind="offer" /> and a dotted underline; cash is solid teal / coral; big figures are compact with the exact ₹ on hover.
        </p>
      </Tile>
      <Tile title="World hover hint (depth 1)">
        <div className={s.hintDemo}>
          <HintDemo data={data} />
        </div>
      </Tile>
      <Tile title="Bucket colours stay fixed; one accent per panel">
        <div className="cluster">
          <Button size="sm" variant="secondary">
            Secondary
          </Button>
          <Button size="sm" variant="primary">
            Primary action
          </Button>
        </div>
      </Tile>
    </div>
  );
}

function HintDemo({ data }: { data: DashboardData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [obj, setObj] = useState<SceneObject | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setObj({ kind: "unit", unitId: data.units[0]?.id, screen: { x: r.left + 120, y: r.top + r.height - 8 } });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [data.units]);
  return (
    <div ref={ref} className={s.hintBox}>
      <WorldHint obj={obj} data={data} />
      <span className={s.hintAnchor} style={{ left: 120 }} />
    </div>
  );
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.tile}>
      <h2 className={s.tileTitle}>{title}</h2>
      {children}
    </section>
  );
}
