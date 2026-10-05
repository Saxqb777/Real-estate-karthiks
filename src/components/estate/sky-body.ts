// Where the painted sun / moon is on screen right now (viewport px), published by the sky backdrop every frame so the
// HUD can put a hover/click target on it (owner: hover the sun or moon for the time, click it to travel in time).
// Plain object, no three.js — the overview reads it without loading the 3D bundle.
export const skyBody = { x: 0, y: 0, r: 0, vis: 0, kind: "sun" as "sun" | "moon", live: false };
