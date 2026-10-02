"use client";
// THE GAME SCREEN ("/"). The 3D world fills the screen; the HUD stays out of the way until asked:
//   top strip  — Property (P) · setup quests · up to 3 status chips · as-of chip · period control · ? · F
//   left       — Property panel (P / chip / a chart drill-down) or the Quest log while setup is incomplete
//   right      — the panel of whatever was clicked in the world (house, mailbox, notice board, pole, tax stamp)
//   bottom     — dock (charts, keys 1–6) + time scrubber (as-of date)
// Clicking the ground / Esc / ✕ closes panels (📌 keeps them); the camera reframes the plot into the free area
// (insets) and the world dims while numbers are being read. Phones get the world on top + a bottom sheet.
// Every figure comes from /api/dashboard (src/lib/calculations.ts) — nothing here does maths.
import { CircleHelp, Eye, History, Maximize, PanelLeft, RotateCcw, Swords } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import EstateSceneLazy, { type ObjectScreenFn, type SceneInsets, type SceneObject, type SceneObjectKind } from "@/components/estate/EstateSceneLazy";
import { Button, EmptyState, IconButton, Kbd, Screen, cx, toast, useIsClient } from "@/components/ui";
import { QuickAddHost, quickAdd, usePropertyTax, useTenants, useYearMode } from "@/components/forms";
import {
  DOCK_TABS,
  Dock,
  HudPanelFor,
  InspectLayer,
  PeriodControl,
  PropertyPanel,
  StatusChips,
  useDrillStack,
  useFormDrawer,
  useHudDashboard,
  useInspect,
  usePeriod,
  usePinned,
  type ChipTarget,
  type DockTab,
  type DrillView,
  type PanelTarget,
} from "@/components/hud";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { sceneUnitsFromBreakdown } from "@/lib/site-layout";
import { useOverviewCommands } from "./commands";
import { HelpOverlay } from "./HelpOverlay";
import { MOBILE_QUERY, QUEST_KEY, TOUR_KEY, useFlag, useHotkeys, useMediaQuery } from "./hooks";
import { MobileSheet, type SheetTab } from "./MobileSheet";
import { QuestLog } from "./QuestLog";
import { buildQuests } from "./quests";
import { TimeScrubber } from "./TimeScrubber";
import { Tutorial } from "./Tutorial";
import s from "./overview.module.css";

export interface OverviewProps {
  /** "immersive" (default): world behind the HUD, camera framed into the free area. "framed": world boxed between the panels. */
  layout?: "immersive" | "framed";
}

/** World objects whose click opens their side panel straight away (the rest get an anchored inspect card). */
const DIRECT: SceneObjectKind[] = ["unit", "mailbox", "noticeboard", "pole", "taxstamp"];
const WORLD_HINTS = new Set<string>(["unit", "mailbox", "noticeboard", "pole", "taxstamp", "tolet"]);
const DOCK_IDS = new Set<string>(DOCK_TABS.map((t) => t.id));
const ZERO: SceneInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function Overview({ layout = "immersive" }: OverviewProps) {
  const isClient = useIsClient();
  const [asOf, setAsOf] = useState<string | null>(null);
  const dash = useHudDashboard(asOf);
  const data = dash.data;

  // a bad / failed as-of date snaps back to today with a plain message
  const failedAsOf = asOf && dash.error ? dash.error.message : null;
  useEffect(() => {
    if (!failedAsOf) return;
    toast.error("Couldn't show that date", { description: failedAsOf });
    setAsOf(null);
  }, [failedAsOf]);

  return (
    <Screen flush contained={false} className={s.screen}>
      <QuickAddHost />
      {isClient && <Game data={data} asOf={asOf} setAsOf={setAsOf} loading={dash.refreshing} error={!data ? dash.error?.message : undefined} retry={dash.reload} layout={layout} />}
    </Screen>
  );
}

// ---------------------------------------------------------------- the game

interface GameProps {
  data: DashboardData | undefined;
  asOf: string | null;
  setAsOf: (d: string | null) => void;
  loading: boolean;
  error?: string;
  retry: () => void;
  layout: "immersive" | "framed";
}

function Game({ data, asOf, setAsOf, loading, error, retry, layout }: GameProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const narrow = useMediaQuery("(max-width: 1179px)");
  const wide = useMediaQuery("(min-width: 1560px)");
  const [period, setPeriod] = usePeriod();
  const [yearMode, setYearMode] = useYearMode();
  const tax = usePropertyTax();
  const tenants = useTenants();
  const inspect = useInspect({ direct: DIRECT });
  const forms = useFormDrawer();
  const propDrill = useDrillStack();
  const [tab, setTab] = useState<DockTab | null>(null);
  const [hudHidden, setHudHidden] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourFlag, setTourFlag] = useFlag(TOUR_KEY);
  const [questFlag, setQuestFlag] = useFlag(QUEST_KEY);
  const [locate, setLocate] = useState<ObjectScreenFn | null>(null);
  const [pinProperty] = usePinned("property");
  const [pinRight] = usePinned(inspect.panel?.kind ?? "_none");
  const { panel, propertyOpen, setPropertyOpen, openPanel, closePanel, closeCard, explored } = inspect;
  const { markExplored } = explored;

  const live = !data || data.isLive;
  const units = useMemo(() => data?.units ?? [], [data]);
  const hasUnits = units.length > 0;

  // ---------------------------------------------------------------- setup quests
  const quests = useMemo(() => (data ? buildQuests(data, tenants.data ? tenants.data.items.length : null) : null), [data, tenants.data]);
  const questsLoaded = Boolean(quests && tenants.data);
  const showQuests = questsLoaded && live && !quests!.complete;
  const [questOpen, setQuestOpen] = useState(false);
  const questInit = useRef(false);
  useEffect(() => {
    if (!questsLoaded || questInit.current) return;
    questInit.current = true;
    if (showQuests && questFlag !== "hidden") setQuestOpen(true);
  }, [questsLoaded, showQuests, questFlag]);
  const wasIncomplete = useRef(false);
  useEffect(() => {
    if (!quests || !questsLoaded) return;
    if (!quests.complete) wasIncomplete.current = true;
    else if (wasIncomplete.current) {
      wasIncomplete.current = false;
      setQuestOpen(false);
      toast.success("Setup complete", { description: "Your estate is running — click a house any time to see how it's doing." });
    }
  }, [quests, questsLoaded]);
  const takenPositions = useMemo(
    () => [...units, ...(data?.unitsNotYetOwned ?? [])].map((u) => u.position).filter((p): p is "front" | "back" => p === "front" || p === "back"),
    [units, data?.unitsNotYetOwned],
  );

  // ---------------------------------------------------------------- panels
  const leftOpen = propertyOpen || (questOpen && showQuests);
  const openProperty = useCallback(() => {
    setQuestOpen(false);
    openPanel({ kind: "property" });
    if (narrow) closePanel();
  }, [openPanel, closePanel, narrow]);
  const toggleProperty = useCallback(() => {
    if (propertyOpen) {
      setPropertyOpen(false);
      propDrill.reset();
    } else openProperty();
  }, [propertyOpen, setPropertyOpen, openProperty, propDrill]);
  const openRight = useCallback(
    (t: PanelTarget) => {
      openPanel(t);
      if (narrow && t.kind !== "property") {
        if (!pinProperty) setPropertyOpen(false);
        setQuestOpen(false);
      }
    },
    [openPanel, narrow, pinProperty, setPropertyOpen],
  );
  const openUnit = useCallback((unitId: string) => openRight({ kind: "unit", unitId }), [openRight]);
  const toggleQuest = () => {
    if (questOpen) {
      setQuestOpen(false);
      setQuestFlag("hidden");
    } else {
      setPropertyOpen(false);
      setQuestOpen(true);
      setQuestFlag(null);
    }
  };

  // pinned property panel opens with the page
  const pinInit = useRef(false);
  useEffect(() => {
    if (pinInit.current || !data) return;
    pinInit.current = true;
    if (pinProperty && !mobile) setPropertyOpen(true);
  }, [data, pinProperty, mobile, setPropertyOpen]);

  // a panel whose unit doesn't exist on the as-of date closes
  useEffect(() => {
    if (panel?.kind === "unit" && data && !data.units.some((u) => u.id === panel.unitId)) closePanel();
  }, [panel, data, closePanel]);

  const onGround = useCallback(() => {
    closeCard();
    if (panel && !pinRight) closePanel();
    if (propertyOpen && !pinProperty) {
      setPropertyOpen(false);
      propDrill.reset();
    }
    setTab(null);
  }, [closeCard, panel, pinRight, closePanel, propertyOpen, pinProperty, setPropertyOpen, propDrill]);

  const onObjectClick = useCallback(
    (obj: SceneObject) => {
      setHudHidden(false);
      if (obj.kind === "tolet" && obj.unitId && data) {
        markExplored("tolet");
        const u = data.units.find((x) => x.id === obj.unitId);
        openUnit(obj.unitId);
        if (u && data.isLive && !u.activeLease && u.status !== "incoming")
          forms.open({ kind: "lease", title: `New lease · ${u.name}`, props: { defaults: { unitId: u.id } } });
        return;
      }
      if (narrow && DIRECT.includes(obj.kind)) {
        if (!pinProperty) setPropertyOpen(false);
        setQuestOpen(false);
      }
      inspect.onObjectClick(obj);
    },
    [data, markExplored, openUnit, forms, inspect, narrow, pinProperty, setPropertyOpen],
  );

  const onChip = (t: ChipTarget) => {
    if (t.kind === "dock") setTab(t.tab);
    else if (t.kind === "property") openProperty();
    else openRight(t);
  };
  const onDrill = (v: DrillView) => {
    setQuestOpen(false);
    openPanel({ kind: "property" });
    propDrill.reset();
    propDrill.push(v);
  };
  const onTabChange = (t: DockTab | null) => {
    setTab(t);
    if (t) markExplored(t);
  };

  // ---------------------------------------------------------------- keys + commands
  const tourRunning = tourOpen;
  useHotkeys(
    {
      p: () => (hudHidden ? (setHudHidden(false), openProperty()) : toggleProperty()),
      f: () => setHudHidden((h) => !h),
      "?": () => setHelpOpen((o) => !o),
    },
    !tourRunning && !mobile,
  );
  const backToToday = useCallback(() => setAsOf(null), [setAsOf]);
  useOverviewCommands({
    data,
    yearMode,
    setYearMode,
    setPeriod,
    openProperty: () => {
      setHudHidden(false);
      openProperty();
    },
    openUnit: (id) => {
      setHudHidden(false);
      openUnit(id);
    },
    openChart: (t) => {
      setHudHidden(false);
      onTabChange(t);
    },
    hudHidden,
    setHudHidden,
    openHelp: () => setHelpOpen(true),
    replayTour: () => {
      setHelpOpen(false);
      setTourOpen(true);
    },
    backToToday: asOf ? backToToday : null,
  });

  // ---------------------------------------------------------------- first-run tour (desktop, once there is a house)
  useEffect(() => {
    if (tourFlag === "done" || mobile || !data || !hasUnits || !live) return;
    const t = window.setTimeout(() => setTourOpen(true), 1600);
    return () => window.clearTimeout(t);
  }, [tourFlag, mobile, data, hasUnits, live]);
  const endTour = useCallback(() => {
    setTourOpen(false);
    setTourFlag("done");
  }, [setTourFlag]);
  useEffect(() => {
    if (!tourOpen) return;
    closeCard();
    setTab(null);
    setHudHidden(false);
  }, [tourOpen, closeCard]);

  // ---------------------------------------------------------------- unexplored hints (max 3 at once, world + dock + property)
  const vacant = units.some((u) => u.status === "vacant" && u.isActive);
  const candidates = hasUnits && live ? ["unit", "mailbox", "property", "income", "noticeboard", ...(vacant ? ["tolet"] : []), "pole", "spending", "taxstamp", "units", "occupancy", "growth", "payments"] : [];
  // a kind can mark several objects (both houses): keep the total number of dots on screen at 3
  const cost = (k: string) => (k === "unit" ? units.length : k === "tolet" ? units.filter((u) => u.status === "vacant" && u.isActive).length : 1);
  const dots = new Set<string>();
  let budget = 3;
  for (const k of candidates) {
    if (explored.explored.has(k)) continue;
    const c = cost(k);
    if (c > budget) break;
    dots.add(k);
    budget -= c;
    if (budget === 0) break;
  }
  const showDots = !tourOpen && !hudHidden;
  const hintObjects = showDots ? ([...dots].filter((k) => WORLD_HINTS.has(k)) as SceneObjectKind[]) : [];
  const dockHints = showDots ? [...dots].filter((k) => DOCK_IDS.has(k)) : [];
  const propertyDot = showDots && dots.has("property");

  // ---------------------------------------------------------------- world cues (letters in the mailbox, notes on the board, tax stamp)
  const cues = useMemo(() => {
    if (!data) return undefined;
    const year = new Date(data.asOf).getUTCFullYear();
    const unitIds = new Set(data.units.map((u) => u.id));
    const taxes = (tax.data?.items ?? []).filter((t) => unitIds.has(t.unitId));
    const due = taxes.some((t) => t.status === "Due" && t.year <= year);
    const paidThisYear = taxes.some((t) => t.year === year) && taxes.filter((t) => t.year === year).every((t) => t.status !== "Due");
    return {
      todos: data.actions.pending.length,
      mail: data.units.some((u) => u.rentState === "overdue" || u.rentState === "due-soon"),
      tax: due ? ("due" as const) : paidThisYear ? ("paid" as const) : undefined,
    };
  }, [data, tax.data]);

  // ---------------------------------------------------------------- insets: the camera frames the plot inside the free area
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [topEl, setTopEl] = useState<HTMLDivElement | null>(null);
  const [leftEl, setLeftEl] = useState<HTMLDivElement | null>(null);
  const [rightEl, setRightEl] = useState<HTMLDivElement | null>(null);
  const [bottomEl, setBottomEl] = useState<HTMLDivElement | null>(null);
  const insets = useInsets(rootEl, hudHidden ? {} : { top: topEl, left: leftEl, right: rightEl, bottom: bottomEl });

  const selected = panel?.kind === "unit" ? panel.unitId : null;
  const dimmed = !hudHidden && !tourOpen && (Boolean(tab) || Boolean(panel) || propertyOpen);
  const getObjectScreen = useCallback((fn: ObjectScreenFn | null) => {
    setLocate(() => fn);
    // test handle (dev builds only): lets browser checks find a house on screen
    if (process.env.NODE_ENV !== "production") (window as unknown as { __peLocate?: ObjectScreenFn | null }).__peLocate = fn;
  }, []);
  const sceneUnits = useMemo(() => sceneUnitsFromBreakdown(units), [units]);
  const framed = layout === "framed" && !mobile;

  const scene = (
    <EstateSceneLazy
      className={s.scene}
      plot={data?.plot ?? {}}
      units={sceneUnits}
      mode="hero"
      showLabels
      selectedUnitId={selected}
      onSelectUnit={(id) => {
        if (!id) onGround();
      }}
      onEmptySlotClick={data && live ? (slot) => quickAdd("unit", { defaults: { position: slot } }) : undefined}
      onObjectClick={onObjectClick}
      onObjectHover={inspect.onObjectHover}
      onUnitContextMenu={inspect.onUnitContextMenu}
      insets={framed ? ZERO : insets}
      dimmed={dimmed}
      hintObjects={hintObjects}
      getObjectScreen={getObjectScreen}
      cues={cues}
      hud={!mobile}
    />
  );

  const scrubber = data ? (
    <TimeScrubber
      timeline={data.timeline}
      asOf={asOf}
      onChange={setAsOf}
      loading={loading}
      yearMode={data.yearMode}
      compact={mobile}
      onUse={() => markExplored("scrubber")}
    />
  ) : null;

  const asOfChip =
    data && !data.isLive ? (
      <button type="button" className={s.asOf} onClick={backToToday} title="Back to today">
        <History aria-hidden />
        <span className={s.asOfText}>
          As of <b className="num">{formatDate(data.asOf)}</b>
        </span>
        <span className={s.asOfLive}>
          <RotateCcw aria-hidden /> Today
        </span>
      </button>
    ) : null;

  const tourEl = (
    <Tutorial open={tourOpen} onClose={endTour} locate={locate} units={units} insets={insets} rootEl={rootEl} />
  );
  const helpEl = (
    <HelpOverlay
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      locate={locate}
      units={units}
      mobile={mobile}
      onReplayTour={() => {
        setHelpOpen(false);
        setTourOpen(true);
      }}
    />
  );
  const overlay = data ? (
    <>
      <InspectLayer data={data} inspect={inspect} locate={locate ?? undefined} />
      {forms.element}
    </>
  ) : null;

  // ---------------------------------------------------------------- phones
  if (mobile)
    return (
      <MobileGame
        data={data}
        error={error}
        retry={retry}
        scene={scene}
        scrubber={scrubber}
        asOfChip={asOfChip}
        setRootEl={setRootEl}
        setTopEl={setTopEl}
        setBottomEl={setBottomEl}
        period={period}
        taxes={tax.data?.items}
        inspect={inspect}
        onChip={onChip}
        openUnit={openUnit}
        quests={showQuests && questFlag !== "hidden" ? quests : null}
        takenPositions={takenPositions}
        onHideQuests={() => setQuestFlag("hidden")}
        help={
          <IconButton size="sm" label="Help" icon={<CircleHelp />} variant="secondary" className={s.mHelp} onClick={() => setHelpOpen(true)} />
        }
      >
        {overlay}
        {helpEl}
      </MobileGame>
    );

  // ---------------------------------------------------------------- desktop / tablet
  const maxChips = narrow ? 1 : wide ? 3 : 2;
  return (
    <div className={cx(s.game, framed && s.framed)} data-hud={hudHidden ? "hidden" : undefined}>
      <div
        ref={setRootEl}
        className={s.world}
        style={framed ? { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left } : undefined}
      >
        {scene}
      </div>

      <AnimatePresence>
        {!hudHidden && (
          <motion.div
            key="hud"
            className={s.hud}
            data-left={leftOpen || undefined}
            data-right={panel ? true : undefined}
            data-dock={tab ? true : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ---- top strip */}
            <div ref={setTopEl} className={s.top}>
              <div className={s.topLeft} data-tour="chips">
                <button
                  type="button"
                  className={cx(s.chipBtn, propertyOpen && s.chipBtnOn)}
                  onClick={toggleProperty}
                  aria-pressed={propertyOpen}
                  data-help="Property — worth, cash flow and occupancy for the whole plot"
                >
                  <PanelLeft aria-hidden />
                  <span>Property</span>
                  <Kbd>P</Kbd>
                  {propertyDot && <span className={s.dot} aria-label="not opened yet" />}
                </button>
                {showQuests && (
                  <button type="button" className={cx(s.chipBtn, s.questBtn, questOpen && s.chipBtnOn)} onClick={toggleQuest} aria-pressed={questOpen} data-help="Setup steps still to do">
                    <Swords aria-hidden />
                    <span>Setup</span>
                    <b className="num">
                      {quests!.done}/{quests!.total}
                    </b>
                  </button>
                )}
                {data && hasUnits && (
                  <div className={s.chips} data-help="What needs you — most urgent first. Click one to open it">
                    <StatusChips data={data} taxes={tax.data?.items} onSelect={onChip} max={maxChips} />
                  </div>
                )}
                {!data && !error && <span className={s.loadingNote}>Loading your estate…</span>}
              </div>
              <div className={s.topRight}>
                {asOfChip}
                {data && (
                  <div data-help="Period for the cash figures · FY = 1 Apr – 31 Mar, Cal = Jan – Dec">
                    <PeriodControl data={data} period={period} size="sm" />
                  </div>
                )}
                <div className={s.tools}>
                  <IconButton size="sm" variant="secondary" label="Help & shortcuts (?)" icon={<CircleHelp />} onClick={() => setHelpOpen(true)} data-help="This help (?)" />
                  <IconButton size="sm" variant="secondary" label="Hide the HUD (F)" icon={<Maximize />} onClick={() => setHudHidden(true)} data-help="Just the world (F)" />
                </div>
              </div>
            </div>

            {/* ---- left: quest log or property */}
            <AnimatePresence>
              {leftOpen && data && (
                <div key={propertyOpen ? "property" : "quests"} ref={setLeftEl} className={s.left}>
                  {propertyOpen ? (
                    <PropertyPanel
                      data={data}
                      period={period}
                      drill={propDrill}
                      onClose={() => {
                        setPropertyOpen(false);
                        propDrill.reset();
                      }}
                      onOpenUnit={openUnit}
                    />
                  ) : (
                    <QuestLog state={quests!} takenPositions={takenPositions} onClose={toggleQuest} />
                  )}
                </div>
              )}
            </AnimatePresence>

            {/* ---- right: the clicked object's panel */}
            <AnimatePresence>
              {panel && data && (
                <div key={panel.kind === "unit" ? `unit:${panel.unitId}` : panel.kind} ref={setRightEl} className={s.right}>
                  <HudPanelFor target={panel} data={data} period={period} onClose={closePanel} onOpenUnit={openUnit} />
                </div>
              )}
            </AnimatePresence>

            {/* ---- bottom: dock + time */}
            {data && (
              <div ref={setBottomEl} className={s.bottom} data-tour="bottom">
                <div data-help="Charts — keys 1–6, Esc closes">
                  <Dock className={s.dock} data={data} period={period} tab={tab} onTabChange={onTabChange} onDrill={onDrill} onOpenUnit={openUnit} hints={dockHints} hotkeys={!tourOpen} />
                </div>
                <div className={s.scrub} data-help="Drag to look back in time · ▶ plays the years · Live = today">
                  {scrubber}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {hudHidden && (
        <button type="button" className={s.showHud} onClick={() => setHudHidden(false)}>
          <Eye aria-hidden /> Show the HUD <Kbd>F</Kbd>
        </button>
      )}

      {error && !data && (
        <div className={s.error}>
          <EmptyState
            title="Couldn't load your figures"
            description={error}
            action={
              <Button variant="primary" size="sm" onClick={() => void retry()}>
                Try again
              </Button>
            }
          />
        </div>
      )}

      {overlay}
      {tourEl}
      {helpEl}
    </div>
  );
}

// ---------------------------------------------------------------- insets

type InsetEls = { top?: HTMLElement | null; left?: HTMLElement | null; right?: HTMLElement | null; bottom?: HTMLElement | null };

/** Pixels of the world box covered by HUD elements (measured live — panels, the dock tray and the strip all move). */
function useInsets(root: HTMLElement | null, els: InsetEls): SceneInsets {
  const [insets, setInsets] = useState<SceneInsets>(ZERO);
  const { top, left, right, bottom } = els;
  useLayoutEffect(() => {
    if (!root) return;
    const measure = () => {
      const R = root.getBoundingClientRect();
      const next: SceneInsets = {
        top: top ? Math.round(Math.max(0, top.getBoundingClientRect().bottom - R.top)) : 0,
        left: left ? Math.round(Math.max(0, left.getBoundingClientRect().right - R.left)) : 0,
        right: right ? Math.round(Math.max(0, R.right - right.getBoundingClientRect().left)) : 0,
        bottom: bottom ? Math.round(Math.max(0, R.bottom - bottom.getBoundingClientRect().top)) : 0,
      };
      setInsets((p) => (Math.abs(p.top - next.top) + Math.abs(p.left - next.left) + Math.abs(p.right - next.right) + Math.abs(p.bottom - next.bottom) < 2 ? p : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [root, top, left, right, bottom]) if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [root, top, left, right, bottom]);
  return insets;
}

// ---------------------------------------------------------------- phones: world on top + bottom sheet

interface MobileGameProps {
  data: DashboardData | undefined;
  error?: string;
  retry: () => void;
  scene: React.ReactNode;
  scrubber: React.ReactNode;
  asOfChip: React.ReactNode;
  setRootEl: (el: HTMLDivElement | null) => void;
  setTopEl: (el: HTMLDivElement | null) => void;
  setBottomEl: (el: HTMLDivElement | null) => void;
  period: ReturnType<typeof usePeriod>[0];
  taxes: Parameters<typeof StatusChips>[0]["taxes"];
  inspect: ReturnType<typeof useInspect>;
  onChip: (t: ChipTarget) => void;
  openUnit: (id: string) => void;
  quests: ReturnType<typeof buildQuests> | null;
  takenPositions: ("front" | "back")[];
  onHideQuests: () => void;
  help: React.ReactNode;
  children: React.ReactNode;
}

function MobileGame({ data, error, retry, scene, scrubber, asOfChip, setRootEl, setTopEl, setBottomEl, period, taxes, inspect, onChip, openUnit, quests, takenPositions, onHideQuests, help, children }: MobileGameProps) {
  const { panel, closePanel, propertyOpen, setPropertyOpen } = inspect;
  const [tab, setTab] = useState<SheetTab>("portfolio");
  const [unitSel, setUnitSel] = useState<string | null>(null);
  // a world tap → the matching sheet tab
  useEffect(() => {
    if (!panel) return;
    if (panel.kind === "unit") {
      setTab("units");
      setUnitSel(panel.unitId);
      closePanel();
    } else if (panel.kind === "mailbox") {
      setTab("month");
      closePanel();
    } else if (panel.kind === "noticeboard") {
      setTab("todo");
      closePanel();
    }
  }, [panel, closePanel]);
  useEffect(() => {
    if (propertyOpen) {
      setTab("portfolio");
      setPropertyOpen(false);
    }
  }, [propertyOpen, setPropertyOpen]);

  return (
    <div className={s.mobile}>
      <div className={s.mWorld}>
        <div ref={setRootEl} className={s.mScene}>
          {scene}
        </div>
        <div ref={setTopEl} className={s.mTop}>
          {data && data.units.length > 0 && <StatusChips data={data} taxes={taxes} onSelect={onChip} max={1} className={s.mChips} />}
          {asOfChip}
          <span className={s.flex} />
          {help}
        </div>
        {scrubber && (
          <div ref={setBottomEl} className={s.mScrub}>
            {scrubber}
          </div>
        )}
      </div>
      {data ? (
        <MobileSheet
          data={data}
          tab={tab}
          onTab={(t) => {
            setTab(t);
            closePanel();
          }}
          period={period}
          detail={panel && (panel.kind === "pole" || panel.kind === "tax") ? panel : null}
          onCloseDetail={closePanel}
          unitId={unitSel}
          onUnit={(id) => {
            setUnitSel(id);
            if (id) openUnit(id);
          }}
          quests={quests}
          takenPositions={takenPositions}
          onHideQuests={onHideQuests}
        />
      ) : (
        <div className={s.mSheetLoading}>
          {error ? (
            <EmptyState
              compact
              title="Couldn't load your figures"
              description={error}
              action={
                <Button variant="primary" size="sm" onClick={() => void retry()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <span className={s.loadingNote}>Loading your estate…</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
