// The tax collector's working day (owner, 9/10/2026) as timed segments in plan feet — pure and unit tested so the walk
// keeps clear of the compound wall, the EB pole and the door-number pole for any plot size. Rendered by TaxCollector.tsx.
import type { Pt, SiteLayout } from "../../lib/site-layout";

/** Moped heading (world yaw): parked along the plot, nose to the front, turned a little so the camera sees its side. */
export const MOPED_YAW = 0.35;
/** Walking pace, ft/s. */
export const WALK_SPEED = 2.6;

export type CollectorAct = "perch" | "rise" | "phone" | "walk" | "gate" | "box" | "sit";
export interface RouteSeg {
  act: CollectorAct;
  t0: number;
  t1: number;
  /** plan feet: from → to (equal when standing still) */
  a: Pt;
  b: Pt;
  /** heading while standing still (world yaw; 0 = facing the front) */
  face: number;
}

/** Where the angry policeman stands guard, in the moped's frame (x = its left, z = its front): behind it, plot side. */
export const GUARD_AT = { x: -1.1, z: -3.5 } as const;

/** Heading that faces from plan point a towards plan point b (plan z grows towards the back = world −z). */
export const headingTo = (a: Pt, b: Pt) => Math.atan2(b.x - a.x, -(b.z - a.z));

/** The parked moped's frame: `at` maps a point in it (x = its left, z = its front) to plan feet, `local` back again. */
export function mopedFrame(layout: Pick<SiteLayout, "fixtures">) {
  const m = layout.fixtures.taxStamp;
  const c = Math.cos(MOPED_YAW);
  const s = Math.sin(MOPED_YAW);
  return {
    at: (lx: number, lz: number): Pt => ({ x: m.x + lx * c + lz * s, z: m.z + lx * s - lz * c }),
    local: (p: Pt): Pt => {
      const dx = p.x - m.x;
      const dz = p.z - m.z;
      return { x: dx * c + dz * s, z: dx * s - dz * c };
    },
  };
}

/**
 * The day, looping: paperwork perched on the moped seat → gets up → checks the phone → walks round the front-right
 * corner (behind the EB pole) and along the front wall to the door-number pole right of Gate A → reads the number and
 * writes it up there → walks back → files the register in the cash box on the carrier → sits back down.
 */
export function collectorRoutine(layout: Pick<SiteLayout, "fixtures" | "plot" | "compoundWalls">): { segs: RouteSeg[]; period: number } {
  const { at } = mopedFrame(layout);
  const c = Math.cos(MOPED_YAW);
  const s = Math.sin(MOPED_YAW);
  const R = layout.plot.rightX;
  const gate = layout.compoundWalls.find((w) => w.gate === "front");
  const perch = at(-0.5, -0.45);
  const stand = at(-1.75, -0.35);
  const boxAt = at(-1.25, -1.95);
  const w1 = { x: R + 4.6, z: 3 };
  const w2 = { x: R + 1.6, z: -2.3 };
  const door = { x: (gate ? Math.max(gate.a.x, gate.b.x) : R - 8) + 1.8, z: -2.9 };
  const sideways = Math.atan2(-c, s); // perched: facing out of the moped's right side
  const toBox = Math.atan2(c, -s); // facing the cash box on the carrier
  const segs: RouteSeg[] = [];
  let t = 0;
  const still = (act: CollectorAct, dur: number, p: Pt, face: number, to: Pt = p) => {
    segs.push({ act, t0: t, t1: t + dur, a: p, b: to, face });
    t += dur;
  };
  const walk = (pts: Pt[], speed = WALK_SPEED) => {
    for (let i = 1; i < pts.length; i++) {
      const dur = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) / speed;
      segs.push({ act: "walk", t0: t, t1: t + dur, a: pts[i - 1], b: pts[i], face: headingTo(pts[i - 1], pts[i]) });
      t += dur;
    }
  };
  still("perch", 13, perch, sideways);
  still("rise", 1.2, perch, sideways, stand);
  still("phone", 6, stand, sideways);
  walk([stand, w1, w2, door]);
  still("gate", 8, door, Math.PI);
  walk([door, w2, w1, boxAt]);
  still("box", 2.6, boxAt, toBox);
  walk([boxAt, stand], 1.6);
  still("sit", 1.2, stand, sideways, perch);
  return { segs, period: t };
}
