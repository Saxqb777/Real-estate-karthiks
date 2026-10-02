"use client";
// Street life — filled in below.
import type { RefObject } from "react";
import type { SiteLayout } from "@/lib/site-layout";
import type { Tier } from "./Effects";
import type { Env } from "./env";
import type { World } from "./util";

export function Life(_: { layout: SiteLayout; world: World; env: RefObject<Env>; enabled: boolean; tier: Tier; mobile: boolean }) {
  return null;
}
