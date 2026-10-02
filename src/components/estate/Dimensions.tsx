"use client";
// Architectural dimension lines built from the layout data (22'3", 23'3", 76'8", 20', 28'…).
// `highlight` (a config field name) pulses the matching dimension so forms can show which field maps where.
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dimensionMatches, type Dimension, type SiteLayout } from "@/lib/site-layout";
import { PAL } from "./materials";
import { FLAT, planShape, type World } from "./util";
import s from "./estate.module.css";

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

type V3 = [number, number, number];

export function Dimensions({ layout, world, show, highlight, reduced }: { layout: SiteLayout; world: World; show: boolean; highlight: string | null; reduced: boolean }) {
  const dims = layout.dimensions.filter((d) => (show && d.primary) || dimensionMatches(d, highlight));
  return (
    <group>
      {dims.map((d) =>
        d.kind === "area" ? (
          <AreaGlow key={d.key} layout={layout} world={world} dim={d} reduced={reduced} />
        ) : (
          <DimLine key={d.key} dim={d} world={world} hot={dimensionMatches(d, highlight)} reduced={reduced} />
        ),
      )}
    </group>
  );
}

function DimLine({ dim, world, hot, reduced }: { dim: Dimension; world: World; hot: boolean; reduced: boolean }) {
  const geom = useMemo(() => {
    const A = new THREE.Vector3(world.x(dim.a.x), dim.a.y, world.z(dim.a.z));
    const B = new THREE.Vector3(world.x(dim.b.x), dim.b.y, world.z(dim.b.z));
    const dir = new THREE.Vector3(dim.dir.x, dim.dir.y, -dim.dir.z).normalize();
    const A2 = A.clone().addScaledVector(dir, dim.offset);
    const B2 = B.clone().addScaledVector(dir, dim.offset);
    const along = B2.clone().sub(A2).normalize();
    const slash = along.clone().add(dir).normalize().multiplyScalar(0.75);
    const ext = dim.offset > 0.3;
    const toArr = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
    return {
      main: [toArr(A2), toArr(B2)],
      ext: ext
        ? [toArr(A), toArr(A2.clone().addScaledVector(dir, 0.8)), toArr(B), toArr(B2.clone().addScaledVector(dir, 0.8))]
        : null,
      ticks: [toArr(A2.clone().sub(slash)), toArr(A2.clone().add(slash)), toArr(B2.clone().sub(slash)), toArr(B2.clone().add(slash))],
      edge: [toArr(A), toArr(B)],
      label: toArr(A2.clone().add(B2).multiplyScalar(0.5).addScaledVector(dir, dim.kind === "height" ? 1.2 : 0.2)),
    };
  }, [dim, world]);

  const mainRef = useRef<{ material: { linewidth: number; opacity: number } } | null>(null);
  const edgeRef = useRef<{ material: { linewidth: number; opacity: number } } | null>(null);
  useFrame(({ clock }) => {
    if (!hot) return;
    const k = reduced ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
    if (mainRef.current) mainRef.current.material.linewidth = 2.2 + k * 1.6;
    if (edgeRef.current) {
      edgeRef.current.material.linewidth = 4 + k * 4;
      edgeRef.current.material.opacity = 0.35 + k * 0.5;
    }
  });
  const color = hot ? PAL.marigold : "#f3ead9";
  const base = dim.key.split(":")[0];
  return (
    <group>
      <Line ref={mainRef as never} points={geom.main} color={color} lineWidth={hot ? 2.6 : 1.4} transparent opacity={hot ? 1 : 0.9} depthTest={!hot} renderOrder={hot ? 30 : 6} toneMapped={false} />
      <Line points={geom.ticks} segments color={color} lineWidth={hot ? 2.4 : 1.6} transparent opacity={0.95} depthTest={!hot} renderOrder={hot ? 30 : 6} toneMapped={false} />
      {geom.ext && <Line points={geom.ext} segments color={color} lineWidth={1} transparent opacity={hot ? 0.9 : 0.55} depthTest={!hot} renderOrder={hot ? 30 : 6} toneMapped={false} />}
      {hot && <Line ref={edgeRef as never} points={geom.edge} color={PAL.marigold} lineWidth={6} transparent opacity={0.6} depthTest={false} renderOrder={29} toneMapped={false} />}
      <Html position={geom.label} center zIndexRange={hot ? [60, 50] : [30, 20]} style={{ pointerEvents: "none" }}>
        <div className={`${s.dim} ${hot ? s.dimHot : ""}`}>
          {hot && <span className={s.dimCaption}>{CAPTION[base] ?? base}</span>}
          {dim.label}
        </div>
      </Html>
    </group>
  );
}

function AreaGlow({ layout, world, dim, reduced }: { layout: SiteLayout; world: World; dim: Dimension; reduced: boolean }) {
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
      <Html position={[world.x(dim.a.x), 2, world.z(dim.a.z)]} center zIndexRange={[60, 50]} style={{ pointerEvents: "none" }}>
        <div className={`${s.dim} ${s.dimHot}`}>
          <span className={s.dimCaption}>{CAPTION.areaSqft}</span>
          {dim.label}
        </div>
      </Html>
    </group>
  );
}
