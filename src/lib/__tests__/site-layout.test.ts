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

const PLOT = { frontWidthFt: 22.25, backWidthFt: 23.25, depthFt: 76.66, areaSqft: 1744.02, townName: "Pattukottai" };

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

describe("computeSiteLayout — owner's site plan", () => {
  const L = computeSiteLayout(PLOT, [A, B]);

  it("draws the trapezoid with a straight left (lane-side) boundary and a slanting right boundary", () => {
    expect(L.plot.rightX).toBe(23.25);
    expect(L.plot.polygon).toEqual([
      { x: 0, z: 0 },
      { x: 22.25, z: 0 },
      { x: 23.25, z: 76.66 },
      { x: 0, z: 76.66 },
    ]);
    expect(polygonArea(L.plot.polygon)).toBeCloseTo(1744.015, 3); // (22.25 + 23.25) / 2 × 76.66
    expect(L.warnings).toEqual([]);
  });

  it("places the front building at 0–28 ft and the back one after a 10 ft courtyard, flush to the lane side (left)", () => {
    const [f, b] = L.slots;
    expect(f.slot).toBe("front");
    expect(f.rect).toEqual({ x0: 0, x1: 20, z0: 0, z1: 28 });
    expect(b.rect).toEqual({ x0: 0, x1: 20, z0: 38, z1: 66 });
    expect(L.courtyard).toEqual({ z0: 28, z1: 38 });
    expect(L.rearYard.z0).toBe(66);
    expect(L.rearYard.z1).toBe(76.66);
    // the side passage is on the right, between the building and the slanting boundary
    expect(f.passageFt).toBeCloseTo(2.25, 6);
    expect(b.passageFt).toBeCloseTo(22.25 + 38 / 76.66 - 20, 6);
    expect(f.unit?.id).toBe("u1");
    expect(b.status).toBe("vacant");
  });

  it("height = floors × 10.5 ft with a 3 ft parapet (single storey + roof terrace by default)", () => {
    expect(L.slots[0].floors).toBe(1);
    expect(L.slots[0].heightFt).toBe(10.5);
    expect(L.slots[0].parapetFt).toBe(3);
    expect(L.maxHeightFt).toBe(13.5);
    const two = computeSiteLayout(PLOT, [unit({ floors: 2 })]);
    expect(two.slots[0].heightFt).toBe(21);
    expect(two.maxHeightFt).toBe(24);
    // missing / invalid floors fall back to 1
    expect(computeSiteLayout(PLOT, [unit({ floors: 0 })]).slots[0].floors).toBe(1);
  });

  it("cuts the stepped notch (6.5 × 9.5, one step) and the 5 × 7 stair well from the front-left (lane-side) corner", () => {
    const f = L.slots[0];
    expect(f.notch.wide).toEqual({ x0: 0, x1: 6.5, z0: 0, z1: 7.5 });
    expect(f.notch.step).toEqual({ x0: 0, x1: 5, z0: 7.5, z1: 9.5 });
    expect(f.stairs).toEqual({ x0: 0, x1: 5, z0: 9.5, z1: 16.5 });
    expect(f.outline).toEqual([
      { x: 6.5, z: 0 },
      { x: 20, z: 0 },
      { x: 20, z: 28 },
      { x: 0, z: 28 },
      { x: 0, z: 16.5 },
      { x: 5, z: 16.5 },
      { x: 5, z: 7.5 },
      { x: 6.5, z: 7.5 },
    ]);
    // 20 × 28 − porch 6.5 × 7.5 − step 5 × 2 − stairs 5 × 7
    expect(f.floorAreaSqft).toBe(466.25);
    expect(polygonArea(f.outline)).toBeGreaterThan(0); // counter-clockwise
    expect(f.door.x).toBe(6.5);
    expect(f.walls.map((w) => w.kind)).toEqual(["front", "side", "back", "party", "stair", "stair", "porch", "porch"]);
    // outward normals: front faces the grass, the side wall faces the passage (+x), the party wall the lane (−x)
    expect(f.walls[0].n).toEqual({ x: 0, z: -1 });
    expect(f.walls[1].n).toEqual({ x: 1, z: -0 });
    expect(f.walls[3].n).toEqual({ x: -1, z: -0 });
  });

  it("has exactly two gates: the main gate at the front unit's stair foot and the back unit's gate mid-way along the lane wall", () => {
    const gates = L.compoundWalls.filter((w) => w.kind === "gate");
    expect(gates.map((w) => w.gate)).toEqual(["porch", "side"]);
    const main = gates[0];
    expect(main.a).toEqual({ x: 2.5, z: 0 });
    expect(main.b).toEqual({ x: 6.5, z: 0 }); // ends at the house front, in front of the notch / stair
    const side = gates[1];
    expect([side.a.x, side.b.x]).toEqual([0, 0]); // on the lane-side boundary
    expect((side.a.z + side.b.z) / 2).toBe(33); // middle of the 28–38 courtyard
    expect(Math.abs(side.a.z - side.b.z)).toBe(4);
    // a front unit alone has only the main gate
    expect(computeSiteLayout(PLOT, [A]).compoundWalls.filter((w) => w.kind === "gate").map((w) => w.gate)).toEqual(["porch"]);
  });

  it("puts open grass (no road) in front of the plot", () => {
    const m = L.site.meadow;
    expect(m.z1).toBe(0);
    expect(m.z0).toBe(-20);
    expect(m.x0).toBeLessThan(L.plot.polygon[0].x);
    expect(m.x1).toBeGreaterThan(L.plot.rightX);
    expect(L.site).not.toHaveProperty("street");
    expect(L.site.tile).toHaveLength(4);
    expect(L.site.tile[0].z).toBeCloseTo(-20, 6);
  });

  it("lists drawing-style dimensions from the data", () => {
    const byKey = Object.fromEntries(L.dimensions.map((d) => [d.key, d]));
    expect(byKey.frontWidthFt.label).toBe(`22'3"`);
    expect(byKey.backWidthFt.label).toBe(`23'3"`);
    expect(byKey.depthFt.label).toBe(`76'8"`);
    expect(byKey["footprintWidthFt:front"].label).toBe(`20'`);
    expect(byKey["footprintDepthFt:back"].label).toBe(`28'`);
    expect(byKey.courtyard.label).toBe(`10'`);
    expect(byKey["floors:front"].label).toBe(`1 floor · 10'6"`);
    expect(byKey.areaSqft.label).toBe("1,744 sq ft"); // whole sq ft like the drawing
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
    // open front wall with a main gate
    expect(L.compoundWalls.filter((w) => w.kind === "gate").map((w) => w.gate)).toEqual(["main"]);
    // nothing built yet: no paving, placeholder footprints only appear when highlighted
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
    expect(f.rect).toEqual({ x0: 0, x1: 18, z0: 0, z1: 24 });
    expect(f.heightFt).toBe(31.5);
    expect(L.slots[1].rect.z0).toBe(34); // 24 + 10 courtyard
  });

  it("scales footprints that do not fit and warns", () => {
    const L = computeSiteLayout(PLOT, [unit({ footprintWidthFt: 30 }), unit({ id: "u2", position: "back", footprintDepthFt: 50 })]);
    const [f, b] = L.slots;
    expect(f.widthFt).toBeCloseTo(22.25, 6); // the plot is 22'3" at the front
    expect(f.scaled).toBe(true);
    // depth: 28 + 50 + 4 (min courtyard) > 76.66 → both scaled by (76.66 − 4) / 78
    expect(f.depthFt).toBeCloseTo(28 * (72.66 / 78), 6);
    expect(b.depthFt).toBeCloseTo(50 * (72.66 / 78), 6);
    expect(b.rect.z0 - f.rect.z1).toBeCloseTo(4, 6);
    expect(b.rect.z1).toBeCloseTo(76.66, 6);
    expect(L.warnings).toHaveLength(2); // one width warning + one combined depth warning
    expect(L.warnings[0]).toContain("Front + back footprint depths (28' + 50')");
  });

  it("an empty slot gets only the room left over by a real unit, or is dropped", () => {
    const L = computeSiteLayout({ ...PLOT, depthFt: 40 }, [unit({ footprintDepthFt: 30 })]);
    expect(L.slots.map((s) => s.slot)).toEqual(["front"]); // 40 − 30 − 4 = 6 < 8 → no room
    const L2 = computeSiteLayout({ ...PLOT, depthFt: 50 }, [unit()]);
    expect(L2.slots[1].status).toBe("empty");
    expect(L2.slots[1].depthFt).toBeCloseTo(18, 6); // 50 − 28 − 4
  });

  it("missing / invalid plot sizes fall back to the site plan", () => {
    const L = computeSiteLayout({ frontWidthFt: undefined, backWidthFt: -3, depthFt: Number.NaN }, [A]);
    expect(L.plot.frontWidthFt).toBe(SITE_DEFAULTS.frontWidthFt);
    expect(L.plot.backWidthFt).toBe(SITE_DEFAULTS.backWidthFt);
    expect(L.plot.depthFt).toBe(SITE_DEFAULTS.depthFt);
    expect(L.plot.areaSqft).toBe(1744.02);
    expect(L.warnings).toHaveLength(2);
  });

  it("keeps the notch valid on a tiny footprint", () => {
    const L = computeSiteLayout(PLOT, [unit({ footprintWidthFt: 8, footprintDepthFt: 10 })]);
    const f = L.slots[0];
    expect(f.notch.wide.x1).toBeLessThan(f.rect.x1);
    expect(f.stairs.z1).toBeLessThan(f.rect.z1);
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

describe("street-front fixtures (clickable world objects)", () => {
  const L = computeSiteLayout(PLOT, [A, B]);
  const F = L.fixtures;
  const [FL, FR, , BL] = L.plot.polygon;
  it("mounts the mailbox on the main-gate pillar and the tax stamp on the house front beside the notch", () => {
    const porch = L.compoundWalls.find((w) => w.gate === "porch")!;
    expect(F.mailbox).toEqual(porch.a);
    const front = L.slots.find((s) => s.slot === "front")!;
    expect(F.taxStamp).toEqual({ x: front.notch.wide.x1 + 2.2, z: 0, on: "wall" });
    expect(F.taxStamp.x).toBeLessThan(front.rect.x1);
  });
  it("hangs the notice board on the left wall a few feet from the street, inside the plot depth", () => {
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
    // both right of the plot (clear of the house fronts in the default view); [0] = lamp + meter pole by the gate
    expect(F.poles[0].x).toBeGreaterThan(FR.x);
    expect(F.poles[1].x).toBeGreaterThan(F.poles[0].x);
    const tileRight = Math.max(...L.site.tile.map((p) => p.x));
    expect(F.poles[1].x).toBeLessThan(tileRight);
  });
  it("falls back to the main gate when no building stands on the street", () => {
    const L2 = computeSiteLayout(PLOT, [B]);
    const main = L2.compoundWalls.find((w) => w.gate === "main")!;
    expect(L2.fixtures.mailbox).toEqual(main.b);
    expect(L2.fixtures.taxStamp).toEqual({ ...main.a, on: "pillar" });
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
