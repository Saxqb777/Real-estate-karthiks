// Real weather in Pattukkottai (owner 2/11/2026: "connect the real weather with my website, so its sunny, raining or
// dark depending on the real weather of pattukkottai"). Open-Meteo's free forecast API (no key) gives the current
// conditions; this module turns its answer into what the 3D world needs: how overcast, how hard it rains, mist,
// thunder and the wind. Pure — the API route fetches, the scene eases towards these numbers.

/** Pattukkottai town centre. */
export const PATTUKKOTTAI = { lat: 10.4235, lon: 79.3197 } as const;

export const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${PATTUKKOTTAI.lat}&longitude=${PATTUKKOTTAI.lon}` +
  "&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day&timezone=Asia%2FKolkata";

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "heavyRain" | "storm";

export interface WeatherNow {
  kind: WeatherKind;
  /** WMO weather code as reported */
  code: number;
  /** 0 clear sky … 1 completely overcast (dark) */
  overcast: number;
  /** 0 dry … 1 a downpour */
  rain: number;
  /** 0 … 1 mist / fog */
  mist: number;
  /** thunder and lightning */
  storm: boolean;
  /** wind at 10 m, km/h */
  windKmh: number;
  tempC: number | null;
  /** the observation time (local Pattukkottai time, ISO without zone) */
  observedAt: string;
}

/** The look for each WMO code (https://open-meteo.com/en/docs#weathervariables). Snow / freezing codes never happen
 *  in Pattukkottai; they map to their nearest rain look. */
export function lookForCode(code: number): { kind: WeatherKind; overcast: number; rain: number; mist: number; storm: boolean } {
  const c = Math.round(code);
  if (c === 0) return { kind: "clear", overcast: 0, rain: 0, mist: 0, storm: false };
  if (c === 1) return { kind: "partly", overcast: 0.18, rain: 0, mist: 0, storm: false };
  if (c === 2) return { kind: "partly", overcast: 0.4, rain: 0, mist: 0, storm: false };
  if (c === 3) return { kind: "cloudy", overcast: 0.82, rain: 0, mist: 0.1, storm: false };
  if (c === 45 || c === 48) return { kind: "fog", overcast: 0.7, rain: 0, mist: 1, storm: false };
  if (c === 51 || c === 56) return { kind: "drizzle", overcast: 0.85, rain: 0.22, mist: 0.25, storm: false };
  if (c === 53) return { kind: "drizzle", overcast: 0.88, rain: 0.3, mist: 0.3, storm: false };
  if (c === 55 || c === 57) return { kind: "drizzle", overcast: 0.9, rain: 0.38, mist: 0.35, storm: false };
  if (c === 61 || c === 80 || c === 71 || c === 85) return { kind: "rain", overcast: 0.9, rain: 0.5, mist: 0.3, storm: false };
  if (c === 63 || c === 81 || c === 66 || c === 73) return { kind: "rain", overcast: 0.95, rain: 0.72, mist: 0.4, storm: false };
  if (c === 65 || c === 67 || c === 75 || c === 77 || c === 86) return { kind: "heavyRain", overcast: 1, rain: 0.92, mist: 0.5, storm: false };
  if (c === 82) return { kind: "heavyRain", overcast: 1, rain: 1, mist: 0.55, storm: false };
  if (c === 95 || c === 96 || c === 99) return { kind: "storm", overcast: 1, rain: 0.9, mist: 0.45, storm: true };
  return { kind: "clear", overcast: 0, rain: 0, mist: 0, storm: false };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Open-Meteo's `current` block → WeatherNow (null when the answer is missing or malformed). */
export function weatherFromOpenMeteo(body: unknown): WeatherNow | null {
  const cur = (body as { current?: Record<string, unknown> } | null)?.current;
  if (!cur || typeof cur !== "object") return null;
  const code = num(cur.weather_code);
  if (code === null) return null;
  const look = lookForCode(code);
  const cloud = num(cur.cloud_cover);
  const precip = num(cur.precipitation) ?? 0;
  // the cloud cover deepens a plain "partly cloudy / overcast" sky a little either way; rain codes stay dark
  const overcast = look.rain > 0 || look.storm ? look.overcast : cloud === null ? look.overcast : clamp01(look.overcast * 0.6 + (cloud / 100) * 0.4);
  // a heavier hourly amount than the code suggests makes the rain heavier (6 mm/h ≈ a downpour)
  const rain = look.rain > 0 ? clamp01(Math.max(look.rain, precip / 6)) : 0;
  return {
    kind: look.kind,
    code,
    overcast,
    rain,
    mist: look.mist,
    storm: look.storm,
    windKmh: Math.max(0, num(cur.wind_speed_10m) ?? 0),
    tempC: num(cur.temperature_2m),
    observedAt: typeof cur.time === "string" ? cur.time : "",
  };
}

/** A made-up reading for one look (the 3D lab, previews). */
export function sampleWeather(kind: WeatherKind): WeatherNow {
  const code: Record<WeatherKind, number> = { clear: 0, partly: 2, cloudy: 3, fog: 45, drizzle: 53, rain: 63, heavyRain: 82, storm: 95 };
  const look = lookForCode(code[kind]);
  return { kind, code: code[kind], overcast: look.overcast, rain: look.rain, mist: look.mist, storm: look.storm, windKmh: kind === "storm" || kind === "heavyRain" ? 32 : 12, tempC: 28, observedAt: "" };
}
