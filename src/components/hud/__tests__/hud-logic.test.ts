// HUD presentation logic: one format per kind of number, explain-key plumbing, status-chip priorities, axis ticks.
// (The money itself is computed and tested in src/lib — these only check how it is shown and routed.)
import { describe, expect, it } from "vitest";
import type { DashboardData, Explain } from "../../../lib/dashboard-types";
import { buildStatusChips } from "../chips";
import { axisINR, niceTicks } from "../charts/scale";
import { parseExplainKey, relatedExplains } from "../explain-keys";
import { explainKey, fmt, inr, monthList, phoneText, waHref } from "../format";

describe("fmt / inr — identical formats everywhere", () => {
  it("prints whole rupees with Indian grouping, a real minus sign and paise only when they exist", () => {
    expect(inr(1234567)).toBe("₹12,34,567");
    expect(inr(-1410)).toBe("−₹1,410");
    expect(inr(10.5)).toBe("₹10.50");
    expect(inr(0)).toBe("₹0");
    expect(inr(null)).toBe("—");
  });
  it("compacts money only from ₹10 L, so smaller figures stay exact", () => {
    expect(fmt(999999, "inr", true)).toBe("₹9,99,999");
    expect(fmt(6150000, "inr", true)).toBe("₹61.5 L");
    expect(fmt(12595960, "inr", true)).toBe("₹1.26 Cr");
    expect(fmt(-2500000, "inr", true)).toBe("−₹25 L");
    expect(fmt(12595960, "inr")).toBe("₹1,25,95,960");
  });
  it("prints the other kinds the same way the explanations do", () => {
    expect(fmt(0.072503, "pct")).toBe("7.3%");
    expect(fmt(1.564716, "multiplier")).toBe("×1.56");
    expect(fmt(1, "days")).toBe("1 day");
    expect(fmt(772, "days")).toBe("772 days");
    expect(fmt(6.396, "years")).toBe("6.4 yrs");
    expect(fmt(3594, "inrPerSqft")).toBe("₹3,594/sqft");
    expect(fmt(undefined, "pct")).toBe("—");
  });
  it("lists months compactly", () => {
    expect(monthList(["Jul 2026", "Aug 2026", "Sep 2026"])).toBe("Jul, Aug, Sep 2026");
    expect(monthList(["Dec 2025", "Jan 2026"])).toBe("Dec 2025, Jan 2026");
  });
});

describe("explain keys", () => {
  it("builds and parses scoped keys", () => {
    expect(explainKey("netCash", "allTime")).toBe("netCash");
    expect(explainKey("netCash", "year")).toBe("year:netCash");
    expect(explainKey("expenses", "month", "u1")).toBe("unit:u1:month:expenses");
    expect(parseExplainKey("unit:u1:month:expenses")).toEqual({ unitId: "u1", period: "month", base: "expenses" });
    expect(parseExplainKey("year:collection")).toEqual({ unitId: null, period: "year", base: "collection" });
    expect(parseExplainKey("worthNow")).toEqual({ unitId: null, period: "allTime", base: "worthNow" });
  });
  it("links a figure to the figures it is made of, in the same scope (falling back to all time)", () => {
    const ex = (key: string): Explain => ({ key, title: key, bucket: "cash", scope: "", value: 1, format: "inr", plain: "", formula: "", steps: [], inputs: [], inputsNote: null, notes: [] });
    const data = { explain: Object.fromEntries(["year:netCash", "year:rentCollected", "year:expenses", "gain", "worthNow", "invested", "unit:u1:worthNow"].map((k) => [k, ex(k)])) } as unknown as DashboardData;
    expect(relatedExplains(data, "year:netCash").map((e) => e.key)).toEqual(["year:rentCollected", "year:expenses"]);
    expect(relatedExplains(data, "gain").map((e) => e.key)).toEqual(["worthNow", "invested"]);
    // unit gain → its own worth now; invested has no unit key, so the portfolio one is used
    expect(relatedExplains(data, "unit:u1:gain").map((e) => e.key)).toEqual(["unit:u1:worthNow"]);
  });
  it("links a year / month cash figure to its 'vs last year' explanation (none for all time)", () => {
    const ex = (key: string): Explain => ({ key, title: key, bucket: "cash", scope: "", value: 1, format: "pct", plain: "", formula: "", steps: [], inputs: [], inputsNote: null, notes: [] });
    const keys = ["year:rentCollected", "yoy:year:rentCollected", "unit:u1:month:expenses", "unit:u1:yoy:month:expenses", "rentCollected", "collection"];
    const data = { explain: Object.fromEntries(keys.map((k) => [k, ex(k)])) } as unknown as DashboardData;
    expect(relatedExplains(data, "year:rentCollected").map((e) => e.key)).toEqual(["collection", "yoy:year:rentCollected"]);
    expect(relatedExplains(data, "unit:u1:month:expenses").map((e) => e.key)).toEqual(["unit:u1:yoy:month:expenses"]);
    expect(relatedExplains(data, "rentCollected").map((e) => e.key)).toEqual(["collection"]);
  });
});

describe("status chips — overdue > due soon > tax / to-dos > vacancy", () => {
  const unit = (over: Record<string, unknown>) => ({
    id: "u",
    name: "Unit",
    position: null,
    isActive: true,
    status: "occupied",
    rentState: "paid",
    nextPayment: null,
    incomingLease: null,
    vacantPeriods: [],
    purchaseDate: "2020-01-01T00:00:00.000Z",
    ...over,
  });
  const arrears = (n: number) => ({ months: Array.from({ length: n }, () => ({})), total: 0, lateFees: 0, totalWithFees: 29000 });
  const data = {
    asOf: "2026-10-03T00:00:00.000Z",
    units: [
      unit({ id: "b", name: "Unit B", position: "back", status: "vacant", rentState: "none", vacantPeriods: [{ ongoing: true, days: 520 }] }),
      unit({ id: "c", name: "Unit C", rentState: "due-soon", nextPayment: { dueDate: "2026-10-05T00:00:00.000Z", amountDue: 12500, daysOverdue: 0, arrears: arrears(0) } }),
      unit({ id: "a", name: "Unit A", position: "front", rentState: "overdue", nextPayment: { dueDate: "2026-07-05T00:00:00.000Z", amountDue: 3000, daysOverdue: 90, arrears: arrears(3) } }),
    ],
    actions: {
      pending: [
        { id: "t1", title: "Fix tap", isOverdue: true },
        { id: "t2", title: "Insurance", isOverdue: false },
      ],
    },
  } as unknown as DashboardData;

  it("puts the most urgent first and names things plainly", () => {
    const chips = buildStatusChips(data, [
      { unitId: "a", year: 2026, status: "Due" },
      { unitId: "b", year: 2026, status: "Due" },
      { unitId: "a", year: 2025, status: "Paid" },
      { unitId: "zzz", year: 2026, status: "Due" }, // a unit not on the board is ignored
    ]);
    expect(chips.map((c) => c.id)).toEqual(["overdue:a", "due:c", "tax", "todo-late", "vacant:b", "todos"]);
    expect(chips[0]).toMatchObject({ tone: "coral", text: "Unit A · 3 months late", detail: "₹29,000", target: { kind: "unit", unitId: "a" } });
    expect(chips[1].text).toBe("Rent due 5 Oct — Unit C");
    expect(chips[2]).toMatchObject({ text: "Property tax 2026 due", detail: "2 bills", target: { kind: "tax" } });
    expect(chips[3].text).toBe("To-do late: Fix tap");
    expect(chips[4].text).toBe("Unit B vacant 520 days");
    expect(chips[5].text).toBe("1 to-do on the board");
  });
  it("leaves out tax when none is due", () => {
    expect(buildStatusChips(data, null).some((c) => c.id === "tax")).toBe(false);
  });
});

describe("axis ticks (layout only)", () => {
  it("covers the range, includes zero and uses round steps", () => {
    const t = niceTicks(-6670, 12500, 4);
    expect(t[0]).toBeLessThanOrEqual(-6670);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(12500);
    expect(t).toContain(0);
    const step = t[1] - t[0];
    expect([1, 2, 2.5, 5].some((m) => Number.isInteger(step / (m * 1000)))).toBe(true);
    expect(niceTicks(0, 0)).toEqual([0, 1000]);
    expect(niceTicks(-500, -500)).toContain(0);
    expect(niceTicks(0, 3).every((v) => Number.isInteger(v))).toBe(true);
  });
  it("labels the axis compactly in Indian units", () => {
    expect(axisINR(0)).toBe("₹0");
    expect(axisINR(15000)).toBe("₹15k");
    expect(axisINR(250000)).toBe("₹2.5 L");
    expect(axisINR(-250000)).toBe("−₹2.5 L");
    expect(axisINR(12000000)).toBe("₹1.2 Cr");
  });
});

describe("tax collector's phone (call / WhatsApp)", () => {
  it("shows Indian mobiles as +91 XXXXX XXXXX and keeps anything else as typed", () => {
    expect(phoneText("+919876543210")).toBe("+91 98765 43210");
    expect(phoneText("+91 98765-43210")).toBe("+91 98765 43210");
    expect(phoneText("9876543210")).toBe("+91 98765 43210");
    expect(phoneText(" +971 50 123 4567 ")).toBe("+971 50 123 4567");
  });
  it("links WhatsApp with the country code (a bare 10-digit number is Indian)", () => {
    expect(waHref("+91 98765 43210")).toBe("https://wa.me/919876543210");
    expect(waHref("9876543210")).toBe("https://wa.me/919876543210");
    expect(waHref("+971 50 123 4567")).toBe("https://wa.me/971501234567");
  });
});
