// The revenue officer sits on her moped (owner 2/11/2026; she used to walk to the gate): on its seat, clear of the
// policeman, the EB pole and the wall — for the site plan and for other plot sizes.
import { describe, expect, it } from "vitest";
import { computeSiteLayout, type SceneUnit } from "../../../lib/site-layout";
import type { Pt } from "../../../lib/site-layout";
import { GUARD_AT, collectorSeat, mopedFrame } from "../tax-route";

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

describe("the revenue officer on her moped", () => {
  for (const plot of PLOTS) {
    const L = computeSiteLayout(plot, UNITS);
    const seat = collectorSeat(L);
    const label = `${plot.frontWidthFt}′ × ${plot.depthFt}′`;

    it(`sits on the moped's seat (${label})`, () => {
      const q = mopedFrame(L).local(seat.p); // the moped body: |x| ≤ 0.5, z −2.7 … 2.6 in its own frame
      expect(Math.abs(q.x)).toBeLessThan(0.9);
      expect(q.z).toBeGreaterThan(-2.7);
      expect(q.z).toBeLessThan(2.6);
    });

    it(`is clear of the policeman, the EB pole and the compound wall (${label})`, () => {
      const guard = mopedFrame(L).at(GUARD_AT.x, GUARD_AT.z);
      expect(dist(seat.p, guard)).toBeGreaterThan(1.2);
      expect(dist(seat.p, L.fixtures.poles[0])).toBeGreaterThan(1.5);
      expect(seat.p.x > L.plot.rightX + 1 || seat.p.z < -1).toBe(true);
    });
  }
});
