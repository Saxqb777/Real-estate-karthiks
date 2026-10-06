"use client";
// The photographer by 116/B7 (owner, 6/10/2026): his window shows the interior photos of the front unit. A grid of the
// shots → click one to see it large (‹ › / arrow keys to step through, ✕ or Esc back to the grid). Photos live under
// /interiors/ (behind the login — see middleware matcher).
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { HudPanel } from "./HudPanel";
import s from "./photos.module.css";

const PHOTOS = ["/interiors/b7-1.jpg", "/interiors/b7-2.jpg", "/interiors/b7-3.jpg", "/interiors/b7-4.jpg"];

export function PhotosPanel({ data, onClose, side = "right", className }: { data: DashboardData; onClose?: () => void; side?: "left" | "right" | "inline"; className?: string }) {
  const front = data.units.find((u) => u.position === "front");
  const name = front?.name ?? "116/B7";
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % PHOTOS.length));
      else if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i + PHOTOS.length - 1) % PHOTOS.length));
      else if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  return (
    <HudPanel side={side} eyebrow="Photographer · inside" title={name} pinId="photos" onClose={onClose} className={className}>
      <div className={s.wrap}>
        {open === null ? (
          <div className={s.grid}>
            {PHOTOS.map((src, i) => (
              <button key={src} type="button" className={s.thumb} onClick={() => setOpen(i)} aria-label={`Photo ${i + 1} of ${PHOTOS.length}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${name} inside, photo ${i + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        ) : (
          <div className={s.viewer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTOS[open]} alt={`${name} inside, photo ${open + 1}`} className={s.big} />
            <IconButton size="sm" variant="secondary" label="Previous photo" icon={<ChevronLeft />} className={s.prev} onClick={() => setOpen((open + PHOTOS.length - 1) % PHOTOS.length)} />
            <IconButton size="sm" variant="secondary" label="Next photo" icon={<ChevronRight />} className={s.next} onClick={() => setOpen((open + 1) % PHOTOS.length)} />
            <IconButton size="sm" variant="secondary" label="Back to all photos" icon={<X />} className={s.close} onClick={() => setOpen(null)} />
            <span className={s.count}>
              {open + 1} / {PHOTOS.length}
            </span>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
