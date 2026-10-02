"use client";
// Post-processing kept tasteful: soft AO (hero only), bloom that only catches emissive glows (lamps, lit windows,
// status rings, quest marker), selection outline, ACES tone mapping, a light vignette and SMAA.
import { Bloom, EffectComposer, N8AO, Outline, SMAA, TiltShift2, ToneMapping, Vignette } from "@react-three/postprocessing";

/** postprocessing's ToneMappingMode.ACES_FILMIC (kept local: `postprocessing` is only a transitive dependency). */
const ACES_FILMIC = 6;

export type Tier = "high" | "mid" | "low";

export function Effects({ tier, preview }: { tier: Tier; preview: boolean }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} autoClear={false}>
      {tier === "high" ? <N8AO halfRes aoRadius={6} distanceFalloff={1.4} intensity={2.0} quality="medium" color="#1c0f08" /> : <></>}
      <Bloom mipmapBlur intensity={preview ? 0.55 : 0.8} luminanceThreshold={0.95} luminanceSmoothing={0.18} radius={0.72} />
      <Outline visibleEdgeColor="#fff1cf" hiddenEdgeColor="#ffb547" edgeStrength={4.5} blur width={1400} />
      {tier === "high" && !preview ? <TiltShift2 blur={0.07} taper={0.55} start={[0, 0.48]} end={[1, 0.48]} samples={8} /> : <></>}
      <ToneMapping mode={ACES_FILMIC} />
      <Vignette offset={0.3} darkness={preview ? 0.35 : 0.52} />
      <SMAA />
    </EffectComposer>
  );
}
