import { L, type Landmark, type LandmarkSet } from '@/models/landmarks';
import { distance, midpoint, type Point } from './features';

/**
 * Normalised skeletons (§57).
 *
 * We never compare raw screen pixels. A detected body is expressed relative to
 * its own torso: origin at the hip centre, scale from the shoulder-to-hip
 * length. Two people of very different heights performing the same pose produce
 * nearly identical normalised skeletons, which is the whole point (§53).
 */

export interface NormalizedSkeleton {
  /** 33 points in torso-relative space. */
  points: Landmark[];
  origin: Point;
  /** The torso length used as the unit, in the input's own units. */
  scale: number;
  valid: boolean;
}

const EMPTY: NormalizedSkeleton = {
  points: [],
  origin: { x: 0.5, y: 0.5 },
  scale: 0,
  valid: false,
};

export function normalizeSkeleton(pts: LandmarkSet): NormalizedSkeleton {
  const sl = pts[L.LEFT_SHOULDER];
  const sr = pts[L.RIGHT_SHOULDER];
  const hl = pts[L.LEFT_HIP];
  const hr = pts[L.RIGHT_HIP];
  if (!sl || !sr || !hl || !hr) return EMPTY;

  const shoulder = midpoint(sl, sr);
  const hip = midpoint(hl, hr);
  const scale = distance(shoulder, hip);
  if (scale < 1e-5) return EMPTY;

  const points = pts.map((p) => ({
    x: (p.x - hip.x) / scale,
    y: (p.y - hip.y) / scale,
    z: p.z,
    visibility: p.visibility,
  }));

  return { points, origin: hip, scale, valid: true };
}

/**
 * Mean positional difference between two normalised skeletons over the given
 * landmarks, in torso units. Used only for coarse similarity, never for
 * generating instructions — those come from angles.
 */
export function skeletonDistance(
  a: NormalizedSkeleton,
  b: NormalizedSkeleton,
  indices: readonly number[],
): number {
  if (!a.valid || !b.valid) return Infinity;
  let total = 0;
  let n = 0;
  for (const i of indices) {
    const pa = a.points[i];
    const pb = b.points[i];
    if (!pa || !pb) continue;
    total += Math.hypot(pa.x - pb.x, pa.y - pb.y);
    n++;
  }
  return n ? total / n : Infinity;
}
