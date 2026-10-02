"use client";
// Lerps plot / footprint / floor numbers towards their targets so typing in a config form visibly reshapes the model.
import { useFrame } from "@react-three/fiber";
import { useMemo, useReducer, useRef } from "react";
import { computeSiteLayout, type SceneUnit, type SiteLayout } from "@/lib/site-layout";
import type { PlotGeometry } from "@/lib/dashboard-types";

type PlotInput = Partial<Pick<PlotGeometry, "frontWidthFt" | "backWidthFt" | "depthFt" | "areaSqft" | "townName">>;

interface Nums {
  front: number;
  back: number;
  depth: number;
  units: Record<string, { fw: number; fd: number; floors: number }>;
}

function targetsOf(target: SiteLayout): Nums {
  const units: Nums["units"] = {};
  for (const s of target.slots) if (s.unit) units[s.unit.id] = { fw: s.requestedWidthFt, fd: s.requestedDepthFt, floors: s.floors };
  return { front: target.plot.frontWidthFt, back: target.plot.backWidthFt, depth: target.plot.depthFt, units };
}

/** Returns { layout (animated), target (final layout, for warnings) }. */
export function useAnimatedLayout(plot: PlotInput, units: SceneUnit[], animate: boolean) {
  const target = useMemo(() => computeSiteLayout(plot, units), [plot, units]);
  const goal = useMemo(() => targetsOf(target), [target]);
  const cur = useRef<Nums | null>(null);
  const [version, bump] = useReducer((x: number) => x + 1, 0);

  if (!cur.current) cur.current = structuredClone(goal);
  // new / removed units snap (the building rise animation covers their arrival)
  for (const id of Object.keys(goal.units)) if (!cur.current.units[id]) cur.current.units[id] = { ...goal.units[id] };

  useFrame((_, dt) => {
    const c = cur.current!;
    const k = animate ? 1 - Math.exp(-Math.min(dt, 0.1) * 9) : 1;
    let moved = false;
    const step = (a: number, b: number) => {
      if (Math.abs(a - b) < 0.004) return b;
      moved = true;
      return a + (b - a) * k;
    };
    c.front = step(c.front, goal.front);
    c.back = step(c.back, goal.back);
    c.depth = step(c.depth, goal.depth);
    for (const [id, g] of Object.entries(goal.units)) {
      const u = c.units[id];
      u.fw = step(u.fw, g.fw);
      u.fd = step(u.fd, g.fd);
      u.floors = step(u.floors, g.floors);
    }
    if (moved) bump();
  });

  const layout = useMemo(() => {
    const c = cur.current!;
    const same = c.front === goal.front && c.back === goal.back && c.depth === goal.depth && Object.entries(goal.units).every(([id, g]) => c.units[id]?.fw === g.fw && c.units[id]?.fd === g.fd && c.units[id]?.floors === g.floors);
    if (same) return target;
    return computeSiteLayout(
      { ...plot, frontWidthFt: c.front, backWidthFt: c.back, depthFt: c.depth, areaSqft: target.plot.areaSqft },
      units.map((u) => {
        const v = c.units[u.id];
        return v ? { ...u, footprintWidthFt: v.fw, footprintDepthFt: v.fd, floors: Math.round(v.floors) } : u;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, target]);

  return { layout, target };
}
