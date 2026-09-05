/**
 * Body representation, kept strictly separate from pose concept (§5, §8).
 *
 * "Beach Lookback on a petite person" and "Beach Lookback on a taller person"
 * are ONE pose with two representations, never two poses. Family, signature,
 * scene compatibility and matcher targets all belong to the pose and are
 * unaffected by which body it is demonstrated on.
 *
 * Representation changes what the user SEES. It never changes what the computer
 * vision COMPARES: matching works on joint angles and torso-relative geometry,
 * so a subject is never scored down for having a different build from the
 * reference (§9).
 */

import type { LandmarkSet } from './landmarks';

export const REPRESENTATION_TYPES = [
  'petite',
  'average',
  'tall',
  'curvy',
  'plus',
  'athletic',
] as const;

export type RepresentationType = (typeof REPRESENTATION_TYPES)[number];

export const REPRESENTATION_LABELS: Record<RepresentationType, string> = {
  petite: 'Petite',
  average: 'Average',
  tall: 'Tall',
  curvy: 'Curvy',
  plus: 'Plus size',
  athletic: 'Athletic',
};

/**
 * Multipliers on the canonical rig. `mass` widens the drawn body without
 * touching joint positions, so it changes the picture and nothing the matcher
 * reads.
 */
export interface BodyProportions {
  shoulderWidth: number;
  hipWidth: number;
  torso: number;
  limb: number;
  neck: number;
  headRadius: number;
  /** Silhouette thickness. Visual only. */
  mass: number;
}

export const BODY_PROPORTIONS: Record<RepresentationType, BodyProportions> = {
  petite: {
    shoulderWidth: 0.94,
    hipWidth: 1.0,
    torso: 0.96,
    limb: 0.92,
    neck: 0.95,
    headRadius: 1.06,
    mass: 0.94,
  },
  average: {
    shoulderWidth: 1,
    hipWidth: 1,
    torso: 1,
    limb: 1,
    neck: 1,
    headRadius: 1,
    mass: 1,
  },
  tall: {
    shoulderWidth: 1.02,
    hipWidth: 0.97,
    torso: 1.04,
    limb: 1.1,
    neck: 1.06,
    headRadius: 0.94,
    mass: 0.95,
  },
  curvy: {
    shoulderWidth: 0.99,
    hipWidth: 1.2,
    torso: 0.98,
    limb: 0.98,
    neck: 0.98,
    headRadius: 1.0,
    mass: 1.16,
  },
  plus: {
    shoulderWidth: 1.08,
    hipWidth: 1.26,
    torso: 0.99,
    limb: 0.97,
    neck: 1.02,
    headRadius: 1.0,
    mass: 1.34,
  },
  athletic: {
    shoulderWidth: 1.1,
    hipWidth: 0.96,
    torso: 1.0,
    limb: 1.02,
    neck: 1.0,
    headRadius: 0.97,
    mass: 1.04,
  },
};

/**
 * One human reference for a pose. Three distinct assets serving three distinct
 * jobs (§2), never one asset doing all three.
 */
export interface PoseRepresentation {
  id: string;
  representationType: RepresentationType;
  /** Photograph of the finished shot. Null until real photography exists. */
  previewImage: string | null;
  /** Transparent cutout for positioning over the live camera. */
  overlayImage: string | null;
  /** Rendered geometry for this body, one entry per person in the pose. */
  targetSkeletons: LandmarkSet[];
  /** True while the visible reference is a development render, not a photo. */
  isPlaceholder: boolean;
}

/**
 * Which body a pose is shown on by default.
 *
 * `diverse` spreads representations across the catalogue so the library visibly
 * covers more than one body type without ever asking the user for theirs (§7).
 */
export type ReferencePreference = { mode: 'diverse' } | { mode: 'fixed'; type: RepresentationType };

export const DEFAULT_REFERENCE_PREFERENCE: ReferencePreference = { mode: 'diverse' };

/** Stable, evenly spread pick so a pose always shows the same body by default. */
export function diverseRepresentationFor(poseId: string): RepresentationType {
  let hash = 0;
  for (let i = 0; i < poseId.length; i++) hash = (hash * 31 + poseId.charCodeAt(i)) >>> 0;
  return REPRESENTATION_TYPES[hash % REPRESENTATION_TYPES.length];
}
