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

/** Black steel window grill: a diamond lattice with small cream square inserts (photos of the owner's houses). */
function drawGrill(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, bar: string, lw: number, inserts: string | null) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.strokeStyle = bar;
  ctx.lineWidth = lw;
  ctx.lineCap = "square";
  // vertical bars
  const nv = Math.max(3, Math.round(w / 18));
  for (let i = 1; i < nv; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + (i * w) / nv, y0);
    ctx.lineTo(x0 + (i * w) / nv, y0 + h);
    ctx.stroke();
  }
  // a big diamond lattice over the bars
  const d = w * 0.5;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  for (let k = -3; k <= 3; k++) {
    const cx = x0 + w / 2 + k * d;
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx + h * 0.5, y0 + h * 0.5);
    ctx.lineTo(cx, y0 + h);
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx - h * 0.5, y0 + h * 0.5);
    ctx.lineTo(cx, y0 + h);
  }
  ctx.stroke();
  // middle rail
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h * 0.5);
  ctx.lineTo(x0 + w, y0 + h * 0.5);
  ctx.stroke();
  if (inserts) {
    const s = Math.max(5, w * 0.09);
    for (const [fx, fy] of [
      [0.5, 0.18],
      [0.5, 0.82],
      [0.22, 0.5],
      [0.78, 0.5],
    ]) {
      ctx.fillStyle = bar;
      ctx.fillRect(x0 + fx * w - s / 2 - 2, y0 + fy * h - s / 2 - 2, s + 4, s + 4);
      ctx.fillStyle = inserts;
      ctx.fillRect(x0 + fx * w - s / 2, y0 + fy * h - s / 2, s, s);
    }
  }
  ctx.restore();
}

/** Window: dark-maroon frame, glass in shadow, black diamond grill with cream inserts. */
export const windowTex = () =>
  make(
    "window2",
    128,
    170,
    (ctx, w, h) => {
      ctx.fillStyle = "#4a1c18";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#6a2a22";
      ctx.fillRect(5, 5, w - 10, h - 10);
      const g = ctx.createLinearGradient(0, 14, w, h);
      g.addColorStop(0, "#41505a");
      g.addColorStop(0.45, "#1c242b");
      g.addColorStop(1, "#11171c");
      ctx.fillStyle = g;
      ctx.fillRect(13, 13, w - 26, h - 26);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(15, 15);
      ctx.lineTo(50, 15);
      ctx.lineTo(15, 75);
      ctx.fill();
      ctx.fillStyle = "#5a221c";
      ctx.fillRect(w / 2 - 3, 13, 6, h - 26);
      drawGrill(ctx, 13, 13, w - 26, h - 26, "#141414", 3.4, "#efe6cf");
    },
    { repeat: false },
  );

/** Emissive map for lit windows: warm room glow behind the same grill. */
export const windowGlowTex = () =>
  make(
    "windowGlow2",
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
      ctx.fillRect(13, 13, w - 26, h - 26);
      ctx.fillStyle = "rgba(120,40,30,0.55)";
      ctx.beginPath();
      ctx.moveTo(13, 13);
      ctx.quadraticCurveTo(46, h * 0.5, 28, h - 13);
      ctx.lineTo(13, h - 13);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(w / 2 - 3, 13, 6, h - 26);
      drawGrill(ctx, 13, 13, w - 26, h - 26, "#000", 3.4, "#000");
    },
    { repeat: false },
  );

/**
 * Veranda grill panel (on transparent): black frame, vertical bars, diamond lattice with cream square inserts.
 * Square-ish, drawn with alphaTest so the dark veranda behind shows through.
 */
export const verandaGrillTex = () =>
  make(
    "verandaGrill",
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 9;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      drawGrill(ctx, 5, 5, w - 10, h - 10, "#151515", 5, "#efe6cf");
    },
    { repeat: false },
  );

/** Square white breeze-block jaali (quatrefoil lattice) in a black frame — set into the compound wall. */
export const jaliTex = () =>
  make(
    "jali",
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = "#161616";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3b3a37";
      ctx.fillRect(12, 12, w - 24, h - 24);
      ctx.save();
      ctx.beginPath();
      ctx.rect(12, 12, w - 24, h - 24);
      ctx.clip();
      ctx.strokeStyle = "#f4f1e8";
      ctx.lineWidth = 6;
      const c = w / 2;
      const r = (w - 24) / 4;
      // quatrefoil: four overlapping circles around the centre + a square ring
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        ctx.beginPath();
        ctx.arc(c + dx * r, c + dy * r, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineWidth = 7;
      ctx.strokeRect(12 + 3, 12 + 3, w - 30, h - 30);
      ctx.beginPath();
      ctx.moveTo(c, 12);
      ctx.lineTo(w - 12, c);
      ctx.lineTo(c, h - 12);
      ctx.lineTo(12, c);
      ctx.closePath();
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    },
    { repeat: false },
  );

/** Small arched white jaali vent for the raised front parapet. */
export const ventArchTex = () =>
  make(
    "ventArch",
    96,
    128,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const arch = (inset: number) => {
        ctx.beginPath();
        ctx.moveTo(inset, h - inset);
        ctx.lineTo(inset, w / 2);
        ctx.arc(w / 2, w / 2, w / 2 - inset, Math.PI, 0);
        ctx.lineTo(w - inset, h - inset);
        ctx.closePath();
      };
      ctx.fillStyle = "#fbfaf5";
      arch(2);
      ctx.fill();
      ctx.fillStyle = "#4a4943";
      arch(12);
      ctx.fill();
      ctx.save();
      arch(12);
      ctx.clip();
      ctx.strokeStyle = "#fbfaf5";
      ctx.lineWidth = 4;
      for (let y = 24; y < h; y += 22)
        for (let x = 14; x < w; x += 22) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      ctx.restore();
    },
    { repeat: false },
  );

/** Door-number plate (on the pole outside each gate): black plate, gold numerals. */
export const houseNumberTex = (no: string) =>
  make(
    `houseNo2-${no}`,
    512,
    208,
    (ctx, w, h) => {
      ctx.fillStyle = "#0e0e0e";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e3c25e";
      ctx.lineWidth = 8;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = "#ffd66b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.min(128, Math.floor(820 / Math.max(1, no.length)))}px ${cssFont("--font-display", "Arial, sans-serif")}`;
      ctx.fillText(no, w / 2, h / 2 + 6, w - 56);
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

/** Woven bamboo lattice (diagonal criss-cross strips, open gaps) for the tax hut's window and gable. Tiles. */
export const bambooLatticeTex = () =>
  make("bambooLattice2", 128, 128, (ctx, w, h) => {
    // transparent gaps (alphaTest) so a lit interior can glow through the weave at night
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#cdb47a";
    ctx.lineWidth = 9;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 64, 0);
      ctx.lineTo(k * 64 + w, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(k * 64 + w, 0);
      ctx.lineTo(k * 64, h);
      ctx.stroke();
    }
  });

/** Split-bamboo mat wall: pale tan panels with fine vertical canes and darker frame battens. Tiles. */
export const bambooMatTex = () =>
  make("bambooMat", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#cbb47c";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) {
      ctx.fillStyle = x % 12 ? "rgba(120,95,50,0.18)" : "rgba(255,245,210,0.18)";
      ctx.fillRect(x, 0, 3, h);
    }
    ctx.fillStyle = "rgba(110,85,45,0.35)";
    ctx.fillRect(0, h / 2 - 2, w, 4);
  });

/** Name board of the little village property-tax office: white letters on government blue. */
export const officeBoardTex = () =>
  make(
    "taxOfficeBoard",
    512,
    112,
    (ctx, w, h) => {
      ctx.fillStyle = "#1d4f91";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#f4f1ea";
      ctx.lineWidth = 5;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 50px ${cssFont("--font-display", "Arial, sans-serif")}`;
      ctx.fillText("PROPERTY TAX OFFICE", w / 2, h / 2 + 3, w - 34);
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

/** Black steel gate (on transparent): frame, vertical bars and a column of diamonds with gold-cream squares. */
export const gateTex = () =>
  make(
    "gate2",
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#141414";
      ctx.lineCap = "square";
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.lineWidth = 5;
      for (let i = 1; i < 8; i++) {
        const x = (i * w) / 8;
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x, h - 6);
        ctx.stroke();
      }
      for (const y of [h * 0.3, h * 0.7]) {
        ctx.beginPath();
        ctx.moveTo(6, y);
        ctx.lineTo(w - 6, y);
        ctx.stroke();
      }
      // diamonds down the middle of each leaf
      for (const cx of [w * 0.27, w * 0.73]) {
        for (const cy of [h * 0.3, h * 0.5, h * 0.7]) {
          const r = w * 0.13;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r * 0.8, cy);
          ctx.lineTo(cx, cy + r);
          ctx.lineTo(cx - r * 0.8, cy);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = "#141414";
          ctx.fillRect(cx - 9, cy - 9, 18, 18);
          ctx.fillStyle = "#e2c77a";
          ctx.fillRect(cx - 6, cy - 6, 12, 12);
        }
      }
    },
    { repeat: false },
  );
