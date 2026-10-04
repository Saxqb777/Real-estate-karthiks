// Street map of Pattukkottai for the /login title screen, drawn in the familiar web-map palette (grey land, white
// streets, blue-grey highways, green fields, blue water). Traced from the owner's own map screenshot in a 2000 × 1250
// frame (1 unit ≈ 1.6 m). Minor streets and buildings are generated from a seed so server and client draw the same map.
// The parent flies the camera by changing the viewBox and two CSS variables: --k (map units per screen pixel, keeps
// labels and the pin a constant size) and --z (0 = whole town … 1 = street level, fades detail in and labels out).
import { memo, type CSSProperties, type Ref } from "react";
import s from "./login.module.css";

export const MAP_W = 2000;
export const MAP_H = 1250;
/** metres per map unit (the owner's screenshot shows 200 m ≈ 125 px) */
export const M_PER_UNIT = 1.6;
/** the plot (as marked by the owner) and the lane it fronts */
export const PLOT = { x: 1164, y: 508 };

type P = [number, number];

/* ---------- traced features ---------- */

const HIGHWAYS: P[][] = [
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

const MAIN: P[][] = [
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

const ROADS: P[][] = [
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
const LANE: P[] = [
  [1150, 455],
  [1165, 485],
  [1176, 512],
  [1192, 545],
  [1212, 582],
  [1236, 620],
];
const LANE_X: P[][] = [
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

const GREEN: P[][] = [
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
const PARKS: P[][] = [
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

const WATER: P[][] = [
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
const BUSY: P[][] = [
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

/* ---------- labels ---------- */

type Tier = "town" | "all" | "near";
type Area = {
  x: number;
  y: number;
  en: string;
  ta?: string;
  tier: Tier;
  big?: boolean;
};
const AREAS: Area[] = [
  {
    x: 803,
    y: 480,
    en: "Pattukkottai",
    ta: "பட்டுக்கோட்டை",
    tier: "town",
    big: true,
  },
  {
    x: 768,
    y: 168,
    en: "VATTAKUDI-NORTH",
    ta: "வட்டகுடி-நார்த்",
    tier: "town",
  },
  {
    x: 793,
    y: 290,
    en: "MANICKAM COLONY",
    ta: "மாணிக்கம் காலனி",
    tier: "town",
  },
  { x: 1053, y: 282, en: "MATTUSANTHAI", ta: "மாட்டு சந்தை", tier: "town" },
  { x: 370, y: 335, en: "KOTTAI KOVIL", ta: "கோட்டை கோவில்", tier: "town" },
  { x: 1313, y: 404, en: "VALAVANPURAM", ta: "வளவன்புரம்", tier: "all" },
  {
    x: 663,
    y: 548,
    en: "NADIMUTHU NAGAR",
    ta: "நாடிமுத்து நகர்",
    tier: "town",
  },
  { x: 245, y: 700, en: "VOC NAGAR", ta: "VOC நகர்", tier: "town" },
  {
    x: 1106,
    y: 742,
    en: "VISHWANATH NAGAR",
    ta: "விஸ்வநாத் நகர்",
    tier: "town",
  },
  {
    x: 533,
    y: 812,
    en: "SRINIVASAN NAGAR",
    ta: "ஸ்ரீநிவாசன் நகர்",
    tier: "town",
  },
  { x: 745, y: 865, en: "MUTHALCHERRY", ta: "முதல்சேரி", tier: "town" },
  { x: 793, y: 945, en: "RV NAGAR", ta: "RV நகர்", tier: "town" },
  {
    x: 1183,
    y: 920,
    en: "VINAYAKAR KOVIL",
    ta: "விநாயகர் கோவில்",
    tier: "town",
  },
  {
    x: 143,
    y: 825,
    en: "VIVEKANANDA NAGAR",
    ta: "விவேகானந்தா நகர்",
    tier: "town",
  },
];

type Poi = {
  x: number;
  y: number;
  en: string;
  ta?: string;
  kind: "water" | "green" | "bus" | "temple";
  side?: "l" | "r" | "b";
};
const POIS: Poi[] = [
  { x: 828, y: 372, en: "Municipal Water Tank", kind: "water", side: "b" },
  {
    x: 703,
    y: 640,
    en: "Bus stand",
    ta: "பேருந்து நிலையம்",
    kind: "bus",
    side: "l",
  },
  {
    x: 622,
    y: 980,
    en: "Naadiamman Temple",
    ta: "நாடியம்மன் கோவில்",
    kind: "temple",
    side: "l",
  },
  {
    x: 1892,
    y: 645,
    en: "Pudhu Eri",
    ta: "புது ஏரி",
    kind: "green",
    side: "l",
  },
  { x: 1743, y: 222, en: "Pappa Veli River", kind: "green", side: "r" },
];

type StreetName = { x: number; y: number; a: number; t: string; tier: Tier };
const STREET_NAMES: StreetName[] = [
  { x: 1826, y: 418, a: 54, t: "Pattukkottai Bypass Rd", tier: "all" },
  { x: 1890, y: 733, a: 24, t: "Ponnai Interior Rd", tier: "all" },
  { x: 979, y: 640, a: -76, t: "Anthoniyar Kovil St", tier: "all" },
  { x: 1037, y: 190, a: -88, t: "Mattusanthai Rd", tier: "all" },
  { x: 690, y: 270, a: -6, t: "Chettiyar Street", tier: "town" },
  { x: 198, y: 955, a: 66, t: "Perumal Kovil St", tier: "town" },
  { x: 302, y: 900, a: -72, t: "Latchathoppu Iratai Salai", tier: "town" },
  { x: 1205, y: 570, a: 61, t: "Lane", tier: "near" },
];

const SHIELDS: { x: number; y: number; t: string }[] = [
  { x: 659, y: 349, t: "343" },
  { x: 1052, y: 565, t: "343" },
  { x: 1343, y: 767, t: "343" },
  { x: 1538, y: 921, t: "343" },
  { x: 1703, y: 1068, t: "343" },
  { x: 1255, y: 295, t: "226" },
  { x: 899, y: 832, t: "342" },
  { x: 601, y: 290, t: "146" },
];

/* ---------- geometry helpers ---------- */

const f = (n: number) => Math.round(n * 10) / 10;

/** Catmull-Rom through the points → smooth cubic path (open or closed). */
function smooth(pts: P[], closed = false): string {
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
const ALL_LINES = [...HIGHWAYS, ...MAIN, ...ROADS];

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
  const streets = segs
    .map(([a, b]) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`)
    .join("");

  // buildings line both sides of the streets; dense near the plot (what the camera lands on), sparse elsewhere
  const lanes: [P, P][] = [...segs];
  for (const l of [LANE, ...LANE_X, ...ROADS, ...MAIN])
    for (let i = 0; i < l.length - 1; i++) lanes.push([l[i], l[i + 1]]);
  let bld = "";
  const rb = rng(77);
  // a coarse grid of placed buildings so none overlap
  const taken = new Set<string>();
  const cell = (x: number, y: number) =>
    `${Math.round(x / 5)},${Math.round(y / 5)}`;
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
    for (let t = 4; t < len - 4; t += 5 + rb() * 4) {
      for (const side of [-1, 1]) {
        if (rb() < 0.22) continue;
        const w = 3 + rb() * 3.2,
          d = 3.4 + rb() * 4.2,
          off = 3.2 + rb() * 1.6;
        const cx = a[0] + ux * t + nx * side * (off + d / 2),
          cy = a[1] + uy * t + ny * side * (off + d / 2);
        if (Math.hypot(cx - PLOT.x, cy - PLOT.y) < 13) continue;
        if (wet(cx, cy) || taken.has(cell(cx, cy))) continue;
        if (ALL_LINES.some((line) => distTo(cx, cy, line) < 6)) continue;
        taken.add(cell(cx, cy));
        const hx = (ux * w) / 2,
          hy = (uy * w) / 2,
          dx = (nx * d) / 2,
          dy = (ny * d) / 2;
        bld += `M${f(cx - hx - dx)} ${f(cy - hy - dy)}L${f(cx + hx - dx)} ${f(cy + hy - dy)}L${f(cx + hx + dx)} ${f(cy + hy + dy)}L${f(cx - hx + dx)} ${f(cy - hy + dy)}Z`;
      }
    }
  }
  return { streets, buildings: bld };
}

// generated lazily on the client (keeps the server HTML small; the streets fade in a moment after load)
let GEN: ReturnType<typeof generate> | null = null;
const generated = () => (GEN ??= generate());

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
const PLOT_PATH = rectPath(
  PLOT.x,
  PLOT.y,
  DEPTH_ANG,
  23.4 / M_PER_UNIT,
  7.1 / M_PER_UNIT,
);
const HOUSE_A = rectPath(
  PLOT.x + Math.cos(DEPTH_ANG) * -2.6,
  PLOT.y + Math.sin(DEPTH_ANG) * -2.6,
  DEPTH_ANG,
  5.4,
  3.6,
);
const HOUSE_B = rectPath(
  PLOT.x + Math.cos(DEPTH_ANG) * 3.6,
  PLOT.y + Math.sin(DEPTH_ANG) * 3.6,
  DEPTH_ANG,
  5.4,
  3.6,
);

/* ---------- drawing ---------- */

const at = (x: number, y: number, rot = 0): CSSProperties => ({
  transform: `translate(${x}px, ${y}px) scale(var(--k))${rot ? ` rotate(${rot}deg)` : ""}`,
});
const tierClass = (t: Tier) =>
  t === "town" ? s.tTown : t === "near" ? s.tNear : undefined;

function PoiIcon({ kind }: { kind: Poi["kind"] }) {
  const fill =
    kind === "water"
      ? "#4a8fd6"
      : kind === "green"
        ? "#34a853"
        : kind === "bus"
          ? "#7a8594"
          : "#9b6ad6";
  return (
    <g>
      <circle r="11" fill={fill} stroke="#fff" strokeWidth="2.5" />
      {kind === "bus" && (
        <g fill="#fff">
          <rect x="-5" y="-6" width="10" height="9" rx="2" />
          <rect x="-4" y="3" width="2.4" height="2.6" rx="1" />
          <rect x="1.6" y="3" width="2.4" height="2.6" rx="1" />
        </g>
      )}
      {kind === "temple" && (
        <path d="M0 -7 L4 -2 H3 V5 H-3 V-2 H-4 Z" fill="#fff" />
      )}
      {kind === "green" && (
        <path d="M0 -7 L5 1 H2 L5 5 H-5 L-2 1 H-5 Z" fill="#fff" />
      )}
      {kind === "water" && (
        <path
          d="M0 -6 C3 -2 5 1 5 3 A5 5 0 0 1 -5 3 C-5 1 -3 -2 0 -6Z"
          fill="#fff"
        />
      )}
    </g>
  );
}

function TownMapImpl({
  svgRef,
  className,
  detail,
}: {
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
  detail: boolean;
}) {
  const gen = detail ? generated() : null;
  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox="40 25 1920 1200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ "--k": 1.33, "--z": 0 } as CSSProperties}
    >
      <rect
        x={-1500}
        y={-1500}
        width={MAP_W + 3000}
        height={MAP_H + 3000}
        fill="#eef0f3"
      />
      {GREEN.map((g, i) => (
        <path key={`g${i}`} d={smooth(g, true)} fill="#d3f0d6" />
      ))}
      {PARKS.map((g, i) => (
        <path key={`p${i}`} d={smooth(g, true)} fill="#bfe6c4" />
      ))}
      {BUSY.map((b, i) => (
        <path key={`b${i}`} d={smooth(b)} className={s.busy} />
      ))}
      {WATER.map((w, i) => (
        <path key={`w${i}`} d={smooth(w, true)} fill="#8fd3f4" />
      ))}
      {gen && <path d={gen.buildings} className={s.bld} />}
      {gen && <path d={gen.streets} className={s.minor} />}
      {[LANE, ...LANE_X].map((l, i) => (
        <path key={`l${i}`} d={smooth(l)} className={s.lane} />
      ))}
      {ROADS.map((l, i) => (
        <path key={`rc${i}`} d={smooth(l)} className={s.roadCase} />
      ))}
      {ROADS.map((l, i) => (
        <path key={`r${i}`} d={smooth(l)} className={s.road} />
      ))}
      {MAIN.map((l, i) => (
        <path key={`mc${i}`} d={smooth(l)} className={s.mainCase} />
      ))}
      {MAIN.map((l, i) => (
        <path key={`m${i}`} d={smooth(l)} className={s.main} />
      ))}
      {HIGHWAYS.map((l, i) => (
        <path key={`hc${i}`} d={smooth(l)} className={s.hwyCase} />
      ))}
      {HIGHWAYS.map((l, i) => (
        <path key={`h${i}`} d={smooth(l)} className={s.hwy} />
      ))}

      {/* the plot itself, drawn to scale (shows up as the camera lands) */}
      <g className={s.plot}>
        <path d={PLOT_PATH} className={s.plotLand} />
        <path d={HOUSE_A} className={s.plotHouse} />
        <path d={HOUSE_B} className={s.plotHouse} />
      </g>

      {/* labels: constant on-screen size whatever the zoom */}
      {STREET_NAMES.map((n) => (
        <g key={n.t} style={at(n.x, n.y, n.a)} className={tierClass(n.tier)}>
          <text className={s.streetName} textAnchor="middle" dy="4">
            {n.t}
          </text>
        </g>
      ))}
      {AREAS.map((a) => (
        <g key={a.en} style={at(a.x, a.y)} className={tierClass(a.tier)}>
          <text className={a.big ? s.townName : s.areaName} textAnchor="middle">
            {a.en}
          </text>
          {a.ta && (
            <text
              className={a.big ? s.townTa : s.areaTa}
              textAnchor="middle"
              dy={a.big ? 22 : 15}
            >
              {a.ta}
            </text>
          )}
        </g>
      ))}
      {SHIELDS.map((sh) => (
        <g key={`${sh.t}${sh.x}`} style={at(sh.x, sh.y)}>
          <rect
            x="-15"
            y="-9.5"
            width="30"
            height="19"
            rx="3.5"
            className={s.shield}
          />
          <text className={s.shieldText} textAnchor="middle" dy="4.2">
            {sh.t}
          </text>
        </g>
      ))}
      {POIS.map((p) => (
        <g key={p.en} style={at(p.x, p.y)} className={s.tTown}>
          <PoiIcon kind={p.kind} />
          <g
            transform={
              p.side === "l"
                ? "translate(-17 0)"
                : p.side === "b"
                  ? "translate(0 28)"
                  : "translate(17 0)"
            }
          >
            <text
              className={s.poiName}
              data-kind={p.kind}
              textAnchor={
                p.side === "l" ? "end" : p.side === "b" ? "middle" : "start"
              }
              dy={p.ta ? -1 : 4}
            >
              {p.en}
            </text>
            {p.ta && (
              <text
                className={s.poiTa}
                textAnchor={
                  p.side === "l" ? "end" : p.side === "b" ? "middle" : "start"
                }
                dy="13"
              >
                {p.ta}
              </text>
            )}
          </g>
        </g>
      ))}

      {/* the pin on the plot */}
      <g style={at(PLOT.x, PLOT.y)}>
        <g className={s.pulse}>
          <circle r="16" className={s.pulseRing} />
        </g>
        <ellipse rx="7" ry="2.6" fill="rgba(0,0,0,.28)" />
        <g className={s.pinBob}>
          <path
            d="M0 0 C-3 -9 -15 -20 -15 -31 A15 15 0 1 1 15 -31 C15 -20 3 -9 0 0Z"
            fill="#ea4335"
            stroke="#b3261e"
            strokeWidth="1.5"
          />
          <circle cy="-31" r="5.6" fill="#7d1d16" />
        </g>
        <g className={s.questTag} transform="translate(22 -44)">
          <rect width="200" height="34" rx="7" className={s.questBox} />
          <rect x="0" y="0" width="4" height="34" rx="2" fill="#ffb547" />
          <text x="14" y="22" className={s.questName}>
            PATTUKKOTTAI ESTATE
          </text>
        </g>
      </g>
    </svg>
  );
}

export const TownMap = memo(TownMapImpl);
