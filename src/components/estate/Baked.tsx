"use client";
// <Baked parts={…}/>: many coloured primitives → one vertex-coloured mesh (see bake.ts). Memoise `parts`!
import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import { bake, type Part } from "./bake";
import { std, type Finish } from "./materials";

export const vcMaterial = (rough = 0.85, finish: Finish = "normal") => std("#ffffff", { vertexColors: true, rough, finish });

export function Baked({ parts, cast = false, receive = false, material }: { parts: Part[]; cast?: boolean; receive?: boolean; material?: THREE.Material }) {
  const geo = useMemo(() => bake(parts), [parts]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={material ?? vcMaterial()} castShadow={cast} receiveShadow={receive} />;
}
