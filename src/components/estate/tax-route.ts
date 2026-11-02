// Where the revenue officer's moped stands, the policeman guarding it and where she sits — pure, plan feet. Rendered by
// TaxCollector.tsx. (Until 2/11/2026 she also walked to the front gate and back; the owner asked her to just sit.)
import type { Pt, SiteLayout } from "../../lib/site-layout";

/** Moped heading (world yaw): parked along the plot, nose to the front, turned a little so the camera sees its side. */
export const MOPED_YAW = 0.35;
/** Where the angry policeman stands guard, in the moped's frame (x = its left, z = its front): behind it, plot side. */
export const GUARD_AT = { x: -1.1, z: -3.5 } as const;

/** The parked moped's frame: `at` maps a point in it (x = its left, z = its front) to plan feet, `local` back again. */
export function mopedFrame(layout: Pick<SiteLayout, "fixtures">) {
  const m = layout.fixtures.taxStamp;
  const c = Math.cos(MOPED_YAW);
  const s = Math.sin(MOPED_YAW);
  return {
    at: (lx: number, lz: number): Pt => ({ x: m.x + lx * c + lz * s, z: m.z + lx * s - lz * c }),
    local: (p: Pt): Pt => {
      const dx = p.x - m.x;
      const dz = p.z - m.z;
      return { x: dx * c + dz * s, z: dx * s - dz * c };
    },
  };
}

/**
 * Where the revenue officer sits (owner 2/11/2026: "let the revenue officer just sit on the bike and move her head
 * looking" — she no longer walks to the gate): side-saddle on the moped's seat, facing out of its right side.
 */
export function collectorSeat(layout: Pick<SiteLayout, "fixtures">): { p: Pt; face: number } {
  const { at } = mopedFrame(layout);
  return { p: at(-0.5, -0.45), face: Math.atan2(-Math.cos(MOPED_YAW), Math.sin(MOPED_YAW)) };
}
