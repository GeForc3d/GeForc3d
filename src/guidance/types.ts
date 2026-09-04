/**
 * Ordered guidance stages (§60). A correction is only considered once every
 * earlier stage is good enough: there is no point tidying a wrist while the
 * subject is half out of frame.
 */
export const STAGES = ['find', 'frame', 'body', 'limbs', 'head', 'refine', 'hold'] as const;
export type GuidanceStage = (typeof STAGES)[number];

export const STAGE_ORDER: Record<GuidanceStage, number> = {
  find: 0,
  frame: 1,
  body: 2,
  limbs: 3,
  head: 4,
  refine: 5,
  hold: 6,
};

export type Actor = 'camera' | 'subject';

export interface Deviation {
  /** Stable id, used for hysteresis so the same correction is not restarted. */
  id: string;
  stage: GuidanceStage;
  actor: Actor;
  /**
   * Error relative to this item's own tolerance. 1.0 means exactly at the
   * tolerance boundary; below 1.0 is good enough to ignore.
   */
  magnitude: number;
  /** Importance in this pose, from the pose's own joint weights. */
  weight: number;
  /** How sure we are the underlying measurement is real, 0..1. */
  confidence: number;
  instruction: string;
}

export interface GuidanceOutput {
  stage: GuidanceStage;
  /** The single correction being shown, or null when nothing needs saying. */
  instruction: { actor: Actor; text: string; id: string } | null;
  /** True once the pose has been close enough for long enough (§69). */
  hold: boolean;
  /** How many people the detector currently sees. */
  subjectCount: number;
  /** Present when guidance cannot run and the user should be told why. */
  blocked: string | null;
}
