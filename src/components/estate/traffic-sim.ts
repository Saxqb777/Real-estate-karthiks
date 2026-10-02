// Lane simulation for the street traffic (pure, unit tested). Vehicles drive on the left (India): each one keeps to
// its own lane, follows the vehicle ahead with a safe gap — so nothing ever drives through another vehicle — and a
// narrow vehicle slips past a slow one only when the lane is wide enough, never into the oncoming lane.
// Sub-stepped on scene time, so it is frame-rate independent.

export type Kind = "auto" | "moped" | "bicycle" | "car" | "bus";

export interface Spec {
  kind: Kind;
  dir: 1 | -1;
  speed: number;
  len: number;
  width: number;
  /** preferred gap between the kerb and the vehicle's side (ft) */
  lat: number;
  /** seconds off-stage between trips */
  rest: [number, number];
}

// ordered by priority: phones get the first few
export const SPECS: Spec[] = [
  { kind: "auto", dir: 1, speed: 17, len: 8.6, width: 4.3, lat: 1.0, rest: [2, 7] },
  { kind: "moped", dir: -1, speed: 21, len: 6, width: 2.2, lat: 0.7, rest: [3, 9] },
  { kind: "bicycle", dir: 1, speed: 10, len: 5.6, width: 2, lat: 0.35, rest: [6, 14] },
  { kind: "auto", dir: -1, speed: 15.5, len: 8.6, width: 4.3, lat: 1.0, rest: [3, 8] },
  { kind: "car", dir: 1, speed: 24, len: 12, width: 5.2, lat: 1.1, rest: [8, 18] },
  { kind: "bus", dir: -1, speed: 17, len: 31, width: 7.6, lat: 0.15, rest: [22, 40] },
];

export interface Car {
  spec: Spec;
  active: boolean;
  /** distance travelled since entering (ft) */
  s: number;
  v: number;
  /** current kerb gap (ft) */
  lat: number;
  wait: number;
  mood: number;
  rand: () => number;
}

const ACCEL = 7;
const BRAKE = 16;
const STEP = 1 / 30;

function lateralOverlap(a: Car, b: Car, margin = 0.3) {
  return a.lat < b.lat + b.spec.width + margin && b.lat < a.lat + a.spec.width + margin;
}

/** Advance the simulation by dt seconds (sub-stepped). `spans` = drivable length of each direction's lane. */
export function stepTraffic(cars: Car[], spans: Record<1 | -1, number>, laneW: number, dt: number) {
  let left = Math.min(dt, 2);
  while (left > 1e-6) {
    const h = Math.min(STEP, left);
    left -= h;
    for (const dir of [1, -1] as const) {
      const lane = cars.filter((c) => c.active && c.spec.dir === dir).sort((a, b) => b.s - a.s);
      for (let i = 0; i < lane.length; i++) {
        const me = lane[i];
        const sp = me.spec;
        // nearest vehicle ahead that shares lateral space; maybe slip past a slow one inside the lane
        let leader: Car | null = null;
        let passing: Car | null = null;
        for (let j = i - 1; j >= 0; j--) {
          const o = lane[j];
          const gap = o.s - o.spec.len / 2 - (me.s + sp.len / 2);
          if (gap > 60) break;
          const passLat = o.lat + o.spec.width + 0.5;
          const canPass = o.v < sp.speed * me.mood * 0.75 && passLat + sp.width <= laneW - 0.15;
          if (canPass && !passing && gap < 18) passing = o;
          if (lateralOverlap(me, o) && !leader) leader = o;
        }
        let wantLat = passing ? passing.lat + passing.spec.width + 0.5 : sp.lat;
        // never steer into the band of a vehicle that is alongside (ahead or behind, overlapping lengthwise)
        if (Math.abs(wantLat - me.lat) > 1e-3) {
          const lo = Math.min(wantLat, me.lat);
          const hi = Math.max(wantLat, me.lat) + sp.width;
          for (const o of lane) {
            if (o === me) continue;
            const alongside = Math.abs(o.s - me.s) < (o.spec.len + sp.len) / 2 + 1.5;
            if (alongside && lo < o.lat + o.spec.width + 0.3 && o.lat < hi + 0.3 && !lateralOverlap(me, o)) {
              wantLat = me.lat;
              break;
            }
          }
        }
        me.lat += Math.max(-2.2 * h, Math.min(2.2 * h, wantLat - me.lat));
        let target = sp.speed * me.mood;
        if (leader) {
          const gap = leader.s - leader.spec.len / 2 - (me.s + sp.len / 2);
          const safe = 3 + me.v * 0.5;
          if (gap < safe) target = Math.min(target, leader.v * Math.max(0, (gap - 1.2) / (safe - 1.2)));
        }
        const dv = target - me.v;
        me.v = Math.max(0, me.v + Math.max(-BRAKE * h, Math.min(ACCEL * h, dv)));
        me.s += me.v * h;
        // hard guarantee: never overlap a vehicle ahead that shares lateral space
        if (leader) me.s = Math.min(me.s, leader.s - (leader.spec.len + sp.len) / 2 - 0.8);
        if (me.s > spans[dir] + sp.len) {
          me.active = false;
          me.wait = sp.rest[0] + me.rand() * (sp.rest[1] - sp.rest[0]);
        }
      }
      // spawn when the lane entrance is clear
      const last = lane[lane.length - 1];
      for (const c of cars) {
        if (c.active || c.spec.dir !== dir) continue;
        c.wait -= h;
        if (c.wait > 0) continue;
        const clear = !last || last.s - last.spec.len / 2 > c.spec.len / 2 + 6;
        if (!clear) continue;
        c.active = true;
        c.s = 0;
        c.mood = 0.85 + c.rand() * 0.25;
        c.v = c.spec.speed * c.mood * (last ? Math.min(1, last.v / (c.spec.speed * c.mood) + 0.1) : 0.95);
        c.lat = c.spec.lat;
        break; // one entry per lane per step
      }
    }
  }
}

