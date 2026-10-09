"use client";
// The property-tax entry point (owner, 9/10/2026; replaces the bamboo hut): the municipal TAX COLLECTOR (Ummarani, in a
// saree) with the moped on its side stand on the grass right of the plot and the angry policeman guarding its cash box.
// The collector keeps a working routine on scene time (frame-rate independent) instead of a fixed pose:
//   perched side-saddle on the seat writing up the register → gets up, checks the phone → walks round the front-right
//   corner to the front unit's gate, reads the door number on its pole and writes it up (tax due: holds the demand
//   notice up to the house and waits, with a glance at the watch; otherwise ticks it off and nods) → walks back, files
//   the register in the cash box → sits back down.
// Clicking the moped, the policeman or the collector opens property tax (kind "taxstamp").
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/site-layout";
import { ball, box, rod, type Part } from "./bake";
import { Baked, vcMaterial } from "./Baked";
import type { Env } from "./env";
import { Hotspot, type V3 } from "./Interact";
import { G } from "./materials";
import { PoliceGuard, RigMesh, useRig } from "./People";
import { P, SKIN, personLimbs, posePerson, type Limb, type RigUniforms } from "./rig";
import { GUARD_AT, MOPED_YAW, WALK_SPEED, collectorRoutine } from "./tax-route";
import { smoothstep, type World } from "./util";

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

/** Ummarani (owner, 9/10/2026): a deep-blue cotton saree with a gold border, mustard blouse, hair in a bun with
 *  jasmine, a cloth bag on the right shoulder; green register in the left hand, a pen in the right. */
function collectorLimbs(): Limb[] {
  const limbs = personLimbs({ top: "#d1a33a", bottom: SAREE, wrap: "saree", skin: SKIN.mid, hair: "bun", jasmine: true });
  limbs[P.body].parts.push(
    box([0.42, 3.1, -0.3], [0.2, 0.8, 0.62], "#b49d72"), // cloth bag at the back of the right hip
    box([0.36, 3.95, -0.05], [0.08, 1.5, 0.08], "#8a7550", [0.25, 0, 0.12]), // its strap over the right shoulder
  );
  limbs[P.armL].parts.push(box([-0.55, 2.75, 0.38], [0.2, 1.2, 0.92], "#2f5a3a"), box([-0.44, 2.75, 0.38], [0.04, 1.1, 0.85], "#f4efe0"));
  limbs[P.armR].parts.push(box([0.61, 2.6, 0.2], [0.06, 0.06, 0.48], "#1f3fa8"));
  limbs.push({ parts: [box([0, 1.55, 0], [0.8, 2.15, 0.44], SAREE), box([0, 0.5, 0], [0.82, 0.1, 0.46], "#d4a72c")], pivot: [0, 2.65, 0], axis: [1, 0, 0] });
  return limbs;
}

/** Hand position of the right arm in the person's model space for arm angle `a` (rig.ts arm: shoulder pivot, 1.55 ft). */
function rightHand(u: RigUniforms, out: THREE.Vector3): THREE.Vector3 {
  const a = u.uAng.value[P.armR];
  out.set(0.61, 4.35 - 1.55 * Math.cos(a), -1.55 * Math.sin(a));
  const l = u.uLean.value;
  const y = out.y * Math.cos(l) - out.z * Math.sin(l);
  const z = out.z * Math.cos(l) + out.y * Math.sin(l);
  return out.set(out.x, y, z).add(u.uShift.value);
}

const texCache = new Map<string, THREE.CanvasTexture>();
/** The property-tax demand notice the collector serves: cream paper, header band, ruled lines and a red DUE band. */
function noticeTex(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const hit = texCache.get("notice");
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 320;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#f4ecd8";
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = "#e3d2ab";
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = "#cbb994";
  for (let i = 0; i < 7; i++) ctx.fillRect(26, 80 + i * 30, 204 - ((i * 37) % 60), 6);
  ctx.save();
  ctx.translate(128, 178);
  ctx.rotate(-0.45);
  ctx.fillStyle = "#c41c26";
  ctx.fillRect(-256, -26, 512, 52);
  ctx.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set("notice", tex);
  return tex;
}

function Collector({ layout, world, env, due }: { layout: SiteLayout; world: World; env: RefObject<Env>; due: boolean }) {
  const { geo, rig } = useRig(collectorLimbs, []);
  const root = useRef<THREE.Group>(null);
  const phone = useRef<THREE.Group>(null);
  const notice = useRef<THREE.Mesh>(null);
  const day = useMemo(() => collectorRoutine(layout), [layout]);
  const anchor = useMemo<V3>(() => [0, 7.2, 0], []);
  const heading = useRef<number | null>(null);
  const walked = useRef(0);
  const lastPick = useRef(0);
  const hand = useMemo(() => new THREE.Vector3(), []);
  const noticeMat = useMemo(() => new THREE.MeshStandardMaterial({ map: noticeTex(), roughness: 0.9, side: THREE.DoubleSide }), []);
  useEffect(() => () => noticeMat.dispose(), [noticeMat]);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const e = env.current;
    const T = day.period;
    const tt = (((e.t + 4) % T) + T) % T; // starts a few seconds into the paperwork
    const sg = day.segs.find((x) => tt < x.t1) ?? day.segs[day.segs.length - 1];
    const k = sg.t1 > sg.t0 ? Math.min(1, Math.max(0, (tt - sg.t0) / (sg.t1 - sg.t0))) : 1;
    const local = tt - sg.t0;
    const u = rig.u;
    const a = u.uAng.value;
    // position: walking keeps a constant pace; rise / sit glide between the seat and the standing spot
    const m = sg.act === "rise" || sg.act === "sit" ? smoothstep(0, 1, k) : k;
    const x = sg.a.x + (sg.b.x - sg.a.x) * m;
    const z = sg.a.z + (sg.b.z - sg.a.z) * m;
    // 1 = sitting on the seat, 0 = standing
    const seated = sg.act === "perch" ? 1 : sg.act === "rise" ? 1 - m : sg.act === "sit" ? m : 0;
    let want = sg.face;
    let showPhone = false;
    let showNotice = false;
    if (sg.act === "walk") {
      walked.current += WALK_SPEED * e.dt;
      posePerson(u, "walk", (walked.current / 1.6) * Math.PI, e.t);
      a[P.armL] = -0.55; // register held against the chest
    } else {
      posePerson(u, "idle", 0, e.t, 2.9);
      a[P.armL] = -0.3;
      a[P.armR] = 0.05;
      if (sg.act === "perch") {
        // writing in the register on the lap; every few seconds a look up at the houses
        const look = smoothstep(0.6, 1, Math.sin(local * 0.9 + 1.1)) * (local > 1 ? 1 : 0);
        a[P.armL] = -0.95;
        a[P.armR] = -0.85 + Math.sin(e.t * 9) * 0.05 * (1 - look) + look * 0.2;
        want += look * 0.45;
      } else if (sg.act === "rise" || sg.act === "sit") {
        a[P.armL] = -0.3 - 0.65 * seated;
        a[P.armR] = 0.05 - 0.9 * seated;
        u.uLean.value = Math.sin(Math.PI * m) * 0.14;
      } else if (sg.act === "phone") {
        showPhone = true;
        a[P.armR] = -1.28 + Math.sin(e.t * 6) * 0.025; // thumbing the screen
        want += Math.sin(local * 0.5) * 0.25;
      } else if (sg.act === "gate") {
        if (due) {
          // reads the number, holds the demand notice up to the house, waits (a glance at the watch), writes it up
          if (local < 1.2) a[P.armL] = -0.4;
          else if (local < 4.2) {
            showNotice = true;
            const up = smoothstep(1.2, 1.8, local) * (1 - smoothstep(3.7, 4.2, local));
            a[P.armR] = 0.05 + (-2.3 + Math.sin(e.t * 3.2) * 0.1 - 0.05) * up;
          } else if (local < 6) {
            showNotice = local < 4.6;
            a[P.armL] = local > 4.8 && local < 5.6 ? -1.15 : -0.3; // watch
            want += Math.sin((local - 4.2) * 2.4) * 0.3;
          } else {
            a[P.armL] = -0.95;
            a[P.armR] = -0.85 + Math.sin(e.t * 9) * 0.05;
          }
        } else {
          // reads the number on the pole, ticks it off in the register, two small nods
          if (local < 1.5) a[P.armL] = -0.4;
          else if (local < 5.5) {
            a[P.armL] = -0.95;
            a[P.armR] = -0.85 + Math.sin(e.t * 9) * 0.05;
          } else {
            a[P.armL] = -0.5;
            u.uLean.value = Math.max(0, Math.sin((local - 5.5) * 5)) * 0.1 * (local < 6.8 ? 1 : 0);
          }
        }
      } else if (sg.act === "box") {
        // files the register in the cash box on the carrier
        a[P.armL] = -1.15;
        a[P.armR] = -1.3 + Math.sin(e.t * 4) * 0.06;
      }
    }
    if (seated > 0) {
      a[P.legL] = a[P.legL] * (1 - seated) - 0.38 * seated;
      a[P.legR] = a[P.legR] * (1 - seated) - 0.32 * seated;
    }
    a[LAP] = -0.35 * seated;
    const X = world.x(x);
    const Z = world.z(z);
    g.position.set(X, -0.1 * seated, Z);
    if (heading.current === null) heading.current = want;
    let dh = want - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-e.dt * 6));
    g.rotation.y = heading.current;
    // props in the right hand
    rightHand(u, hand);
    if (phone.current) {
      phone.current.visible = showPhone;
      phone.current.position.copy(hand);
      phone.current.rotation.x = -a[P.armR] - Math.PI / 2;
    }
    if (notice.current) {
      notice.current.visible = showNotice;
      notice.current.position.set(hand.x, hand.y + 0.42, hand.z + 0.06);
    }
    anchor[0] = X;
    anchor[1] = 7.2;
    anchor[2] = Z;
    // a moving click target: re-test the pointer now and then while walking so the hover follows
    if (sg.act !== "perch" && sg.act !== "gate" && state.clock.elapsedTime - lastPick.current > 0.15) {
      lastPick.current = state.clock.elapsedTime;
      state.events.update?.();
    }
  });
  return (
    <Hotspot spot={{ key: "taxcollector", kind: "taxstamp", anchor }}>
      <group ref={root}>
        <RigMesh geo={geo} rig={rig} />
        <group ref={phone} visible={false}>
          <mesh geometry={G.box()} scale={[0.24, 0.44, 0.06]} position={[0, 0.16, 0]}>
            <meshStandardMaterial color="#1b1b1e" roughness={0.4} />
          </mesh>
          {/* the lit screen faces the collector */}
          <mesh geometry={G.plane()} scale={[0.2, 0.36, 1]} position={[0, 0.16, -0.035]} rotation={[0, Math.PI, 0]}>
            <meshBasicMaterial color="#9fd3ff" toneMapped={false} />
          </mesh>
        </group>
        <mesh ref={notice} geometry={G.plane()} material={noticeMat} scale={[0.72, 0.9, 1]} visible={false} />
        <mesh geometry={G.box()} position={[0, 3, 0]} scale={[2.4, 6.2, 2.4]} visible={false} userData={{ pickFirst: true }} />
      </group>
    </Hotspot>
  );
}

/**
 * The tax collector, the moped (on the spot the hut used to stand) and the policeman guarding its cash box. The moped
 * and the policeman are one static click target; the collector is a moving one; both open property tax.
 */
export function TaxCollector({ layout, world, env, due }: { layout: SiteLayout; world: World; env: RefObject<Env>; due: boolean }) {
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
      <Collector layout={layout} world={world} env={env} due={due} />
    </>
  );
}
