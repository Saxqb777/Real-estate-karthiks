"use client";
// "Inspect like a game", wired to the 3D scene's object callbacks (SCENE CONTRACT v2):
//   1 hover → <WorldHint> (name + 1–2 key figures + state colour + what a click does)
//   2 click → <InspectCard> anchored to the object with a leader line (essentials + 2–3 actions)
//   3 expand (⤢ / Enter) → the side panel (<HudPanelFor>)
// Esc steps back one depth (card → nothing; panel closes unless pinned).
//
//   const inspect = useInspect();
//   <EstateSceneLazy onObjectHover={inspect.onObjectHover} onObjectClick={inspect.onObjectClick} … />
//   <InspectLayer data={data} inspect={inspect} />
//   {inspect.panel && <HudPanelFor target={inspect.panel} data={data} period={period} onClose={inspect.closePanel} />}
import { ArrowUpRight, ExternalLink, FileSignature, ListPlus, Phone, ReceiptIndianRupee, Ruler } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, InspectCard, LinkButton, useIsClient, cx } from "@/components/ui";
import { usePropertyTax } from "@/components/forms";
import type { DashboardData, UnitBreakdown } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { useFormDrawer } from "./FormDrawer";
import { Fig } from "./Figure";
import { firstName, inr, inrCompact, monthList, positionLabel, telHref } from "./format";
import { MailboxPanel } from "./MailboxPanel";
import { NoticeBoardPanel } from "./NoticeBoardPanel";
import { PolePanel } from "./PolePanel";
import { PropertyPanel } from "./PropertyPanel";
import { useEscape, useExplored } from "./store";
import { TaxPanel } from "./TaxPanel";
import type { PanelTarget, PeriodKind, SceneObject, SceneObjectKind } from "./types";
import { RentStatePill, UnitPanel, UnitStatusPill } from "./UnitPanel";
import s from "./bits.module.css";

// ---------------------------------------------------------------- controller

/** Which side panel an object expands into. */
export function panelFor(obj: SceneObject): PanelTarget {
  switch (obj.kind) {
    case "unit":
    case "tenant":
    case "tolet":
      return obj.unitId ? { kind: "unit", unitId: obj.unitId } : { kind: "property" };
    case "mailbox":
      return { kind: "mailbox" };
    case "noticeboard":
      return { kind: "noticeboard" };
    case "pole":
      return { kind: "pole" };
    case "taxstamp":
      return { kind: "tax" };
    case "plot":
      return { kind: "property" };
  }
}

export interface UseInspectOptions {
  /** Kinds whose click skips the card and opens the side panel straight away. */
  direct?: SceneObjectKind[];
  /** Initial right panel. */
  initialPanel?: PanelTarget | null;
}

export interface InspectController {
  hover: SceneObject | null;
  card: SceneObject | null;
  /** the right-hand panel (unit / mailbox / notice board / pole / tax) */
  panel: PanelTarget | null;
  /** the left property panel */
  propertyOpen: boolean;
  onObjectHover: (obj: SceneObject | null) => void;
  onObjectClick: (obj: SceneObject) => void;
  expand: () => void;
  closeCard: () => void;
  openPanel: (t: PanelTarget) => void;
  closePanel: () => void;
  setPropertyOpen: (open: boolean) => void;
  /** a world object has never been opened → show its marigold "unexplored" dot */
  explored: ReturnType<typeof useExplored>;
}

/** State machine for hover → card → panel. Pass its callbacks to the 3D scene. */
export function useInspect({ direct = [], initialPanel = null }: UseInspectOptions = {}): InspectController {
  const [hover, setHover] = useState<SceneObject | null>(null);
  const [card, setCard] = useState<SceneObject | null>(null);
  const [panel, setPanel] = useState<PanelTarget | null>(initialPanel);
  const [propertyOpen, setPropertyOpenState] = useState(false);
  const explored = useExplored();
  const { markExplored } = explored;

  const openPanel = useCallback(
    (t: PanelTarget) => {
      setCard(null);
      if (t.kind === "property") {
        setPropertyOpenState(true);
        markExplored("property");
      } else {
        setPanel(t);
        markExplored(t.kind);
      }
    },
    [markExplored],
  );
  const onObjectClick = useCallback(
    (obj: SceneObject) => {
      setHover(null);
      markExplored(obj.kind);
      if (direct.includes(obj.kind)) openPanel(panelFor(obj));
      else setCard(obj);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openPanel, markExplored, direct.join(",")],
  );
  const expand = useCallback(() => {
    setCard((c) => {
      if (c) openPanel(panelFor(c));
      return null;
    });
  }, [openPanel]);
  const closeCard = useCallback(() => setCard(null), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const setPropertyOpen = useCallback((o: boolean) => setPropertyOpenState(o), []);
  useEscape(card !== null, closeCard);

  return { hover, card, panel, propertyOpen, onObjectHover: setHover, onObjectClick, expand, closeCard, openPanel, closePanel, setPropertyOpen, explored };
}

// ---------------------------------------------------------------- panel router

export interface HudPanelForProps {
  target: PanelTarget;
  data: DashboardData;
  period: PeriodKind;
  onClose: () => void;
  /** switch the right panel to another unit (from a breakdown) */
  onOpenUnit?: (unitId: string) => void;
  side?: "left" | "right" | "inline";
  className?: string;
}

/** The side panel for a target. */
export function HudPanelFor({ target, data, period, onClose, onOpenUnit, side, className }: HudPanelForProps) {
  const right = side === "inline" ? "inline" : "right";
  switch (target.kind) {
    case "property":
      return <PropertyPanel data={data} period={period} onClose={onClose} onOpenUnit={onOpenUnit} side={side === "inline" ? "inline" : "left"} className={className} />;
    case "unit":
      return <UnitPanel data={data} unitId={target.unitId} period={period} onClose={onClose} onOpenUnit={onOpenUnit} side={right} className={className} />;
    case "mailbox":
      return <MailboxPanel data={data} period={period} onClose={onClose} onOpenUnit={onOpenUnit} side={right} className={className} />;
    case "noticeboard":
      return <NoticeBoardPanel data={data} onClose={onClose} side={right} className={className} />;
    case "pole":
      return <PolePanel data={data} onClose={onClose} side={right} className={className} />;
    case "tax":
      return <TaxPanel data={data} onClose={onClose} side={right} className={className} />;
  }
}

// ---------------------------------------------------------------- hover hint

const OBJECT_NAME: Record<SceneObjectKind, string> = {
  unit: "House",
  mailbox: "Mailbox",
  noticeboard: "Notice board",
  pole: "Electric pole",
  tolet: "TO-LET board",
  tenant: "Tenant",
  taxstamp: "Tax stamp",
  plot: "Plot",
};

type Tone = "teal" | "marigold" | "coral" | "sky" | "neutral";

function unitTone(u: UnitBreakdown): Tone {
  if (u.rentState === "overdue") return "coral";
  if (u.rentState === "due-soon") return "marigold";
  if (u.status === "occupied") return "teal";
  if (u.status === "vacant" || u.status === "incoming") return "sky";
  return "neutral";
}

/** Name + 1–2 key figures + state colour + what a click does — for a hovered world object. */
export function hintFor(obj: SceneObject, data: DashboardData): { title: string; lines: string[]; tone: Tone; action: string } {
  const u = obj.unitId ? data.units.find((x) => x.id === obj.unitId) : undefined;
  switch (obj.kind) {
    case "unit": {
      if (!u) return { title: "Empty plot slot", lines: ["Build a unit here in Config"], tone: "neutral", action: "Click to build" };
      const who = u.activeLease ? `${u.activeLease.tenantName} · ${inr(u.activeLease.monthlyRent)}/mo` : u.incomingLease ? `${u.incomingLease.tenantName} moves in ${formatDate(u.incomingLease.startDate)}` : "Empty";
      const rent =
        u.rentState === "overdue" && u.nextPayment
          ? `Owes ${inr(u.nextPayment.arrears.totalWithFees)}`
          : u.rentState === "due-soon" && u.nextPayment
            ? `Rent due ${formatDate(u.nextPayment.dueDate)}`
            : u.rentState === "paid"
              ? "Rent paid"
              : `Worth ${inrCompact(u.valuation)} ${u.valuationSource === "offer" ? "(offer)" : "(est.)"}`;
      return { title: `${u.name}${positionLabel(u.position) ? ` · ${positionLabel(u.position)}` : ""}`, lines: [who, rent], tone: unitTone(u), action: "Click to inspect · right-click for actions" };
    }
    case "tenant":
      return u?.activeLease
        ? { title: u.activeLease.tenantName, lines: [`${u.name} · since ${formatDate(u.activeLease.startDate)}`, u.activeLease.tenantPhone ?? "No phone saved"], tone: unitTone(u), action: "Click for the tenant · tap-to-call" }
        : { title: "Tenant", lines: [], tone: "neutral", action: "Click to inspect" };
    case "tolet": {
      const v = u?.vacantPeriods.find((p) => p.ongoing);
      return { title: `TO-LET · ${u?.name ?? "Unit"}`, lines: [v ? `Empty ${v.days} days` : "Empty", v && v.unrealizedLoss > 0 ? `Rent lost so far ${inr(v.unrealizedLoss)}` : ""].filter(Boolean), tone: "sky", action: "Click to sign a new lease" };
    }
    case "mailbox": {
      const last = data.recentPayments[0];
      return {
        title: "Mailbox · payments",
        lines: [last ? `Last rent ${inr(last.amount)} on ${formatDate(last.paymentDate)}` : "No rent recorded yet", data.kpis.overdueAmount > 0 ? `${inr(data.kpis.overdueAmount)} overdue` : "Nothing overdue"],
        tone: data.kpis.overdueAmount > 0 ? "coral" : "teal",
        action: "Click to record rent",
      };
    }
    case "noticeboard": {
      const late = data.actions.pending.filter((a) => a.isOverdue).length;
      return { title: "Notice board · to-dos", lines: [`${data.actions.pending.length} to do${late ? ` · ${late} late` : ""}`], tone: late ? "marigold" : "neutral", action: "Click to see the list" };
    }
    case "pole":
      return { title: "Electric pole · TNPDCL", lines: data.units.filter((x) => x.electricityConsumerNumber).map((x) => `${x.name}: ${x.electricityConsumerNumber}`), tone: "neutral", action: "Click for consumer numbers + pay link" };
    case "taxstamp":
      return { title: "Property tax", lines: ["Per year, per unit"], tone: "marigold", action: "Click to see what's due" };
    case "plot":
      return { title: `Plot · ${data.plot.areaSqft.toLocaleString("en-IN")} sqft`, lines: [`${data.plot.frontWidthFt}′ front · ${data.plot.depthFt}′ deep`], tone: "neutral", action: "Click for the plot" };
  }
}

/** Depth 1: small hover label that follows the object. Render it while `obj` is hovered and no card is open. */
export function WorldHint({ obj, data }: { obj: SceneObject | null; data: DashboardData }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  const h = obj?.screen ? hintFor(obj, data) : null;
  return createPortal(
    <AnimatePresence>
      {obj?.screen && h && (
        <motion.div
          key={`${obj.kind}:${obj.unitId ?? ""}`}
          className={s.worldHint}
          data-tone={h.tone}
          style={{ left: obj.screen.x, top: obj.screen.y }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          role="tooltip"
        >
          <span className={s.hintKind}>{OBJECT_NAME[obj.kind]}</span>
          <span className={s.hintTitle}>{h.title}</span>
          {h.lines.map((l, i) => (
            <span key={i} className={s.hintLine}>
              {l}
            </span>
          ))}
          <span className={s.hintAction}>{h.action}</span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------- inspect card

export interface InspectLayerProps {
  data: DashboardData;
  inspect: InspectController;
}

/** Hover hint + the anchored inspect card for the current object. Forms open in a drawer from here. */
export function InspectLayer({ data, inspect }: InspectLayerProps) {
  const forms = useFormDrawer();
  const { card } = inspect;
  return (
    <>
      <WorldHint obj={card ? null : inspect.hover} data={data} />
      <ObjectCard obj={card} data={data} onClose={inspect.closeCard} onExpand={inspect.expand} openForm={forms.open} />
      {forms.element}
    </>
  );
}

function ObjectCard({ obj, data, onClose, onExpand, openForm }: { obj: SceneObject | null; data: DashboardData; onClose: () => void; onExpand: () => void; openForm: ReturnType<typeof useFormDrawer>["open"] }) {
  // keep the last object so the card can animate out with its content
  const [last, setLast] = useState<SceneObject | null>(obj);
  if (obj && obj !== last) setLast(obj);
  const parts = useCardParts({ obj: last, data, openForm, onExpand });
  const anchor = obj ? (obj.screen ?? (typeof window !== "undefined" ? { x: window.innerWidth / 2, y: window.innerHeight / 2 } : null)) : null;
  return (
    <InspectCard
      open={Boolean(obj)}
      anchor={anchor}
      onClose={onClose}
      onExpand={onExpand}
      eyebrow={parts?.eyebrow}
      title={parts?.title ?? ""}
      aside={parts?.aside}
      actions={parts?.actions}
      width={326}
    >
      {parts?.body}
      {parts && <p className={s.cardHint}>Enter to expand · Esc to close</p>}
    </InspectCard>
  );
}

interface CardParts {
  eyebrow: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  body: ReactNode;
  actions: ReactNode;
}

function useCardParts({ obj, data, openForm, onExpand }: { obj: SceneObject | null; data: DashboardData; openForm: ReturnType<typeof useFormDrawer>["open"]; onExpand: () => void }): CardParts | null {
  const tax = usePropertyTax();
  if (!obj) return null;
  const u = obj.unitId ? data.units.find((x) => x.id === obj.unitId) : undefined;
  const details = (
    <Button size="sm" variant="ghost" iconRight={<ArrowUpRight />} onClick={onExpand}>
      Details
    </Button>
  );
  const recordRent = (leaseId?: string) => (
    <Button size="sm" variant="primary" icon={<ReceiptIndianRupee />} onClick={() => openForm({ kind: "payment", props: leaseId ? { defaults: { leaseId } } : undefined })}>
      Record rent
    </Button>
  );
  const newLease = (unitId: string, name: string) => (
    <Button size="sm" variant="primary" icon={<FileSignature />} onClick={() => openForm({ kind: "lease", title: `New lease · ${name}`, props: { defaults: { unitId } } })}>
      New lease
    </Button>
  );
  const call = (phone: string | null | undefined, name: string) =>
    phone ? (
      <a className={cx(s.cardCall)} href={telHref(phone)} title={`Call ${name}`}>
        <Phone aria-hidden /> Call
      </a>
    ) : null;

  switch (obj.kind) {
    case "unit":
    case "tenant":
    case "tolet": {
      if (!u) return { eyebrow: "Plot slot", title: "No unit here yet", body: <p className={s.cardText}>Build a unit in Config and it appears in the world.</p>, actions: <LinkButton size="sm" href="/config#units" variant="primary">Build a unit</LinkButton> };
      const lease = u.activeLease;
      const np = u.nextPayment;
      const pos = positionLabel(u.position);
      if (obj.kind === "tenant" && lease)
        return {
          eyebrow: `Tenant · ${u.name}`,
          title: lease.tenantName,
          aside: <RentStatePill unit={u} />,
          body: (
            <dl className={s.cardFacts}>
              <div>
                <dt>Phone</dt>
                <dd>{lease.tenantPhone ? <a href={telHref(lease.tenantPhone)} className={s.cardTel}>{lease.tenantPhone}</a> : "—"}</dd>
              </div>
              <div>
                <dt>Since</dt>
                <dd className="num">{formatDate(lease.startDate)}</dd>
              </div>
              <div>
                <dt>Rent</dt>
                <dd className="num">{inr(lease.monthlyRent)}/month</dd>
              </div>
              <div>
                <dt>Deposit held</dt>
                <dd className="num">{inr(u.depositHeld)}</dd>
              </div>
            </dl>
          ),
          actions: (
            <>
              {call(lease.tenantPhone, firstName(lease.tenantName))}
              {recordRent(lease.id)}
              {details}
            </>
          ),
        };
      const vacant = u.vacantPeriods.find((v) => v.ongoing);
      return {
        eyebrow: `${pos ? `${pos} unit` : "Unit"} · ${u.type}`,
        title: u.name,
        aside: (
          <span className={s.pills}>
            <UnitStatusPill unit={u} />
            <RentStatePill unit={u} />
          </span>
        ),
        body: (
          <div className={s.cardBody}>
            {lease ? (
              <div className={s.cardRow}>
                <span className={s.cardWho}>{lease.tenantName}</span>
                <span className="num dim">{inr(lease.monthlyRent)}/mo</span>
              </div>
            ) : u.incomingLease ? (
              <div className={s.cardRow}>
                <span className={s.cardWho}>{u.incomingLease.tenantName}</span>
                <span className="dim">moves in {formatDate(u.incomingLease.startDate)}</span>
              </div>
            ) : (
              <div className={s.cardRow}>
                <span className={s.cardWho}>Empty</span>
                {vacant && <span className="dim">{vacant.days} days · since {formatDate(vacant.start)}</span>}
              </div>
            )}
            {np && np.arrears.months.length > 0 ? (
              <div className={cx(s.cardStat, s.cardStatBad)}>
                <span>Owes {monthList(np.arrears.months.map((m) => m.label))}</span>
                <Fig value={np.arrears.totalWithFees} size="md" tone="expense" compact={false} animate={false} />
              </div>
            ) : np ? (
              <div className={s.cardStat}>
                <span>Next rent {np.label} · due {formatDate(np.dueDate)}</span>
                <Fig value={np.amountDue} size="md" compact={false} animate={false} />
              </div>
            ) : vacant && vacant.unrealizedLoss > 0 ? (
              <div className={s.cardStat}>
                <span>Rent lost while empty</span>
                <Fig value={vacant.unrealizedLoss} size="md" tone="dim" compact={false} animate={false} />
              </div>
            ) : null}
            <div className={s.cardStat}>
              <span>Worth now (est.)</span>
              <Fig value={u.valuation} size="md" paper={u.valuationSource === "offer" ? "offer" : "est."} animate={false} compact />
            </div>
          </div>
        ),
        actions: (
          <>
            {lease ? recordRent(lease.id) : newLease(u.id, u.name)}
            {lease && call(lease.tenantPhone, firstName(lease.tenantName))}
            {details}
          </>
        ),
      };
    }
    case "mailbox": {
      const last = data.recentPayments.slice(0, 2);
      return {
        eyebrow: "Mailbox",
        title: "Rent & receipts",
        body: (
          <div className={s.cardBody}>
            {data.kpis.overdueAmount > 0 && (
              <div className={cx(s.cardStat, s.cardStatBad)}>
                <span>Overdue now</span>
                <Fig value={data.kpis.overdueAmount} size="md" tone="expense" compact={false} animate={false} />
              </div>
            )}
            {last.length ? (
              last.map((r) => (
                <div key={r.id} className={s.cardRow}>
                  <span>
                    {formatDate(r.paymentDate)} · {firstName(r.tenantName)}
                  </span>
                  <span className="num pos">{inr(r.amount)}</span>
                </div>
              ))
            ) : (
              <p className={s.cardText}>No rent recorded yet.</p>
            )}
          </div>
        ),
        actions: (
          <>
            {recordRent()}
            {details}
          </>
        ),
      };
    }
    case "noticeboard": {
      const items = [...data.actions.pending].sort((a, z) => Number(z.isOverdue) - Number(a.isOverdue)).slice(0, 3);
      return {
        eyebrow: "Notice board",
        title: `${data.actions.pending.length} to do`,
        body: items.length ? (
          <ul className={s.cardList}>
            {items.map((a) => (
              <li key={a.id} className={cx(a.isOverdue && s.cardLate)}>
                {a.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.cardText}>Nothing on the board.</p>
        ),
        actions: (
          <>
            <Button size="sm" variant="primary" icon={<ListPlus />} onClick={() => openForm({ kind: "action" })}>
              Add a to-do
            </Button>
            {details}
          </>
        ),
      };
    }
    case "pole": {
      const withNo = data.units.filter((x) => x.isActive);
      const pay = withNo.find((x) => x.electricityPayUrl)?.electricityPayUrl;
      return {
        eyebrow: "Electric pole",
        title: "TNPDCL",
        body: (
          <div className={s.cardBody}>
            {withNo.map((x) => (
              <div key={x.id} className={s.cardRow}>
                <span>{x.name}</span>
                <span className="num">{x.electricityConsumerNumber ?? "—"}</span>
              </div>
            ))}
          </div>
        ),
        actions: (
          <>
            {pay && (
              <a className={s.cardCall} href={pay} target="_blank" rel="noopener noreferrer">
                Pay electricity <ExternalLink aria-hidden />
              </a>
            )}
            {details}
          </>
        ),
      };
    }
    case "taxstamp": {
      const thisYear = new Date(data.asOf).getUTCFullYear();
      const due = (tax.data?.items ?? []).filter((t) => t.status === "Due" && t.year <= thisYear);
      return {
        eyebrow: "Tax stamp",
        title: "Property tax",
        body: due.length ? (
          <div className={s.cardBody}>
            {due.slice(0, 3).map((t) => (
              <div key={t.id} className={s.cardRow}>
                <span>
                  {t.year} · {t.unit.name}
                </span>
                <span className="num">{inr(t.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={s.cardText}>{tax.loading ? "Checking…" : "Nothing due."}</p>
        ),
        actions: details,
      };
    }
    case "plot":
      return {
        eyebrow: "Plot",
        title: `${data.plot.areaSqft.toLocaleString("en-IN")} sqft`,
        body: (
          <dl className={s.cardFacts}>
            <div>
              <dt>Front</dt>
              <dd className="num">{data.plot.frontWidthFt} ft</dd>
            </div>
            <div>
              <dt>Back</dt>
              <dd className="num">{data.plot.backWidthFt} ft</dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd className="num">{data.plot.depthFt} ft</dd>
            </div>
            {data.plot.usingDefaults && <p className={s.cardText}>Using the site-plan drawing — set exact sizes in Config.</p>}
          </dl>
        ),
        actions: (
          <>
            <LinkButton size="sm" variant="secondary" href="/config#plot" icon={<Ruler />}>
              Edit plot
            </LinkButton>
            {details}
          </>
        ),
      };
  }
}
