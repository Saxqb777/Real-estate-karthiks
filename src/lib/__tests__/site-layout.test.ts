// Layout maths for the 3D diorama. Expected values come from the owner's drawing (CLAUDE.md "Site plan").
import { describe, expect, it } from "vitest";
import {
  SITE_DEFAULTS,
  assignSlots,
  computeSiteLayout,
  dimensionMatches,
  formatFeetInches,
  highlightedSlots,
  offsetPolygon,
  polygonArea,
  sceneUnitsFromBreakdown,
  type SceneUnit,
} from "../site-layout";
import type { UnitBreakdown } from "../dashboard-types";

const PLOT = { frontWidthFt: 23.25, backWidthFt: 22.25, depthFt: 76.66, areaSqft: 1744.02, townName: "Pattukottai" };

const unit = (over: Partial<SceneUnit> = {}): SceneUnit => ({
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
const A = unit();
const B = unit({ id: "u2", name: "Unit B", position: "back", status: "vacant", rentState: "none" });

describe("formatFeetInches", () => {
  it("formats like the drawing", () => {
    expect(formatFeetInches(22.25)).toBe(`22'3"`);
    expect(formatFeetInches(23.25)).toBe(`23'3"`);
    expect(formatFeetInches(76.66)).toBe(`76'8"`); // 919.92 in → 920 in = 76'8"
    expect(formatFeetInches(20)).toBe(`20'`);
    expect(formatFeetInches(28)).toBe(`28'`);
    expect(formatFeetInches(9.99)).toBe(`10'`); // 119.88 in → 120 in carries into the feet
    expect(formatFeetInches(0.5)).toBe(`0'6"`);
    expect(formatFeetInches(NaN)).toBe("—");
  });
});

describe("polygon helpers", () => {
  it("signed area is positive counter-clockwise", () => {
    const sq = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 3 },
      { x: 0, z: 3 },
    ];
    expect(polygonArea(sq)).toBe(6);
    expect(polygonArea([...sq].reverse())).toBe(-6);
  });
  it("offsets every edge (uniform and per edge), in either winding", () => {
    const sq = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 2 },
      { x: 0, z: 2 },
    ];
    expect(offsetPolygon(sq, 1)).toEqual([
      { x: -1, z: -1 },
      { x: 3, z: -1 },
      { x: 3, z: 3 },
      { x: -1, z: 3 },
    ]);
    expect(offsetPolygon([...sq].reverse(), -0.5).map((p) => [p.x, p.z])).toEqual([
      [0.5, 1.5],
      [1.5, 1.5],
      [1.5, 0.5],
      [0.5, 0.5],
    ]);
    // front edge pushed 5, others 1
    const t = offsetPolygon(sq, [5, 1, 1, 1]);
    expect(t[0]).toEqual({ x: -1, z: -5 });
    expect(t[2]).toEqual({ x: 3, z: 3 });
  });
});

describe("computeSiteLayout — owner's annotated site plan (images/8.jpg)", () => {
  const L = computeSiteLayout(PLOT, [A, B]);
  const [f, b] = L.slots;

  it("draws the trapezoid: 23'3\" front, 22'3\" back, straight right boundary, slanting lane-side (left) boundary", () => {
    expect(L.plot.rightX).toBe(23.25);
    expect(L.plot.polygon).toEqual([
      { x: 0, z: 0 },
      { x: 23.25, z: 0 },
      { x: 23.25, z: 76.66 },
      { x: 1, z: 76.66 }, // 23.25 − 22.25
    ]);
    expect(polygonArea(L.plot.polygon)).toBeCloseTo(1744.015, 3);
    expect(L.warnings).toEqual([]);
  });

  it("orders front yard → Unit A → courtyard → Unit B against the back, with a clear strip to the back wall", () => {
    expect(f.slot).toBe("front");
    expect(f.unit?.id).toBe("u1");
    expect(b.status).toBe("vacant");
    // usable depth = 76.66 − 1.5 back clearance; the 19.16 ft of open ground is shared by the front yard and the courtyard
    expect(b.rect.z1).toBeCloseTo(75.16, 6);
    expect(b.rect.z0).toBeCloseTo(47.16, 6);
    expect(f.rect.z0).toBeCloseTo(9.58, 6);
    expect(f.rect.z1).toBeCloseTo(37.58, 6);
    expect(L.courtyard!.z0).toBeCloseTo(37.58, 6);
    expect(L.courtyard!.z1).toBeCloseTo(47.16, 6);
    expect(f.yardFt).toBeCloseTo(9.58, 2);
    expect(b.yardFt).toBeCloseTo(9.58, 2);
    expect(L.rearYard.z1 - L.rearYard.z0).toBeCloseTo(1.5, 6);
  });

  it("keeps every house clear of the compound wall: ≥ 3 ft lane passage on the left, 1.5 ft strip on the right", () => {
    for (const s of L.slots) {
      expect(s.rect.x1).toBeCloseTo(23.25 - SITE_DEFAULTS.wallClearFt, 6);
      const leftAt = (z: number) => 23.25 - (23.25 + (22.25 - 23.25) * (z / 76.66));
      expect(s.rect.x0 - Math.max(leftAt(s.rect.z0), leftAt(s.rect.z1))).toBeGreaterThanOrEqual(SITE_DEFAULTS.passageFt - 1e-9);
      expect(s.passageFt).toBeGreaterThanOrEqual(3);
      // drawn a little narrower than 20 ft only for the clearance: not "scaled", and the label keeps 20'
      expect(s.widthFt).toBeLessThan(20);
      expect(s.scaled).toBe(false);
    }
  });

  it("height = floors × 10.5 ft with a 3 ft parapet (single storey + roof terrace by default)", () => {
    expect(f.floors).toBe(1);
    expect(f.heightFt).toBe(10.5);
    expect(f.parapetFt).toBe(3);
    expect(L.maxHeightFt).toBe(13.5);
    const two = computeSiteLayout(PLOT, [unit({ floors: 2 })]);
    expect(two.slots[0].heightFt).toBe(21);
    expect(two.maxHeightFt).toBe(24);
    expect(computeSiteLayout(PLOT, [unit({ floors: 0 })]).slots[0].floors).toBe(1);
  });

  it("cuts the backyard notch (6.5 × 9.5, one step for the bathroom) from the rear-right corner, with a back exit", () => {
    const { x0, x1, z1 } = f.rect;
    expect(f.notch.wide).toEqual({ x0: x1 - 6.5, x1, z0: z1 - 5.5, z1 });
    expect(f.notch.step.x0).toBeCloseTo(x1 - 5.2, 6);
    expect(f.notch.step.z0).toBeCloseTo(z1 - 9.5, 6);
    expect(f.outline.map((p) => [+p.x.toFixed(2), +p.z.toFixed(2)])).toEqual([
      [+x0.toFixed(2), 9.58],
      [21.75, 9.58],
      [21.75, 28.08],
      [16.55, 28.08],
      [16.55, 32.08],
      [15.25, 32.08],
      [15.25, 37.58],
      [+x0.toFixed(2), 37.58],
    ]);
    expect(polygonArea(f.outline)).toBeGreaterThan(0); // counter-clockwise
    expect(f.floorAreaSqft).toBeCloseTo(f.widthFt * 28 - 6.5 * 5.5 - 5.2 * 4, 1);
    expect(f.walls.map((w) => w.kind)).toEqual(["front", "party", "notch", "notch", "notch", "notch", "back", "side"]);
    expect(f.walls[0].n).toEqual({ x: 0, z: -1 });
    expect(f.backExit.z).toBeCloseTo(z1 - 9.5, 6); // the notch's front wall
    expect(f.backExit.x).toBeGreaterThan(f.notch.step.x0);
  });

  it("puts the house entrance at the front-left and the stair outside, in the yard in front of the front-right corner", () => {
    for (const s of L.slots) {
      expect(s.door.z).toBe(s.rect.z0);
      expect(s.door.x).toBeLessThan((s.rect.x0 + s.rect.x1) / 2);
      expect(s.stairs.x1).toBe(s.rect.x1);
      expect(s.stairs.z1).toBe(s.rect.z0);
      expect(s.stairs.z1 - s.stairs.z0).toBe(5);
      expect(s.stairs.x1 - s.stairs.x0).toBeGreaterThan(9.5);
      expect(s.stairs.x1 - s.stairs.x0).toBeLessThanOrEqual(10);
      expect(s.stairs.x0).toBeGreaterThan(s.door.x);
    }
    expect(f.stairs.z0).toBeGreaterThan(0); // inside the front yard
    expect(b.stairs.z0).toBeGreaterThan(L.courtyard!.z0); // inside the courtyard
  });

  it("has exactly two gates: Gate to Unit A in the front wall (left/centre), Gate to Unit B in the lane wall at the courtyard", () => {
    const gates = L.compoundWalls.filter((w) => w.kind === "gate");
    expect(gates.map((w) => w.gate)).toEqual(["front", "side"]);
    const [ga, gb] = gates;
    expect(ga.a.z).toBe(0);
    expect(ga.b.x - ga.a.x).toBeCloseTo(4, 6);
    expect(ga.b.x).toBeLessThan(f.stairs.x0); // clear of the stair on the right
    expect(ga.a.x).toBeLessThan(23.25 / 2);
    const zc = (gb.a.z + gb.b.z) / 2;
    expect(zc).toBeCloseTo((L.courtyard!.z0 + L.courtyard!.z1) / 2, 2);
    for (const p of [gb.a, gb.b]) expect(p.x).toBeCloseTo(23.25 - (23.25 - p.z / 76.66), 2); // on the lane boundary
  });

  it("runs the compound wall round the whole boundary, never touching a house", () => {
    const P = L.plot.polygon;
    const onBoundary = (p: { x: number; z: number }) =>
      P.some((a, i) => {
        const c = P[(i + 1) % P.length];
        const cross = (c.x - a.x) * (p.z - a.z) - (c.z - a.z) * (p.x - a.x);
        return Math.abs(cross) < 0.05 * Math.hypot(c.x - a.x, c.z - a.z);
      });
    for (const w of L.compoundWalls) {
      expect(onBoundary(w.a)).toBe(true);
      expect(onBoundary(w.b)).toBe(true);
    }
    const len = L.compoundWalls.reduce((n, w) => n + Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z), 0);
    const perimeter = P.reduce((n, a, i) => n + Math.hypot(P[(i + 1) % 4].x - a.x, P[(i + 1) % 4].z - a.z), 0);
    expect(len).toBeCloseTo(perimeter, 1); // continuous, gates included
  });

  it("puts open grass (no road) in front of the plot", () => {
    const m = L.site.meadow;
    expect(m.z1).toBe(0);
    expect(m.z0).toBe(-20);
    expect(m.x0).toBeLessThan(L.plot.polygon[0].x);
    expect(m.x1).toBeGreaterThan(L.plot.rightX);
    expect(L.site).not.toHaveProperty("street");
    expect(L.site.tile[0].z).toBeCloseTo(-20, 6);
  });

  it("lists drawing-style dimensions from the data", () => {
    const byKey = Object.fromEntries(L.dimensions.map((d) => [d.key, d]));
    expect(byKey.frontWidthFt.label).toBe(`23'3"`);
    expect(byKey.backWidthFt.label).toBe(`22'3"`);
    expect(byKey.depthFt.label).toBe(`76'8"`);
    expect(byKey["footprintWidthFt:front"].label).toBe(`20'`); // the unit's real width, though drawn inset
    expect(byKey["footprintDepthFt:back"].label).toBe(`28'`);
    expect(byKey.courtyard.label).toBe(formatFeetInches(L.courtyard!.z1 - L.courtyard!.z0));
    expect(byKey["floors:front"].label).toBe(`1 floor · 10'6"`);
    expect(byKey.areaSqft.label).toBe("1,744 sq ft");
    expect(byKey["floors:front"].primary).toBe(false);
  });
});

describe("computeSiteLayout — slots and edge cases", () => {
  it("no units → two empty slots", () => {
    const L = computeSiteLayout(PLOT, []);
    expect(L.slots.map((s) => [s.slot, s.status])).toEqual([
      ["front", "empty"],
      ["back", "empty"],
    ]);
    expect(L.compoundWalls.filter((w) => w.kind === "gate").map((w) => w.gate)).toEqual(["front", "side"]);
    expect(L.paved[2].z).toBe(0);
    expect(L.dimensions.filter((d) => d.kind === "footprint").every((d) => !d.primary)).toBe(true);
  });

  it("units without a position fill free slots in order", () => {
    const L = computeSiteLayout(PLOT, [unit({ id: "x", position: null }), unit({ id: "y", position: "front" })]);
    expect(L.slots.map((s) => s.unit?.id)).toEqual(["y", "x"]);
  });

  it("an active unit wins a contested position over an inactive one; extra units are reported", () => {
    const old = unit({ id: "old", name: "Old", isActive: false, status: "inactive", rentState: "none" });
    const r = assignSlots([old, unit({ id: "new" }), unit({ id: "b", position: "back" }), unit({ id: "c", name: "Extra", position: null })]);
    expect(r.bySlot.front?.id).toBe("new");
    expect(r.bySlot.back?.id).toBe("b");
    expect(r.unplaced.map((u) => u.id)).toEqual(["c", "old"]);
    expect(r.warnings).toHaveLength(2);
  });

  it("units with status 'empty' are placeholders, not buildings", () => {
    const L = computeSiteLayout(PLOT, [unit({ status: "empty" })]);
    expect(L.slots.every((s) => s.status === "empty")).toBe(true);
  });

  it("uses each unit's own footprint and floors", () => {
    const L = computeSiteLayout(PLOT, [unit({ footprintWidthFt: 18, footprintDepthFt: 24, floors: 3 })]);
    const f = L.slots[0];
    expect(f.rect.x1).toBeCloseTo(21.75, 6);
    expect(f.rect.x0).toBeCloseTo(3.75, 6); // 18 ft fits with the passage
    expect(f.rect.z1 - f.rect.z0).toBe(24);
    expect(f.heightFt).toBe(31.5);
    // a long plot: the courtyard stays 10 ft and the front yard takes the rest
    expect(L.slots[1].rect.z0 - f.rect.z1).toBeCloseTo(10, 6);
  });

  it("scales footprints that do not fit and warns", () => {
    const L = computeSiteLayout(PLOT, [unit({ footprintWidthFt: 30 }), unit({ id: "u2", position: "back", footprintDepthFt: 50 })]);
    const [f, b] = L.slots;
    expect(f.scaled).toBe(true);
    expect(f.rect.x0 - f.passageFt).toBeGreaterThanOrEqual(-1e-9);
    // depth: 28 + 50 + two 5.5 ft yards > 75.16 usable → both scaled by (75.16 − 11) / 78
    expect(f.depthFt).toBeCloseTo(28 * (64.16 / 78), 6);
    expect(b.depthFt).toBeCloseTo(50 * (64.16 / 78), 6);
    expect(b.rect.z0 - f.rect.z1).toBeCloseTo(5.5, 6);
    expect(f.rect.z0).toBeCloseTo(5.5, 6);
    expect(L.warnings).toHaveLength(2);
    expect(L.warnings[0]).toContain("Front + back footprint depths (28' + 50')");
    expect(L.warnings[1]).toContain("wider than the plot");
  });

  it("an empty slot gets only the room left over by a real unit, or is dropped", () => {
    const L = computeSiteLayout({ ...PLOT, depthFt: 40 }, [unit({ footprintDepthFt: 30 })]);
    expect(L.slots.map((s) => s.slot)).toEqual(["front"]); // 38.5 − 30 − 2 × 5.5 < 8 → no room
    const L2 = computeSiteLayout({ ...PLOT, depthFt: 50 }, [unit()]);
    expect(L2.slots[1].status).toBe("empty");
    expect(L2.slots[1].depthFt).toBeCloseTo(9.5, 6); // 48.5 − 28 − 11
  });

  it("missing / invalid plot sizes fall back to the site plan", () => {
    const L = computeSiteLayout({ frontWidthFt: undefined, backWidthFt: -3, depthFt: Number.NaN }, [A]);
    expect(L.plot.frontWidthFt).toBe(23.25);
    expect(L.plot.backWidthFt).toBe(22.25);
    expect(L.plot.depthFt).toBe(SITE_DEFAULTS.depthFt);
    expect(L.plot.areaSqft).toBe(1744.02);
    expect(L.warnings).toHaveLength(2);
  });

  it("keeps the notch and stair valid on a tiny footprint", () => {
    const L = computeSiteLayout(PLOT, [unit({ footprintWidthFt: 8, footprintDepthFt: 10 })]);
    const f = L.slots[0];
    expect(f.notch.wide.x0).toBeGreaterThan(f.rect.x0);
    expect(f.notch.step.z0).toBeGreaterThan(f.rect.z0);
    expect(f.stairs.z1).toBe(f.rect.z0);
    expect(f.floorAreaSqft).toBeGreaterThan(0);
  });
});

describe("highlight matching", () => {
  const L = computeSiteLayout(PLOT, [A, B]);
  const d = (key: string) => L.dimensions.find((x) => x.key === key)!;
  it("matches plain, slot and unit-id field names", () => {
    expect(dimensionMatches(d("frontWidthFt"), "frontWidthFt")).toBe(true);
    expect(dimensionMatches(d("frontWidthFt"), "depthFt")).toBe(false);
    expect(dimensionMatches(d("footprintWidthFt:front"), "footprintWidthFt")).toBe(true);
    expect(dimensionMatches(d("footprintWidthFt:front"), "footprintWidthFt:back")).toBe(false);
    expect(dimensionMatches(d("footprintWidthFt:back"), "footprintWidthFt:u2")).toBe(true);
    expect(dimensionMatches(d("footprintDepthFt:back"), "position")).toBe(true);
    expect(dimensionMatches(d("floors:front"), "floors:u1")).toBe(true);
    expect(dimensionMatches(d("frontWidthFt"), null)).toBe(false);
  });
  it("finds the highlighted building slots", () => {
    expect(highlightedSlots(L, "floors:u2")).toEqual(["back"]);
    expect(highlightedSlots(L, "position")).toEqual(["front", "back"]);
    expect(highlightedSlots(L, "depthFt")).toEqual([]);
  });
});

describe("front-wall fixtures (clickable world objects)", () => {
  const L = computeSiteLayout(PLOT, [A, B]);
  const F = L.fixtures;
  const [FL, FR, , BL] = L.plot.polygon;
  it("mounts the mailbox on Gate A's pillar and puts the tax collector's spot on the grass right of the plot", () => {
    const gate = L.compoundWalls.find((w) => w.gate === "front")!;
    expect(F.mailbox).toEqual(gate.a);
    expect(F.taxStamp.on).toBe("office");
    expect(F.taxStamp.x).toBeGreaterThan(FR.x + 4); // clear of the compound wall
    expect(F.taxStamp.x).toBeLessThan(Math.max(...L.site.tile.map((p) => p.x)) - 4); // on the island
    expect(F.taxStamp.z).toBeGreaterThan(0);
  });
  it("hangs the notice board on the lane wall a few feet from the front, inside the plot depth", () => {
    expect(F.noticeBoard.z).toBeGreaterThan(2);
    expect(F.noticeBoard.z).toBeLessThan(10);
    const xLeft = FL.x + ((BL.x - FL.x) * F.noticeBoard.z) / L.plot.depthFt;
    expect(F.noticeBoard.x).toBeCloseTo(xLeft, 1);
    expect(F.noticeBoard.widthFt).toBeGreaterThanOrEqual(2.4);
  });
  it("puts the survey stone just outside the back-left corner and the poles on the grass in front of the wall", () => {
    expect(F.plotMarker.x).toBeLessThan(BL.x);
    expect(F.plotMarker.z).toBeGreaterThan(BL.z);
    for (const p of F.poles) {
      expect(p.z).toBeLessThan(0);
      expect(p.z).toBeGreaterThan(L.site.meadow.z0);
    }
    expect(F.poles[0].x).toBeGreaterThan(FR.x);
    // one pole either side of the plot: [1] off the front-left (lane) corner, still on the island
    expect(F.poles[1].x).toBeLessThan(FL.x);
    expect(F.poles[1].x).toBeGreaterThan(Math.min(...L.site.tile.map((p) => p.x)));
  });
  it("keeps Gate A (and its mailbox) when no house stands at the front", () => {
    const L2 = computeSiteLayout(PLOT, [B]);
    const gate = L2.compoundWalls.find((w) => w.gate === "front")!;
    expect(L2.fixtures.mailbox).toEqual(gate.a);
    expect(L2.fixtures.taxStamp.on).toBe("office");
  });
  it("keeps objects apart so each one can be hovered on its own", () => {
    const pts = [F.mailbox, F.taxStamp, F.noticeBoard, F.poles[0], F.plotMarker];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z)).toBeGreaterThan(5);
  });
});

describe("sceneUnitsFromBreakdown", () => {
  it("an incoming unit carries the signed tenant, rent and move-in date", () => {
    const u = {
      id: "b",
      name: "Back House",
      position: "back",
      floors: 2,
      isActive: true,
      status: "incoming",
      rentState: "none",
      footprintWidthFt: null,
      footprintDepthFt: null,
      activeLease: null,
      incomingLease: { tenantName: "Selvi", monthlyRent: 11000, startDate: "2026-11-01T00:00:00.000Z" },
      nextPayment: { daysOverdue: 0 },
      vacantPeriods: [{ days: 40, ongoing: true }],
    } as unknown as UnitBreakdown;
    expect(sceneUnitsFromBreakdown([u])[0]).toMatchObject({
      status: "incoming",
      tenantName: "Selvi",
      monthlyRent: 11000,
      moveInDate: "2026-11-01T00:00:00.000Z",
      vacantDays: 40,
      daysOverdue: 0,
    });
  });
  it("an empty unit's past gap is not counted as vacant days now", () => {
    const u = {
      id: "c",
      name: "C",
      position: null,
      floors: 1,
      isActive: true,
      status: "vacant",
      rentState: "none",
      footprintWidthFt: null,
      footprintDepthFt: null,
      activeLease: null,
      incomingLease: null,
      nextPayment: null,
      vacantPeriods: [{ days: 12, ongoing: true }],
    } as unknown as UnitBreakdown;
    expect(sceneUnitsFromBreakdown([u])[0].vacantDays).toBe(12);
    expect(sceneUnitsFromBreakdown([u])[0].moveInDate).toBeUndefined();
  });

  it("maps dashboard units to scene units", () => {
    const u = {
      id: "a",
      name: "Front House",
      position: "front",
      floors: 2,
      isActive: true,
      status: "occupied",
      rentState: "overdue",
      footprintWidthFt: 20,
      footprintDepthFt: null,
      activeLease: { tenantName: "Kumar", monthlyRent: 12000 },
      nextPayment: { daysOverdue: 9 },
      vacantPeriods: [],
    } as unknown as UnitBreakdown;
    expect(sceneUnitsFromBreakdown([u])[0]).toEqual({
      id: "a",
      name: "Front House",
      position: "front",
      floors: 2,
      footprintWidthFt: 20,
      footprintDepthFt: null,
      status: "occupied",
      rentState: "overdue",
      tenantName: "Kumar",
      monthlyRent: 12000,
      isActive: true,
      daysOverdue: 9,
      vacantDays: 0,
    });
  });
});
