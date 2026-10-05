"use client";
// "?" help overlay: labels every hotspot in the 3D world (from the scene's live object positions) — names only. Esc / ? / a click closes it.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ObjectScreenFn, SceneObjectKind } from "@/components/estate/EstateSceneLazy";
import { cx, useIsClient } from "@/components/ui";
import { useEscape } from "@/components/hud";
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

function worldSpots(units: UnitBreakdown[], mobile: boolean): Spot[] {
  const out: Spot[] = [];
  for (const u of units) {
    out.push({
      key: `unit:${u.id}`,
      kind: "unit",
      unitId: u.id,
      title: u.name,
      opens: mobile ? "Tap · hold for actions" : "Click: details · right-click: actions",
    });
    if (u.activeLease) out.push({ key: `tenant:${u.id}`, kind: "tenant", unitId: u.id, title: "Tenant", opens: "Profile · tap to call" });
    if (u.status === "vacant" && u.isActive) out.push({ key: `tolet:${u.id}`, kind: "tolet", unitId: u.id, title: "TO-LET board", opens: "Sign a new lease" });
  }
  out.push(
    { key: "mailbox", kind: "mailbox", title: "Mailbox", opens: "Record rent · receipts" },
    { key: "noticeboard", kind: "noticeboard", title: "Property manager", opens: "To-dos" },
    { key: "pole", kind: "pole", title: "EB pole", opens: "TNPDCL numbers · pay link" },
    { key: "taxstamp", kind: "taxstamp", title: "Tax office", opens: "Property tax · mark paid" },
    { key: "plot", kind: "plot", title: "Plot marker", opens: "Plot size" },
    { key: "car", kind: "car", title: "Car", opens: "Drive off · sign out" },
  );
  return out;
}

const LABEL_H = 28;

function placeWorld(spots: Spot[], locate: ObjectScreenFn | null): Placed[] {
  if (!locate) return [];
  const vw = window.innerWidth;
  const found = spots
    .map((sp) => ({ sp, p: locate(sp.kind, sp.unitId) }))
    .filter((x): x is { sp: Spot; p: { x: number; y: number } } => Boolean(x.p) && x.p!.x > 0 && x.p!.x < vw && x.p!.y > 0 && x.p!.y < window.innerHeight);
  const cx = found.length ? found.reduce((a, f) => a + f.p.x, 0) / found.length : vw / 2;
  const out: Placed[] = [];
  for (const side of ["left", "right"] as const) {
    const list = found.filter((f) => f.p.x < cx === (side === "left")).sort((a, b) => a.p.y - b.p.y);
    let lastY = -Infinity;
    for (const { sp, p } of list) {
      const ly = Math.max(p.y - LABEL_H / 2, lastY + LABEL_H + 6);
      lastY = ly;
      // keep the whole label on screen (its width is estimated from the text)
      const w = sp.title.length * 8.2 + 22;
      const lx = side === "left" ? Math.max(p.x - 44, w + 6) : Math.min(p.x + 44, vw - w - 6);
      out.push({ key: sp.key, x: p.x, y: p.y, lx, ly, side, title: sp.title, opens: sp.opens });
    }
  }
  return out;
}

export function HelpOverlay({ open, onClose, locate, units, mobile = false }: HelpOverlayProps) {
  const isClient = useIsClient();
  const [world, setWorld] = useState<Placed[]>([]);

  useLayoutEffect(() => {
    if (!open) return;
    const spots = worldSpots(units, mobile);
    const place = () => {
      setWorld(placeWorld(spots, locate));
    };
    place();
    const id = window.setInterval(place, 400);
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", place);
    };
  }, [open, units, locate, mobile]);

  // Esc joins the HUD's one Esc stack (so it never also closes a panel underneath); "?" toggles it off
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!isClient) return null;

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
          {world.map((w) => (
            <div key={w.key}>
              <span className={s.pin} style={{ left: w.x, top: w.y }} />
              <svg className={s.leader} aria-hidden>
                <line x1={w.x} y1={w.y} x2={w.lx} y2={w.ly + LABEL_H / 2} />
              </svg>
              <span className={cx(s.label, w.side === "left" && s.labelLeft)} style={{ left: w.lx, top: w.ly }}>
                <b>{w.title}</b>
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
