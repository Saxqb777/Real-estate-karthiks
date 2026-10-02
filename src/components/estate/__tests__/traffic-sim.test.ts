// The street traffic must never drive through another vehicle or cross into the oncoming lane.
import { describe, expect, it } from "vitest";
import { SPECS, stepTraffic, type Car } from "../traffic-sim";
import { rng } from "../util";

const LANE_W = 8;
const SPANS = { 1: 62, [-1]: 64 } as Record<1 | -1, number>;

function fleet(seed = 1): Car[] {
  return SPECS.map((spec, i) => {
    const rand = rng(seed * 100 + i);
    return { spec, active: false, s: 0, v: 0, lat: spec.lat, wait: rand() * 4, mood: 1, rand };
  });
}

function check(cars: Car[]) {
  for (const c of cars) {
    if (!c.active) continue;
    // stays inside its own lane: kerb gap ≥ 0 and the far side never past the centre line
    expect(c.lat).toBeGreaterThanOrEqual(-1e-6);
    expect(c.lat + c.spec.width).toBeLessThanOrEqual(LANE_W + 1e-6);
  }
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (!a.active || !b.active || a.spec.dir !== b.spec.dir) continue;
      const lateral = a.lat < b.lat + b.spec.width && b.lat < a.lat + a.spec.width;
      if (!lateral) continue;
      const gap = Math.abs(a.s - b.s) - (a.spec.len + b.spec.len) / 2;
      expect(gap).toBeGreaterThan(-1e-6);
    }
}

describe("street traffic lane simulation", () => {
  it("keeps every vehicle in its lane and never overlaps another, at any frame rate", () => {
    for (const seed of [1, 2, 3]) {
      const cars = fleet(seed);
      const r = rng(seed);
      const trips = new Map<Car, number>();
      let t = 0;
      while (t < 900) {
        const dt = 0.008 + r() * 0.12; // 8 fps … 120 fps, jittery
        const before = cars.map((c) => c.active);
        stepTraffic(cars, SPANS, LANE_W, dt);
        cars.forEach((c, i) => before[i] && !c.active && trips.set(c, (trips.get(c) ?? 0) + 1));
        check(cars);
        t += dt;
      }
      // every vehicle keeps coming back
      for (const c of cars) expect(trips.get(c) ?? 0).toBeGreaterThan(2);
    }
  });

  it("slow vehicles hold up the ones behind instead of being driven through", () => {
    const cars = fleet(7);
    const bike = cars.find((c) => c.spec.kind === "bicycle")!;
    const car = cars.find((c) => c.spec.kind === "car")!;
    for (const c of cars) c.active = false;
    for (const c of cars) c.wait = 1e9;
    // a wide bus-like case: the car cannot squeeze past a cyclist riding mid-lane
    Object.assign(bike, { active: true, s: 30, v: 10, lat: 3.2, mood: 1 });
    Object.assign(car, { active: true, s: 5, v: 24, lat: car.spec.lat, mood: 1 });
    for (let k = 0; k < 200; k++) {
      stepTraffic(cars, SPANS, LANE_W, 1 / 60);
      check(cars);
    }
    expect(car.v).toBeLessThan(car.spec.speed * 0.8);
  });
});
