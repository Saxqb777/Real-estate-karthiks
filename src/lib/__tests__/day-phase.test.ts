import { describe, expect, it } from "vitest";
import { dayPhaseAt, formatTimeIST, hourInIST } from "../day-phase";

describe("day phase (IST)", () => {
  it.each([
    [3.99, "night"],
    [4, "dawn"],
    [5.5, "dawn"],
    [6, "morning"],
    [11.99, "morning"],
    [12, "afternoon"],
    [16, "evening"],
    [18.99, "evening"],
    [19, "night"],
    [23.5, "night"],
    [0, "night"],
  ])("hour %s → %s", (h, phase) => {
    expect(dayPhaseAt(h).phase).toBe(phase);
  });

  it("night progress wraps past midnight", () => {
    expect(dayPhaseAt(19).progress).toBeCloseTo(0);
    expect(dayPhaseAt(23.5).progress).toBeCloseTo(4.5 / 9);
    expect(dayPhaseAt(3.5).progress).toBeCloseTo(8.5 / 9);
  });

  it("converts UTC to IST (+5:30)", () => {
    const d = new Date(Date.UTC(2026, 9, 2, 2, 12, 0)); // 02:12 UTC = 07:42 IST
    expect(hourInIST(d)).toBeCloseTo(7.7);
    expect(formatTimeIST(d)).toBe("7:42 AM");
    expect(dayPhaseAt(hourInIST(d)).tamil).toBe("காலை");
  });

  it("formats noon and midnight", () => {
    expect(formatTimeIST(new Date(Date.UTC(2026, 0, 1, 6, 30)))).toBe("12:00 PM");
    expect(formatTimeIST(new Date(Date.UTC(2026, 0, 1, 18, 30)))).toBe("12:00 AM");
  });
});
