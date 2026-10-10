// The street map of Pattukkottai for the /login title screen — pure data, no React: the features traced from the
// owner's map screenshot (2000 × 1250 frame, 1 unit ≈ 1.6 m), the seeded generator for the minor streets and the
// buildings, and the plot's outline. TownMap.tsx draws the labels / pin (SVG); map-painter.ts paints the rest (canvas).

export const MAP_W = 2000;
export const MAP_H = 1250;
/** metres per map unit (the owner's screenshot shows 200 m ≈ 125 px) */
export const M_PER_UNIT = 1.6;
/** the plot (as marked by the owner) and the lane it fronts */
export const PLOT = { x: 1164, y: 508 };

export type P = [number, number];

/* ---------- traced features ---------- */

export const HIGHWAYS: P[][] = [
  [
    [262, -40],
    [300, 80],
    [355, 190],
    [430, 280],
    [490, 345],
  ],
  [
    [490, 345],
    [548, 347],
    [603, 348],
  ],
  [
    [603, 348],
    [603, 220],
    [603, -40],
  ],
  [
    [-60, 442],
    [200, 440],
    [445, 432],
  ],
  [
    [490, 345],
    [462, 392],
    [440, 450],
    [415, 540],
    [390, 630],
    [366, 730],
    [352, 830],
    [347, 950],
    [350, 1100],
    [352, 1300],
  ],
];

export const MAIN: P[][] = [
  // 343 into town, through the centre, then south-east past the plot
  [
    [603, 348],
    [700, 352],
    [745, 382],
    [758, 440],
    [762, 500],
  ],
  [
    [445, 432],
    [520, 450],
    [620, 468],
    [700, 482],
    [762, 500],
    [860, 515],
    [960, 522],
    [1010, 522],
    [1060, 512],
    [1100, 497],
  ],
  [
    [1010, 522],
    [1080, 560],
    [1160, 612],
    [1240, 680],
    [1300, 740],
    [1420, 835],
    [1530, 922],
    [1650, 1015],
    [1760, 1105],
    [1860, 1190],
    [1940, 1300],
  ],
  // 226 north-east
  [
    [1100, 497],
    [1150, 455],
    [1195, 400],
    [1250, 300],
    [1300, 215],
    [1350, 140],
    [1400, 60],
    [1430, -40],
  ],
  // 342 south-east from the bus stand
  [
    [720, 520],
    [722, 640],
    [745, 700],
    [800, 760],
    [880, 830],
    [960, 915],
    [1040, 1005],
    [1120, 1095],
    [1200, 1190],
    [1260, 1300],
  ],
  // bypass
  [
    [1560, -40],
    [1620, 100],
    [1700, 230],
    [1790, 360],
    [1880, 480],
    [1960, 590],
    [2060, 720],
  ],
];

export const ROADS: P[][] = [
  [
    [1040, -40],
    [1036, 120],
    [1030, 250],
    [1025, 330],
    [1015, 420],
    [1008, 520],
  ],
  [
    [1008, 525],
    [990, 600],
    [968, 690],
    [950, 780],
    [935, 880],
    [925, 980],
  ],
  [
    [603, 285],
    [680, 272],
    [760, 262],
    [840, 258],
  ],
  [
    [1700, 640],
    [1840, 705],
    [1960, 760],
    [2060, 800],
  ],
  [
    [1690, 1300],
    [1760, 1100],
    [1790, 1000],
    [1800, 900],
    [1780, 800],
  ],
  [
    [140, 860],
    [190, 960],
    [230, 1060],
    [260, 1180],
    [275, 1300],
  ],
  [
    [260, 1060],
    [290, 930],
    [330, 820],
    [366, 730],
  ],
  [
    [548, 1300],
    [555, 1170],
    [575, 1060],
    [610, 1010],
  ],
  [
    [700, 380],
    [740, 250],
    [790, 150],
    [830, -40],
  ],
  [
    [-60, 700],
    [150, 690],
    [366, 700],
  ],
  [
    [1100, 497],
    [1200, 470],
    [1300, 440],
    [1400, 430],
    [1480, 445],
  ],
  [
    [200, 300],
    [350, 330],
    [490, 345],
  ],
  [
    [762, 500],
    [880, 470],
    [960, 420],
    [1015, 420],
  ],
  [
    [620, 468],
    [600, 560],
    [560, 640],
    [470, 700],
    [366, 730],
  ],
  [
    [722, 640],
    [640, 700],
    [560, 760],
    [480, 830],
    [430, 900],
  ],
  [
    [1240, 680],
    [1180, 760],
    [1120, 840],
    [1070, 920],
  ],
  [
    [1420, 835],
    [1470, 760],
    [1520, 700],
    [1600, 650],
    [1700, 640],
  ],
];

/** the lane in front of the plot (always drawn, named when zoomed in) */
export const LANE: P[] = [
  [1150, 455],
  [1165, 485],
  [1176, 512],
  [1192, 545],
  [1212, 582],
  [1236, 620],
];
export const LANE_X: P[][] = [
  [
    [1100, 580],
    [1150, 561],
    [1192, 545],
    [1240, 526],
    [1300, 505],
  ],
  [
    [1090, 500],
    [1130, 494],
    [1165, 485],
    [1215, 462],
    [1270, 445],
  ],
];

export const GREEN: P[][] = [
  [
    [1430, -60],
    [2100, -60],
    [2100, 1350],
    [1900, 1350],
    [1790, 1160],
    [1660, 1045],
    [1545, 955],
    [1440, 870],
    [1350, 790],
    [1300, 700],
    [1305, 610],
    [1345, 535],
    [1425, 488],
    [1455, 390],
    [1478, 280],
    [1468, 140],
  ],
  [
    [1150, 1350],
    [1230, 1185],
    [1330, 1085],
    [1440, 1018],
    [1560, 1036],
    [1680, 1135],
    [1765, 1350],
  ],
  [
    [-80, 1100],
    [80, 1060],
    [150, 1150],
    [160, 1350],
    [-80, 1350],
  ],
  [
    [860, 150],
    [940, 140],
    [960, 210],
    [900, 240],
    [850, 210],
  ],
];
export const PARKS: P[][] = [
  [
    [820, 600],
    [846, 598],
    [848, 624],
    [822, 627],
  ],
  [
    [1250, 560],
    [1282, 552],
    [1290, 585],
    [1258, 594],
  ],
];

export const WATER: P[][] = [
  [
    [300, 150],
    [345, 148],
    [350, 200],
    [332, 250],
    [292, 248],
    [296, 200],
  ],
  [
    [805, 345],
    [853, 340],
    [856, 398],
    [828, 406],
    [800, 392],
  ],
  [
    [382, 566],
    [408, 564],
    [409, 588],
    [384, 591],
  ],
  [
    [456, 742],
    [498, 734],
    [503, 778],
    [472, 790],
    [452, 772],
  ],
  [
    [578, 860],
    [672, 868],
    [652, 930],
    [600, 1010],
    [575, 1045],
    [528, 1040],
    [524, 985],
    [548, 905],
  ],
  [
    [1866, 655],
    [1902, 646],
    [1914, 672],
    [1884, 688],
    [1864, 676],
  ],
];

/** busy commercial streets get the warm beige wash */
export const BUSY: P[][] = [
  [
    [560, 458],
    [700, 482],
    [762, 500],
    [880, 516],
    [1005, 524],
  ],
  [
    [700, 355],
    [748, 390],
    [760, 470],
  ],
  [
    [722, 520],
    [722, 640],
  ],
  [
    [598, 292],
    [605, 340],
  ],
];


/* ---------- geometry helpers ---------- */

const f = (n: number) => Math.round(n * 10) / 10;

/** Catmull-Rom through the points → smooth cubic path (open or closed). */
export function smooth(pts: P[], closed = false): string {
  const n = pts.length;
  if (n < 3) return `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}`;
  const at = (i: number): P =>
    closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

function inPoly(x: number, y: number, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** distance from a point to a polyline */
function distTo(x: number, y: number, line: P[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i],
      [bx, by] = line[i + 1];
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* ---------- generated streets + buildings ---------- */

const PLOT_ANGLE = Math.atan2(LANE[3][1] - LANE[1][1], LANE[3][0] - LANE[1][0]); // lane direction

/** an oriented box: centre, unit axis along it, half sizes along / across */
type Box = { cx: number; cy: number; ux: number; uy: number; hx: number; hy: number };

/**
 * Where buildings may go: streets (segments with a half width) and the buildings placed so far, in a coarse grid.
 * free(box) = clear of every street by its half width + a hair, and of every building by a small gap.
 */
function blocker() {
  const CELL = 24;
  const grid = new Map<string, { s: [P, P, number][]; b: Box[] }>();
  const at = (i: number, j: number) => {
    const k = `${i},${j}`;
    let g = grid.get(k);
    if (!g) {
      g = { s: [], b: [] };
      grid.set(k, g);
    }
    return g;
  };
  const span = (x0: number, y0: number, x1: number, y1: number, fn: (i: number, j: number) => void) => {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) fn(i, j);
  };
  const reach = (b: Box) => Math.hypot(b.hx, b.hy);
  // segment a→b against box b inflated by r (slab clipping in the box's own frame)
  const hits = (a: P, c: P, b: Box, r: number) => {
    const vx = -b.uy,
      vy = b.ux;
    const p0 = [(a[0] - b.cx) * b.ux + (a[1] - b.cy) * b.uy, (a[0] - b.cx) * vx + (a[1] - b.cy) * vy];
    const p1 = [(c[0] - b.cx) * b.ux + (c[1] - b.cy) * b.uy, (c[0] - b.cx) * vx + (c[1] - b.cy) * vy];
    let t0 = 0,
      t1 = 1;
    for (let k = 0; k < 2; k++) {
      const lim = (k === 0 ? b.hx : b.hy) + r;
      const d = p1[k] - p0[k];
      if (Math.abs(d) < 1e-9) {
        if (Math.abs(p0[k]) > lim) return false;
        continue;
      }
      let ta = (-lim - p0[k]) / d,
        tb = (lim - p0[k]) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    return true;
  };
  // two boxes overlap (separating axes), with a gap
  const overlap = (a: Box, b: Box, gap: number) => {
    const axes: [number, number][] = [
      [a.ux, a.uy],
      [-a.uy, a.ux],
      [b.ux, b.uy],
      [-b.uy, b.ux],
    ];
    const dx = b.cx - a.cx,
      dy = b.cy - a.cy;
    for (const [ax, ay] of axes) {
      const ra = a.hx * Math.abs(a.ux * ax + a.uy * ay) + a.hy * Math.abs(-a.uy * ax + a.ux * ay);
      const rbb = b.hx * Math.abs(b.ux * ax + b.uy * ay) + b.hy * Math.abs(-b.uy * ax + b.ux * ay);
      if (Math.abs(dx * ax + dy * ay) > ra + rbb + gap) return false;
    }
    return true;
  };
  return {
    street(a: P, b: P, half: number) {
      const r = half + 0.4;
      span(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (i, j) => at(i, j).s.push([a, b, half]));
    },
    building(b: Box) {
      const r = reach(b);
      span(b.cx - r, b.cy - r, b.cx + r, b.cy + r, (i, j) => at(i, j).b.push(b));
    },
    free(b: Box) {
      const r = reach(b) + 6;
      let ok = true;
      span(b.cx - r, b.cy - r, b.cx + r, b.cy + r, (i, j) => {
        if (!ok) return;
        const g = grid.get(`${i},${j}`);
        if (!g) return;
        if (g.s.some(([p, q, half]) => hits(p, q, b, half + 0.3))) ok = false;
        else if (g.b.some((o) => overlap(o, b, 0.5))) ok = false;
      });
      return ok;
    },
  };
}

function generate() {
  const r = rng(20251004);
  const zones = Array.from({ length: 34 }, (_, i) => ({
    x: -120 + r() * 2240,
    y: -120 + r() * 1490,
    a: (r() - 0.5) * 1.1,
    sp: 30 + r() * 16,
    i,
  }));
  const nearest = (x: number, y: number) => {
    let b = zones[0],
      bd = Infinity;
    for (const z of zones) {
      const d = (z.x - x) ** 2 + (z.y - y) ** 2;
      if (d < bd) {
        bd = d;
        b = z;
      }
    }
    return b;
  };
  const wet = (x: number, y: number) => WATER.some((w) => inPoly(x, y, w));
  const green = (x: number, y: number) => GREEN.some((g) => inPoly(x, y, g));
  const density = (x: number, y: number) => {
    const town = Math.hypot((x - 740) / 1.25, y - 560);
    let p = town < 330 ? 0.9 : town < 620 ? 0.72 : 0.5;
    if (green(x, y)) p = 0.14;
    return p;
  };
  const segs: [P, P][] = [];
  for (const z of zones) {
    const c = Math.cos(z.a),
      sn = Math.sin(z.a);
    const R = 15;
    const pt = (i: number, j: number): P => {
      const jx = (hash(z.i, i, j) - 0.5) * z.sp * 0.42;
      const jy = (hash(z.i, j, i + 99) - 0.5) * z.sp * 0.42;
      const u = i * z.sp + jx,
        v = j * z.sp + jy;
      return [z.x + u * c - v * sn, z.y + u * sn + v * c];
    };
    for (let i = -R; i <= R; i++)
      for (let j = -R; j <= R; j++) {
        const a = pt(i, j);
        for (let k = 0; k < 2; k++) {
          const b = k === 0 ? pt(i + 1, j) : pt(i, j + 1);
          const mx = (a[0] + b[0]) / 2,
            my = (a[1] + b[1]) / 2;
          if (nearest(mx, my) !== z) continue;
          if (hash(z.i + 7, i * 2 + k, j) > density(mx, my)) continue;
          if (wet(mx, my) || wet(a[0], a[1]) || wet(b[0], b[1])) continue;
          if (distTo(PLOT.x, PLOT.y, [a, b]) < 14) continue;
          segs.push([a, b]);
        }
      }
  }

  // buildings line both sides of the streets; dense near the plot (what the camera lands on), sparse elsewhere.
  // Owner, 10/10/2026 (ultra HD): none of them sits on a street or on another building — each one is checked against
  // every street nearby (at its drawn width when zoomed in on a phone, the widest case) and the buildings placed before.
  const lanes: [P, P][] = [...segs];
  for (const l of [LANE, ...LANE_X, ...ROADS, ...MAIN])
    for (let i = 0; i < l.length - 1; i++) lanes.push([l[i], l[i + 1]]);
  const block = blocker();
  for (const [a, b] of segs) block.street(a, b, 1.7);
  for (const l of [LANE, ...LANE_X])
    for (let i = 0; i < l.length - 1; i++) block.street(l[i], l[i + 1], 2.3);
  for (const l of ROADS)
    for (let i = 0; i < l.length - 1; i++) block.street(l[i], l[i + 1], 3.4);
  for (const l of [...MAIN, ...HIGHWAYS])
    for (let i = 0; i < l.length - 1; i++) block.street(l[i], l[i + 1], 4.9);
  const rects: [P, P, P, P][] = [];
  const rb = rng(77);
  for (const [a, b] of lanes) {
    const mx = (a[0] + b[0]) / 2,
      my = (a[1] + b[1]) / 2;
    const dPlot = Math.hypot(mx - PLOT.x, my - PLOT.y);
    const keep = dPlot < 230 ? 1 : dPlot < 460 ? 0.4 : dPlot < 750 ? 0.08 : 0;
    if (rb() > keep || (green(mx, my) && dPlot > 140)) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len,
      uy = (b[1] - a[1]) / len;
    const nx = -uy,
      ny = ux;
    // packed a little tighter than before: the clash checks now leave gaps instead of overlaps
    for (let t = 3.5; t < len - 3.5; t += 4.2 + rb() * 3) {
      for (const side of [-1, 1]) {
        if (rb() < 0.12) continue;
        const w = 3 + rb() * 3.2,
          d = 3.4 + rb() * 4.2,
          off = 3.2 + rb() * 1.6;
        const cx = a[0] + ux * t + nx * side * (off + d / 2),
          cy = a[1] + uy * t + ny * side * (off + d / 2);
        if (Math.hypot(cx - PLOT.x, cy - PLOT.y) < 13) continue;
        if (wet(cx, cy)) continue;
        const box = { cx, cy, ux, uy, hx: w / 2, hy: d / 2 };
        if (!block.free(box)) continue;
        block.building(box);
        const hx = (ux * w) / 2,
          hy = (uy * w) / 2,
          dx = (nx * d) / 2,
          dy = (ny * d) / 2;
        rects.push([
          [f(cx - hx - dx), f(cy - hy - dy)],
          [f(cx + hx - dx), f(cy + hy - dy)],
          [f(cx + hx + dx), f(cy + hy + dy)],
          [f(cx - hx + dx), f(cy - hy + dy)],
        ]);
      }
    }
  }
  return {
    streets: segs.map(([a, b]): [P, P] => [
      [f(a[0]), f(a[1])],
      [f(b[0]), f(b[1])],
    ]),
    buildings: rects,
  };
}

// generated lazily on the client (keeps the server HTML small; the canvas fades them in a moment after load)
let GEN: ReturnType<typeof generate> | null = null;
export const generated = () => (GEN ??= generate());

/** a rectangle (centre, along-angle, length, width) as a path */
function rectPath(
  cx: number,
  cy: number,
  ang: number,
  len: number,
  wid: number,
): string {
  const ux = Math.cos(ang),
    uy = Math.sin(ang),
    nx = -uy,
    ny = ux;
  const hl = len / 2,
    hw = wid / 2;
  const c = (a: number, b: number) =>
    `${f(cx + ux * a + nx * b)} ${f(cy + uy * a + ny * b)}`;
  return `M${c(-hl, -hw)}L${c(hl, -hw)}L${c(hl, hw)}L${c(-hl, hw)}Z`;
}
// the plot: 7.1 m frontage on the lane, 23.4 m deep, running back (west) from the lane; two houses inside it
const DEPTH_ANG = PLOT_ANGLE + Math.PI / 2;
export const PLOT_PATH = rectPath(
  PLOT.x,
  PLOT.y,
  DEPTH_ANG,
  23.4 / M_PER_UNIT,
  7.1 / M_PER_UNIT,
);
export const HOUSE_A = rectPath(
  PLOT.x + Math.cos(DEPTH_ANG) * -2.6,
  PLOT.y + Math.sin(DEPTH_ANG) * -2.6,
  DEPTH_ANG,
  5.4,
  3.6,
);
export const HOUSE_B = rectPath(
  PLOT.x + Math.cos(DEPTH_ANG) * 3.6,
  PLOT.y + Math.sin(DEPTH_ANG) * 3.6,
  DEPTH_ANG,
  5.4,
  3.6,
);
