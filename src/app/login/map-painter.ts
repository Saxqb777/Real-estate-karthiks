// Paints the login map's land, water, roads and the generated streets + buildings on a <canvas> (owner, 10/10/2026:
// "smooth on my phone"). The SVG used to re-draw ~25,000 path segments on every frame of the title drift and the
// flight. Now the canvas holds one vector render of the view plus a margin, and the frames in between only MOVE and
// SCALE that canvas with a CSS transform (the graphics chip composites it — nothing is re-drawn). The canvas is
// re-drawn when the camera has zoomed past ±30 % or panned out of it, and once more, exactly, when the camera comes
// to rest. Same colours, widths and layer order as the old SVG.
import { BUSY, GREEN, HIGHWAYS, LANE, LANE_X, MAIN, PARKS, ROADS, WATER, generated, smooth, type P } from "./town-data";

/** The SVG viewBox the camera shows (map units). */
export interface MapView {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BG = "#eef0f3";
/** grid cell (map units) for culling the generated streets and buildings */
const CELL = 160;
/** margin drawn round the view, as a share of the view on each side */
const MARGIN = 0.25;
/** re-draw once the zoom has drifted this far from the drawing (it is shown scaled in between) */
const ZOOM_SLACK = 1.3;
/** the most canvas pixels per screen pixel worth drawing (3× phones look the same at 2.5×) */
const MAX_DPR = 2.5;
/** the most pixels one canvas may hold */
const MAX_AREA = 16_000_000;

interface Chunk {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  streets: Path2D;
  buildings: Path2D | null;
}

interface Layers {
  green: Path2D[];
  parks: Path2D[];
  busy: Path2D[];
  water: Path2D[];
  lanes: Path2D[];
  roads: Path2D[];
  main: Path2D[];
  highways: Path2D[];
  chunks: Chunk[];
}

function buildLayers(): Layers {
  const open = (lines: P[][]) => lines.map((l) => new Path2D(smooth(l)));
  const closed = (shapes: P[][]) => shapes.map((g) => new Path2D(smooth(g, true)));
  // generated streets / buildings, grouped by grid cell so off-screen ones are skipped
  const gen = generated();
  const cells = new Map<string, { pts: P[]; streets: Path2D; buildings: Path2D | null }>();
  const cellOf = (x: number, y: number) => {
    const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    let c = cells.get(key);
    if (!c) {
      c = { pts: [], streets: new Path2D(), buildings: null };
      cells.set(key, c);
    }
    return c;
  };
  for (const [a, b] of gen.streets) {
    const c = cellOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    c.streets.moveTo(a[0], a[1]);
    c.streets.lineTo(b[0], b[1]);
    c.pts.push(a, b);
  }
  for (const r of gen.buildings) {
    const c = cellOf((r[0][0] + r[2][0]) / 2, (r[0][1] + r[2][1]) / 2);
    c.buildings ??= new Path2D();
    c.buildings.moveTo(r[0][0], r[0][1]);
    for (let i = 1; i < 4; i++) c.buildings.lineTo(r[i][0], r[i][1]);
    c.buildings.closePath();
    c.pts.push(...r);
  }
  const chunks: Chunk[] = [];
  for (const c of cells.values()) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of c.pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    chunks.push({ x0, y0, x1, y1, streets: c.streets, buildings: c.buildings });
  }
  return {
    green: closed(GREEN),
    parks: closed(PARKS),
    busy: open(BUSY),
    water: closed(WATER),
    lanes: open([LANE, ...LANE_X]),
    roads: open(ROADS),
    main: open(MAIN),
    highways: open(HIGHWAYS),
    chunks,
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * One vector render of the map region (x0, y0, w, h) into ctx at `k` canvas pixels per map unit. `css` = screen (CSS)
 * pixels per map unit, which sets the stroke widths (the old SVG strokes were non-scaling, in screen pixels); `z` =
 * 0 whole town … 1 street level (wider streets, buildings fading in, busy areas fading out).
 */
function render(ctx: CanvasRenderingContext2D, L: Layers, x0: number, y0: number, w: number, h: number, k: number, css: number, z: number) {
  const px = (v: number) => v / css;
  ctx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.fillRect(x0, y0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const fill = (paths: Path2D[], color: string) => {
    ctx.fillStyle = color;
    for (const p of paths) ctx.fill(p);
  };
  const stroke = (paths: Path2D[], color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = px(width);
    for (const p of paths) ctx.stroke(p);
  };
  fill(L.green, "#d3f0d6");
  fill(L.parks, "#bfe6c4");
  ctx.globalAlpha = 1 - z * 0.6;
  stroke(L.busy, "#fbe7c6", 20 + z * 40);
  ctx.globalAlpha = 1;
  fill(L.water, "#8fd3f4");
  // generated detail: only the cells that touch the region (a little slack for stroke widths)
  const pad = px(12);
  const seen = L.chunks.filter((c) => c.x1 + pad >= x0 && c.x0 - pad <= x0 + w && c.y1 + pad >= y0 && c.y0 - pad <= y0 + h);
  const bld = clamp01((z - 0.35) * 2.2);
  if (bld > 0) {
    ctx.globalAlpha = bld;
    ctx.fillStyle = "#e1e3e8";
    ctx.strokeStyle = "#d2d6dc";
    ctx.lineWidth = px(0.8);
    for (const c of seen) {
      if (!c.buildings) continue;
      ctx.fill(c.buildings);
      ctx.stroke(c.buildings);
    }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = px(1.5 + z * 5);
  for (const c of seen) ctx.stroke(c.streets);
  stroke(L.lanes, "#ffffff", 1.8 + z * 7);
  stroke(L.roads, "#d6dae0", 4.6 + z * 9);
  stroke(L.roads, "#ffffff", 3.2 + z * 7.5);
  stroke(L.main, "#ccd2da", 7 + z * 12);
  stroke(L.main, "#ffffff", 5.2 + z * 10);
  stroke(L.highways, "#7c94b8", 8 + z * 12);
  stroke(L.highways, "#98afd0", 6 + z * 10);
}

export interface MapPainter {
  /** Show this view (the SVG's viewBox) at zoom level z. Free unless the canvas has to be re-drawn. */
  paint(view: MapView, z: number): void;
  dispose(): void;
}

/**
 * `canvas` must be absolutely positioned at the top-left of the map box; it is sized and moved here. `onFirstPaint`
 * runs once the first drawing is on screen.
 */
export function createMapPainter(canvas: HTMLCanvasElement, onFirstPaint?: () => void): MapPainter {
  const ctx = canvas.getContext("2d", { alpha: false });
  let layers: Layers | null = null;
  // what the canvas holds: its region (map units), screen pixels per unit when drawn, the zoom level and screen size
  let held: { x0: number; y0: number; w: number; h: number; css: number; z: number; W: number; H: number; dpr: number } | null = null;
  let last: { view: MapView; z: number } | null = null;
  let settle = 0;
  let painted = false;
  canvas.style.transformOrigin = "0 0";
  canvas.style.willChange = "transform";

  const draw = (view: MapView, z: number, W: number, H: number, screenDpr: number) => {
    if (!ctx) return;
    const css = W / view.w;
    const x0 = view.x - view.w * MARGIN;
    const y0 = view.y - view.h * MARGIN;
    const w = view.w * (1 + 2 * MARGIN);
    const h = view.h * (1 + 2 * MARGIN);
    // iOS caps a canvas at 16.7 M pixels: big screens draw a touch softer rather than not at all
    const dpr = Math.min(screenDpr, Math.sqrt(MAX_AREA / (w * css * h * css)));
    const cw = Math.ceil(w * css * dpr);
    const ch = Math.ceil(h * css * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    canvas.style.width = `${cw / dpr}px`;
    canvas.style.height = `${ch / dpr}px`;
    layers ??= buildLayers();
    render(ctx, layers, x0, y0, w, h, css * dpr, css, z);
    held = { x0, y0, w, h, css, z, W, H, dpr: screenDpr };
  };

  const show = (view: MapView, z: number, exact: boolean) => {
    const W = canvas.parentElement?.clientWidth ?? window.innerWidth;
    const H = canvas.parentElement?.clientHeight ?? window.innerHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const css = W / view.w;
    const c = held;
    const inside = !!c && view.x >= c.x0 && view.y >= c.y0 && view.x + view.w <= c.x0 + c.w && view.y + view.h <= c.y0 + c.h;
    const ratio = c ? css / c.css : 0;
    const usable =
      !!c &&
      c.W === W &&
      c.H === H &&
      c.dpr === dpr &&
      inside &&
      (exact ? Math.abs(ratio - 1) < 0.002 && Math.abs(c.z - z) < 0.002 : ratio < ZOOM_SLACK && ratio > 1 / ZOOM_SLACK && Math.abs(c.z - z) < 0.15);
    if (!usable) draw(view, z, W, H, dpr);
    const h = held;
    if (!h) return;
    // place the drawing: its region's corner lands where the camera now puts it, scaled by the zoom since it was drawn
    const k = css / h.css;
    canvas.style.transform = `translate3d(${((h.x0 - view.x) * css).toFixed(2)}px, ${((h.y0 - view.y) * css).toFixed(2)}px, 0) scale(${k.toFixed(5)})`;
    if (!painted) {
      painted = true;
      onFirstPaint?.();
    }
  };

  return {
    paint(view, z) {
      last = { view: { ...view }, z };
      show(view, z, false);
      // when the camera rests, re-draw once at exactly this zoom (crisp, not a scaled copy)
      window.clearTimeout(settle);
      settle = window.setTimeout(() => last && show(last.view, last.z, true), 160);
    },
    dispose() {
      window.clearTimeout(settle);
      canvas.width = canvas.height = 0;
    },
  };
}
