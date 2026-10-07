"use client";
// The photographer by 116/B7 (owner, 6/10/2026): his window shows the interior photos of the front unit — just the panel
// of all photos (no enlarge view, owner). Photos live under /interiors/ (behind the login — see middleware matcher).
import type { DashboardData } from "@/lib/dashboard-types";
import { HudPanel } from "./HudPanel";
import s from "./photos.module.css";

const PHOTOS = ["/interiors/b7-1.jpg", "/interiors/b7-3.jpg", "/interiors/b7-4.jpg"];

export function PhotosPanel({ data, onClose, side = "right", className }: { data: DashboardData; onClose?: () => void; side?: "left" | "right" | "inline"; className?: string }) {
  const front = data.units.find((u) => u.position === "front");
  const name = front?.name ?? "116/B7";
  return (
    <HudPanel side={side} eyebrow="Photographer · interior" title={name} pinId="photos" onClose={onClose} className={className}>
      <div className={s.wrap}>
        <div className={s.grid}>
          {PHOTOS.map((src, i) => (
            <div key={src} className={s.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${name} interior, photo ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </HudPanel>
  );
}
