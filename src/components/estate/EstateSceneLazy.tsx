"use client";
// Client-only entry for the 3D estate scene. three.js is code-split and never rendered on the server;
// a drawing-style skeleton holds the space while it loads.
import dynamic from "next/dynamic";
import type { EstateSceneProps } from "./EstateScene";
import s from "./estate.module.css";

export type { EstateSceneProps, SceneMode, TimeOfDay, WorldCues } from "./EstateScene";
// SCENE CONTRACT v2 types (pure module — safe to import anywhere)
export type { ObjectScreenFn, SceneInsets, SceneObject, SceneObjectKind, ScreenPoint } from "./types";
export { SCENE_OBJECT_INFO, SCENE_OBJECT_KINDS } from "./types";

export function EstateSceneSkeleton({ className }: { className?: string }) {
  return (
    <div className={`${s.skeleton} ${className ?? ""}`} aria-busy="true" aria-label="Loading 3D site">
      <div className={s.skeletonInner}>
        <svg className={s.skeletonPlan} viewBox="0 0 60 120" aria-hidden="true">
          <path d="M5 115 L58 115 L58 5 L2 5 Z" pathLength={340} />
          <rect x="10" y="72" width="48" height="40" pathLength={340} />
          <rect x="10" y="12" width="48" height="40" pathLength={340} />
        </svg>
        <span className={s.skeletonText}>Loading 3D site</span>
      </div>
    </div>
  );
}

const Scene = dynamic(() => import("./EstateScene"), { ssr: false, loading: () => <EstateSceneSkeleton /> });

/** Same props as EstateScene; `className` sizes the box (give it a height, e.g. 60vh or 100%). */
export default function EstateSceneLazy({ className, ...props }: EstateSceneProps) {
  return (
    <div className={`${s.lazyBox} ${className ?? ""}`}>
      <Scene {...props} />
    </div>
  );
}
