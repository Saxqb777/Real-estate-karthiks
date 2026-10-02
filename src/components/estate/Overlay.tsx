"use client";
// In-world labels without a React root per label: the scene describes labels (LabelSpec), the DOM tree renders
// them once, and LabelProjector moves them every frame by projecting their 3D anchors to screen pixels.
import { useFrame } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import * as THREE from "three";
import { formatINR } from "@/lib/format";
import type { SlotName } from "@/lib/site-layout";
import s from "./estate.module.css";

export type V3 = [number, number, number];
export type Tone = "teal" | "marigold" | "coral" | "sky" | "faint";

export type LabelSpec =
  | {
      key: string;
      kind: "card";
      slot: SlotName;
      name: string;
      tone: Tone;
      status: string;
      /** tenant / rent line (rent in ₹ per month) */
      row: { left: string; right: number | null } | null;
      meta: string | null;
      /** next-step hint, fades in after a beat (DESIGN.md "Discoverability") */
      hint: string | null;
    }
  | { key: string; kind: "tag"; name: string; tone: Tone }
  | { key: string; kind: "tip"; title: string; sub: string; note: string | null; hint: string | null; tone: Tone }
  | { key: string; kind: "hint" }
  | { key: string; kind: "dim"; text: string; caption: string | null; hot: boolean }
  | { key: string; kind: "build"; slot: SlotName };

/** Projects anchors → screen and writes transforms straight onto the registered DOM nodes. */
export function LabelProjector({
  anchors,
  registry,
  occluders,
}: {
  anchors: RefObject<Map<string, V3>>;
  registry: RefObject<Map<string, HTMLElement>>;
  occluders?: RefObject<Set<THREE.Object3D>>;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const w = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  useFrame(({ camera, size }) => {
    const occ = occluders ? [...occluders.current] : [];
    for (const [key, el] of registry.current) {
      const a = anchors.current.get(key);
      if (!a) continue;
      if (occ.length && el.dataset.fade === "1") {
        // fade drawing labels that sit behind a building
        w.set(a[0], a[1], a[2]);
        const dist = w.distanceTo(camera.position);
        ray.set(camera.position, w.sub(camera.position).normalize());
        ray.far = dist - 0.5;
        el.style.opacity = ray.intersectObjects(occ, false).length ? "0.22" : "1";
      }
      v.set(a[0], a[1], a[2]).project(camera);
      if (v.z > 1 || v.z < -1) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px,0)`;
    }
  });
  return null;
}

const toneClass: Record<Tone, string> = { teal: s.toneTeal, marigold: s.toneMarigold, coral: s.toneCoral, sky: s.toneSky, faint: s.toneFaint };

/** DOM side: renders the labels; positions are written by LabelProjector. */
export function OverlayLabels({
  labels,
  registry,
  onBuild,
}: {
  labels: LabelSpec[];
  registry: RefObject<Map<string, HTMLElement>>;
  onBuild?: (slot: SlotName) => void;
}) {
  const reg = (key: string) => (el: HTMLElement | null) => {
    if (el) registry.current.set(key, el);
    else registry.current.delete(key);
  };
  return (
    <div className={s.overlay} aria-hidden={labels.every((l) => l.kind !== "build") ? true : undefined}>
      {labels.map((l) => (
        <div
          key={l.key}
          ref={reg(l.key)}
          data-fade={l.kind === "dim" && !l.hot ? "1" : undefined}
          className={`${s.anchor} ${l.kind === "dim" ? (l.hot ? s.zHot : s.zDim) : l.kind === "card" || l.kind === "tip" ? s.zCard : ""}`}
          style={{ visibility: "hidden" }}
        >
          {l.kind === "card" && (
            <div className={s.above}>
              <div className={`${s.card} ${toneClass[l.tone]}`}>
                <div className={s.cardHead}>
                  <span className={s.cardName}>{l.name}</span>
                  <span className={s.cardSlot}>{l.slot}</span>
                </div>
                <div className={s.cardStatus}>
                  <i className={s.dot} />
                  {l.status}
                </div>
                {l.row && (
                  <div className={s.cardRow}>
                    <span>{l.row.left}</span>
                    {l.row.right !== null && <b>{`${formatINR(l.row.right)}/mo`}</b>}
                  </div>
                )}
                {l.meta && <div className={s.cardMeta}>{l.meta}</div>}
                {l.hint && <div className={s.cardHint}>{l.hint}</div>}
              </div>
            </div>
          )}
          {l.kind === "tip" && (
            <div className={s.above}>
              <div className={`${s.tip} ${toneClass[l.tone]}`}>
                <div className={s.tipTitle}>{l.title}</div>
                <div className={s.tipSub}>{l.note ?? l.sub}</div>
                {l.hint && <div className={s.cardHint}>{l.hint}</div>}
              </div>
            </div>
          )}
          {l.kind === "hint" && (
            <div className={s.centered}>
              <i className={s.unexplored} />
            </div>
          )}
          {l.kind === "tag" && (
            <div className={s.above}>
              <div className={`${s.tag} ${toneClass[l.tone]}`}>
                <i className={s.dot} />
                {l.name}
              </div>
            </div>
          )}
          {l.kind === "dim" && (
            <div className={s.centered}>
              <div className={`${s.dim} ${l.hot ? s.dimHot : ""}`}>
                {l.caption && <span className={s.dimCaption}>{l.caption}</span>}
                {l.text}
              </div>
            </div>
          )}
          {l.kind === "build" && (
            <div className={s.centered}>
              <button type="button" className={s.build} onClick={() => onBuild?.(l.slot)}>
                <span className={s.buildPlus}>+</span> Build {l.slot} unit
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
