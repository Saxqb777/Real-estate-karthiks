// GET /api/weather — Pattukkottai's weather right now, for the 3D world (sunny / cloudy / rain / storm / mist).
// Open-Meteo (free, no key); the answer is cached for 15 minutes, so the site asks it at most ~4 times an hour.
// If the weather service can't be reached the world simply stays clear: { weather: null }.
import { handler, json } from "@/lib/api";
import { OPEN_METEO_URL, weatherFromOpenMeteo } from "@/lib/weather";

export const GET = handler(async () => {
  try {
    const res = await fetch(OPEN_METEO_URL, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return json({ weather: null });
    return json({ weather: weatherFromOpenMeteo(await res.json()) });
  } catch {
    return json({ weather: null });
  }
});
