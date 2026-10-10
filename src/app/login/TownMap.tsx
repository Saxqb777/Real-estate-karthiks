// Street map of Pattukkottai for the /login title screen, drawn in the familiar web-map palette (grey land, white
// streets, blue-grey highways, green fields, blue water). Traced from the owner's own map screenshot in a 2000 × 1250
// frame (1 unit ≈ 1.6 m); the traced features, the seeded minor streets / buildings and the plot live in town-data.ts.
// The parent flies the camera by changing the viewBox and two CSS variables: --k (map units per screen pixel, keeps
// labels and the pin a constant size) and --z (0 = whole town … 1 = street level, fades detail in and labels out).
// Owner, 10/10/2026 ("smooth on my phone"): the land, roads and the thousands of generated streets and buildings are
// painted on a <canvas> under the SVG (map-painter.ts — cached, re-drawn only when the camera has moved far enough),
// so a flight no longer re-draws ~25,000 path segments every frame. The SVG keeps the plot, labels and the pin; its
// own copy of the base layers only shows for the first paint, before the canvas takes over.
import { memo, type CSSProperties, type Ref } from "react";
import {
  BUSY,
  GREEN,
  HIGHWAYS,
  HOUSE_A,
  HOUSE_B,
  LANE,
  LANE_X,
  MAIN,
  MAP_H,
  MAP_W,
  PARKS,
  PLOT,
  PLOT_PATH,
  ROADS,
  WATER,
  smooth,
} from "./town-data";
import s from "./login.module.css";

export { MAP_H, M_PER_UNIT, PLOT } from "./town-data";

/* ---------- labels ---------- */

type Tier = "town" | "all" | "near";
type Area = {
  x: number;
  y: number;
  en: string;
  tier: Tier;
  big?: boolean;
};
const AREAS: Area[] = [
  {
    x: 803,
    y: 480,
    en: "Pattukkottai",
    tier: "town",
    big: true,
  },
  {
    x: 768,
    y: 168,
    en: "VATTAKUDI-NORTH",
    tier: "town",
  },
  {
    x: 793,
    y: 290,
    en: "MANICKAM COLONY",
    tier: "town",
  },
  { x: 1053, y: 282, en: "MATTUSANTHAI", tier: "town" },
  { x: 370, y: 335, en: "KOTTAI KOVIL", tier: "town" },
  { x: 1313, y: 404, en: "VALAVANPURAM", tier: "all" },
  {
    x: 663,
    y: 548,
    en: "NADIMUTHU NAGAR",
    tier: "town",
  },
  { x: 245, y: 700, en: "VOC NAGAR", tier: "town" },
  {
    x: 1106,
    y: 742,
    en: "VISHWANATH NAGAR",
    tier: "town",
  },
  {
    x: 533,
    y: 812,
    en: "SRINIVASAN NAGAR",
    tier: "town",
  },
  { x: 745, y: 865, en: "MUTHALCHERRY", tier: "town" },
  { x: 793, y: 945, en: "RV NAGAR", tier: "town" },
  {
    x: 1183,
    y: 920,
    en: "VINAYAKAR KOVIL",
    tier: "town",
  },
  {
    x: 143,
    y: 825,
    en: "VIVEKANANDA NAGAR",
    tier: "town",
  },
];

type Poi = {
  x: number;
  y: number;
  en: string;
  kind: "water" | "green" | "bus" | "temple";
  side?: "l" | "r" | "b";
};
const POIS: Poi[] = [
  { x: 828, y: 372, en: "Municipal Water Tank", kind: "water", side: "b" },
  {
    x: 703,
    y: 640,
    en: "Bus stand",
    kind: "bus",
    side: "l",
  },
  {
    x: 622,
    y: 980,
    en: "Naadiamman Temple",
    kind: "temple",
    side: "l",
  },
  {
    x: 1892,
    y: 645,
    en: "Pudhu Eri",
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
  canvasRef,
  className,
}: {
  svgRef?: Ref<SVGSVGElement>;
  canvasRef?: Ref<HTMLCanvasElement>;
  className?: string;
}) {
  return (
    <>
      <canvas ref={canvasRef} className={s.mapCanvas} aria-hidden />
      <svg
        ref={svgRef}
        className={className}
        viewBox="40 25 1920 1200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        style={{ "--k": 1.33, "--z": 0 } as CSSProperties}
      >
        {/* the base layers for the very first paint; the canvas draws them (and the streets) after that */}
        <g className={s.base}>
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
        </g>

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
                dy={4}
              >
                {p.en}
              </text>
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
    </>
  );
}

export const TownMap = memo(TownMapImpl);
