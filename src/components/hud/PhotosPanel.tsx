"use client";
// The photographer by the front unit (owner, 6/10/2026): his window shows the interior photos — design D "no box"
// (owner, 9/10/2026): no frame and no title (no unit name), the photos float over the darkened world with only 📌 / ✕
// above them; 3 across on every screen, no enlarge view (owner). Photos live under /interiors/ (behind the login — see
// middleware matcher).
import { cx } from "@/components/ui";
import { HudPanel } from "./HudPanel";
import s from "./photos.module.css";

const PHOTOS = ["/interiors/b7-1.jpg", "/interiors/b7-3.jpg", "/interiors/b7-4.jpg"];

export function PhotosPanel({ onClose, side = "right", className }: { onClose?: () => void; side?: "left" | "right" | "inline"; className?: string }) {
  return (
    <HudPanel bare side={side} title="Interior photos" pinId="photos" onClose={onClose} className={cx(s.panel, className)}>
      <div className={s.wrap}>
        <div className={s.grid}>
          {PHOTOS.map((src, i) => (
            <div key={src} className={s.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Interior photo ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </HudPanel>
  );
}
