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

describe("clockAt (fixed offsets)", () => {
  it("shows UAE 1.5 h behind India", async () => {
    const { clockAt, HOME_ZONE } = await import("../day-phase");
    const d = new Date(Date.UTC(2026, 9, 2, 21, 0)); // 21:00 UTC
    const ist = clockAt(d, 330); // 02:30 Sat
    const uae = clockAt(d, HOME_ZONE.offsetMin); // 01:00 Sat
    expect(`${ist.time} ${ist.ampm}`).toBe("2:30 AM");
    expect(`${uae.time} ${uae.ampm}`).toBe("1:00 AM");
    expect(ist.dateKey).toBe(uae.dateKey);
  });
  it("flags a different date around midnight", async () => {
    const { clockAt } = await import("../day-phase");
    const d = new Date(Date.UTC(2026, 9, 2, 19, 0)); // IST 00:30 Sat, UAE 23:00 Fri
    expect(clockAt(d, 330).dateKey).not.toBe(clockAt(d, 240).dateKey);
    expect(clockAt(d, 240).weekday).toBe("Fri");
  });
});

describe("formatTimeIST minute boundaries", () => {
  it("never drifts a minute at :00 seconds", async () => {
    const { formatTimeIST } = await import("../day-phase");
    for (let m = 0; m < 1440; m++) {
      const d = new Date(Date.UTC(2026, 9, 2, 0, m, 0));
      const ist = (m + 330) % 1440;
      const h = Math.floor(ist / 60);
      const expected = `${h % 12 === 0 ? 12 : h % 12}:${String(ist % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
      expect(formatTimeIST(d)).toBe(expected);
    }
  });
});
