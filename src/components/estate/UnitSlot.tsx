"use client";
// A front/back slot on the plot: the townhouse plus its status language (DESIGN.md "The world"):
//   occupied + paid → teal ring · due within 5 days → marigold ring · overdue → coral pulsing ring + "!" quest marker
//   vacant → blueprint hologram + TO-LET board · incoming (lease signed, starts later) → blueprint + "Moving in D/M" board
//   inactive → desaturated · no unit → wireframe slot with "+ Build unit".
// The house, its board and its tenant are clickable world objects (Interact.tsx).
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { formatFeetInches, type BuildingSlot, type SlotName } from "@/lib/site-layout";
import type { Env } from "./env";
import { useTamilFont } from "./Fixtures";
import { Hotspot, spotKey, useScene, type V3 } from "./Interact";
import { G, PAL, std } from "./materials";
import { TenantFigure } from "./People";
import { Townhouse } from "./Townhouse";
import { glowTex, kolamTex, movingInTex, toLetTex } from "./textures";
import type { LabelSpec, Tone } from "./Overlay";
import { FLAT, easeOutBack, planShape, type World } from "./util";

export type SceneMode = "hero" | "preview" | "login";

export interface UnitSlotProps {
  slot: BuildingSlot;
  world: World;
  env: RefObject<Env>;
  mode: SceneMode;
  selected: boolean;
  highlighted: boolean;
  interactive: boolean;
  reduced: boolean;
  life: boolean;
  rise: boolean;
  index: number;
  onEmptyClick?: (slot: SlotName) => void;
  /** where the unit's gate is on the street (plan ft): its TO-LET board stands there, its kolam is drawn there */
  signAt?: { x: number; z: number };
  /** hang the TO-LET board on the building's side wall instead (a back house, seen over the side passage) */
  boardOnWall?: boolean;
  /** registers the building hit volume (used to fade labels hidden behind buildings) */
  occluder?: (o: THREE.Object3D | null) => void;
}

/** "1/11" from an ISO date-only string (UTC parts, like formatDate). */
export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return "soon";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "soon" : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export function statusLook(slot: BuildingSlot) {
  const u = slot.unit;
  if (!u || slot.status === "empty") return { ring: null, label: "Empty slot", tone: "faint" as Tone };
  if (slot.status === "inactive") return { ring: null, label: "Inactive", tone: "faint" as Tone };
  if (slot.status === "incoming") return { ring: PAL.sky, label: `Moving in ${dayMonth(u.moveInDate)}`, tone: "sky" as Tone };
  if (slot.status === "vacant") return { ring: PAL.sky, label: u.vacantDays ? `Vacant · ${u.vacantDays} days` : "Vacant", tone: "sky" as Tone };
  if (u.rentState === "overdue") return { ring: PAL.coral, label: u.daysOverdue ? `Rent ${u.daysOverdue} days late` : "Rent overdue", tone: "coral" as Tone };
  if (u.rentState === "due-soon") return { ring: PAL.marigold, label: "Rent due soon", tone: "marigold" as Tone };
  return { ring: PAL.teal, label: "Rent paid", tone: "teal" as Tone };
}

/** Roof-top anchor of a slot (cards, tooltips, `screen` coords). */
export function slotAnchor(slot: BuildingSlot, world: World): V3 {
  const cx = world.x((slot.rect.x0 + slot.rect.x1) / 2);
  const cz = world.z((slot.rect.z0 + slot.rect.z1) / 2);
  const marker = slot.unit?.rentState === "overdue" && slot.status === "occupied";
  return [cx, slot.heightFt + slot.parapetFt + (marker ? 12.5 : 4.5), cz];
}

/** Label specs + anchors for a slot (card on hover / selection, compact tag when labels are on, build button). */
export function slotLabels(
  slot: BuildingSlot,
  world: World,
  o: { hovered: boolean; selected: boolean; showLabel: boolean; interactive: boolean; canBuild: boolean; meta: boolean },
): { spec: LabelSpec; anchor: V3 }[] {
  const cx = world.x((slot.rect.x0 + slot.rect.x1) / 2);
  const cz = world.z((slot.rect.z0 + slot.rect.z1) / 2);
  if (!o.interactive) return [];
  if (slot.status === "empty" || !slot.unit) {
    return o.canBuild ? [{ spec: { key: `build:${slot.slot}`, kind: "build", slot: slot.slot }, anchor: [cx, 14, cz] }] : [];
  }
  const u = slot.unit;
  const look = statusLook(slot);
  const anchor = slotAnchor(slot, world);
  if (o.hovered || o.selected) {
    const row =
      slot.status === "occupied"
        ? { left: u.tenantName || "Tenant", right: u.monthlyRent ? u.monthlyRent : null }
        : slot.status === "incoming"
          ? { left: u.tenantName ? `${u.tenantName} moves in` : "Lease signed", right: u.monthlyRent ? u.monthlyRent : null }
          : slot.status === "vacant"
            ? { left: "Ready to let", right: null }
            : null;
    return [
      {
        spec: {
          key: `card:${slot.slot}`,
          kind: "card",
          slot: slot.slot,
          name: u.name,
          tone: look.tone,
          status: look.label,
          row,
          meta: o.meta ? `${slot.floors} floor${slot.floors === 1 ? "" : "s"} · ${formatFeetInches(slot.widthFt)} × ${formatFeetInches(slot.depthFt)}` : null,
          hint: o.hovered && !o.selected ? "Click for details · right-click for actions" : null,
        },
        anchor,
      },
    ];
  }
  return o.showLabel ? [{ spec: { key: `tag:${slot.slot}`, kind: "tag", name: u.name, tone: look.tone }, anchor }] : [];
}

export function UnitSlot(p: UnitSlotProps) {
  if (p.slot.status === "empty") return <EmptySlot {...p} />;
  return <BuiltSlot {...p} />;
}

function BuiltSlot({ slot, world, env, mode, selected, highlighted, interactive, reduced, life, rise, index, signAt, boardOnWall, occluder }: UnitSlotProps) {
  const u = slot.unit!;
  const look = statusLook(slot);
  const api = useScene();
  const key = spotKey("unit", u.id);
  const hovered = api.hovered === key;
  const group = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const totalH = slot.heightFt + slot.parapetFt;
  const cx = world.x((slot.rect.x0 + slot.rect.x1) / 2);
  const cz = world.z((slot.rect.z0 + slot.rect.z1) / 2);
  const empty = slot.status === "vacant" || slot.status === "incoming";

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (!rise || reduced) {
      g.scale.y = 1;
      return;
    }
    born.current ??= clock.elapsedTime + 0.35 + index * 0.25;
    const t = Math.min(1, Math.max(0, (clock.elapsedTime - born.current) / 1.1));
    g.scale.y = Math.max(0.001, easeOutBack(t));
  });

  // hit volume = the real outline (the porch notch stays open, so the tenant standing in it can be clicked)
  const sig = JSON.stringify([slot.outline, totalH, world.cx, world.cz]);
  const hitGeo = useMemo(
    () => new THREE.ExtrudeGeometry(planShape(slot.outline, world), { depth: totalH + 6.5, bevelEnabled: false, curveSegments: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig],
  );
  useEffect(() => () => hitGeo.dispose(), [hitGeo]);
  const anchor = useMemo(() => slotAnchor(slot, world), [slot, world]);

  return (
    <group>
      <Hotspot
        spot={{ key, kind: "unit", unitId: u.id, anchor }}
        selected={selected}
        hit={<mesh ref={occluder} geometry={hitGeo} rotation={FLAT} visible={false} />}
      >
        <group ref={group}>
          <Townhouse
            slot={slot}
            world={world}
            env={env}
            finish={slot.status === "inactive" ? "muted" : "normal"}
            ghost={empty}
            lived={slot.status === "occupied"}
            clothes={slot.status === "occupied" && life}
            animate={!reduced && life}
          />
        </group>
      </Hotspot>
      {look.ring && (
        <StatusRing
          slot={slot}
          world={world}
          color={look.ring}
          pulse={u.rentState === "overdue" && slot.status === "occupied" && !reduced}
          dashed={empty}
          boost={hovered || selected || highlighted ? 1 : 0}
        />
      )}
      {!look.ring && (highlighted || selected) && <StatusRing slot={slot} world={world} color={PAL.marigold} pulse={false} dashed={false} boost={1} />}
      {slot.status === "occupied" && u.rentState === "overdue" && <QuestMarker x={cx} z={cz} y={totalH + 7} roof={totalH} reduced={reduced} />}
      {empty && <LetBoard slot={slot} world={world} reduced={reduced} at={signAt} onWall={!!boardOnWall} incoming={slot.status === "incoming"} />}
      {slot.status === "occupied" && mode !== "preview" && interactive && <TenantFigure slot={slot} world={world} env={env} index={index} />}
      {slot.status === "occupied" && signAt && <StreetKolam x={world.x(signAt.x)} z={world.z(signAt.z - 1.2)} env={env} />}
    </group>
  );
}

// ───────────────────────────── status ring ─────────────────────────────

const RING_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform vec2 uHalf; uniform vec2 uBox; uniform float uPulse; uniform float uDash; uniform float uBoost;
  varying vec2 vUv;
  float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uHalf;
    float d = sdRoundBox(p, uBox, 1.4);
    float line = 1.0 - smoothstep(0.14, 0.38, abs(d));
    float halo = exp(-max(d, 0.0) * 1.1) * step(0.0, d) * 0.28 + exp(-abs(d) * 2.6) * 0.25;
    float inner = (1.0 - smoothstep(-2.2, 0.0, -d)) * 0.0;
    float corner = max(uBox.x - abs(p.x), uBox.y - abs(p.y));
    float bracket = (1.0 - smoothstep(2.6, 2.9, corner)) * (1.0 - smoothstep(0.1, 0.42, abs(d - 0.55)));
    float dash = mix(1.0, step(0.45, fract((p.x + p.y) * 0.32 - uTime * 0.35)), uDash);
    float beat = mix(1.0, 0.7 + 0.3 * sin(uTime * 4.5), uPulse);
    float rip = 0.0;
    if (uPulse > 0.5) {
      float t = fract(uTime * 0.55);
      rip = (1.0 - smoothstep(0.0, 0.5, abs(d - t * 6.5))) * (1.0 - t) * 0.8;
    }
    float a = (line * dash * 1.3 + bracket * 1.4 + halo + rip + inner) * beat * (1.0 + uBoost * 0.6);
    vec3 c = uColor * (1.5 + bracket * 1.3 + uBoost * 0.8);
    gl_FragColor = vec4(c * a, a);
  }
`;

function StatusRing({ slot, world, color, pulse, dashed, boost }: { slot: BuildingSlot; world: World; color: string; pulse: boolean; dashed: boolean; boost: number }) {
  const margin = 4;
  const hx = slot.widthFt / 2 + 1.6;
  const hz = slot.depthFt / 2 + 1.6;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uTime: { value: 0 },
          uHalf: { value: new THREE.Vector2() },
          uBox: { value: new THREE.Vector2() },
          uPulse: { value: 0 },
          uDash: { value: 0 },
          uBoost: { value: 0 },
        },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: RING_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const boostRef = useRef(0);
  useFrame(({ clock }, dt) => {
    const u = mat.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uHalf.value.set(hx + margin, hz + margin);
    u.uBox.value.set(hx, hz);
    u.uPulse.value = pulse ? 1 : 0;
    u.uDash.value = dashed ? 1 : 0;
    boostRef.current += (boost - boostRef.current) * Math.min(1, dt * 8);
    u.uBoost.value = boostRef.current;
  });
  return (
    <mesh
      geometry={G.plane()}
      material={mat}
      rotation={FLAT}
      position={[world.x((slot.rect.x0 + slot.rect.x1) / 2), 0.68, world.z((slot.rect.z0 + slot.rect.z1) / 2)]}
      scale={[(hx + margin) * 2, (hz + margin) * 2, 1]}
      renderOrder={5}
    />
  );
}

// ───────────────────────────── overdue quest marker ─────────────────────────────

function QuestMarker({ x, y, z, roof, reduced }: { x: number; y: number; z: number; roof: number; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: PAL.coral, emissive: PAL.coral, emissiveIntensity: 2.4, roughness: 0.4, toneMapped: false }), []);
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: glowTex(), color: PAL.coral, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }), []);
  const beam = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.coral, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const capsule = useMemo(() => new THREE.CapsuleGeometry(0.46, 1.9, 6, 14), []);
  useEffect(() => () => [glow, halo, beam, capsule].forEach((o) => o.dispose()), [glow, halo, beam, capsule]);
  useFrame(({ clock }) => {
    if (!g.current || reduced) return;
    const t = clock.elapsedTime;
    g.current.position.y = y + Math.sin(t * 2.2) * 0.6;
    g.current.rotation.y = t * 1.3;
    const k = 1 + Math.sin(t * 4.5) * 0.06;
    g.current.scale.setScalar(k);
    glow.emissiveIntensity = 2.0 + Math.sin(t * 4.5) * 0.8;
  });
  return (
    <group>
      <group ref={g} position={[x, y, z]}>
        <mesh geometry={capsule} material={glow} position={[0, 1.15, 0]} castShadow />
        <mesh geometry={G.sphere()} material={glow} scale={1.05} position={[0, -1.25, 0]} castShadow />
        <sprite material={halo} scale={[8, 8, 1]} />
      </group>
      <mesh geometry={G.cyl()} material={beam} position={[x, (roof + y - 2) / 2, z]} scale={[0.22, y - roof - 2, 0.22]} />
    </group>
  );
}

// ───────────────────────────── vacant: TO-LET board · incoming: "Moving in D/M" slate ─────────────────────────────

function LetBoard({ slot, world, reduced, at, onWall, incoming }: { slot: BuildingSlot; world: World; reduced: boolean; at?: { x: number; z: number }; onWall: boolean; incoming: boolean }) {
  const tamil = useTamilFont();
  const ref = useRef<THREE.Group>(null);
  const date = dayMonth(slot.unit?.moveInDate);
  const face = useMemo(() => std("#ffffff", { map: incoming ? movingInTex(date, tamil) : toLetTex(tamil), rough: 0.7 }), [incoming, date, tamil]);
  const wood = std(PAL.wood, { rough: 0.85 });
  useFrame(({ clock }) => {
    if (ref.current && !reduced) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * (onWall ? 0.012 : 0.025);
  });
  const unitId = slot.unit!.id;
  // street board at the unit's gate, facing the road — or hung on the side wall facing the passage (world −X)
  const wallY = Math.min(slot.heightFt - 2.2, slot.floors > 1 ? 10.5 + 2.2 : 5.6);
  const pos: V3 = onWall
    ? [world.x(slot.rect.x0 - 0.3), 0, world.z(slot.rect.z0 + Math.min(slot.depthFt * 0.4, 9))]
    : [world.x(at ? at.x : slot.notch.wide.x0 + (slot.notch.wide.x1 - slot.notch.wide.x0) * 0.45), 0, world.z(at ? at.z : slot.rect.z0 - 2.4)];
  const rotY = onWall ? -Math.PI / 2 : -0.12;
  const boardY = onWall ? wallY : 6.0;
  const anchor = useMemo<V3>(() => [pos[0] - (onWall ? 0.5 : 0), boardY + 2.4, pos[2]], [pos[0], pos[2], boardY, onWall]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Hotspot
      spot={{ key: spotKey("tolet", unitId), kind: "tolet", unitId, anchor }}
      hit={<mesh geometry={G.box()} position={[pos[0], onWall ? boardY : 4.4, pos[2]]} scale={[6.4, onWall ? 3.6 : 8.8, 1.6]} rotation={[0, rotY, 0]} visible={false} />}
    >
      <group position={pos} rotation={[0, rotY, 0]}>
        {!onWall &&
          [-2.1, 2.1].map((dx) => <mesh key={dx} geometry={G.box()} material={wood} scale={[0.3, 7.4, 0.3]} position={[dx, 3.7, 0]} castShadow />)}
        {onWall &&
          [-1.9, 1.9].map((dx) => <mesh key={dx} geometry={G.box()} material={wood} scale={[0.08, 1.2, 0.08]} position={[dx, boardY + 1.9, 0.05]} rotation={[0, 0, dx > 0 ? -0.35 : 0.35]} />)}
        <group ref={ref} position={[0, boardY, onWall ? 0.12 : 0.2]}>
          <mesh geometry={G.box()} material={[wood, wood, wood, wood, face, wood]} scale={[5.6, 2.8, 0.16]} castShadow />
        </group>
      </group>
    </Hotspot>
  );
}

/** A kolam drawn on the street in front of the gate (fresh in the morning, fading through the day). */
function StreetKolam({ x, z, env }: { x: number; z: number; env: RefObject<Env> }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: kolamTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    mat.opacity = env.current.kolam;
  });
  return <mesh geometry={G.plane()} material={mat} rotation={FLAT} position={[x, 0.09, z]} scale={[3.4, 3.4, 1]} renderOrder={2} />;
}

// ───────────────────────────── empty slot ─────────────────────────────

const GRID_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform vec2 uHalf; uniform float uHover;
  varying vec2 vUv;
  float gl(float v, float s, float w) { float f = abs(fract(v / s - 0.5) - 0.5) * s; return 1.0 - smoothstep(0.0, w, f); }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uHalf;
    float minor = max(gl(p.x, 1.0, 0.04), gl(p.y, 1.0, 0.04)) * 0.25;
    float major = max(gl(p.x, 5.0, 0.07), gl(p.y, 5.0, 0.07)) * 0.6;
    vec2 e = uHalf - abs(p);
    float border = 1.0 - smoothstep(0.1, 0.3, min(e.x, e.y));
    float scan = 1.0 - smoothstep(0.0, 1.6, abs(p.y - (fract(uTime * 0.18) * 2.0 - 1.0) * uHalf.y));
    float a = (0.08 + minor + major + border * 1.2 + scan * 0.35) * (0.6 + uHover * 0.6);
    gl_FragColor = vec4(uColor * a * 1.3, a);
  }
`;

function EmptySlot({ slot, world, mode, interactive, reduced, onEmptyClick }: UnitSlotProps) {
  const [hover, setHover] = useState(false);
  const w = slot.widthFt;
  const d = slot.depthFt;
  const h = 10.5;
  const cx = world.x((slot.rect.x0 + slot.rect.x1) / 2);
  const cz = world.z((slot.rect.z0 + slot.rect.z1) / 2);
  const color = PAL.marigold;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uHalf: { value: new THREE.Vector2(w / 2, d / 2) }, uHover: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: GRID_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color, w, d],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const lineRef = useRef<{ material: { dashOffset: number; opacity: number } } | null>(null);
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime;
    mat.uniforms.uHover.value += ((hover ? 1 : 0) - mat.uniforms.uHover.value) * 0.15;
    if (lineRef.current && !reduced) lineRef.current.material.dashOffset = -clock.elapsedTime * 0.8;
  });
  const edges = useMemo(() => {
    const x0 = -w / 2;
    const x1 = w / 2;
    const z0 = -d / 2;
    const z1 = d / 2;
    const c = [
      [x0, 0, z0],
      [x1, 0, z0],
      [x1, 0, z1],
      [x0, 0, z1],
    ] as [number, number, number][];
    const top = c.map(([x, , z]) => [x, h, z] as [number, number, number]);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      pts.push(top[i], top[(i + 1) % 4], c[i], top[i]);
    }
    return pts;
  }, [w, d]);
  const canClick = interactive && mode !== "login" && !!onEmptyClick;
  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={G.plane()} material={mat} rotation={FLAT} position={[0, 0.12, 0]} scale={[w, d, 1]} renderOrder={4} />
      <Line ref={lineRef as never} points={edges} segments color={color} lineWidth={hover ? 2.6 : 2} dashed dashSize={0.9} gapSize={0.6} transparent opacity={hover ? 1 : 0.85} toneMapped={false} />
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={G.box()} material={std("#c9a46b", { rough: 0.9 })} scale={[0.18, 2.2, 0.18]} position={[0, 1.1, 0]} castShadow />
          <mesh geometry={G.box()} material={std(PAL.saffron, { side: THREE.DoubleSide })} scale={[0.7, 0.32, 0.02]} position={[0.36, 1.95, 0]} rotation={[0, i * 0.7, 0]} />
        </group>
      ))}
      {canClick && (
          <mesh
            visible={false}
            geometry={G.box()}
            position={[0, h / 2, 0]}
            scale={[w, h, d]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(true);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHover(false);
              document.body.style.cursor = "";
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.delta <= 6) onEmptyClick!(slot.slot);
            }}
          />
      )}
    </group>
  );
}
