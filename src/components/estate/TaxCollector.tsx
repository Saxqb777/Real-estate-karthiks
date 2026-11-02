"use client";
// The property-tax entry point (owner, 9/10/2026; replaces the bamboo hut): the REVENUE OFFICER (Ummarani, in a saree)
// with the moped on its side stand on the grass right of the plot and the angry policeman guarding its cash box.
// Owner 2/11/2026: "let the revenue officer just sit on the bike and move her head looking" — she sits side-saddle on
// the seat scrolling on her phone, now and then looking up and about (the houses, the road, the policeman …) —
// owner 2/11/2026: "not natural just holding the pen n book the whole day … maybe … just using a phone".
// Clicking the moped, the policeman or the officer opens property tax (kind "taxstamp").
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { ball, box, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import type { Env } from "./env";
import { Hotspot, type V3 } from "./Interact";
import { G } from "./materials";
import { PoliceGuard, RigMesh, useRig } from "./People";
import { P, SKIN, personLimbs, posePerson, type Limb } from "./rig";
import { GUARD_AT, MOPED_YAW, collectorSeat } from "./tax-route";
import type { World } from "./util";

/** The moped leans onto its side stand (to its left, +x). */
const LEAN = -0.08;

// ───────────────────────────── the moped ─────────────────────────────

/** A TVS XL-style moped, upright on the ground: front = +z, rider's left = +x. */
function mopedParts(): Part[] {
  const paint = "#33607d";
  const paintDk = "#274b62";
  const black = "#161616";
  const chrome = "#c0c5ca";
  const R = 0.9; // wheel radius
  const wheel = (z: number): Part[] => [
    rod([0, R, z], [2 * R, 0.24, 2 * R], black, [0, 0, Math.PI / 2]), // tyre
    rod([0, R, z], [1.38, 0.26, 1.38], chrome, [0, 0, Math.PI / 2]), // rim
    rod([0, R, z], [1.18, 0.27, 1.18], "#4a4d52", [0, 0, Math.PI / 2]), // spokes in shadow
    rod([0, R, z], [0.4, 0.4, 0.4], chrome, [0, 0, Math.PI / 2]), // hub
  ];
  return [
    ...wheel(2.0),
    ...wheel(-2.0),
    // front fork raked back up to the steering head; headlamp nacelle
    ...[-1, 1].map((s) => box([s * 0.2, 1.8, 1.86], [0.1, 1.95, 0.1], chrome, [-0.26, 0, 0])),
    box([0, 2.85, 1.6], [0.36, 0.5, 0.36], paint),
    rod([0, 3.12, 1.84], [0.62, 0.3, 0.62], paint, [Math.PI / 2, 0, 0]),
    rod([0, 3.12, 2.0], [0.48, 0.04, 0.48], "#fff3c8", [Math.PI / 2, 0, 0]), // lens
    // handlebar, black grips, mirrors on stalks
    rod([0, 3.4, 1.55], [0.09, 2.0, 0.09], chrome, [0, 0, Math.PI / 2]),
    ...[-1, 1].map((s) => rod([s * 0.9, 3.4, 1.55], [0.14, 0.38, 0.14], black, [0, 0, Math.PI / 2])),
    ...[-1, 1].flatMap((s) => [box([s * 0.68, 3.75, 1.5], [0.04, 0.7, 0.04], black, [0, 0, -s * 0.25]), rod([s * 0.78, 4.1, 1.5], [0.32, 0.06, 0.32], black, [Math.PI / 2, 0, 0])]),
    // front mudguard hugging the wheel top
    box([0, 1.95, 2.25], [0.36, 0.08, 0.8], paint, [0.45, 0, 0]),
    box([0, 1.95, 1.72], [0.36, 0.08, 0.7], paint, [-0.4, 0, 0]),
    // step-through frame: down tube, floor pan with its rubber mat, the body under the seat, engine
    box([0, 2.0, 1.2], [0.28, 1.55, 0.28], paint, [0.5, 0, 0]),
    box([0, 1.05, 0.25], [0.95, 0.12, 1.9], paintDk),
    box([0, 1.12, 0.3], [0.8, 0.03, 1.5], "#2a2a2a"),
    box([0, 1.75, -0.75], [0.72, 1.1, 1.3], paint),
    box([0, 1.25, -0.95], [0.55, 0.55, 0.85], "#5a5d62"),
    // long seat
    box([0, 2.42, -0.65], [0.78, 0.26, 1.75], "#2a211a"),
    box([0, 2.3, -0.65], [0.8, 0.06, 1.78], black),
    // exhaust down the right side
    rod([-0.38, 1.0, -1.3], [0.16, 1.6, 0.16], "#3b3b3b", [Math.PI / 2, 0, 0]),
    rod([-0.4, 1.05, -2.15], [0.26, 0.6, 0.26], chrome, [Math.PI / 2, 0, 0]),
    // rear mudguard, carrier rack and its stays, tail lamp, number plate
    box([0, 1.95, -2.15], [0.36, 0.08, 1.0], paint, [-0.35, 0, 0]),
    box([0, 2.62, -1.95], [0.92, 0.08, 1.15], chrome),
    ...[-1, 1].map((s) => box([s * 0.42, 2.25, -1.8], [0.06, 0.7, 0.06], chrome, [0.3, 0, 0])),
    box([0, 2.25, -2.6], [0.3, 0.16, 0.08], "#c41c26"),
    box([0, 1.85, -2.62], [0.72, 0.36, 0.04], "#f2efe6"),
    box([0, 1.88, -2.645], [0.5, 0.06, 0.02], "#1c1c1c"),
    box([0, 1.78, -2.645], [0.56, 0.06, 0.02], "#1c1c1c"),
    // the cash box on the carrier: a maroon steel trunk with a brass hasp
    box([0, 3.05, -1.95], [0.92, 0.78, 0.98], "#7a2a20"),
    box([0, 3.46, -1.95], [0.96, 0.06, 1.02], "#5e1f17"),
    box([0, 3.12, -1.44], [0.12, 0.2, 0.04], "#c9a227"),
    // side stand (left) down to the grass
    box([0.47, 0.52, -0.1], [0.07, 1.05, 0.07], "#2a2a2a", [0, 0, -0.42]),
    // the collector's helmet hanging off the left mirror stalk
    ball([0.86, 3.22, 1.42], [0.62, 0.55, 0.66], "#f2f2ee"),
    box([0.86, 3.18, 1.7], [0.42, 0.18, 0.08], "#2b3a4a"),
  ];
}

// ───────────────────────────── the collector ─────────────────────────────

const SAREE = "#2c4f86";
/** Limb 5: the saree over the lap. Hidden inside the saree's skirt while standing; swings forward with the legs when
 *  the collector sits on the moped, so the cloth (not bare legs) shows over the knees. */
const LAP = 5;
/** Limb 6: her head (with the bun + jasmine), turning on the neck. */
const HEAD = 6;

/** Ummarani (owner, 9/10/2026): a deep-blue cotton saree with a gold border, mustard blouse, hair in a bun with
 *  jasmine, a cloth bag on the right shoulder and a phone in her right hand. */
function collectorLimbs(): Limb[] {
  const limbs = personLimbs({ top: "#d1a33a", bottom: SAREE, wrap: "saree", skin: SKIN.mid, hair: "bun", jasmine: true });
  limbs[P.body].parts.push(
    box([0.42, 3.1, -0.3], [0.2, 0.8, 0.62], "#b49d72"), // cloth bag at the back of the right hip
    box([0.36, 3.95, -0.05], [0.08, 1.5, 0.08], "#8a7550", [0.25, 0, 0.12]), // its strap over the right shoulder
  );
  // a phone in the right hand (screen to the front at rest: raised, it faces up at her), lit screen
  limbs[P.armR].parts.push(box([0.6, 2.76, 0.13], [0.24, 0.42, 0.05], "#1b1b1e"), box([0.6, 2.76, 0.16], [0.2, 0.36, 0.012], "#9fd3ff"));
  limbs.push({ parts: [box([0, 1.55, 0], [0.8, 2.15, 0.44], SAREE), box([0, 0.5, 0], [0.82, 0.1, 0.46], "#d4a72c")], pivot: [0, 2.65, 0], axis: [1, 0, 0] });
  // the head (and hair, bun, jasmine) on its own neck joint so she can look about
  const body = limbs[P.body].parts;
  const head = body.filter((pt) => pt.p[1] >= 4.6);
  limbs[P.body].parts = body.filter((pt) => pt.p[1] < 4.6);
  limbs.push({ parts: head, pivot: [0, 4.5, 0], axis: [0, 1, 0] });
  return limbs;
}

/** Where she looks, in turn (head yaw, + = to her right): ahead, the houses, the road, the policeman, … */
/** Where she looks when she glances up from the phone (head yaw, + = to her right). */
const LOOKS = [0.75, -0.7, 1.0, -0.4, 0.45, -0.9, 0.2, -0.2];
/** One cycle: ~7.5 s on the phone, then ~3.5 s looking up and about. */
const CYCLE = 11;
const ON_PHONE = 7.5;

function Collector({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const { geo, rig } = useRig(collectorLimbs, []);
  const root = useRef<THREE.Group>(null);
  const seat = useMemo(() => collectorSeat(layout), [layout]);
  const X = world.x(seat.p.x);
  const Z = world.z(seat.p.z);
  const anchor = useMemo<V3>(() => [X, 7.2, Z], [X, Z]);
  const head = useRef(0.3);
  const lean = useRef(0.1);
  const lift = useRef(1);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    const u = rig.u;
    const a = u.uAng.value;
    posePerson(u, "idle", 0, e.t, 2.9);
    // sitting side-saddle on the seat (hips down on it, feet on the ground in front), left hand resting on her lap
    a[P.legL] = -0.6;
    a[P.legR] = -0.52;
    a[LAP] = -0.62;
    a[P.armL] = -0.55;
    // the phone: held up and scrolled (a small thumb flick now and then), head bowed a little towards it; then she
    // lowers it a bit and looks up and about for a few seconds, and goes back to it
    const k = Math.floor(e.t / CYCLE);
    const f = e.t - k * CYCLE;
    const phone = f < ON_PHONE;
    const look = LOOKS[((k % LOOKS.length) + LOOKS.length) % LOOKS.length];
    const ease = 1 - Math.exp(-e.dt * 3.2);
    head.current += ((phone ? 0.28 : look) - head.current) * ease;
    lean.current += ((phone ? 0.11 : 0) - lean.current) * ease;
    lift.current += ((phone ? 1 : 0.55) - lift.current) * ease;
    const flick = phone ? Math.max(0, Math.sin(e.t * 2.6)) ** 6 * 0.05 : 0;
    a[P.armR] = -0.75 - 0.5 * lift.current - flick;
    a[HEAD] = head.current + Math.sin(e.t * 1.3) * 0.025;
    u.uLean.value = lean.current;
    g.position.set(X, -0.42, Z);
    g.rotation.y = seat.face;
  });
  return (
    <Hotspot spot={{ key: "taxcollector", kind: "taxstamp", anchor }}>
      <group ref={root}>
        <RigMesh geo={geo} rig={rig} />
        <mesh geometry={G.box()} position={[0, 3, 0]} scale={[2.4, 6.2, 2.4]} visible={false} userData={{ pickFirst: true }} />
      </group>
    </Hotspot>
  );
}

/**
 * The tax collector, the moped (on the spot the hut used to stand) and the policeman guarding its cash box. The moped
 * and the policeman are one static click target; the collector is a moving one; both open property tax.
 */
export function TaxCollector({ layout, world, env }: { layout: SiteLayout; world: World; env: RefObject<Env> }) {
  const t = layout.fixtures.taxStamp;
  const X = world.x(t.x);
  const Z = world.z(t.z);
  const parts = useMemo(mopedParts, []);
  const anchor = useMemo<V3>(() => [X, 6.4, Z], [X, Z]);
  return (
    <>
      <Hotspot spot={{ key: "taxstamp", kind: "taxstamp", anchor }}>
        <group position={[X, 0, Z]} rotation={[0, MOPED_YAW, 0]}>
          <group rotation={[0, 0, LEAN]}>
            <Baked parts={parts} cast receive material={vcMaterial(0.5)} />
          </group>
          {/* the angry policeman stands guard over the cash box, behind the moped on the plot side */}
          <PoliceGuard env={env} position={[GUARD_AT.x, 0, GUARD_AT.z]} rotationY={-0.64} />
          <mesh geometry={G.box()} position={[-0.7, 2.6, -0.8]} scale={[3.6, 5.4, 7.4]} visible={false} />
        </group>
      </Hotspot>
      <Collector layout={layout} world={world} env={env} />
    </>
  );
}
