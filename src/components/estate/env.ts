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
}

// Hand-tuned palette keys (hour of day in IST). Laterite earth, lime plaster and coconut green read well in all of them.
// The backdrop paints skyTop (screen top) → skyHorizon (a soft band) → skyBottom (the haze under the floating tile).
// Night and dusk keep a strong cool hemisphere light so the diorama never sinks into mud.
const KEYS: Key[] = [
  { h: 0, skyTop: "#081228", skyHorizon: "#1f3260", skyBottom: "#0b1226", hemiSky: "#4d64a6", hemiGround: "#22170f", hemi: 1.0, key: "#a9bcff", keyI: 0.95, fill: "#ffb36b", fillI: 0.14, night: 1, lamps: 1, windows: 1, stars: 1, cloud: "#46537c" },
  { h: 4.3, skyTop: "#0a1530", skyHorizon: "#26386a", skyBottom: "#0d1428", hemiSky: "#4e66a8", hemiGround: "#22170f", hemi: 1.0, key: "#a9bcff", keyI: 0.9, fill: "#ffb36b", fillI: 0.14, night: 1, lamps: 1, windows: 0.75, stars: 0.9, cloud: "#4a5680" },
  { h: 5.25, skyTop: "#2b3d74", skyHorizon: "#e2a19c", skyBottom: "#3c3656", hemiSky: "#8a8fc4", hemiGround: "#4a2e26", hemi: 1.05, key: "#ffb9a2", keyI: 1.0, fill: "#8fa2e0", fillI: 0.3, night: 0.6, lamps: 0.75, windows: 0.55, stars: 0.35, cloud: "#d7a7b2" },
  { h: 6.1, skyTop: "#4f77bd", skyHorizon: "#ffc9a0", skyBottom: "#77708c", hemiSky: "#adbbe2", hemiGround: "#7a4a36", hemi: 1.1, key: "#ffc49a", keyI: 2.0, fill: "#a6b9ff", fillI: 0.4, night: 0.15, lamps: 0.15, windows: 0.2, stars: 0, cloud: "#ffdcc8" },
  { h: 7.4, skyTop: "#4a8ad4", skyHorizon: "#f7ead8", skyBottom: "#a9c6e4", hemiSky: "#c4dcf2", hemiGround: "#9a5d40", hemi: 1.45, key: "#ffe2bc", keyI: 2.8, fill: "#ffe9d2", fillI: 0.95, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#fff5ea" },
  { h: 10.5, skyTop: "#3c84d4", skyHorizon: "#dcecf8", skyBottom: "#b4d0ec", hemiSky: "#cfe4f6", hemiGround: "#a3613f", hemi: 1.5, key: "#fff1dc", keyI: 3.1, fill: "#fff0de", fillI: 0.95, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#ffffff" },
  { h: 13.5, skyTop: "#3a80d0", skyHorizon: "#e2eef8", skyBottom: "#b8d2ea", hemiSky: "#d6e9f7", hemiGround: "#a3613f", hemi: 1.5, key: "#fff6ea", keyI: 3.3, fill: "#fff2e2", fillI: 0.9, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#ffffff" },
  { h: 15.8, skyTop: "#4580ca", skyHorizon: "#f1e6d4", skyBottom: "#bccbe0", hemiSky: "#d8e2ee", hemiGround: "#a3613f", hemi: 1.4, key: "#ffe6c0", keyI: 3.0, fill: "#ffe8cc", fillI: 0.8, night: 0, lamps: 0, windows: 0, stars: 0, cloud: "#fff6ea" },
  { h: 17.2, skyTop: "#4f70b6", skyHorizon: "#ffcf96", skyBottom: "#b39aa6", hemiSky: "#d6c9d8", hemiGround: "#94553a", hemi: 1.1, key: "#ffbe78", keyI: 2.7, fill: "#93a8e8", fillI: 0.5, night: 0.05, lamps: 0, windows: 0.1, stars: 0, cloud: "#ffe2c2" },
  { h: 18.15, skyTop: "#38458a", skyHorizon: "#ff9f6a", skyBottom: "#5e4566", hemiSky: "#a99acb", hemiGround: "#6a3a2c", hemi: 1.05, key: "#ff9d5e", keyI: 2.0, fill: "#8494e6", fillI: 0.6, night: 0.35, lamps: 0.6, windows: 0.7, stars: 0.05, cloud: "#ffb9a0" },
  { h: 18.85, skyTop: "#1e2b62", skyHorizon: "#d47c86", skyBottom: "#2c2748", hemiSky: "#7378b4", hemiGround: "#3a2420", hemi: 1.05, key: "#b9abff", keyI: 1.05, fill: "#ffa070", fillI: 0.3, night: 0.75, lamps: 1, windows: 1, stars: 0.45, cloud: "#b083a0" },
  { h: 19.7, skyTop: "#0b1530", skyHorizon: "#263a6c", skyBottom: "#0e1529", hemiSky: "#4f66a8", hemiGround: "#24180f", hemi: 1.0, key: "#a9bcff", keyI: 0.95, fill: "#ffb36b", fillI: 0.15, night: 1, lamps: 1, windows: 1, stars: 1, cloud: "#4a5680" },
  { h: 24, skyTop: "#081228", skyHorizon: "#1f3260", skyBottom: "#0b1226", hemiSky: "#4d64a6", hemiGround: "#22170f", hemi: 1.0, key: "#a9bcff", keyI: 0.95, fill: "#ffb36b", fillI: 0.14, night: 1, lamps: 1, windows: 1, stars: 1, cloud: "#46537c" },
];

const COLOR_FIELDS = ["skyTop", "skyHorizon", "skyBottom", "hemiSky", "hemiGround", "key", "fill", "cloud"] as const;
const NUM_FIELDS = ["hemi", "keyI", "fillI", "night", "lamps", "windows", "stars"] as const;
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
  /** scene ("world") time in seconds: advances with timeScale, so focus dimming slows every ambient motion */
  t: number;
  /** last frame's scene-time step (clamped, scaled) */
  dt: number;
  /** 1 normal · ~0.3 while the world is dimmed behind a reading panel */
  timeScale: number;
  /** gust strength 0.15..1 at the plot centre, and the prevailing wind heading in world x/z */
  wind: number;
  windDir: [number, number];
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
  e.t = 0;
  e.dt = 0;
  e.timeScale = 1;
  e.wind = 0.5;
  e.windDir = [1, 0];
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
export function windDir(t: number, out: [number, number] = [0, 0]): [number, number] {
  const a = 0.35 + Math.sin(t * 0.05) * 0.35;
  out[0] = Math.cos(a);
  out[1] = Math.sin(a);
  return out;
}

/** Gust fronts travel downwind at this speed (ft/s), so palms, laundry and petals catch the same gust one after another. */
export const GUST_SPEED = 26;

/** Gust strength at a world position: the plot-centre gust, delayed by how far downwind the point is. */
export function gustAt(e: Pick<Env, "t" | "windDir">, x: number, z: number): number {
  return windAt(e.t - (x * e.windDir[0] + z * e.windDir[1]) / GUST_SPEED);
}
