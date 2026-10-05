// Which compound-wall gates a tenant is walking through right now (owner, 5/10/2026): the tenant figure flags its own
// gate when it is close to it, and the gate leaf swings open / shut towards that flag (PlotGround → GateLeaf).
export const gateNear: Record<"front" | "side", boolean> = { front: false, side: false };
