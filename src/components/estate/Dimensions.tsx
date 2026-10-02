"use client";
// Architectural dimension lines built from the layout data (22'3", 23'3", 76'8", 20', 28'…).
// `highlight` (a config field name) pulses the matching dimension so forms can show which field maps where.
// Labels are DOM (see Overlay.tsx): dimensionLabels() describes them, the lines live here.
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dimensionMatches, type Dimension, type SiteLayout } from "@/lib/site-layout";
import { PAL } from "./materials";
import type { LabelSpec, V3 } from "./Overlay";
import { FLAT, planShape, type World } from "./util";

const CAPTION: Record<string, string> = {
  frontWidthFt: "Front width",
  backWidthFt: "Back width",
  depthFt: "Plot depth",
  footprintWidthFt: "Footprint width",
  footprintDepthFt: "Footprint depth",
  courtyard: "Courtyard",
  floors: "Height",
  areaSqft: "Plot area",
};

function visibleDims(layout: SiteLayout, show: boolean, highlight: string | null) {
  return layout.dimensions.filter((d) => (show && d.primary) || dimensionMatches(d, highlight));
}

function dimGeometry(dim: Dimension, world: World) {
  const A = new THREE.Vector3(world.x(dim.a.x), dim.a.y, world.z(dim.a.z));
  const B = new THREE.Vector3(world.x(dim.b.x), dim.b.y, world.z(dim.b.z));
  const dir = new THREE.Vector3(dim.dir.x, dim.dir.y, -dim.dir.z).normalize();
  const A2 = A.clone().addScaledVector(dir, dim.offset);
  const B2 = B.clone().addScaledVector(dir, dim.offset);
  const along = B2.clone().sub(A2).normalize();
  const slash = along.clone().add(dir).normalize().multiplyScalar(0.75);
  const arr = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
  return {
    main: [arr(A2), arr(B2)],
    ext: dim.offset > 0.3 ? [arr(A), arr(A2.clone().addScaledVector(dir, 0.8)), arr(B), arr(B2.clone().addScaledVector(dir, 0.8))] : null,
    ticks: [arr(A2.clone().sub(slash)), arr(A2.clone().add(slash)), arr(B2.clone().sub(slash)), arr(B2.clone().add(slash))],
    edge: [arr(A), arr(B)],
    label: arr(A2.clone().add(B2).multiplyScalar(0.5).addScaledVector(dir, dim.kind === "height" ? 1.4 : 0.2)),
  };
}

/** Label specs + anchors for the visible dimensions. */
export function dimensionLabels(layout: SiteLayout, world: World, show: boolean, highlight: string | null): { spec: LabelSpec; anchor: V3 }[] {
  return visibleDims(layout, show, highlight).map((d) => {
    const hot = dimensionMatches(d, highlight);
    const base = d.key.split(":")[0];
    const anchor: V3 = d.kind === "area" ? [world.x(d.a.x), 2, world.z(d.a.z)] : dimGeometry(d, world).label;
    return { spec: { key: `dim:${d.key}`, kind: "dim", text: d.label, caption: hot ? (CAPTION[base] ?? base) : null, hot }, anchor };
  });
}

export function Dimensions({ layout, world, show, highlight, reduced }: { layout: SiteLayout; world: World; show: boolean; highlight: string | null; reduced: boolean }) {
  return (
    <group>
      {visibleDims(layout, show, highlight).map((d) =>
        d.kind === "area" ? (
          <AreaGlow key={d.key} layout={layout} world={world} reduced={reduced} />
        ) : (
          <DimLine key={d.key} dim={d} world={world} hot={dimensionMatches(d, highlight)} reduced={reduced} />
        ),
      )}
    </group>
  );
}

type LineRef = { material: { linewidth: number; opacity: number } } | null;

function DimLine({ dim, world, hot, reduced }: { dim: Dimension; world: World; hot: boolean; reduced: boolean }) {
  const geom = useMemo(() => dimGeometry(dim, world), [dim, world]);
  const mainRef = useRef<LineRef>(null);
  const edgeRef = useRef<LineRef>(null);
  useFrame(({ clock }) => {
    if (!hot) return;
    const k = reduced ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
    if (mainRef.current) mainRef.current.material.linewidth = 2.2 + k * 1.6;
    if (edgeRef.current) {
      edgeRef.current.material.linewidth = 4 + k * 4;
      edgeRef.current.material.opacity = 0.35 + k * 0.5;
    }
  });
  const color = hot ? PAL.marigold : "#f6eedf";
  const order = hot ? 30 : 6;
  return (
    <group>
      <Line ref={mainRef as never} points={geom.main} color={color} lineWidth={hot ? 2.6 : 1.5} transparent opacity={hot ? 1 : 0.92} depthTest={!hot} renderOrder={order} toneMapped={false} />
      <Line points={geom.ticks} segments color={color} lineWidth={hot ? 2.4 : 1.7} transparent opacity={0.95} depthTest={!hot} renderOrder={order} toneMapped={false} />
      {geom.ext && <Line points={geom.ext} segments color={color} lineWidth={1} transparent opacity={hot ? 0.9 : 0.6} depthTest={!hot} renderOrder={order} toneMapped={false} />}
      {hot && <Line ref={edgeRef as never} points={geom.edge} color={PAL.marigold} lineWidth={6} transparent opacity={0.6} depthTest={false} renderOrder={29} toneMapped={false} />}
    </group>
  );
}

function AreaGlow({ layout, world, reduced }: { layout: SiteLayout; world: World; reduced: boolean }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(planShape(layout.plot.polygon, world)), [layout.plot.polygon, world]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.marigold, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    mat.opacity = reduced ? 0.25 : 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4));
  });
  const outline = useMemo(() => {
    const pts = layout.plot.polygon.map((p) => [world.x(p.x), 0.4, world.z(p.z)] as V3);
    return [...pts, pts[0]];
  }, [layout.plot.polygon, world]);
  return (
    <group>
      <mesh geometry={geo} material={mat} rotation={FLAT} position={[0, 0.3, 0]} renderOrder={20} />
      <Line points={outline} color={PAL.marigold} lineWidth={3} transparent opacity={0.9} depthTest={false} renderOrder={30} toneMapped={false} />
    </group>
  );
}
