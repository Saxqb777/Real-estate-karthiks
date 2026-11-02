"use client";
// THE GAME SCREEN ("/"). The 3D world fills the screen; the HUD stays out of the way until asked:
//   top strip  — Property (P) · setup quests · up to 3 status chips · as-of chip · period control · ? · F
//   left       — Property panel (P / chip / a chart drill-down) or the Quest log while setup is incomplete
//   right      — the panel of whatever was clicked in the world (house, mailbox, notice board, pole, tax stamp)
//   bottom     — the open chart (keys 1–6); its tabs are an icon column on the left side (the reel, 31/10/2026)
// Clicking the ground / Esc / ✕ closes panels (📌 keeps them); the camera reframes the plot into the free area
// (insets) and the world dims while numbers are being read. Phones: only the world + the bottom bar (☰ → charts menu → chart sheet).
// Every figure comes from /api/dashboard (src/lib/calculations.ts) — nothing here does maths.
import { Eye } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import EstateSceneLazy, { type ObjectScreenFn, type SceneInsets, type SceneObject, type SceneObjectKind } from "@/components/estate/EstateSceneLazy";
import { Button, EmptyState, Kbd, Screen, cx, toast, useIsClient } from "@/components/ui";
import { QuickAddHost, quickAdd, usePropertyTax, useTenants, useYearMode } from "@/components/forms";
import {
  Dock,
  HudPanelFor,
  InspectLayer,
  PropertyPanel,
  useDrillStack,
  useFormDrawer,
  useHudDashboard,
  useInspect,
  usePinned,
  type DockTab,
  type DrillView,
  type PanelTarget,
  type PeriodKind,
} from "@/components/hud";
import { SpanContext, type Span } from "@/components/hud/year-jump";
import { chartMenu, useChartMenu } from "@/components/shell/chart-menu";
import { arrivedFlag, signingOutFlag, worldState } from "@/components/shell/world-state";
import { invalidate, logout, useApi } from "@/lib/client";
import type { WeatherNow } from "@/lib/weather";
import type { DashboardData } from "@/lib/dashboard-types";
import { sceneUnitsFromBreakdown } from "@/lib/site-layout";
import { useOverviewCommands } from "./commands";
import { HelpOverlay } from "./HelpOverlay";
import { LeavePrompt } from "./LeavePrompt";
import { SkyTarget, TimePanel } from "./SkyTime";
import { MOBILE_QUERY, QUEST_KEY, TOUR_KEY, useFlag, useHotkeys, useMediaQuery } from "./hooks";
import { ChartMenu } from "./ChartMenu";
import { QuestLog } from "./QuestLog";
import { buildQuests } from "./quests";
import { TimeScrubber } from "./TimeScrubber";
import { Tutorial } from "./Tutorial";
import s from "./overview.module.css";

export interface OverviewProps {
  /** "immersive" (default): world behind the HUD, camera framed into the free area. "framed": world boxed between the panels. */
  layout?: "immersive" | "framed";
  /**
   * false while Data / Config sit on top (owner, 31/10/2026: the world stays behind every page — no loading screen on
   * the way back): the HUD steps away, keys and commands rest, and the world holds still once it has been drawn.
   */
  active?: boolean;
}

/** Owner, 5/10/2026: hover = name tag only; a click opens the object's window STRAIGHT AWAY — no gold card, phone + desktop.
 *  (Sign out = the side bar's last icon → the leave prompt; the sun / moon opens time travel.) */
const DIRECT: SceneObjectKind[] = ["unit", "tenant", "tolet", "mailbox", "noticeboard", "pole", "taxstamp", "plot", "photographer"];
const ZERO: SceneInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function Overview({ layout = "immersive", active = true }: OverviewProps) {
  const isClient = useIsClient();
  // the period (owner 2/11/2026): Year (at the as-of date) · All time — shared by every window + chart
  const [asOf, setYearAsOf] = useState<string | null>(null);
  const [span, setSpan] = useState<Span>({ kind: "year" });
  // the time travel (sun / moon) and the year dropdown both mean "the year view at this date"
  const setAsOf = useCallback((d: string | null) => {
    setSpan({ kind: "year" });
    setYearAsOf(d);
  }, []);
  const spanApi = useMemo(() => ({ span, setSpan, setAsOf }), [span, setAsOf]);
  const dash = useHudDashboard(span.kind === "year" ? asOf : null);
  const data = dash.data;
  const period: PeriodKind = span.kind === "all" ? "allTime" : "year";

  // a bad / failed as-of date snaps back to today with a plain message
  const failedAsOf = asOf && dash.error ? dash.error.message : null;

  // ARRIVAL: one calm loading screen (same as the login hand-over) covers the page until the figures are in and the
  // 3D world has drawn its first frames; then it fades away and the whole game appears at once — no pop-ins.
  const [sceneReady, setSceneReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  const loadFailed = !data && Boolean(dash.error);
  useEffect(() => {
    void import("@/components/estate/EstateScene"); // fetch the 3D code while the figures load
    const safety = window.setTimeout(() => setArrived(true), 15000);
    return () => window.clearTimeout(safety);
  }, []);
  useEffect(() => {
    if (!sceneReady && !loadFailed) return;
    const t = window.setTimeout(() => setArrived(true), loadFailed ? 0 : 250);
    return () => window.clearTimeout(t);
  }, [sceneReady, loadFailed]);
  const onSceneReady = useCallback(() => {
    setSceneReady(true);
    worldState.setReady(true);
  }, []);
  // the floating nav hides under the arrival screen (and comes back clean after a sign-out → sign-in)
  useEffect(() => arrivedFlag.set(arrived), [arrived]);
  useEffect(() => () => arrivedFlag.set(false), []);
  useEffect(() => {
    if (!failedAsOf) return;
    toast.error("Couldn't show that date", { description: failedAsOf });
    setAsOf(null);
  }, [failedAsOf, setAsOf]);

  return (
    <Screen flush contained={false} className={s.screen}>
      <QuickAddHost />
      {isClient && (
        <SpanContext value={spanApi}>
          <Game
            data={data}
            period={period}
            asOf={span.kind === "year" ? asOf : null}
            setAsOf={setAsOf}
            loading={dash.refreshing}
            error={!data ? dash.error?.message : undefined}
            retry={dash.reload}
            layout={layout}
            onSceneReady={onSceneReady}
            active={active}
            paused={!active && sceneReady}
          />
        </SpanContext>
      )}
      <AnimatePresence>
        {/* the arrival screen only on the overview itself; behind Data / Config the world just loads quietly */}
        {!arrived && active && (
          <motion.div key="arrival" className={cx(s.arrival, "pe-loadbg")} role="status" exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
            <span className="pe-spinner" aria-label="Loading" />
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}

// ---------------------------------------------------------------- the game

interface GameProps {
  data: DashboardData | undefined;
  /** the windows' + charts' cash period: "year" = the year slot (a year, or custom dates), "allTime" */
  period: PeriodKind;
  asOf: string | null;
  setAsOf: (d: string | null) => void;
  loading: boolean;
  error?: string;
  retry: () => void;
  layout: "immersive" | "framed";
  onSceneReady: () => void;
  /** the overview is the page on screen (not the world behind Data / Config) */
  active: boolean;
  /** hold the world still */
  paused: boolean;
}

function Game({ data, period, asOf, setAsOf, loading, error, retry, layout, onSceneReady, active, paused }: GameProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const narrow = useMediaQuery("(max-width: 1179px)");
  const [yearMode, setYearMode] = useYearMode();
  const tax = usePropertyTax();
  const tenants = useTenants();
  const inspect = useInspect({ direct: DIRECT });
  const forms = useFormDrawer();
  const propDrill = useDrillStack();
  const [tab, setTab] = useState<DockTab | null>(null);
  // phones: ☰ in the bottom bar → charts menu (names only) → the picked chart as a sheet with an ✕ (owner, option B)
  const menuOpen = useChartMenu();
  useEffect(() => {
    if (menuOpen) setTab(null);
  }, [menuOpen]);
  useEffect(() => () => chartMenu.set(false), []);
  const [hudHidden, setHudHidden] = useState(false);
  // sign out = the side bar's last icon (owner 31/10/2026: the car is gone): "Leave?" → the screen fades to the title screen
  const [leaving, setLeaving] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  // the sun / moon opens TIME TRAVEL (as-of timeline + FY/calendar period)
  const [timeOpen, setTimeOpen] = useState(false);
  const stay = useCallback(() => setAskLeave(false), []);
  const driveOff = useCallback(() => {
    setAskLeave(false);
    setLeaving(true);
    window.setTimeout(() => void logout(), 1400);
  }, []);
  // …and under the sign-out screen
  useEffect(() => {
    signingOutFlag.set(leaving);
    return () => signingOutFlag.set(false);
  }, [leaving]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [, setTourFlag] = useFlag(TOUR_KEY);
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
  // no setup checklist / instructions on screen (owner)
  const showQuests = false;
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
      toast.success("Setup complete");
    }
  }, [quests, questsLoaded]);
  const takenPositions = useMemo(
    () => [...units, ...(data?.unitsNotYetOwned ?? [])].map((u) => u.position).filter((p): p is "front" | "back" => p === "front" || p === "back"),
    [units, data?.unitsNotYetOwned],
  );

  // ---------------------------------------------------------------- panels
  const leftOpen = questOpen && showQuests && !propertyOpen;
  const rightOpen = Boolean(panel) || propertyOpen;
  const openProperty = useCallback(() => {
    setQuestOpen(false);
    openPanel({ kind: "property" });
  }, [openPanel]);
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
  const openTenant = useCallback((unitId: string) => openRight({ kind: "tenant", unitId }), [openRight]);
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

  // pinned windows no longer reopen on page load (owner, 5/10/2026): the overview always starts on the clean 3D world —
  // and leaving it for Data / Config closes what was open, so coming back shows the clean world again
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) {
      closeCard();
      closePanel();
      setPropertyOpen(false);
      propDrill.reset();
      setTab(null);
      setTimeOpen(false);
      setAskLeave(false);
      setHelpOpen(false);
      setHudHidden(false);
    }
    wasActive.current = active;
  }, [active, closeCard, closePanel, setPropertyOpen, propDrill]);

  // a panel whose unit doesn't exist on the as-of date closes
  useEffect(() => {
    if ((panel?.kind === "unit" || panel?.kind === "tenant") && data && !data.units.some((u) => u.id === panel.unitId)) closePanel();
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
      inspect.onObjectClick(obj);
    },
    [inspect],
  );

  // hover hint after a short beat (the outline is instant) so sweeping the mouse across the world stays calm
  const hoverTimer = useRef(0);
  const setHover = inspect.onObjectHover;
  const onObjectHover = useCallback(
    (obj: SceneObject | null) => {
      window.clearTimeout(hoverTimer.current);
      if (!obj) setHover(null);
      else hoverTimer.current = window.setTimeout(() => setHover(obj), 240);
    },
    [setHover],
  );
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const onDrill = (v: DrillView) => {
    setQuestOpen(false);
    if (mobile) setTab(null);
    openPanel({ kind: "property" });
    propDrill.reset();
    propDrill.push(v);
  };
  const onTabChange = (t: DockTab | null) => {
    setTab(t);
    if (t) markExplored(t);
  };

  // ---------------------------------------------------------------- keys + commands
  useHotkeys(
    {
      p: () => (hudHidden ? (setHudHidden(false), openProperty()) : toggleProperty()),
      f: () => setHudHidden((h) => !h),
      "?": () => setHelpOpen((o) => !o),
    },
    active && !tourOpen && !helpOpen && !mobile,
  );
  const backToToday = useCallback(() => setAsOf(null), [setAsOf]);
  useOverviewCommands({
    data,
    yearMode,
    setYearMode,
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
    enabled: active,
  });

  // ---------------------------------------------------------------- first-run tour (desktop, once there is a house)
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
  const candidates =
    hasUnits && live
      ? [
          "unit",
          "mailbox",
          "property",
          "income",
          "noticeboard",
          ...(vacant ? ["tolet"] : []),
          "pole",
          "spending",
          "taxstamp",
          "units",
          "occupancy",
          "growth",
          "payments",
        ]
      : [];
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
  // no "not opened yet" dots (owner: no instructions anywhere)
  const hintObjects: SceneObjectKind[] = [];
  const dockHints: string[] = [];

  // ---------------------------------------------------------------- world cues (letters in the mailbox, notes on the board, tax stamp)
  const cues = useMemo(() => {
    if (!data) return undefined;
    const year = new Date(data.asOf).getUTCFullYear();
    const unitIds = new Set(data.units.map((u) => u.id));
    const taxes = (tax.data?.items ?? []).filter((t) => unitIds.has(t.unitId));
    const due = taxes.some((t) => t.status === "Due" && t.year <= year);
    const paidThisYear = taxes.some((t) => t.year === year) && taxes.filter((t) => t.year === year).every((t) => t.status !== "Due");
    return {
      todos: data.actions.pending.length + data.renewals.length,
      mail: data.units.some((u) => u.rentState === "overdue" || u.rentState === "due-soon"),
      tax: due ? ("due" as const) : paidThisYear ? ("paid" as const) : undefined,
    };
  }, [data, tax.data]);

  // ---------------------------------------------------------------- insets: the camera frames the plot inside the free area
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [topEl] = useState<HTMLDivElement | null>(null);
  const [leftEl, setLeftEl] = useState<HTMLDivElement | null>(null);
  const [bottomEl, setBottomEl] = useState<HTMLDivElement | null>(null);
  // (the chart beside the side bar floats over the world — it is NOT an inset: the camera never moves for it)
  const liveInsets = useInsets(rootEl, hudHidden ? {} : { top: topEl, left: leftEl, bottom: bottomEl });
  // the HUD steps away behind Data / Config: keep the camera's framing as it was, so nothing moves on the way back
  const keptInsets = useRef(liveInsets);
  if (active) keptInsets.current = liveInsets;
  const insets = active ? liveInsets : keptInsets.current;

  const selected = panel?.kind === "unit" || panel?.kind === "tenant" ? panel.unitId : null;
  const dimmed = active && !mobile && !hudHidden && !tourOpen && (Boolean(tab) || Boolean(panel) || propertyOpen);
  // Pattukkottai's real weather for the world (owner 2/11/2026): fetched on arrival, refreshed every 15 minutes
  const { data: wx } = useApi<{ weather: WeatherNow | null }>("/api/weather", { dedupeMs: 15 * 60_000 });
  useEffect(() => {
    const id = window.setInterval(() => invalidate("/api/weather"), 15 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  const getObjectScreen = useCallback((fn: ObjectScreenFn | null) => {
    setLocate(() => fn);
    // test handle (dev builds only): lets browser checks find a house on screen
    if (process.env.NODE_ENV !== "production") (window as unknown as { __peLocate?: ObjectScreenFn | null }).__peLocate = fn;
  }, []);
  const sceneUnits = useMemo(() => sceneUnitsFromBreakdown(units), [units]);
  const framed = layout === "framed" && !mobile;

  // the world waits for the figures, so the houses don't pop in (and re-frame the camera) after the first frames
  const scene = (data || error) && (
    <EstateSceneLazy
      className={s.scene}
      plot={data?.plot ?? {}}
      units={sceneUnits}
      mode="hero"
      selectedUnitId={selected}
      onSelectUnit={(id) => {
        if (!id) onGround();
      }}
      onEmptySlotClick={data && live ? (slot) => quickAdd("unit", { defaults: { position: slot } }) : undefined}
      onObjectClick={onObjectClick}
      onObjectHover={onObjectHover}
      insets={framed ? ZERO : insets}
      dimmed={dimmed}
      hintObjects={hintObjects}
      getObjectScreen={getObjectScreen}
      cues={cues}
      hud={false} /* the Life switch lives in the side bar (hud/Dock) */
      onFirstFrame={onSceneReady}
      paused={paused}
      weather={wx?.weather ?? null}
    />
  );

  const scrubber =
    data && hasUnits ? (
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

  const skyEl = (
    <>
      {/* sun / moon click opens TIME TRAVEL straight away (owner, 5/10/2026: no card for it) */}
      <SkyTarget
        active={timeOpen}
        hidden={rightOpen || Boolean(tab && mobile) || (mobile && menuOpen)}
        onClick={() => {
          closeCard();
          setTimeOpen((v) => !v);
        }}
      />
      {data && hasUnits && (
        <TimePanel open={timeOpen} onClose={() => setTimeOpen(false)} timeline={scrubber} />
      )}
    </>
  );
  const leaveEl = (
    <>
      <LeavePrompt open={askLeave} onStay={stay} onLeave={driveOff} />
      {leaving && (
        <motion.div
          className={cx(s.leaving, "pe-loadbg")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.9, ease: "easeIn" }}
          role="status"
        >
          <span className="pe-spinner" aria-label="Signing out" />
        </motion.div>
      )}
    </>
  );
  const tourEl = <Tutorial open={tourOpen} onClose={endTour} locate={locate} units={units} insets={insets} rootEl={rootEl} />;
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
      <InspectLayer
        data={data}
        inspect={inspect}
        locate={locate ?? undefined}
      />
      {forms.element}
    </>
  ) : null;

  // ---------------------------------------------------------------- desktop / tablet
  return (
    <div className={cx(s.game, framed && s.framed)} data-hud={hudHidden ? "hidden" : undefined}>
      <div
        ref={setRootEl}
        className={s.world}
        data-dim={dimmed || undefined}
        style={
          framed
            ? {
                top: insets.top,
                right: insets.right,
                bottom: insets.bottom,
                left: insets.left,
              }
            : undefined
        }
      >
        {scene}
      </div>

      <AnimatePresence>
        {active && !hudHidden && (
          <motion.div
            key="hud"
            className={s.hud}
            data-left={leftOpen || undefined}
            data-quests={leftOpen || undefined}
            data-centre={rightOpen || undefined}
            data-dock={tab ? true : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ---- left: quest log or property */}
            <AnimatePresence>
              {leftOpen && data && (
                <div key="quests" ref={setLeftEl} className={s.left}>
                  <QuestLog state={quests!} takenPositions={takenPositions} onClose={toggleQuest} />
                </div>
              )}
            </AnimatePresence>

            {/* ---- right: the clicked object's panel */}
            <AnimatePresence>
              {/* CENTRE GAME MENU (owner, option 3): the opened panel sits in the middle over a darkened world */}
              {rightOpen && data && (
                <motion.div
                  key="centre-shade"
                  className={cx(s.centreShade, !propertyOpen && panel?.kind === "photos" && s.centreShadeDeep)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={onGround}
                />
              )}
              {propertyOpen && data ? (
                <div key="property" className={s.centre} data-centre-panel>
                  <PropertyPanel
                    data={data}
                    period={period}
                    drill={propDrill}
                    side="right"
                    onClose={() => {
                      setPropertyOpen(false);
                      propDrill.reset();
                    }}
                    onOpenUnit={openUnit}
                  />
                </div>
              ) : (
                panel &&
                data && (
                  <div key={panel.kind === "unit" || panel.kind === "tenant" ? `${panel.kind}:${panel.unitId}` : panel.kind} className={s.centre} data-centre-panel>
                    <HudPanelFor target={panel} data={data} period={period} onClose={closePanel} onOpenUnit={openUnit} onOpenTenant={openTenant} />
                  </div>
                )
              )}
            </AnimatePresence>

            {/* ---- bottom: dock + time (nothing to chart before the first unit) */}
            {data && hasUnits && !mobile && (
              <motion.div
                ref={setBottomEl}
                className={s.bottom}
                data-tour="bottom"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.45,
                  delay: 0.25,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* opacity only: a moved box would trap the icon column, which is placed against the whole HUD */}
                <div data-help="Charts (keys 1–6)">
                  <Dock
                    side
                    onLeave={() => {
                      closeCard();
                      setAskLeave(true);
                    }}
                    className={s.dock}
                    data={data}
                    period={period}
                    tab={tab}
                    onTabChange={onTabChange}
                    onDrill={onDrill}
                    onOpenUnit={openUnit}
                    hints={dockHints}
                    hotkeys={active && !tourOpen && !helpOpen}
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {active && hudHidden && (
        <button type="button" className={s.showHud} onClick={() => setHudHidden(false)}>
          <Eye aria-hidden /> Show the HUD <Kbd>F</Kbd>
        </button>
      )}

      {active && error && !data && (
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

      {active && mobile && data && hasUnits && (
        <>
          <ChartMenu
            open={menuOpen}
            data={data}
            onClose={() => chartMenu.set(false)}
            onProperty={() => {
              chartMenu.set(false);
              closeCard();
              openProperty();
            }}
            onPick={(t) => {
              chartMenu.set(false);
              closeCard();
              onTabChange(t);
            }}
          />
          <AnimatePresence>
            {tab && (
              <motion.div
                key="chart-sheet"
                className={s.mChart}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Dock sheet data={data} period={period} tab={tab} onTabChange={onTabChange} onDrill={onDrill} onOpenUnit={openUnit} hotkeys={false} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      {active && (
        <>
          {overlay}
          {leaveEl}
          {skyEl}
          {tourEl}
          {helpEl}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- insets

type InsetEls = {
  top?: HTMLElement | null;
  left?: HTMLElement | null;
  right?: HTMLElement | null;
  bottom?: HTMLElement | null;
};

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
      setInsets((p) =>
        Math.abs(p.top - next.top) + Math.abs(p.left - next.left) + Math.abs(p.right - next.right) + Math.abs(p.bottom - next.bottom) < 2 ? p : next,
      );
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
