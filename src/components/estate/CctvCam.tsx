"use client";
// CCTV camera (owner 2/11/2026: "replace the cctv for the camera man so remove him", then his photo of a street PTZ
// dome: "a real looking small sized cctv on the eb pole on the left will look good"): a white PTZ dome camera — white
// housing with a grey band and a glossy smoked dome underneath — hanging from a curved white arm clamped halfway up the
// LEFT EB pole (off the lane corner; that pole is not a hotspot, so it never clashes with the Electricity Board one), a
// grey junction box strapped behind it, the arm out over the lane-side grass. Real size-ish (small); a generous click box.
// Clickable (kind / key "photographer") → the interior photos window. Scenery, not life: it stays with Life off.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { bake, type Part } from "./bake";
import { Hotspot, type V3 } from "./Interact";
import { G } from "./materials";
import type { World } from "./util";

const MOUNT_Y = 13; // halfway up the 26 ft pole, well under the wires
const POLE_R = 0.375; // the EB pole is 0.75 ft across
const K = 0.75; // owner 2/11/2026: "a bit smaller" — close to a real dome's size next to this pole
const ARM_OUT = POLE_R + 1.225 * K; // pole axis → the drop tube
const DOME_R = 0.5 * K;
const DOME_Y = -1.06 * K;

const WHITE = "#eef0f2";
const STEEL = "#c3c7cd";
const BAND = "#4d5158";
const BOX = "#b4b8be";

/**
 * Origin = the pole's axis at MOUNT_Y; the arm reaches out along +z. Drawn at full size, then everything off the pole
 * is shrunk by K towards the pole's surface (the straps keep hugging the pole).
 */
function parts(): Part[] {
  const R = POLE_R;
  const A = R + 1.225; // full-size arm reach
  const full: (Part & { hug?: boolean })[] = [
    // steel straps round the pole (the arm's and the junction box's)
    { g: "cyl", p: [0, 0.32, 0], s: [0.86, 0.12, 0.86], c: STEEL, hug: true },
    { g: "cyl", p: [0, -0.1, 0], s: [0.86, 0.12, 0.86], c: STEEL, hug: true },
    { g: "cyl", p: [0, -1.25, 0], s: [0.86, 0.12, 0.86], c: STEEL, hug: true },
    // arm: base plate, a tube out that rises a little, the bend, the drop tube and its collar
    { g: "box", p: [0, 0.12, R + 0.05], s: [0.36, 0.62, 0.1], c: WHITE },
    { g: "cyl", p: [0, 0.2, (R + A) / 2], s: [0.2, A - R, 0.2], c: WHITE, r: [Math.PI / 2 - 0.12, 0, 0] },
    { g: "sphere", p: [0, 0.27, A], s: 0.24, c: WHITE },
    { g: "cyl", p: [0, 0.02, A], s: [0.19, 0.5, 0.19], c: WHITE },
    { g: "cyl", p: [0, -0.26, A], s: [0.32, 0.12, 0.32], c: WHITE },
    // housing: domed top + body, the grey band at its foot
    { g: "sphere", p: [0, -0.5, A], s: [1.24, 0.5, 1.24], c: WHITE },
    { g: "cyl", p: [0, -0.74, A], s: [1.24, 0.46, 1.24], c: WHITE },
    { g: "cyl", p: [0, -1.0, A], s: [1.3, 0.12, 1.3], c: BAND },
    // junction box strapped to the back of the pole (lid + strap) and its cable up to the arm
    { g: "box", p: [0, -1.1, -R - 0.18], s: [0.62, 0.86, 0.34], c: BOX },
    { g: "box", p: [0, -1.1, -R - 0.36], s: [0.4, 0.5, 0.02], c: "#9da2a9" },
    { g: "box", p: [0, -0.62, -R - 0.18], s: [0.66, 0.06, 0.38], c: STEEL },
    { g: "cyl", p: [0.24, -0.3, -0.12], s: [0.06, 0.9, 0.06], c: "#202226", r: [0.3, 0, 0] },
  ];
  return full.map(({ hug, ...q }) => {
    const s = typeof q.s === "number" ? [q.s, q.s, q.s] : q.s;
    if (hug) return { ...q, p: [0, q.p[1] * K, 0], s: [s[0], s[1] * K, s[2]] };
    const z = q.p[2];
    const zk = Math.abs(z) <= R ? z * K : Math.sign(z) * (R + (Math.abs(z) - R) * K);
    return { ...q, p: [q.p[0] * K, q.p[1] * K, zk], s: [s[0] * K, s[1] * K, s[2] * K] };
  });
}

const BODY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.08 });
// the smoked dome: glossy, near black — catches the light like the real one
const DOME = new THREE.MeshStandardMaterial({ color: "#0d0e11", roughness: 0.1, metalness: 0.45 });
const DOME_GEO = new THREE.SphereGeometry(DOME_R, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);

export function CctvCam({ layout, world }: { layout: SiteLayout; world: World }) {
  const geo = useMemo(() => bake(parts()), []);
  useEffect(() => () => geo.dispose(), [geo]);
  // the left EB pole (off the lane corner); the arm reaches out over the open grass on the lane side (a dome sees all
  // round) — clear of Gate A, its kolam and the waiting tenant, so it stands out against the grass
  const spot = useMemo(() => {
    const pole = layout.fixtures.poles[1] ?? layout.fixtures.poles[0];
    const aim = { x: pole.x - 10, z: pole.z - 3 };
    const X = world.x(pole.x);
    const Z = world.z(pole.z);
    return { X, Z, yaw: Math.atan2(world.x(aim.x) - X, world.z(aim.z) - Z) };
  }, [layout, world]);
  // the dome's centre in world space (for the tag and the click box)
  const dome = useMemo<V3>(() => [spot.X + Math.sin(spot.yaw) * ARM_OUT, MOUNT_Y + DOME_Y, spot.Z + Math.cos(spot.yaw) * ARM_OUT], [spot]);
  const anchor = useMemo<V3>(() => [dome[0], MOUNT_Y + 1.6, dome[2]], [dome]);
  return (
    <Hotspot
      spot={{ key: "photographer", kind: "photographer", anchor }}
      hit={<mesh geometry={G.box()} position={[dome[0], dome[1] + 0.5, dome[2]]} scale={[3, 3.2, 3]} visible={false} userData={{ pickFirst: true }} />}
    >
      <group position={[spot.X, MOUNT_Y, spot.Z]} rotation={[0, spot.yaw, 0]}>
        <mesh geometry={geo} material={BODY} castShadow />
        <mesh geometry={DOME_GEO} material={DOME} position={[0, DOME_Y, ARM_OUT]} castShadow />
      </group>
    </Hotspot>
  );
}
