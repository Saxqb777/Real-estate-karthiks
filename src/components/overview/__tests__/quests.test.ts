import { describe, expect, it } from "vitest";
import { buildQuests } from "../quests";

type Input = Parameters<typeof buildQuests>[0];

const plot = (usingDefaults: boolean) => ({
  frontWidthFt: 22.25,
  backWidthFt: 23.25,
  depthFt: 76.66,
  areaSqft: 1744,
  townName: "Pattukottai",
  sitePlanImageUrl: null,
  usingDefaults,
});
const unit = (name: string, position: "front" | "back") => ({ id: name, name, position });
const lease = {
  leaseId: "l1",
  tenantId: "t1",
  tenantName: "Lakshmi Narayanan",
  start: "2023-09-01T00:00:00.000Z",
  end: null,
  monthlyRent: 12500,
  state: "current",
};

function data(o: { plotSet?: boolean; units?: number; leases?: boolean; rent?: number }): Input {
  const units = [unit("Unit A", "front"), unit("Unit B", "back")].slice(0, o.units ?? 0);
  return {
    plot: plot(!o.plotSet),
    units,
    unitsNotYetOwned: [],
    timeline: {
      range: { start: null, end: "2026-10-03T00:00:00.000Z" },
      units: units.map((u) => ({
        unitId: u.id,
        unitName: u.name,
        position: u.position,
        isActive: true,
        purchaseDate: "2019-06-15T00:00:00.000Z",
        leases: o.leases && u.name === "Unit A" ? [lease] : [],
        vacant: [],
      })),
      markers: [],
      yearTicks: [],
    },
    kpis: { rentCollected: o.rent ?? 0 },
    recentPayments: o.rent
      ? [{ id: "p1", amount: o.rent, paymentDate: "2026-07-18T00:00:00.000Z", unitName: "Unit A", tenantName: "Lakshmi Narayanan", invoiceNumber: "INV-1" }]
      : [],
  } as unknown as Input;
}

describe("buildQuests (onboarding quest log)", () => {
  it("an empty database starts at the plot, with later steps locked until they make sense", () => {
    const q = buildQuests(data({}), 0);
    expect(q.done).toBe(0);
    expect(q.total).toBe(6);
    expect(q.complete).toBe(false);
    expect(q.current).toBe("plot");
    const byId = Object.fromEntries(q.quests.map((x) => [x.id, x]));
    expect(byId.unit2.locked).toBe("Build unit 1 first");
    expect(byId.lease.locked).toBe("Needs a unit");
    expect(byId.rent.locked).toBe("Needs a lease");
    expect(byId.tenant.locked).toBeUndefined();
  });

  it("counts finished steps and moves the current marker to the first open one", () => {
    const q = buildQuests(data({ plotSet: true, units: 1 }), 1);
    expect(q.quests.filter((x) => x.done).map((x) => x.id)).toEqual(["plot", "unit1", "tenant"]);
    expect(q.current).toBe("unit2");
    expect(q.quests.find((x) => x.id === "unit1")?.doneNote).toBe("Unit A · front");
    expect(q.quests.find((x) => x.id === "lease")?.locked).toBeUndefined();
  });

  it("a lease needs a tenant", () => {
    const q = buildQuests(data({ plotSet: true, units: 2 }), 0);
    expect(q.quests.find((x) => x.id === "lease")?.locked).toBe("Needs a tenant");
    expect(q.current).toBe("tenant");
  });

  it("is complete once the first rent is recorded", () => {
    const q = buildQuests(data({ plotSet: true, units: 2, leases: true, rent: 12500 }), 1);
    expect(q.complete).toBe(true);
    expect(q.current).toBeNull();
    expect(q.quests.every((x) => !x.locked)).toBe(true);
    expect(q.quests.find((x) => x.id === "rent")?.doneNote).toBe("₹12,500 on 18/7/2026");
    expect(q.quests.find((x) => x.id === "lease")?.doneNote).toBe("Lakshmi Narayanan · Unit A · ₹12,500/month");
  });

  it("the tenant count can still be loading", () => {
    const q = buildQuests(data({ plotSet: true, units: 1 }), null);
    expect(q.quests.find((x) => x.id === "tenant")?.done).toBe(false);
  });
});
