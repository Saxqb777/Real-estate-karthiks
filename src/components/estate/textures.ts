// Procedural canvas textures for the diorama — everything is painted at runtime (no downloads).
// Each texture is created once per page and cached.
import * as THREE from "three";
import { cssFont, rng } from "./util";

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: Draw, o: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (o.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat !== false) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = o.aniso ?? 8;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

const repeats = new Map<string, THREE.Texture>();
/** Cached copy of a texture with its own repeat/offset (shares the image). Safe to call during render. */
export function withRepeat(tex: THREE.Texture, rx: number, ry: number, ox = 0, oy = 0) {
  const key = `${tex.uuid}|${rx.toFixed(5)}|${ry.toFixed(5)}|${ox.toFixed(4)}|${oy.toFixed(4)}`;
  let t = repeats.get(key);
  if (!t) {
    t = tex.clone();
    t.repeat.set(rx, ry);
    t.offset.set(ox, oy);
    t.needsUpdate = true;
    repeats.set(key, t);
  }
  return t;
}

/** Draw something tileably (repeat at ±w / ±h). */
function wrapDraw(w: number, h: number, x: number, y: number, r: number, fn: (x: number, y: number) => void) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) if (x + dx > -r && x + dx < w + r && y + dy > -r && y + dy < h + r) fn(x + dx, y + dy);
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], size: [number, number], alpha: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Fine lime-plaster grain (multiplied with the material colour). */
export const plasterTex = () =>
  make("plaster", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 22; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 30 + r() * 70;
      wrapDraw(w, h, x, y, rad, (xx, yy) => blob(ctx, xx, yy, rad, r() > 0.5 ? "#e6e6e6" : "#ffffff", 0.22));
    }
    speckle(ctx, w, h, 2200, ["#e2e2e2", "#ffffff", "#ebebeb"], [1, 2], 0.45, 8);
  });

/** Red laterite earth with patchy coconut-grove grass (tile top). */
export const earthTex = () =>
  make("earth", 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#b4673f";
    ctx.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 90; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 30 + r() * 90;
      const c = ["#7f9c47", "#6d8c3e", "#91aa52", "#68853f", "#9aab55"][Math.floor(r() * 5)];
      wrapDraw(w, h, x, y, rad, (xx, yy) => blob(ctx, xx, yy, rad, c, 0.55));
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 18 + r() * 40;
      wrapDraw(w, h, x, y, rad, (xx, yy) => blob(ctx, xx, yy, rad, "#bd6b40", 0.6));
    }
    speckle(ctx, w, h, 9000, ["#4f6a2e", "#8fa55a", "#7b4127", "#b8714a"], [1, 3], 0.45, 12);
  });

/** Vesicular laterite / soil strata for the tile edge (multiplied with each band colour). */
export const strataTex = () =>
  make("strata", 512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#ececec";
    ctx.fillRect(0, 0, w, h);
    const r = rng(21);
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = r() > 0.5 ? "#bdbdbd" : "#ffffff";
      ctx.fillRect(0, r() * h, w, 2 + r() * 8);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 700; i++) {
      const x = r() * w;
      const y = r() * h;
      const rx = 1.5 + r() * 4.5;
      const ry = rx * (0.5 + r() * 0.5);
      wrapDraw(w, h, x, y, 8, (xx, yy) => {
        ctx.fillStyle = `rgba(70,60,55,${0.35 + r() * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(xx, yy, rx, ry, r() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(xx - 0.6, yy - 0.8, rx * 0.6, ry * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    speckle(ctx, w, h, 5000, ["#a8a8a8", "#ffffff", "#8c8c8c"], [1, 2], 0.5, 22);
  });

/** Courtyard / passage cement tiles: 4 × 4 tiles of 2 ft → one repeat = 8 ft. */
export const pavingTex = () =>
  make("paving", 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#9c907f";
    ctx.fillRect(0, 0, w, h);
    const r = rng(31);
    const n = 4;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const tone = 205 + Math.floor(r() * 22);
        ctx.fillStyle = `rgb(${tone + 8},${tone},${tone - 14})`;
        ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
        const g = ctx.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
        g.addColorStop(0, "rgba(255,255,255,0.10)");
        g.addColorStop(1, "rgba(0,0,0,0.08)");
        ctx.fillStyle = g;
        ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      }
    speckle(ctx, w, h, 6000, ["#8f8576", "#efe7da", "#b5aa98"], [1, 2], 0.35, 32);
  });

/** Terracotta weathering-course roof tiles, 1 ft squares → one repeat = 8 ft. */
export const roofTex = () =>
  make("roof", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#d9b08c";
    ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    const n = 8;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const k = r();
        ctx.fillStyle = `rgb(${172 + Math.floor(k * 28)},${84 + Math.floor(k * 18)},${52 + Math.floor(r() * 14)})`;
        ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      }
    speckle(ctx, w, h, 2500, ["#7d3f22", "#e2a27c", "#5e2f1b"], [1, 2], 0.35, 42);
  });

/** Athangudi (Chettinad) cement tiles for the accent band: alternating motifs, one tile = 1 band height. */
export const athangudiTex = () =>
  make("athangudi", 256, 64, (ctx) => {
    const motif = (x: number, kind: number) => {
      const s = 64;
      ctx.fillStyle = "#f1e3c4";
      ctx.fillRect(x, 0, s, s);
      ctx.fillStyle = "#8e2a22";
      for (const [cx, cy] of [
        [x, 0],
        [x + s, 0],
        [x, s],
        [x + s, s],
      ]) {
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = kind ? "#d99a2b" : "#2e7d6b";
      ctx.beginPath();
      ctx.moveTo(x + s / 2, 6);
      ctx.lineTo(x + s - 6, s / 2);
      ctx.lineTo(x + s / 2, s - 6);
      ctx.lineTo(x + 6, s / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = kind ? "#2e7d6b" : "#d99a2b";
      for (let p = 0; p < 4; p++) {
        const a = (p * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.ellipse(x + s / 2 + Math.cos(a) * 8, s / 2 + Math.sin(a) * 8, 7, 3.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#8e2a22";
      ctx.beginPath();
      ctx.arc(x + s / 2, s / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,25,15,0.45)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, 0.75, s - 1.5, s - 1.5);
    };
    for (let i = 0; i < 4; i++) motif(i * 64, i % 2);
  });

/** Pulli kolam drawn in rice-flour white with a little colour, on transparent. */
export const kolamTex = () =>
  make(
    "kolam",
    512,
    512,
    (ctx, w) => {
      const c = w / 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // coloured petals (festive powder)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(a);
        ctx.fillStyle = i % 2 ? "rgba(255,93,115,0.75)" : "rgba(255,181,71,0.8)";
        ctx.beginPath();
        ctx.ellipse(0, -62, 18, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 7;
      // petals outline + inner circle
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -62, 22, 46, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(c, c, 18, 0, Math.PI * 2);
      ctx.stroke();
      // ring of loops around a dot grid (sikku-style arcs)
      const ringR = 150;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = c + Math.cos(a) * ringR;
        const y = c + Math.sin(a) * ringR;
        ctx.beginPath();
        ctx.arc(x, y, 22, a + Math.PI * 0.5, a + Math.PI * 2.5 - 0.6);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // wavy outer border
      ctx.beginPath();
      for (let i = 0; i <= 360; i++) {
        const a = (i / 360) * Math.PI * 2;
        const rr = 214 + Math.sin(a * 24) * 9;
        const x = c + Math.cos(a) * rr;
        const y = c + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      // corner dots + diamond
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(c, c - 250);
      ctx.lineTo(c + 250, c);
      ctx.lineTo(c, c + 250);
      ctx.lineTo(c - 250, c);
      ctx.closePath();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * 120, c + Math.sin(a) * 120, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { repeat: false },
  );

/** Teal-green painted window with grill (front face of the window). */
export const windowTex = () =>
  make(
    "window",
    128,
    170,
    (ctx, w, h) => {
      ctx.fillStyle = "#e9dcc4";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#245a50";
      ctx.fillRect(8, 8, w - 16, h - 16);
      const g = ctx.createLinearGradient(0, 14, w, h);
      g.addColorStop(0, "#3b5568");
      g.addColorStop(0.45, "#1c2a35");
      g.addColorStop(1, "#141e26");
      ctx.fillStyle = g;
      ctx.fillRect(16, 16, w - 32, h - 32);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.moveTo(18, 18);
      ctx.lineTo(48, 18);
      ctx.lineTo(18, 70);
      ctx.fill();
      ctx.fillStyle = "#245a50";
      ctx.fillRect(w / 2 - 3, 16, 6, h - 32);
      ctx.fillStyle = "#2b2b2b";
      for (let i = 1; i < 6; i++) ctx.fillRect(16 + (i * (w - 32)) / 6 - 1.5, 16, 3, h - 32);
      ctx.fillRect(16, h / 2 - 2, w - 32, 4);
    },
    { repeat: false },
  );

/** Emissive map for lit windows: warm room glow behind the grill and a curtain. */
export const windowGlowTex = () =>
  make(
    "windowGlow",
    128,
    170,
    (ctx, w, h) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.55, h * 0.6, 4, w * 0.5, h * 0.5, h * 0.6);
      g.addColorStop(0, "#fff1d0");
      g.addColorStop(0.6, "#ffb45e");
      g.addColorStop(1, "#c8662c");
      ctx.fillStyle = g;
      ctx.fillRect(16, 16, w - 32, h - 32);
      ctx.fillStyle = "rgba(120,40,30,0.55)";
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(46, h * 0.5, 30, h - 16);
      ctx.lineTo(16, h - 16);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(w / 2 - 3, 16, 6, h - 32);
      for (let i = 1; i < 6; i++) ctx.fillRect(16 + (i * (w - 32)) / 6 - 1.5, 16, 3, h - 32);
      ctx.fillRect(16, h / 2 - 2, w - 32, 4);
    },
    { repeat: false },
  );

/** Carved teak double door with brass knobs. */
export const doorTex = () =>
  make(
    "door",
    128,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#3e2414";
      ctx.fillRect(0, 0, w, h);
      for (const x0 of [10, w / 2 + 2]) {
        const lw = w / 2 - 12;
        ctx.fillStyle = "#7a4626";
        ctx.fillRect(x0, 12, lw, h - 14);
        for (let p = 0; p < 3; p++) {
          const y = 22 + p * ((h - 34) / 3);
          const ph = (h - 34) / 3 - 10;
          ctx.fillStyle = "#5e3319";
          ctx.fillRect(x0 + 6, y, lw - 12, ph);
          ctx.fillStyle = "#8e5530";
          ctx.fillRect(x0 + 9, y + 3, lw - 18, ph - 6);
        }
      }
      ctx.fillStyle = "#e0b24a";
      ctx.beginPath();
      ctx.arc(w / 2 - 6, h * 0.55, 4, 0, Math.PI * 2);
      ctx.arc(w / 2 + 8, h * 0.55, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c98f2a";
      ctx.fillRect(0, 0, w, 6);
    },
    { repeat: false },
  );

/** Hand-painted TO-LET board. Tamil line only when a Tamil font is available. */
export const toLetTex = (tamil: boolean) =>
  make(
    `tolet-${tamil}`,
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#f6f0e2";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c22d2d";
      ctx.lineWidth = 14;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = "#c22d2d";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${tamil ? 118 : 140}px ${cssFont("--font-display", "Impact, 'Arial Black', sans-serif")}`;
      ctx.fillText("TO-LET", w / 2, tamil ? h * 0.4 : h * 0.52);
      if (tamil) {
        ctx.fillStyle = "#1f1f1f";
        ctx.font = `700 52px ${cssFont("--font-tamil", "sans-serif")}`;
        ctx.fillText("வாடகைக்கு", w / 2, h * 0.76);
      }
    },
    { repeat: false },
  );

/** Weathered two-lane asphalt; one repeat = 32 ft along the road, full road width across. */
export const asphaltTex = () =>
  make("asphalt", 512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#47474c";
    ctx.fillRect(0, 0, w, h);
    const r = rng(51);
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = 20 + r() * (h - 40);
      const rad = 20 + r() * 60;
      wrapDraw(w, 1e6, x, y, rad, (xx) => blob(ctx, xx, y, rad, r() > 0.5 ? "#2f2f33" : "#57575d", 0.5));
    }
    ctx.fillStyle = "#3a3a3f";
    ctx.fillRect(r() * w * 0.6, h * 0.55, 90, 50); // repair patch
    speckle(ctx, w, h, 9000, ["#5d5d63", "#2a2a2e", "#6e6c68"], [1, 2], 0.6, 52);
    // worn edges + faded centre dashes
    ctx.fillStyle = "rgba(235,230,215,0.55)";
    ctx.fillRect(0, 10, w, 4);
    ctx.fillRect(0, h - 14, w, 4);
    ctx.fillStyle = "rgba(235,230,215,0.45)";
    for (let x = 0; x < w; x += 64) ctx.fillRect(x + 8, h / 2 - 2, 34, 4);
    ctx.fillStyle = "#7a5038";
    for (let x = 0; x < w; x += 3) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, 0, 3, 3 + r() * 9);
      ctx.fillRect(x, h - 3 - r() * 9, 3, 12);
    }
    ctx.globalAlpha = 1;
  });

/** Tamil Nadu milestone face: white with a yellow cap, town name from the plot data. */
export const milestoneTex = (town: string) =>
  make(
    `milestone-${town}`,
    256,
    320,
    (ctx, w, h) => {
      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(0, 0, w, h * 0.36);
      ctx.fillStyle = "#1d1d1d";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const name = town.toUpperCase().slice(0, 16);
      let size = 54;
      ctx.font = `700 ${size}px ${cssFont("--font-display", "Arial Narrow, sans-serif")}`;
      while (ctx.measureText(name).width > w - 24 && size > 18) {
        size -= 2;
        ctx.font = `700 ${size}px ${cssFont("--font-display", "Arial Narrow, sans-serif")}`;
      }
      ctx.fillText(name, w / 2, h * 0.52);
      ctx.font = `700 96px ${cssFont("--font-display", "Arial, sans-serif")}`;
      ctx.fillText("0", w / 2, h * 0.78);
      ctx.font = `600 30px ${cssFont("--font-display", "Arial, sans-serif")}`;
      ctx.fillText("KM", w / 2 + 52, h * 0.82);
    },
    { repeat: false },
  );

/** Soft radial glow sprite (white → transparent). */
export const glowTex = () =>
  make(
    "glow",
    128,
    128,
    (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    },
    { repeat: false, srgb: false },
  );

/** Green notice board with pinned notes (one per open to-do, up to 6) and a Tamil + English header. */
export const noticeTex = (notes: number, tamil: boolean) =>
  make(
    `notice-${notes}-${tamil}`,
    256,
    192,
    (ctx, w, h) => {
      ctx.fillStyle = "#24493a";
      ctx.fillRect(0, 0, w, h);
      const r = rng(61);
      speckle(ctx, w, h, 1400, ["#1d3d30", "#2d5846", "#335f4c"], [1, 2], 0.6, 62);
      ctx.fillStyle = "#e8dcc0";
      ctx.fillRect(0, 0, w, 34);
      ctx.fillStyle = "#3e2414";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${tamil ? 22 : 24}px ${tamil ? cssFont("--font-tamil", "sans-serif") : cssFont("--font-display", "sans-serif")}`;
      ctx.fillText(tamil ? "அறிவிப்பு · NOTICE" : "NOTICE", w / 2, 18);
      const spots = [
        [24, 48],
        [104, 44],
        [176, 52],
        [36, 116],
        [116, 112],
        [180, 120],
      ];
      const colors = ["#fbf6e8", "#f6df8a", "#f4f1ea", "#f7c6c6", "#fbf6e8", "#cfe8f6"];
      for (let i = 0; i < Math.min(6, notes); i++) {
        const [x, y] = spots[i];
        const pw = 54 + r() * 10;
        const ph = 58 + r() * 8;
        ctx.save();
        ctx.translate(x + pw / 2, y + ph / 2);
        ctx.rotate((r() - 0.5) * 0.16);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(-pw / 2 + 3, -ph / 2 + 4, pw, ph);
        ctx.fillStyle = colors[i];
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        ctx.fillStyle = "rgba(40,40,40,0.55)";
        for (let l = 0; l < 4; l++) ctx.fillRect(-pw / 2 + 7, -ph / 2 + 14 + l * 10, pw * (0.5 + r() * 0.35), 3);
        ctx.fillStyle = i % 2 ? "#c22d2d" : "#2f6fb5";
        ctx.beginPath();
        ctx.arc(0, -ph / 2 + 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    { repeat: false },
  );

/** Round municipal property-tax stamp (rubber-stamp ink on a brass plaque). state: paid ✓ / due / plain. */
export const taxStampTex = (state: "paid" | "due" | "plain", tamil: boolean) =>
  make(
    `tax-${state}-${tamil}`,
    256,
    256,
    (ctx, w) => {
      const c = w / 2;
      const ink = state === "due" ? "#b3262b" : state === "paid" ? "#1f6b4f" : "#7a2a1a";
      const g = ctx.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c);
      g.addColorStop(0, "#f2d488");
      g.addColorStop(0.7, "#d4a744");
      g.addColorStop(1, "#8a6420");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, c - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6efdc";
      ctx.beginPath();
      ctx.arc(c, c, c - 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(c, c, c - 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c, c, c - 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 26px ${cssFont("--font-display", "sans-serif")}`;
      ctx.fillText("PROPERTY TAX", c, c - 52);
      if (tamil) {
        ctx.font = `700 26px ${cssFont("--font-tamil", "sans-serif")}`;
        ctx.fillText("சொத்து வரி", c, c - 14);
      }
      ctx.font = `700 ${state === "plain" ? 54 : 46}px ${cssFont("--font-display", "sans-serif")}`;
      ctx.fillText(state === "paid" ? "PAID ✓" : state === "due" ? "DUE" : "₹", c, tamil ? c + 34 : c + 12);
      // worn ink
      const r = rng(71);
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 260; i++) {
        ctx.globalAlpha = 0.35 * r();
        ctx.fillRect(r() * w, r() * w, 2 + r() * 4, 2 + r() * 4);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
    { repeat: false },
  );

/** Chalk "Moving in D/M" slate that replaces the TO-LET board once a lease is signed. */
export const movingInTex = (date: string, tamil: boolean) =>
  make(
    `movein-${date}-${tamil}`,
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#23302c";
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 2600, ["#2e3d38", "#1b2623", "#3a4a44"], [1, 3], 0.6, 81);
      ctx.strokeStyle = "#d9b26a";
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = "#f4efe2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 64px ${cssFont("--font-display", "Impact, sans-serif")}`;
      ctx.fillText("MOVING IN", w / 2, h * (tamil ? 0.3 : 0.34));
      ctx.fillStyle = "#ffb547";
      ctx.font = `700 ${tamil ? 84 : 100}px ${cssFont("--font-display", "Impact, sans-serif")}`;
      ctx.fillText(date, w / 2, h * (tamil ? 0.62 : 0.7));
      if (tamil) {
        ctx.fillStyle = "#cfc6b4";
        ctx.font = `700 30px ${cssFont("--font-tamil", "sans-serif")}`;
        ctx.fillText("புதிய குடித்தனம்", w / 2, h * 0.87);
      }
    },
    { repeat: false },
  );

/**
 * Parapet face: terracotta plaster with a row of cement jaali openings (diamond lattice) and a drip line.
 * One repeat = 6 ft wide × the parapet height (set the repeat so v spans exactly the parapet).
 */
export const parapetTex = () =>
  make("parapet", 384, 192, (ctx, w, h) => {
    ctx.fillStyle = "#e9dccd";
    ctx.fillRect(0, 0, w, h);
    const r = rng(91);
    for (let i = 0; i < 18; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 20 + r() * 40;
      wrapDraw(w, h, x, y, rad, (xx, yy) => blob(ctx, xx, yy, rad, r() > 0.5 ? "#d8c8b8" : "#f6ece0", 0.3));
    }
    // jaali band: a row of small cement lattice panels, 6 per 6 ft, set into a cream frame
    const n = 6;
    const cw = w / n;
    ctx.fillStyle = "#f2e8da";
    ctx.fillRect(0, h * 0.34, w, h * 0.34);
    for (let i = 0; i < n; i++) {
      const cx = i * cw + cw / 2;
      const cy = h * 0.51;
      const bw = cw * 0.66;
      const bh = h * 0.24;
      ctx.fillStyle = "#7a3a24";
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.clip();
      ctx.strokeStyle = "#efe4d4";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = -4; k <= 4; k++) {
        ctx.moveTo(cx + k * (bw / 5) - bh, cy - bh);
        ctx.lineTo(cx + k * (bw / 5) + bh, cy + bh);
        ctx.moveTo(cx + k * (bw / 5) + bh, cy - bh);
        ctx.lineTo(cx + k * (bw / 5) - bh, cy + bh);
      }
      ctx.stroke();
      ctx.restore();
    }
    // drip line + weathering under the coping
    ctx.fillStyle = "rgba(60,30,20,0.35)";
    ctx.fillRect(0, h * 0.08, w, 3);
    const g = ctx.createLinearGradient(0, h * 0.08, 0, h * 0.3);
    g.addColorStop(0, "rgba(80,50,30,0.22)");
    g.addColorStop(1, "rgba(80,50,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.08, w, h * 0.22);
    speckle(ctx, w, h, 1600, ["#d6c6b4", "#ffffff", "#c9b8a6"], [1, 2], 0.4, 92);
  });

/** Woven palm-leaf mat with red chillies drying in the sun (a Pattukottai roadside sight). */
export const chilliMatTex = () =>
  make(
    "chillimat",
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#c9a76a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(120,90,40,0.35)";
      ctx.lineWidth = 2;
      for (let i = -h; i < w; i += 9) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
      const r = rng(101);
      for (let i = 0; i < 520; i++) {
        const x = 14 + r() * (w - 28);
        const y = 14 + r() * (h - 28);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(r() * Math.PI);
        ctx.fillStyle = r() > 0.15 ? (r() > 0.5 ? "#b3201c" : "#8e1612") : "#cf4a1c";
        ctx.beginPath();
        ctx.ellipse(0, 0, 6 + r() * 3, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3f6b2a";
        ctx.fillRect(6, -1, 3, 2);
        ctx.restore();
      }
      ctx.strokeStyle = "#8a6a34";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    },
    { repeat: false },
  );

/** Soft contact-shadow blob (alpha falloff; tint it with the material colour). */
export const blobTex = () =>
  make(
    "blob",
    64,
    64,
    (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.45, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    },
    { repeat: false, srgb: false },
  );

/** Wrought-iron gate: bars, rails and a sunburst top, on transparent. */
export const gateTex = () =>
  make(
    "gate",
    256,
    256,
    (ctx, w, h) => {
      ctx.strokeStyle = "#1d3330";
      ctx.lineCap = "round";
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 40, w - 12, h - 46);
      ctx.lineWidth = 6;
      for (let i = 1; i < 9; i++) {
        const x = (i * w) / 9;
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, h - 6);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(6, h * 0.62);
      ctx.lineTo(w - 6, h * 0.62);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(w / 2, 40, w * 0.36, Math.PI, 0);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(w / 2, 40);
        ctx.lineTo(w / 2 + Math.cos(a) * w * 0.36, 40 + Math.sin(a) * w * 0.36);
        ctx.stroke();
      }
      ctx.fillStyle = "#e0b24a";
      ctx.beginPath();
      ctx.arc(w / 2, 40, 9, 0, Math.PI * 2);
      ctx.fill();
    },
    { repeat: false },
  );
