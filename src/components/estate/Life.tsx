"use client";
// Street life in front of the plot: lane-following traffic (Traffic.tsx), pedestrians, the dog and the cow
// (People.tsx), bird flocks and petals on the wind (SkyLife.tsx). Counts scale down on phones / lower tiers.
// Everything runs on scene time (env.t) → frame-rate independent, slowed while the world is dimmed.
import type { RefObject } from "react";
import type { SiteLayout } from "@/lib/site-layout";
import type { Tier } from "./Effects";
import type { Env } from "./env";
import { BlobShadows, Cow, Dog, Pedestrians, useMovers } from "./People";
import { Birds, Petals } from "./SkyLife";
import { Traffic } from "./Traffic";
import type { World } from "./util";

export function Life({ layout, world, env, enabled, tier, mobile }: { layout: SiteLayout; world: World; env: RefObject<Env>; enabled: boolean; tier: Tier; mobile: boolean }) {
  const movers = useMovers();
  if (!enabled) return null;
  const n =
    tier === "high" && !mobile
      ? { veh: 6, ped: 5, birds: true, petals: 36, animals: true }
      : tier === "low"
        ? { veh: 3, ped: 2, birds: false, petals: 0, animals: true }
        : { veh: 4, ped: 3, birds: true, petals: 18, animals: true };
  return (
    <group>
      <Traffic layout={layout} world={world} env={env} count={n.veh} />
      <Pedestrians layout={layout} world={world} env={env} count={n.ped} movers={movers.registry} />
      {n.animals && <Dog layout={layout} world={world} env={env} movers={movers.registry} />}
      {n.animals && <Cow layout={layout} world={world} env={env} movers={movers.registry} />}
      <BlobShadows list={movers.list} max={n.ped + 2} />
      {n.birds && <Birds layout={layout} env={env} />}
      {n.petals > 0 && <Petals layout={layout} world={world} env={env} count={n.petals} />}
    </group>
  );
}
