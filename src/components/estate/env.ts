// Time-of-day lighting for the diorama. Palettes are keyed by IST hour and blended continuously, so the scene
// moves through dawn → morning → afternoon → evening → night exactly like the HUD clock (src/lib/day-phase.ts).
import * as THREE from "three";
import { dayPhaseAt, hourInIST, type DayPhase } from "@/lib/day-phase";

export type TimeOfDay = "auto" | "day" | "dusk" | "night" | DayPhase;

/** Representative hour for each manual override. */
export const PRESET_HOUR: Record<Exclude<TimeOfDay, "auto">, number> = {
  dawn: 5.55,
  morning: 8.4,
  day: 10.6,
  afternoon: 13.6,
  evening: 17.35,
  dusk: 18.3,
  night: 21.5,
};

export function targetHour(tod: TimeOfDay, now = new Date()): number {
  return tod === "auto" ? hourInIST(now) : PRESET_HOUR[tod];
}

export function phaseOf(hour: number): DayPhase {
  return dayPhaseAt(hour).phase;
}

interface Key {
  h: number;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  key: string; // sun / moon light colour
  keyI: number;
  fill: string;
  fillI: number;
  night: number; // 0 day … 1 full night
  lamps: number;
  windows: number;
  stars: number;
  cloud: string;
  exposure: number;
}

// Hand-tuned palette keys (hour of day in IST). Laterite earth, lime plaster and coconut green read well in all of them.
const KEYS: Key[] = [
  { h: 0, skyTop: "#04070f", skyHorizon: "#1b2a4d", skyBottom: "#06080f", hemiSky: "#3a4f86", hemiGround: "#1a1210", hemi: 0.75, key: "#9fb4ff", keyI: 0.75, fill: "#ffb36b", fillI: 0.1, night: 1, lamps: 1, windows: 1, stars: 1, cloud: "#3a4566", exposure: 1.05 },
  { h: 4.3, skyTop: "#070b18", skyHorizon: "#21305a", skyBottom: "#070910", hemiSky: "#3c4f86", hemiGround: "#1a1210", hemi: 0.75, key: "#9fb4ff", keyI: 0.7, fill: "#ffb36b", fillI: 0.1, night: 1, lamps: 1, windows: 0.75, stars: 0.9, cloud: "#3d4869", exposure: 1.05 },
  { h: 5.25, skyTop: "#27396b", skyHorizon: "#c88f98", skyBottom: "#1d1f33", hemiSky: "#7b84b8", hemiGround: "#4a2e26", hemi: 0.9, key: "#ffb7a0", keyI: 0.9, fill: "#8fa2e0", fillI: 0.25, night: 0.6, lamps: 0.75, windows: 0.55, stars: 0.35, cloud: "#c99aa6", exposure: 1.05 },
  { h: 6.1, skyTop: "#4b72b8", skyHorizon: "#ffbf95", skyBottom: "#4a4660", hemiSky: "#a9b8e0", hemiGround: "#7a4a36", hemi: 1.0, key: "#ffc49a", keyI: 1.9, fill: "#9fb6ff", fillI: 0.35, night: 0.15, lamps: 0.15, windows: 0.2, stars: 0, cloud: "#ffd6c2", exposure: 1.0 },
  { h: 7.4, skyTop: "#4f8fd6", skyHorizon: "#f3e6d6", skyBottom: "#78a8d8", hemiSky: "#c4dcf2", hemiGround: "#9a5d40", hemi: 1.45, key: "#ffe0b8", keyI: 2.8, fill: "#ffe9d2", fillI: 0.95, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#fff3e6", exposure: 1.0 },
  { h: 10.5, skyTop: "#3f86d4", skyHorizon: "#d4ebf8", skyBottom: "#6aa3dc", hemiSky: "#cfe4f6", hemiGround: "#a3613f", hemi: 1.5, key: "#fff1dc", keyI: 3.1, fill: "#fff0de", fillI: 0.95, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#ffffff", exposure: 0.98 },
  { h: 13.5, skyTop: "#3a82d2", skyHorizon: "#d8ecf8", skyBottom: "#6ea7de", hemiSky: "#d6e9f7", hemiGround: "#a3613f", hemi: 1.5, key: "#fff6ea", keyI: 3.3, fill: "#fff2e2", fillI: 0.9, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#ffffff", exposure: 0.95 },
  { h: 15.8, skyTop: "#457fc9", skyHorizon: "#efe4d2", skyBottom: "#7c9fca", hemiSky: "#d8e2ee", hemiGround: "#a3613f", hemi: 1.35, key: "#ffe6c0", keyI: 3.0, fill: "#ffe8cc", fillI: 0.8, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#fff6ea", exposure: 0.98 },
  { h: 17.2, skyTop: "#4d6fb4", skyHorizon: "#ffc485", skyBottom: "#5d4a5c", hemiSky: "#d6c9d8", hemiGround: "#94553a", hemi: 0.95, key: "#ffbc73", keyI: 2.7, fill: "#8fa5e6", fillI: 0.45, night: 0.05, lamps: 0, windows: 0.1, stars: 0, cloud: "#ffe0bd", exposure: 1.0 },
  { h: 18.15, skyTop: "#38407e", skyHorizon: "#ff9a62", skyBottom: "#2e2238", hemiSky: "#a495c4", hemiGround: "#6a3a2c", hemi: 0.9, key: "#ff9a5a", keyI: 2.0, fill: "#7f8ee0", fillI: 0.55, night: 0.35, lamps: 0.6, windows: 0.7, stars: 0.05, cloud: "#ffb59a", exposure: 1.02 },
  { h: 18.85, skyTop: "#1b2253", skyHorizon: "#c86a78", skyBottom: "#161426", hemiSky: "#6c70a8", hemiGround: "#3a2420", hemi: 0.85, key: "#b5a6ff", keyI: 0.95, fill: "#ff9d6b", fillI: 0.25, night: 0.75, lamps: 1, windows: 1, stars: 0.45, cloud: "#a87a96", exposure: 1.05 },
  { h: 19.7, skyTop: "#060a17", skyHorizon: "#22305c", skyBottom: "#070910", hemiSky: "#3d5089", hemiGround: "#1c1411", hemi: 0.8, key: "#a3b6ff", keyI: 0.8, fill: "#ffb36b", fillI: 0.12, night: 1, lamps: 1, windows: 1, stars: 1, cloud: "#3b4668", exposure: 1.05 },
  { h: 24, skyTop: "#04070f", skyHorizon: "#1b2a4d", skyBottom: "#06080f", hemiSky: "#3a4f86", hemiGround: "#1a1210", hemi: 0.75, key: "#9fb4ff", keyI: 0.75, fill: "#ffb36b", fillI: 0.1, night: 1, lamps: 1, windows: 1, stars: 1, cloud: "#3a4566", exposure: 1.05 },
];

const COLOR_FIELDS = ["skyTop", "skyHorizon", "skyBottom", "hemiSky", "hemiGround", "key", "fill", "cloud"] as const;
const NUM_FIELDS = ["hemi", "keyI", "fillI", "night", "lamps", "windows", "stars", "exposure"] as const;
type ColorField = (typeof COLOR_FIELDS)[number];
type NumField = (typeof NUM_FIELDS)[number];

export type Env = { [K in ColorField]: THREE.Color } & { [K in NumField]: number } & {
  hour: number;
  phase: DayPhase;
  sunDir: THREE.Vector3; // true sun direction (sky disc)
  moonDir: THREE.Vector3;
  keyDir: THREE.Vector3; // light direction actually used (kept above the horizon for shadows)
  sunVis: number;
  moonVis: number;
  fog: THREE.Color;
  /** 0..1 kolam freshness: drawn at dawn, crisp in the morning, fading by night */
  kolam: number;
};

const keyColors = KEYS.map((k) => Object.fromEntries(COLOR_FIELDS.map((f) => [f, new THREE.Color(k[f])])) as Record<ColorField, THREE.Color>);

export function createEnv(): Env {
  const e = {} as Env;
  for (const f of COLOR_FIELDS) e[f] = new THREE.Color();
  for (const f of NUM_FIELDS) e[f] = 0;
  e.sunDir = new THREE.Vector3();
  e.moonDir = new THREE.Vector3();
  e.keyDir = new THREE.Vector3();
  e.fog = new THREE.Color();
  e.hour = 12;
  e.phase = "afternoon";
  e.sunVis = 1;
  e.moonVis = 0;
  e.kolam = 1;
  return e;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const SUNRISE = 6.0;
const SUNSET = 18.25;

/** Sun arc: rises in the east (+x), sets in the west (−x) slightly towards the street (+z), as the drawing faces. */
export function sunDirection(hour: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = ((hour - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI;
  return out.set(Math.cos(a), Math.sin(a) * 0.96, 0.38).normalize();
}

export function moonDirection(hour: number, out = new THREE.Vector3()): THREE.Vector3 {
  const night = (((hour - SUNSET) % 24) + 24) % 24; // hours since sunset
  const a = (night / (24 - (SUNSET - SUNRISE))) * Math.PI;
  return out.set(-Math.cos(a) * 0.7, 0.55 + Math.sin(a) * 0.45, -0.45).normalize();
}

/** Evaluate the palette at an hour (0..24) into `out`. */
export function evalEnv(hour: number, out: Env): Env {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h))));
  for (const f of COLOR_FIELDS) out[f].copy(keyColors[i][f]).lerp(keyColors[i + 1][f], t);
  for (const f of NUM_FIELDS) out[f] = a[f] + (b[f] - a[f]) * t;
  out.hour = h;
  out.phase = phaseOf(h);
  sunDirection(h, out.sunDir);
  moonDirection(h, out.moonDir);
  out.sunVis = smooth(Math.min(1, Math.max(0, (out.sunDir.y + 0.08) / 0.16)));
  out.moonVis = smooth(Math.min(1, Math.max(0, (out.night - 0.4) / 0.5)));
  // light direction: the sun, lifted to ≥ 11° so shadows stay readable; swaps to the moon at night
  const sun = out.sunDir.clone();
  if (sun.y < 0.19) sun.setY(0.19).normalize();
  out.keyDir.copy(sun).lerp(out.moonDir, smooth(Math.min(1, Math.max(0, (out.night - 0.3) / 0.45)))).normalize();
  out.fog.copy(out.skyHorizon).lerp(out.skyBottom, 0.55);
  const kolamByHour = h >= 4 && h < 6 ? 0.55 + (h - 4) * 0.22 : h >= 6 && h < 12 ? 1 : h >= 12 && h < 19 ? 1 - (h - 12) * 0.05 : 0.55;
  out.kolam = kolamByHour;
  return out;
}

/** Ease the displayed hour towards a target along the shorter way round the clock. */
export function stepHour(current: number, target: number, dt: number, rate = 2.4): number {
  let d = target - current;
  if (d > 12) d -= 24;
  if (d < -12) d += 24;
  if (Math.abs(d) < 0.002) return target;
  return (current + d * (1 - Math.exp(-dt * rate)) + 24) % 24;
}

/** Gusty wind strength 0.15..1 (frame-rate independent, deterministic in time). */
export function windAt(t: number): number {
  const base = 0.5 + 0.22 * Math.sin(t * 0.21) + 0.12 * Math.sin(t * 0.53 + 1.3);
  const gust = Math.max(0, Math.sin(t * 0.37 + Math.sin(t * 0.11) * 2)) ** 3 * 0.45;
  return Math.min(1, Math.max(0.15, base + gust));
}

/** Prevailing wind heading in the ground plane (world x/z), slowly veering. */
export function windDir(t: number): [number, number] {
  const a = 0.35 + Math.sin(t * 0.05) * 0.35;
  return [Math.cos(a), Math.sin(a)];
}
