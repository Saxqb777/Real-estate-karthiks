// The login map's street-level detail (owner, 10/10/2026: "ultra HD"): the generated buildings never sit on a street
// or on each other, and the blocks round the plot stay full. Checked with geometry of its own (not the generator's).
import { describe, expect, it } from "vitest";
import { HIGHWAYS, LANE, LANE_X, MAIN, PLOT, ROADS, generated, type P } from "../town-data";

type Quad = [P, P, P, P];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];

/** two convex quads overlap (separating axis test on all edge normals), allowing `gap` of slack */
function overlap(a: Quad, b: Quad, gap = 0): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < 4; i++) {
      const e = sub(poly[(i + 1) % 4], poly[i]);
      const n: P = [-e[1], e[0]];
      const len = Math.hypot(n[0], n[1]) || 1;
      const pa = a.map((p) => dot(p, n) / len);
      const pb = b.map((p) => dot(p, n) / len);
      if (Math.max(...pa) + gap <= Math.min(...pb) || Math.max(...pb) + gap <= Math.min(...pa)) return false;
    }
  return true;
}

function segDist(p: P, a: P, b: P): number {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t);
}
function segsCross(a: P, b: P, c: P, d: P): boolean {
  const cross = (o: P, p: P, q: P) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}
function inside(p: P, q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = (q[(i + 1) % 4][0] - q[i][0]) * (p[1] - q[i][1]) - (q[(i + 1) % 4][1] - q[i][1]) * (p[0] - q[i][0]);
    if (c !== 0) {
      if (sign && Math.sign(c) !== sign) return false;
      sign = Math.sign(c);
    }
  }
  return true;
}
/** shortest distance between a street segment and a building (0 when they touch) */
function streetToBuilding(a: P, b: P, q: Quad): number {
  if (inside(a, q) || inside(b, q)) return 0;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const c = q[i];
    const d = q[(i + 1) % 4];
    if (segsCross(a, b, c, d)) return 0;
    best = Math.min(best, segDist(c, a, b), segDist(d, a, b), segDist(a, c, d), segDist(b, c, d));
  }
  return best;
}

const lines = (ls: P[][]) => ls.flatMap((l) => l.slice(1).map((p, i): [P, P] => [l[i], p]));

describe("the login map's generated streets and buildings", () => {
  const { streets, buildings } = generated();
  const CELL = 30;
  const grid = new Map<string, number[]>();
  const cellsOf = (q: Quad, pad: number) => {
    const xs = q.map((p) => p[0]);
    const ys = q.map((p) => p[1]);
    const out: string[] = [];
    for (let i = Math.floor((Math.min(...xs) - pad) / CELL); i <= Math.floor((Math.max(...xs) + pad) / CELL); i++)
      for (let j = Math.floor((Math.min(...ys) - pad) / CELL); j <= Math.floor((Math.max(...ys) + pad) / CELL); j++) out.push(`${i},${j}`);
    return out;
  };
  buildings.forEach((q, i) => cellsOf(q, 0).forEach((k) => grid.set(k, [...(grid.get(k) ?? []), i])));

  it("draws a full town: thousands of streets, buildings packed round the plot", () => {
    expect(streets.length).toBeGreaterThan(3000);
    const near = buildings.filter((q) => Math.hypot(q[0][0] - PLOT.x, q[0][1] - PLOT.y) < 230);
    expect(near.length).toBeGreaterThan(500);
  });

  it("no building overlaps another", () => {
    const bad: string[] = [];
    buildings.forEach((q, i) => {
      const others = new Set(cellsOf(q, 1).flatMap((k) => grid.get(k) ?? []));
      for (const j of others) if (j > i && overlap(q, buildings[j], 0.2)) bad.push(`${i} × ${j}`);
    });
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it("no building sits on a street (each street at its widest drawn half-width)", () => {
    const all: [P, P, number][] = [
      ...streets.map(([a, b]): [P, P, number] => [a, b, 1.7]),
      ...lines([LANE, ...LANE_X]).map(([a, b]): [P, P, number] => [a, b, 2.3]),
      ...lines(ROADS).map(([a, b]): [P, P, number] => [a, b, 3.4]),
      ...lines([...MAIN, ...HIGHWAYS]).map(([a, b]): [P, P, number] => [a, b, 4.9]),
    ];
    const bad: string[] = [];
    for (const [a, b, half] of all) {
      const box: Quad = [a, b, b, a];
      const near = new Set(cellsOf(box, half + 1).flatMap((k) => grid.get(k) ?? []));
      for (const i of near) {
        const d = streetToBuilding(a, b, buildings[i]);
        if (d < half) bad.push(`building ${i} ${d.toFixed(2)} from a street (half-width ${half})`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
