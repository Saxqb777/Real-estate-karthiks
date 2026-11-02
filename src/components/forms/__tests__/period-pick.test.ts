// Year · All time · Custom dates (owner 2/11/2026: "add all time and custom date … in every page where dates are present").
import { describe, expect, it } from "vitest";
import { defaultRange, keepOrder, periodParams, periodText } from "../period-pick";

const today = new Date(Date.UTC(2026, 10, 2)); // 2/11/2026

describe("custom dates start from what's on screen", () => {
  it("a past FY → its whole year", () => {
    expect(defaultRange({ kind: "year", year: 2024 }, "fy", today)).toEqual({ from: "2024-04-01", to: "2025-03-31" });
  });
  it("this FY → its start up to today", () => {
    expect(defaultRange({ kind: "year", year: 2026 }, "fy", today)).toEqual({ from: "2026-04-01", to: "2026-11-02" });
  });
  it("a calendar year → 1 Jan … 31 Dec (or today)", () => {
    expect(defaultRange({ kind: "year", year: 2025 }, "calendar", today)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(defaultRange({ kind: "year", year: 2026 }, "calendar", today)).toEqual({ from: "2026-01-01", to: "2026-11-02" });
  });
  it("all time → the last 12 months; dates already picked stay", () => {
    expect(defaultRange({ kind: "all" }, "fy", today)).toEqual({ from: "2025-11-03", to: "2026-11-02" });
    expect(defaultRange({ kind: "range", from: "2026-01-05", to: "2026-02-01" }, "fy", today)).toEqual({ from: "2026-01-05", to: "2026-02-01" });
  });
});

describe("From never passes To", () => {
  it("the other date follows the one just moved", () => {
    expect(keepOrder({ from: "2026-05-01", to: "2026-04-01" }, "from")).toEqual({ from: "2026-05-01", to: "2026-05-01" });
    expect(keepOrder({ from: "2026-05-01", to: "2026-04-01" }, "to")).toEqual({ from: "2026-04-01", to: "2026-04-01" });
    expect(keepOrder({ from: "2026-04-01", to: "2026-05-01" }, "to")).toEqual({ from: "2026-04-01", to: "2026-05-01" });
  });
});

describe("what the APIs and labels get", () => {
  it("year → year + mode, custom → from + to, all time → nothing", () => {
    expect(periodParams({ kind: "year", year: 2025 }, "fy")).toEqual({ year: "2025", yearMode: "fy" });
    expect(periodParams({ kind: "range", from: "2026-01-01", to: "2026-03-31" }, "fy")).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(periodParams({ kind: "all" }, "calendar")).toEqual({});
  });
  it("labels", () => {
    expect(periodText({ kind: "year", year: 2025 }, "fy")).toBe("FY 2025-26");
    expect(periodText({ kind: "all" }, "fy")).toBe("All time");
    expect(periodText({ kind: "range", from: "2026-01-01", to: "2026-03-31" }, "fy")).toBe("1/1/2026 – 31/3/2026");
  });
});
