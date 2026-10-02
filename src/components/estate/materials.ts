// Shared palette, cached materials and unit geometries for the estate scene.
import * as THREE from "three";

/** Materials of the actual site: lime plaster, terracotta, laterite, red oxide, coconut green. */
export const PAL = {
  plaster: "#f6e4c4",
  plasterWarm: "#efdcbc",
  cornice: "#fbf3e4",
  plinth: "#9a5a43",
  terracotta: "#b9582f",
  terracottaCap: "#d07a4c",
  redOxide: "#8f3424",
  wood: "#6b3f22",
  woodDark: "#3e2414",
  shutter: "#245a50",
  tank: "#1c1d21",
  concrete: "#bdb5a8",
  concreteDark: "#8f877b",
  laterite: "#b5532e",
  palmTrunk: "#8b6b4c",
  frond: "#3d8a4b",
  coconut: "#6f8a2e",
  bush: "#4a7d3c",
  marigold: "#ffb547",
  saffron: "#ff8a3d",
  teal: "#2dd4bf",
  coral: "#ff5d73",
  sky: "#60a5fa",
  skin: "#8a5536",
  skinDark: "#5f3a26",
  hair: "#141110",
  white: "#f4f1ea",
} as const;

export type Finish = "normal" | "muted";

interface StdOpts {
  rough?: number;
  metal?: number;
  flat?: boolean;
  map?: THREE.Texture | null;
  emissive?: string;
  emissiveIntensity?: number;
  emissiveMap?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
  depthWrite?: boolean;
  vertexColors?: boolean;
  finish?: Finish;
  toneMapped?: boolean;
  polygonOffset?: number;
  /** clip against VEHICLE_CLIP (traffic emerging from the tile's cut edge) */
  clip?: boolean;
}

/** Shared clipping planes for street traffic; Traffic keeps them on the tile's left/right edges. */
export const VEHICLE_CLIP = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e4), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e4)];

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Desaturate in the shader (inactive units) so textures go grey too. */
function applyMuted(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))) * 0.86, 0.88);",
    );
  };
  m.customProgramCacheKey = () => "muted";
}

/** Cached MeshStandardMaterial. Never mutate the result unless you created it with `own: true`-style keys. */
export function std(color: string, o: StdOpts = {}): THREE.MeshStandardMaterial {
  const key = [
    color,
    o.rough ?? 0.9,
    o.metal ?? 0,
    o.flat ? 1 : 0,
    o.map?.uuid,
    o.emissive,
    o.emissiveIntensity,
    o.emissiveMap?.uuid,
    o.side,
    o.transparent ? 1 : 0,
    o.opacity,
    o.alphaTest,
    o.depthWrite,
    o.vertexColors ? 1 : 0,
    o.finish,
    o.toneMapped,
    o.polygonOffset,
    o.clip ? 1 : 0,
  ].join("|");
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.9,
    metalness: o.metal ?? 0,
    flatShading: !!o.flat,
    map: o.map ?? null,
    emissive: o.emissive ?? "#000000",
    emissiveIntensity: o.emissiveIntensity ?? 1,
    emissiveMap: o.emissiveMap ?? null,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    alphaTest: o.alphaTest ?? 0,
    depthWrite: o.depthWrite ?? true,
    vertexColors: !!o.vertexColors,
  });
  if (o.toneMapped === false) m.toneMapped = false;
  if (o.polygonOffset) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -o.polygonOffset;
    m.polygonOffsetUnits = -o.polygonOffset;
  }
  if (o.finish === "muted") applyMuted(m);
  if (o.clip) {
    m.clippingPlanes = VEHICLE_CLIP;
    m.clipShadows = true;
  }
  cache.set(key, m);
  return m;
}

let _box: THREE.BoxGeometry | null = null;
let _cyl: THREE.CylinderGeometry | null = null;
let _cone: THREE.ConeGeometry | null = null;
let _sphere: THREE.SphereGeometry | null = null;
let _plane: THREE.PlaneGeometry | null = null;
/** Unit geometries: scale them per mesh (shared buffers, cheap). */
export const G = {
  box: () => (_box ??= new THREE.BoxGeometry(1, 1, 1)),
  cyl: () => (_cyl ??= new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
  cone: () => (_cone ??= new THREE.ConeGeometry(0.5, 1, 12)),
  sphere: () => (_sphere ??= new THREE.SphereGeometry(0.5, 14, 10)),
  plane: () => (_plane ??= new THREE.PlaneGeometry(1, 1)),
};

const HOLO_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 wp = modelMatrix * p;
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const HOLO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  float gridLine(float v, float s, float w) { float f = abs(fract(v / s - 0.5) - 0.5) * s; return 1.0 - smoothstep(0.0, w, f); }
  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(normalize(vNormalW), V)), 2.2);
    float scan = 1.0 - smoothstep(0.0, 0.9, abs(fract(vWorld.y * 0.08 - uTime * 0.18) - 0.5) * 9.0);
    float grid = max(gridLine(vWorld.y, 2.625, 0.06), max(gridLine(vWorld.x, 2.0, 0.05), gridLine(vWorld.z, 2.0, 0.05)));
    float a = (0.13 + fres * 0.5 + grid * 0.22 + scan * 0.22) * uOpacity;
    vec3 c = uColor * (0.75 + fres * 0.9 + grid * 0.5 + scan * 0.6);
    gl_FragColor = vec4(c, a);
  }
`;

/** Blueprint hologram for vacant units (fresnel + grid + drifting scanline). */
export function holoMaterial(color: string = PAL.sky) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
