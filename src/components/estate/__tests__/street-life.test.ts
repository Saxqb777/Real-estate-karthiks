// The people on the grass (owner, 9/10/2026: a passer-by stood right beside the waiting tenant, both on the gate kolam).
// Plays everyone's day — the passers-by, both tenants, the dog family (a mother and her 2 pups on the lane side), the
// property manager, the revenue officer, the photographer, the policeman and the cow — over two hours of scene time on
// three plot sizes (and with the front house empty) and checks: nobody stands within 4 ft of anybody, nobody walks
// through someone standing, nobody stands on a kolam, and the passers-by take turns on the front grass.
import { describe, expect, it } from "vitest";
import { computeSiteLayout, type Pt, type SceneUnit, type SiteLayout } from "../../../lib/site-layout";
import { GUARD_AT, collectorRoutine, mopedFrame } from "../tax-route";
import {
  KOLAM_FT,
  WALKERS,
  PUP_CYCLE,
  cowSpot,
  dogFamily,
  gatePoint,
  gateSign,
  kolamCentre,
  legTimeline,
  managerAt,
  managerLoop,
  photographerSpot,
  pupAt,
  streetSchedule,
  tenantAt,
  tenantRoute,
  tenantWaitSpot,
  walkerAt,
} from "../street-life";

const unit = (over: Partial<SceneUnit>): SceneUnit => ({
  id: "u1",
  name: "Unit A",
  position: "front",
  floors: 1,
  footprintWidthFt: null,
  footprintDepthFt: null,
  status: "occupied",
  rentState: "paid",
  isActive: true,
  ...over,
});
const PLOTS = [
  { frontWidthFt: 23.25, backWidthFt: 22.25, depthFt: 76.66, areaSqft: 1744.02, townName: "Pattukottai" },
  { frontWidthFt: 40, backWidthFt: 40, depthFt: 60, areaSqft: 2400, townName: "Pattukottai" },
  { frontWidthFt: 18, backWidthFt: 20, depthFt: 100, areaSqft: 1900, townName: "Pattukottai" },
];
const CASES = PLOTS.flatMap((plot) => [
  { plot, units: [unit({}), unit({ id: "u2", name: "Unit B", position: "back" })], label: `${plot.frontWidthFt}′ × ${plot.depthFt}′` },
  { plot, units: [unit({ status: "vacant", rentState: "none" }), unit({ id: "u2", name: "Unit B", position: "back" })], label: `${plot.frontWidthFt}′ × ${plot.depthFt}′, front empty` },
]);

type Body = { who: string; p: Pt; standing: boolean; r: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
const mod = (t: number, p: number) => ((t % p) + p) % p;

function cast(L: SiteLayout) {
  const walkers = streetSchedule(L);
  const tenants = L.slots
    .map((slot, index) => ({ slot, index, sign: gateSign(L, slot.slot) }))
    .filter((t) => t.slot.status === "occupied" && t.sign)
    .map((t) => ({ ...t, tl: legTimeline(tenantRoute(t.slot, gatePoint(t.sign!))) }));
  const loop = managerLoop(L);
  const day = collectorRoutine(L);
  const fam = dogFamily(L);
  const statics: Body[] = [
    // she's ~3.4 ft nose to rump (+ the tail curled round): a 1.9 ft body
    { who: "dog", p: { x: fam.x, z: fam.z }, standing: true, r: 1.9 },
    { who: "photographer", p: photographerSpot(L), standing: true, r: 1.3 },
    { who: "policeman", p: mopedFrame(L).at(GUARD_AT.x, GUARD_AT.z), standing: true, r: 0.7 },
  ];
  const kolams = tenants.map((t) => kolamCentre(t.sign!));
  return {
    kolams,
    tenants,
    at(t: number): Body[] {
      const out: Body[] = [...statics];
      for (const i of [0, 1] as const) {
        const s = pupAt(fam, i, t);
        out.push({ who: `pup${i}`, p: { x: s.x, z: s.z }, standing: s.speed === 0, r: 0.6 });
      }
      const cow = cowSpot(L);
      out.push({ who: "cow", p: { x: cow.x + Math.sin((t + 3.7) * 0.05) * 1.5, z: cow.z }, standing: true, r: 2.6 });
      walkers.forEach((w, i) => {
        const s = walkerAt(w, t);
        if (s.on) out.push({ who: `walker${i}`, p: s.p, standing: !!s.stop, r: 0.7 * WALKERS[i].scale });
      });
      for (const tn of tenants) {
        const s = tenantAt(tn.tl, t, tn.index);
        if (s.y < 0.01) out.push({ who: `tenant-${tn.slot.slot}`, p: { x: s.x, z: s.z }, standing: !s.moving, r: 0.7 });
      }
      const m = managerAt(loop, t);
      out.push({ who: "manager", p: { x: m.x, z: m.z }, standing: m.writing, r: 0.7 });
      const tt = mod(t + 4, day.period);
      const sg = day.segs.find((x) => tt < x.t1) ?? day.segs[day.segs.length - 1];
      const k = sg.t1 > sg.t0 ? Math.min(1, Math.max(0, (tt - sg.t0) / (sg.t1 - sg.t0))) : 1;
      out.push({ who: "officer", p: { x: sg.a.x + (sg.b.x - sg.a.x) * k, z: sg.a.z + (sg.b.z - sg.a.z) * k }, standing: sg.act !== "walk", r: 0.7 });
      return out;
    },
  };
}

// the revenue officer perches on her moped right by the policeman who guards it (tax-route.test checks that walk); the
// pups nap against their mother and play round her
const family = (w: string) => w === "dog" || w.startsWith("pup");
const intended = (a: string, b: string) => (a === "officer" && b === "policeman") || (a === "policeman" && b === "officer") || (family(a) && family(b));

describe("the people on the grass", () => {
  for (const c of CASES) {
    const L = computeSiteLayout(c.plot, c.units);
    const street = cast(L);

    it(`nobody stands in anybody or walks through someone standing (${c.label})`, () => {
      const bad: string[] = [];
      for (let t = 0; t < 7200 && bad.length < 8; t += 0.25) {
        const bodies = street.at(t);
        for (let i = 0; i < bodies.length; i++)
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const b = bodies[j];
            if (intended(a.who, b.who)) continue;
            const d = dist(a.p, b.p);
            // two standing still: a clear 4 ft between two people (more round the cow / the tripod)
            if (a.standing && b.standing && d < 4 + (a.r - 0.7) + (b.r - 0.7)) bad.push(`t=${t} ${a.who} + ${b.who} standing ${d.toFixed(2)} ft apart`);
            // one walking past someone standing: never through them
            else if (a.standing !== b.standing && d < a.r + b.r + 0.2) bad.push(`t=${t} ${a.standing ? b.who : a.who} walks through ${a.standing ? a.who : b.who} (${d.toFixed(2)} ft)`);
          }
      }
      expect(bad).toEqual([]);
    });

    it(`nobody stands on a kolam (${c.label})`, () => {
      const half = KOLAM_FT / 2;
      const bad: string[] = [];
      for (let t = 0; t < 3600 && bad.length < 8; t += 0.25)
        for (const b of street.at(t))
          if (b.standing)
            for (const k of street.kolams)
              // feet (the body's centre) clear of the square by a few inches
              if (Math.abs(b.p.x - k.x) < half + 0.3 && Math.abs(b.p.z - k.z) < half + 0.3) bad.push(`t=${t} ${b.who} on the kolam at ${k.x.toFixed(1)}, ${k.z.toFixed(1)}`);
      expect(bad).toEqual([]);
    });

    it(`the passers-by take turns on the front grass (${c.label})`, () => {
      const plans = streetSchedule(L);
      const crossers = plans.filter((_, i) => WALKERS[i].route.kind === "cross");
      for (let t = 0; t < 1800; t += 0.5) expect(crossers.filter((p) => walkerAt(p, t).on).length).toBeLessThanOrEqual(1);
    });

    it(`the pups stay with their mother and never run through her (${c.label})`, () => {
      const fam = dogFamily(L);
      const bad: string[] = [];
      for (let t = 0; t < PUP_CYCLE; t += 0.05)
        for (const i of [0, 1] as const) {
          const s = pupAt(fam, i, t);
          // her body in her own frame: u along her, w across (she's an ellipse ~2.4 × 0.6 ft round her middle)
          const dx = s.x - fam.x;
          const dz = s.z - fam.z;
          const u = dx * fam.fx + dz * fam.fz - 0.2;
          const w = dx * fam.fz - dz * fam.fx;
          if ((u / 2.35) ** 2 + (w / 0.75) ** 2 < 1) bad.push(`t=${t.toFixed(2)} pup${i} inside her at u ${u.toFixed(2)}, w ${w.toFixed(2)}`);
          if (Math.hypot(dx, dz) > 3.2) bad.push(`t=${t.toFixed(2)} pup${i} ${Math.hypot(dx, dz).toFixed(2)} ft from her`);
          if (s.speed > 4) bad.push(`t=${t.toFixed(2)} pup${i} at ${s.speed.toFixed(1)} ft/s`);
        }
      expect(bad.slice(0, 8)).toEqual([]);
      // both nap against her for a good part of the day, and each one is up and about at some point
      for (const i of [0, 1] as const) {
        const acts = Array.from({ length: PUP_CYCLE * 4 }, (_, k) => pupAt(fam, i, k / 4).act);
        expect(acts.filter((a) => a === "nap").length / acts.length).toBeGreaterThan(0.5);
        expect(acts).toContain("run");
      }
    });

    it(`a tenant waits beside the gate, facing it, with the gate shut (${c.label})`, () => {
      for (const tn of street.tenants) {
        const gate = gatePoint(tn.sign!);
        const legs = tenantRoute(tn.slot, gate);
        expect(legs[0].look).toBe("gate");
        expect(legs[0].pause).toBeGreaterThan(5);
        // the gate opens within 2.4 ft (gate-state.ts): the waiting spot stays outside that
        expect(dist(tenantWaitSpot(gate), gate)).toBeGreaterThan(2.4);
      }
    });
  }
});
