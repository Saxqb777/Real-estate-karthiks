// The tax collector's walk (owner, 9/10/2026): one continuous loop that stays outside the compound wall and clear of
// the EB pole, the door-number pole, the moped and the policeman — for the site plan and for other plot sizes.
import { describe, expect, it } from "vitest";
import { computeSiteLayout, type SceneUnit } from "../../../lib/site-layout";
import type { Pt } from "../../../lib/site-layout";
import { GUARD_AT, collectorRoutine, mopedFrame } from "../tax-route";

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
const UNITS = [unit({}), unit({ id: "u2", name: "Unit B", position: "back" })];
const PLOTS = [
  { frontWidthFt: 23.25, backWidthFt: 22.25, depthFt: 76.66, areaSqft: 1744.02, townName: "Pattukottai" },
  { frontWidthFt: 40, backWidthFt: 40, depthFt: 60, areaSqft: 2400, townName: "Pattukottai" },
  { frontWidthFt: 18, backWidthFt: 20, depthFt: 100, areaSqft: 1900, townName: "Pattukottai" },
];
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);

describe("tax collector's day", () => {
  for (const plot of PLOTS) {
    const L = computeSiteLayout(plot, UNITS);
    const { segs, period } = collectorRoutine(L);
    const label = `${plot.frontWidthFt}′ × ${plot.depthFt}′`;
    // every point he passes on foot
    const walkPts = segs.filter((s) => s.act === "walk").flatMap((s) => Array.from({ length: 21 }, (_, k) => ({ x: s.a.x + ((s.b.x - s.a.x) * k) / 20, z: s.a.z + ((s.b.z - s.a.z) * k) / 20 })));

    it(`is one continuous loop (${label})`, () => {
      expect(period).toBeGreaterThan(40);
      expect(segs[0].t0).toBe(0);
      segs.forEach((s, i) => {
        const next = segs[(i + 1) % segs.length];
        expect(s.t1).toBeGreaterThan(s.t0);
        if (i + 1 < segs.length) expect(next.t0).toBeCloseTo(s.t1, 9);
        expect(dist(s.b, next.a)).toBeLessThan(1e-9);
      });
      expect(segs[segs.length - 1].t1).toBeCloseTo(period, 9);
    });

    it(`walks outside the compound wall (${label})`, () => {
      const R = L.plot.rightX;
      for (const p of walkPts) expect(p.x > R + 1 || p.z < -1).toBe(true);
    });

    it(`keeps clear of the EB pole, the door-number pole, the moped and the policeman (${label})`, () => {
      const pole = L.fixtures.poles[0];
      const gate = L.compoundWalls.find((w) => w.gate === "front")!;
      const numberPole = { x: Math.max(gate.a.x, gate.b.x) + 1.8, z: -1.3 };
      const frame = mopedFrame(L);
      const guard = frame.at(GUARD_AT.x, GUARD_AT.z);
      for (const p of walkPts) {
        expect(dist(p, pole)).toBeGreaterThan(1.5);
        expect(dist(p, numberPole)).toBeGreaterThan(1.2);
        expect(dist(p, guard)).toBeGreaterThan(1.2);
        const q = frame.local(p); // the moped body: |x| ≤ 0.5, z −2.7 … 2.6 in its own frame
        expect(Math.abs(q.x) > 0.9 || q.z < -3.1 || q.z > 3).toBe(true);
      }
    });
  }
});
