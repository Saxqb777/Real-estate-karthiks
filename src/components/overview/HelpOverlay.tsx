"use client";
// "?" help overlay: labels every hotspot in the 3D world (from the scene's live object positions) and every HUD
// control (elements carrying data-help="…"), plus the keyboard shortcuts. Esc / ? / a click closes it.
import { PlayCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ObjectScreenFn, SceneObjectKind } from "@/components/estate/EstateSceneLazy";
import { Button, IconButton, Kbd, cx, useIsClient } from "@/components/ui";
import type { UnitBreakdown } from "@/lib/dashboard-types";
import s from "./help.module.css";

export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
  locate: ObjectScreenFn | null;
  units: UnitBreakdown[];
  mobile?: boolean;
  onReplayTour: () => void;
}

interface Spot {
  key: string;
  kind: SceneObjectKind;
  unitId?: string;
  title: string;
  opens: string;
}

interface Placed {
  key: string;
  x: number;
  y: number;
  lx: number;
  ly: number;
  side: "left" | "right";
  title: string;
  opens: string;
}

interface HudLabel {
  key: string;
  box: { x: number; y: number; w: number; h: number };
  text: string;
  lx: number;
  ly: number;
  lw: number;
  lh: number;
}

function worldSpots(units: UnitBreakdown[], mobile: boolean): Spot[] {
  const out: Spot[] = [];
  for (const u of units) {
    out.push({ key: `unit:${u.id}`, kind: "unit", unitId: u.id, title: u.name, opens: mobile ? "Tap: details · hold: actions" : "Click: details · right-click: actions" });
    if (u.activeLease) out.push({ key: `tenant:${u.id}`, kind: "tenant", unitId: u.id, title: "Tenant", opens: "Profile · tap to call" });
    if (u.status === "vacant" && u.isActive) out.push({ key: `tolet:${u.id}`, kind: "tolet", unitId: u.id, title: "TO-LET board", opens: "Sign a new lease" });
  }
  out.push(
    { key: "mailbox", kind: "mailbox", title: "Mailbox", opens: "Record rent · receipts" },
    { key: "noticeboard", kind: "noticeboard", title: "Notice board", opens: "To-dos" },
    { key: "pole", kind: "pole", title: "EB pole", opens: "TNPDCL numbers · pay link" },
    { key: "taxstamp", kind: "taxstamp", title: "Tax stamp", opens: "Property tax · mark paid" },
    { key: "plot", kind: "plot", title: "Plot marker", opens: "Plot size" },
  );
  return out;
}

const LABEL_H = 38;

function placeWorld(spots: Spot[], locate: ObjectScreenFn | null): Placed[] {
  if (!locate) return [];
  const vw = window.innerWidth;
  const found = spots
    .map((sp) => ({ sp, p: locate(sp.kind, sp.unitId) }))
    .filter((x): x is { sp: Spot; p: { x: number; y: number } } => Boolean(x.p) && x.p!.x > 0 && x.p!.x < vw && x.p!.y > 0 && x.p!.y < window.innerHeight);
  const cx = found.length ? found.reduce((a, f) => a + f.p.x, 0) / found.length : vw / 2;
  const out: Placed[] = [];
  for (const side of ["left", "right"] as const) {
    const list = found.filter((f) => (f.p.x < cx) === (side === "left")).sort((a, b) => a.p.y - b.p.y);
    let lastY = -Infinity;
    for (const { sp, p } of list) {
      const ly = Math.max(p.y - LABEL_H / 2, lastY + LABEL_H + 6);
      lastY = ly;
      const lx = side === "left" ? p.x - 44 : p.x + 44;
      out.push({ key: sp.key, x: p.x, y: p.y, lx, ly, side, title: sp.title, opens: sp.opens });
    }
  }
  return out;
}

function placeHud(): HudLabel[] {
  const els = [...document.querySelectorAll<HTMLElement>("[data-help]")];
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const placed: HudLabel[] = [];
  els.forEach((el, n) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const text = el.dataset.help ?? "";
    const below = r.top < vh / 2;
    const lw = Math.min(Math.max(text.length * 6.7 + 18, 90), 300);
    const lines = Math.ceil((text.length * 6.7) / (lw - 16));
    const lh = 12 + lines * 16;
    const lx = Math.min(Math.max(r.left, 10), vw - lw - 10);
    let ly = below ? r.bottom + 8 : r.top - 8 - lh;
    for (let guard = 0; guard < 8; guard++) {
      const hit = placed.find((p) => lx < p.lx + p.lw + 6 && lx + lw + 6 > p.lx && ly < p.ly + p.lh + 4 && ly + lh + 4 > p.ly);
      if (!hit) break;
      ly = below ? hit.ly + hit.lh + 6 : hit.ly - lh - 6;
    }
    placed.push({ key: `${n}`, box: { x: r.left, y: r.top, w: r.width, h: r.height }, text, lx, ly, lw, lh });
  });
  return placed;
}

export function HelpOverlay({ open, onClose, locate, units, mobile = false, onReplayTour }: HelpOverlayProps) {
  const isClient = useIsClient();
  const [world, setWorld] = useState<Placed[]>([]);
  const [hud, setHud] = useState<HudLabel[]>([]);

  useLayoutEffect(() => {
    if (!open) return;
    const spots = worldSpots(units, mobile);
    const place = () => {
      setWorld(placeWorld(spots, locate));
      setHud(placeHud());
    };
    place();
    const id = window.setInterval(place, 400);
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", place);
    };
  }, [open, units, locate, mobile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!isClient) return null;

  const keys: [ReactNode, string][] = mobile
    ? [
        ["Tap a house", "its tenant, rent and value"],
        ["Hold a house", "the action wheel"],
        ["Tap the mailbox", "record rent"],
        ["Swipe the sheet", "next tab"],
        ["Drag the timeline", "see any past date"],
      ]
    : [
        ["Click a house", "its tenant, rent and value"],
        ["Right-click a house", "action wheel — keys 1–6"],
        [<Kbd key="p">P</Kbd>, "property totals"],
        [
          <span key="n" className={s.keyRange}>
            <Kbd>1</Kbd>–<Kbd>6</Kbd>
          </span>,
          "charts",
        ],
        [<Kbd key="f">F</Kbd>, "hide / show the HUD"],
        [<Kbd key="k" keys={["mod", "k"]} />, "commands: record rent, add expense…"],
        [<Kbd key="e">Esc</Kbd>, "back one step"],
        [
          <span key="a" className={s.keyRange}>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </span>,
          "on the timeline: a month at a time",
        ],
        [<Kbd key="q">?</Kbd>, "this help"],
      ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="help"
          className={s.overlay}
          role="dialog"
          aria-label="Help: what you can click"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {hud.map((h) => (
            <div key={h.key}>
              <span className={s.hudBox} style={{ left: h.box.x - 3, top: h.box.y - 3, width: h.box.w + 6, height: h.box.h + 6 }} />
              <span className={s.hudLabel} style={{ left: h.lx, top: h.ly, width: h.lw }}>
                {h.text}
              </span>
            </div>
          ))}
          {world.map((w) => (
            <div key={w.key}>
              <span className={s.pin} style={{ left: w.x, top: w.y }} />
              <svg className={s.leader} aria-hidden>
                <line x1={w.x} y1={w.y} x2={w.lx} y2={w.ly + LABEL_H / 2} />
              </svg>
              <span className={cx(s.label, w.side === "left" && s.labelLeft)} style={{ left: w.lx, top: w.ly }}>
                <b>{w.title}</b>
                <span>{w.opens}</span>
              </span>
            </div>
          ))}
          <motion.section
            className={cx(s.card, mobile && s.cardMobile)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.05 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={s.cardHead}>
              <div>
                <span className={s.eyebrow}>Help</span>
                <h2 className={s.title}>What you can do here</h2>
              </div>
              <IconButton size="sm" label="Close (Esc)" icon={<X />} onClick={onClose} />
            </header>
            <p className={s.lead}>Everything in the world that glows when you point at it opens something. The labels show what.</p>
            <dl className={s.keys}>
              {keys.map(([k, v], n) => (
                <div key={n} className={s.keyRow}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className={s.cardActions}>
              <Button size="sm" variant="secondary" icon={<PlayCircle />} onClick={onReplayTour}>
                Replay the tour
              </Button>
              <span className={s.flex} />
              <Button size="sm" variant="primary" onClick={onClose}>
                Got it
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
