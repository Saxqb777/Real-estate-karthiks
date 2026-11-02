// "Type it or pick it" boxes always list every choice (owner 2/11/2026: the Kind list didn't open once something was typed).
import { describe, expect, it } from "vitest";
import { kindChoices } from "../kind-choices";

describe("kindChoices", () => {
  it("keeps the usual choices in order, adds the kinds already used, and the catch-all last", () => {
    const usual = ["Repair", "Rent", "Lease", "Paperwork", "Custom"];
    expect(kindChoices(usual, ["Software", "Lease", "Renovation", "Software", null, ""], "Custom")).toEqual([
      "Repair",
      "Rent",
      "Lease",
      "Paperwork",
      "Renovation",
      "Software",
      "Custom",
    ]);
  });

  it("treats another case or extra spaces as the same choice", () => {
    const out = kindChoices(["Townhouse", "House"], [" townhouse ", "SHOP", "Shop"]);
    expect(out.map((s) => s.toLowerCase())).toEqual(["townhouse", "house", "shop"]);
    expect(out[0]).toBe("Townhouse");
  });

  it("never lists the catch-all twice", () => {
    expect(kindChoices(["Repair"], ["custom", "Custom"], "Custom")).toEqual(["Repair", "Custom"]);
  });
});
