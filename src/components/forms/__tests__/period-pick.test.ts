// Year · All time (owner 2/11/2026); custom dates stay an API option (from / to).
import { describe, expect, it } from "vitest";
import { periodParams, periodText } from "../period-pick";

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
