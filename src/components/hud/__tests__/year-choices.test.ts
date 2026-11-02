import { describe, expect, it } from "vitest";
import { yearChoices } from "../year-choices";

describe("the year dropdown's years", () => {
  it("keeps every year up to this year when an earlier year is picked (2025 used to vanish)", () => {
    // with 2024 picked the figures only reach 2024
    expect(yearChoices(2026, 2024, [2024])).toEqual([2026, 2025, 2024]);
  });

  it("lists this year back to the first year with records, newest first, no gaps", () => {
    expect(yearChoices(2026, 2026, [2024, 2026])).toEqual([2026, 2025, 2024]);
    expect(yearChoices(2026, 2026, [2026])).toEqual([2026]);
  });

  it("ignores future years and caps very old ones", () => {
    expect(yearChoices(2026, 2026, [2025, 2027])).toEqual([2026, 2025]);
    expect(yearChoices(2026, 2026, [1970])).toHaveLength(30);
  });
});
