// Photos are shrunk on the device before upload (owner, 10/10/2026) — readable, small, never stretched.
import { describe, expect, it } from "vitest";
import { PHOTO_MAX_PIXELS, PHOTO_MAX_SIDE, THUMB_MAX_SIDE, fitWithin } from "../image-fit";

const photo = (w: number, h: number) => fitWithin(w, h, PHOTO_MAX_PIXELS, PHOTO_MAX_SIDE);

describe("fitWithin", () => {
  it("leaves a phone screenshot as it is (already small enough)", () => {
    expect(photo(1170, 2532)).toEqual({ width: 1170, height: 2532 });
  });

  it("brings a 12 MP camera photo down to about 4 MP, same shape", () => {
    const { width, height } = photo(4032, 3024);
    expect(width * height).toBeLessThanOrEqual(PHOTO_MAX_PIXELS);
    expect(width * height).toBeGreaterThan(PHOTO_MAX_PIXELS * 0.99);
    expect(width / height).toBeCloseTo(4032 / 3024, 2);
  });

  it("caps a very long image on its long side", () => {
    const { width, height } = photo(1000, 9000); // a long scrolling screenshot
    expect(height).toBe(PHOTO_MAX_SIDE);
    expect(width).toBe(333);
  });

  it("makes thumbnails no bigger than the preview size", () => {
    expect(fitWithin(4032, 3024, Infinity, THUMB_MAX_SIDE)).toEqual({ width: 360, height: 270 });
    expect(fitWithin(200, 100, Infinity, THUMB_MAX_SIDE)).toEqual({ width: 200, height: 100 });
  });

  it("never returns zero or negative sizes", () => {
    expect(fitWithin(0, 0, PHOTO_MAX_PIXELS, PHOTO_MAX_SIDE)).toEqual({ width: 1, height: 1 });
    expect(fitWithin(100000, 1, PHOTO_MAX_PIXELS, PHOTO_MAX_SIDE)).toEqual({ width: 3000, height: 1 });
  });
});
