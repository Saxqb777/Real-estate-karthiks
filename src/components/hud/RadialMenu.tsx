"use client";
// Radial action wheel for a house (right-click / long-press → SceneObject contract's onUnitContextMenu).
// Six slots, keys 1–6, context aware: Record rent · Add expense · Call tenant · Pay electricity · Add to-do ·
// Move out (or New lease when empty). Each slot opens the real form in a drawer (or tel: / the TNPDCL site).
import { DoorOpen, FileSignature, ListPlus, Phone, ReceiptIndianRupee, Wallet, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx, isFocusTrapActive, useIsClient } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { useFormDrawer, type HudFormRequest } from "./FormDrawer";
import { firstName, positionLabel, telHref } from "./format";
import { useEscape } from "./store";
import s from "./radial.module.css";

export interface RadialMenuProps {
  data: DashboardData;
  /** the house that was right-clicked (null = closed) */
  unitId: string | null;
  /** viewport px where it was clicked */
  at: { x: number; y: number } | null;
  onClose: () => void;
}

interface Slot {
  key: string;
  short: string;
  label: string;
  icon: ReactNode;
  disabled?: string;
  run: () => void;
}

const R_OUT = 112;
const R_IN = 48;
const SIZE = R_OUT * 2 + 8;
const C = SIZE / 2;
const GAP = 0.035; // radians between wedges

function wedge(i: number, n: number, r0: number, r1: number) {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n + GAP;
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n - GAP;
  const p = (r: number, a: number) => `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`;
  return `M${p(r1, a0)}A${r1},${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 0 0 ${p(r0, a0)}Z`;
}
function centerOf(i: number, n: number, r: number) {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

export function RadialMenu({ data, unitId, at, onClose }: RadialMenuProps) {
  const isClient = useIsClient();
  const forms = useFormDrawer();
  const [hover, setHover] = useState<number | null>(null);
  const u = unitId ? data.units.find((x) => x.id === unitId) : undefined;
  const open = Boolean(u && at);
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);

  const go = (r: HudFormRequest) => {
    onClose();
    forms.open(r);
  };
  const lease = u?.activeLease ?? null;
  const slots: Slot[] = u
    ? [
        {
          key: "rent",
          short: "Rent",
          label: lease ? `Record rent from ${firstName(lease.tenantName)}` : "Record rent",
          icon: <ReceiptIndianRupee />,
          disabled: lease ? undefined : "Nobody lives here now",
          run: () => lease && go({ kind: "payment", title: `Record rent · ${u.name}`, props: { defaults: { leaseId: lease.id } } }),
        },
        { key: "expense", short: "Expense", label: `Add an expense for ${u.name}`, icon: <Wallet />, run: () => go({ kind: "expense", props: { defaults: { unitId: u.id } } }) },
        {
          key: "call",
          short: "Call",
          label: lease?.tenantPhone ? `Call ${firstName(lease.tenantName)} · ${lease.tenantPhone}` : "Call tenant",
          icon: <Phone />,
          disabled: lease?.tenantPhone ? undefined : lease ? "No phone number saved" : "No tenant",
          run: () => {
            if (!lease?.tenantPhone) return;
            onClose();
            window.location.href = telHref(lease.tenantPhone);
          },
        },
        {
          key: "eb",
          short: "Pay EB",
          label: u.electricityConsumerNumber ? `Pay electricity · ${u.electricityConsumerNumber}` : "Pay electricity",
          icon: <Zap />,
          disabled: u.electricityPayUrl ? undefined : "No pay link saved (Config → Units)",
          run: () => {
            if (!u.electricityPayUrl) return;
            onClose();
            window.open(u.electricityPayUrl, "_blank", "noopener,noreferrer");
          },
        },
        { key: "todo", short: "To-do", label: `Add a to-do for ${u.name}`, icon: <ListPlus />, run: () => go({ kind: "action", props: { defaults: { unitId: u.id } } }) },
        lease
          ? {
              key: "moveout",
              short: "Move out",
              label: `${firstName(lease.tenantName)} is moving out`,
              icon: <DoorOpen />,
              run: () =>
                go({
                  kind: "moveOut",
                  title: `Move out · ${lease.tenantName}`,
                  props: { lease: { id: lease.id, startDate: lease.startDate, securityDeposit: lease.securityDeposit, unit: { name: u.name }, tenant: { name: lease.tenantName } } },
                }),
            }
          : { key: "lease", short: "New lease", label: `Sign a new lease for ${u.name}`, icon: <FileSignature />, run: () => go({ kind: "lease", title: `New lease · ${u.name}`, props: { defaults: { unitId: u.id } } }) },
      ]
    : [];

  // keys 1–6 (capture phase so the dock's 1–6 don't also fire)
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isFocusTrapActive() || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 6) {
        e.preventDefault();
        e.stopPropagation();
        const sl = slotsRef.current[n - 1];
        if (sl && !sl.disabled) sl.run();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose]);

  if (!isClient) return forms.element;
  const pos = at
    ? {
        left: Math.min(Math.max(at.x, SIZE / 2 + 8), window.innerWidth - SIZE / 2 - 8),
        top: Math.min(Math.max(at.y, SIZE / 2 + 8), window.innerHeight - SIZE / 2 - 8),
      }
    : { left: 0, top: 0 };
  const hs = hover !== null ? slots[hover] : null;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && u && (
            <motion.div
              key="radial"
              ref={ref}
              className={s.wheel}
              style={{ left: pos.left, top: pos.top, width: SIZE, height: SIZE }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role="menu"
              aria-label={`Actions for ${u.name}`}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg width={SIZE} height={SIZE} className={s.svg} aria-hidden>
                <circle cx={C} cy={C} r={R_OUT + 3} className={s.halo} />
                {slots.map((sl, i) => (
                  <path key={sl.key} d={wedge(i, slots.length, R_IN, R_OUT)} className={cx(s.wedge, hover === i && s.wedgeOn, sl.disabled && s.wedgeOff)} />
                ))}
                <circle cx={C} cy={C} r={R_IN - 6} className={s.hub} />
              </svg>
              {slots.map((sl, i) => {
                const c = centerOf(i, slots.length, (R_IN + R_OUT) / 2 + 2);
                return (
                  <motion.button
                    key={sl.key}
                    type="button"
                    role="menuitem"
                    className={cx(s.slot, sl.disabled && s.slotOff)}
                    style={{ left: c.x, top: c.y }}
                    aria-disabled={Boolean(sl.disabled)}
                    aria-label={`${i + 1}. ${sl.label}${sl.disabled ? ` — ${sl.disabled}` : ""}`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                    onFocus={() => setHover(i)}
                    onClick={() => !sl.disabled && sl.run()}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.18, delay: 0.03 * i }}
                  >
                    <span className={s.slotIcon}>{sl.icon}</span>
                    <span className={s.slotLabel}>{sl.short}</span>
                    <span className={s.slotKey}>{i + 1}</span>
                  </motion.button>
                );
              })}
              <div className={s.center}>
                {hs ? (
                  <span className={s.centerAction}>{hs.disabled ?? hs.label}</span>
                ) : (
                  <>
                    <span className={s.centerName}>{u.name}</span>
                    <span className={s.centerSub}>{positionLabel(u.position) ?? u.type}</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
      {forms.element}
    </>
  );
}
