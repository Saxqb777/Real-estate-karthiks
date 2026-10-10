// Bank / UPI ref no. (UTR) on rent payments (owner, 10/10/2026): tidied the same way when recorded and when changed later.
import { describe, expect, it, vi } from "vitest";
import { paymentCreateSchema, paymentReferenceSchema } from "../schemas/payment";

// the schema module imports through the "@/" alias, which vitest here doesn't resolve (as in calculations.lease-rules)
vi.mock("@/lib/dates", () => import("../dates"));
vi.mock("@/lib/format", () => import("../format"));
vi.mock("@/lib/validation", () => import("../validation"));
vi.mock("@/lib/calculations", () => import("../calculations"));

const rent = { leaseId: "lease_1", amount: 5000, paymentDate: "2026-10-01", periodMonth: 10, periodYear: 2026, method: "upi" };
const created = (reference: unknown) => paymentCreateSchema.safeParse({ ...rent, reference });

describe("payment ref no. (UTR)", () => {
  it("drops spaces and capitalises letters, as on the bank statement", () => {
    expect(created("4123 4567 8901").data?.reference).toBe("412345678901");
    expect(created(" hdfcn52024101012345678 ").data?.reference).toBe("HDFCN52024101012345678");
  });

  it("is optional: missing or blank saves no ref no.", () => {
    expect(created(undefined).data?.reference).toBeNull();
    expect(created("").data?.reference).toBeNull();
    expect(created("   ").data?.reference).toBeNull();
    expect(created(null).data?.reference).toBeNull();
  });

  it("refuses more than 40 characters and anything that is not text", () => {
    expect(created("X".repeat(40)).success).toBe(true);
    expect(created("X".repeat(41)).error?.issues[0]).toMatchObject({ path: ["reference"], message: "must be at most 40 characters" });
    expect(created(412345678901).error?.issues[0]).toMatchObject({ path: ["reference"], message: "must be text" });
  });

  it("can be added or changed later (PATCH), and cleared with a blank", () => {
    expect(paymentReferenceSchema.parse({ reference: " utr 4123 " })).toEqual({ reference: "UTR4123" });
    expect(paymentReferenceSchema.parse({ reference: "" })).toEqual({ reference: null });
    expect(paymentReferenceSchema.parse({ reference: null })).toEqual({ reference: null });
  });

  it("a change without the ref no. in it never wipes a saved one", () => {
    expect(paymentReferenceSchema.safeParse({}).error?.issues[0]).toMatchObject({ path: ["reference"], message: "is required" });
    expect(paymentReferenceSchema.safeParse({ reference: "X".repeat(41) }).success).toBe(false);
  });
});

describe("how rent is received (owner, 10/10/2026: never cash)", () => {
  const withMethod = (method: unknown) => paymentCreateSchema.safeParse({ ...rent, method });
  it("takes UPI or bank", () => {
    expect(withMethod("upi").data?.method).toBe("upi");
    expect(withMethod("Bank").data?.method).toBe("bank");
  });
  it("refuses cash (and anything else)", () => {
    expect(withMethod("cash").success).toBe(false);
    expect(withMethod("other").success).toBe(false);
  });
  it("is UPI when not given", () => {
    expect(withMethod(undefined).data?.method).toBe("upi");
    expect(withMethod("").data?.method).toBe("upi");
  });
});
