// Size a photo before it is uploaded as proof (owner, 10/10/2026): small enough to store and send quickly, still sharp
// enough to read a bill or a payment screenshot. Pure maths, unit tested.

/** Photos: at most ~4.2 million pixels (a 12 MP phone photo → about 2370 × 1780) and 3000 px on the long side. */
export const PHOTO_MAX_PIXELS = 4_200_000;
export const PHOTO_MAX_SIDE = 3000;
/** the small preview shown in the thumbnails */
export const THUMB_MAX_SIDE = 360;

/** The size to draw a w × h image at so it fits both limits — never enlarged, never below 1 px, aspect ratio kept. */
export function fitWithin(w: number, h: number, maxPixels: number, maxSide: number): { width: number; height: number } {
  if (!(w > 0 && h > 0)) return { width: 1, height: 1 };
  const scale = Math.min(1, Math.sqrt(maxPixels / (w * h)), maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
