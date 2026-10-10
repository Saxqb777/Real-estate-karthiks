"use client";
// Life round the plot (no road, no traffic — owner's request): people walking across the grass and round the trees,
// the dog family and the cow (People.tsx), bird flocks and petals on the wind (SkyLife.tsx). Counts scale down on
// phones / lower tiers. Everything runs on scene time (env.t) → frame-rate independent, slowed while the world is dimmed.
import type { RefObject } from "react";
import type { SiteLayout } from "@/lib/site-layout";
import type { Tier } from "./Effects";
import type { Env } from "./env";
import { BlobShadows, Cow, DogFamily, Pedestrians, Photographer, useMovers } from "./People";
import { Birds, Petals } from "./SkyLife";
import type { World } from "./util";

export function Life({ layout, world, env, enabled, tier, mobile }: { layout: SiteLayout; world: World; env: RefObject<Env>; enabled: boolean; tier: Tier; mobile: boolean }) {
  const movers = useMovers();
  if (!enabled) return null;
  const n =
    tier === "high" && !mobile
      ? { ped: 5, birds: true, petals: 36 }
      : tier === "low"
        ? { ped: 3, birds: false, petals: 0 }
        : { ped: 4, birds: true, petals: 18 };
  return (
    <group>
      <Pedestrians layout={layout} world={world} env={env} count={n.ped} movers={movers.registry} />
      <DogFamily layout={layout} world={world} env={env} movers={movers.registry} />
      <Cow layout={layout} world={world} env={env} movers={movers.registry} />
      <Photographer layout={layout} world={world} env={env} />
      <BlobShadows list={movers.list} max={n.ped + 4} />
      {n.birds && <Birds layout={layout} env={env} />}
      {n.petals > 0 && <Petals layout={layout} world={world} env={env} count={n.petals} />}
    </group>
  );
}
