// The radial action wheel (right-click / long-press a house → 6 slots, keys 1–6: Record rent · Add expense · Call tenant ·
// Pay electricity · Add to-do · Move out / New lease) is built once in the HUD kit and mounted on the game screen by
// <InspectLayer> (Overview.tsx passes the scene's onUnitContextMenu to useInspect). Re-exported here so the overview's
// pieces can be found in one place — there is deliberately no second implementation.
export { RadialMenu, type RadialMenuProps } from "@/components/hud";
