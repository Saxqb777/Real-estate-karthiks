// Pattukkottai's real weather → the 3D world's look (owner 2/11/2026).
import { describe, expect, it } from "vitest";
import { lookForCode, sampleWeather, weatherFromOpenMeteo, type WeatherKind } from "../weather";

// an Open-Meteo /v1/forecast answer with `current=…` (the shape the API route reads)
const answer = (current: Record<string, unknown>) => ({
  latitude: 10.375,
  longitude: 79.375,
  timezone: "Asia/Kolkata",
  current_units: { time: "iso8601", temperature_2m: "°C", weather_code: "wmo code", cloud_cover: "%", precipitation: "mm", wind_speed_10m: "km/h" },
  current: { time: "2026-11-02T14:15", interval: 900, is_day: 1, ...current },
});

describe("weather codes → the world's look", () => {
  it("clear, partly cloudy, overcast get darker step by step and stay dry", () => {
    const [a, b, c, d] = [0, 1, 2, 3].map(lookForCode);
    expect([a.kind, b.kind, c.kind, d.kind]).toEqual(["clear", "partly", "partly", "cloudy"]);
    expect(a.overcast).toBe(0);
    expect(b.overcast).toBeLessThan(c.overcast);
    expect(c.overcast).toBeLessThan(d.overcast);
    for (const l of [a, b, c, d]) expect(l.rain).toBe(0);
  });

  it("drizzle < rain < heavy rain, all under a dark sky", () => {
    const drizzle = lookForCode(53);
    const rain = lookForCode(63);
    const heavy = lookForCode(65);
    expect(drizzle.rain).toBeLessThan(rain.rain);
    expect(rain.rain).toBeLessThan(heavy.rain);
    for (const l of [drizzle, rain, heavy]) expect(l.overcast).toBeGreaterThanOrEqual(0.85);
    expect(lookForCode(82).kind).toBe("heavyRain");
  });

  it("thunderstorms flash, fog is misty, unknown codes stay clear", () => {
    for (const c of [95, 96, 99]) expect(lookForCode(c)).toMatchObject({ kind: "storm", storm: true });
    expect(lookForCode(45)).toMatchObject({ kind: "fog", mist: 1 });
    expect(lookForCode(1234)).toMatchObject({ kind: "clear", rain: 0, overcast: 0 });
  });
});

describe("reading Open-Meteo", () => {
  it("reads the current conditions", () => {
    const w = weatherFromOpenMeteo(answer({ temperature_2m: 29.4, weather_code: 63, cloud_cover: 100, precipitation: 1.2, wind_speed_10m: 18.5 }))!;
    expect(w).toMatchObject({ kind: "rain", code: 63, tempC: 29.4, windKmh: 18.5, storm: false, observedAt: "2026-11-02T14:15" });
    expect(w.rain).toBeCloseTo(0.72, 5);
    expect(w.overcast).toBeGreaterThan(0.9);
  });

  it("a heavier hourly amount than the code says makes the rain heavier", () => {
    const w = weatherFromOpenMeteo(answer({ weather_code: 61, cloud_cover: 100, precipitation: 5.4, wind_speed_10m: 10 }))!;
    expect(w.rain).toBeCloseTo(0.9, 5);
  });

  it("the cloud cover nudges a dry sky", () => {
    const thin = weatherFromOpenMeteo(answer({ weather_code: 2, cloud_cover: 20 }))!;
    const thick = weatherFromOpenMeteo(answer({ weather_code: 2, cloud_cover: 90 }))!;
    expect(thin.overcast).toBeLessThan(thick.overcast);
    expect(thin.rain).toBe(0);
  });

  it("returns null for a missing or broken answer", () => {
    expect(weatherFromOpenMeteo(null)).toBeNull();
    expect(weatherFromOpenMeteo({})).toBeNull();
    expect(weatherFromOpenMeteo({ current: { weather_code: "rain" } })).toBeNull();
  });

  it("every sample look round-trips to its kind", () => {
    const kinds: WeatherKind[] = ["clear", "partly", "cloudy", "fog", "drizzle", "rain", "heavyRain", "storm"];
    for (const k of kinds) expect(sampleWeather(k).kind).toBe(k);
  });
});
