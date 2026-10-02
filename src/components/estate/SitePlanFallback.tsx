"use client";
// 2D site plan drawn from the same layout data — shown when WebGL is unavailable (or the 3D view crashes).
import type { SiteLayout } from "@/lib/site-layout";
import { PAL } from "./materials";
import { statusLook } from "./UnitSlot";
import s from "./estate.module.css";

export function SitePlanFallback({ layout, reason }: { layout: SiteLayout; reason: string }) {
  const P = layout.plot;
  const pad = 8;
  const W = P.rightX + pad * 2;
  const H = P.depthFt + pad * 2;
  // plan → svg: x as is, front edge at the bottom
  const X = (x: number) => x + pad;
  const Y = (z: number) => P.depthFt - z + pad;
  const path = (pts: { x: number; z: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(2)},${Y(p.z).toFixed(2)}`).join(" ") + " Z";
  return (
    <div className={s.fallback} role="img" aria-label={`Site plan of the ${P.townName} plot`}>
      <p className={s.fallbackNote}>
        <b>3D view unavailable</b> — {reason}. Showing the site plan instead.
      </p>
      <svg className={s.fallbackSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <path d={path(P.polygon)} fill="#2a1c14" stroke={PAL.laterite} strokeWidth={0.4} />
        {layout.slots.map((slot) => {
          const look = statusLook(slot);
          const empty = slot.status === "empty";
          return (
            <g key={slot.slot}>
              <path
                d={path(slot.outline)}
                fill={empty ? "none" : slot.status === "vacant" ? "rgba(96,165,250,0.18)" : "#efe2c8"}
                stroke={look.ring ?? (empty ? PAL.marigold : "#9a8f80")}
                strokeWidth={0.35}
                strokeDasharray={empty || slot.status === "vacant" ? "1 0.7" : undefined}
              />
              <text x={X((slot.rect.x0 + slot.rect.x1) / 2 - 2)} y={Y((slot.rect.z0 + slot.rect.z1) / 2)} fontSize={2.2} fill={empty ? PAL.marigold : "#3a2a1c"} textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                {slot.unit?.name ?? `+ ${slot.slot}`}
              </text>
            </g>
          );
        })}
        <text x={X(P.rightX / 2)} y={Y(0) + 4.5} fontSize={2.4} fill="#f3ead9" textAnchor="middle" style={{ fontFamily: "var(--font-display)" }}>
          {layout.dimensions.find((d) => d.key === "frontWidthFt")?.label}
        </text>
        <text x={X(P.rightX) + 4} y={Y(P.depthFt / 2)} fontSize={2.4} fill="#f3ead9" textAnchor="middle" transform={`rotate(-90 ${X(P.rightX) + 4} ${Y(P.depthFt / 2)})`} style={{ fontFamily: "var(--font-display)" }}>
          {layout.dimensions.find((d) => d.key === "depthFt")?.label}
        </text>
      </svg>
    </div>
  );
}
