import type { Pose } from '@/models/pose';
import type { LandmarkSet } from '@/models/landmarks';
import { deviationPriority, matchPose } from '@/pose-matching/matcher';
import type { Deviation, GuidanceOutput, GuidanceStage } from './types';
import { STAGE_ORDER } from './types';

/**
 * The guidance state machine (§60, §68, §69, §70).
 *
 * Its job is to say ONE useful thing at a time, and to keep saying it long
 * enough to be actionable. Three mechanisms do that work:
 *
 *   Dead bands   — a deviation must exceed its tolerance to be raised at all,
 *                  and must fall well below it to be considered cleared.
 *   Dwell        — an instruction stays on screen for a minimum time before
 *                  anything is allowed to replace it.
 *   Displacement — a competing instruction must be meaningfully more important
 *                  than the current one, not merely one frame luckier.
 */

export interface GuidanceConfig {
  /** Below this multiple of tolerance, a deviation is considered cleared. */
  exitThreshold: number;
  /** Minimum time an instruction stays before it can be replaced, ms. */
  minInstructionMs: number;
  /** How much more important a rival must be to take over. */
  displacementRatio: number;
  /** Continuous good time required to enter HOLD, ms. */
  holdEnterMs: number;
  /** Deviation magnitude that breaks HOLD once entered. */
  holdExitMagnitude: number;
  /** Frames of no detection before we admit we cannot see anyone. */
  lostSubjectMs: number;
}

export const DEFAULT_GUIDANCE_CONFIG: GuidanceConfig = {
  exitThreshold: 0.78,
  minInstructionMs: 1100,
  displacementRatio: 1.35,
  holdEnterMs: 650,
  holdExitMagnitude: 1.25,
  lostSubjectMs: 700,
};

export interface GuidanceInput {
  pose: Pose;
  /** Smoothed landmarks per detected person, in FRAME space. */
  people: LandmarkSet[];
  worldLandmarks?: LandmarkSet;
  now: number;
}

interface Held {
  deviation: Deviation;
  since: number;
}

export class GuidanceEngine {
  private held: Held | null = null;
  private goodSince: number | null = null;
  private inHold = false;
  private lastSeen = 0;
  private started = 0;

  constructor(private readonly config: GuidanceConfig = DEFAULT_GUIDANCE_CONFIG) {}

  reset(now = 0): void {
    this.held = null;
    this.goodSince = null;
    this.inHold = false;
    this.lastSeen = 0;
    this.started = now;
  }

  evaluate(input: GuidanceInput): GuidanceOutput {
    const { pose, people, now } = input;
    const expected = pose.targetSubjects.length;

    // ---- FIND ----
    if (!people.length) {
      if (!this.lastSeen) this.lastSeen = this.started || now;
      const lostFor = now - this.lastSeen;
      if (lostFor > this.config.lostSubjectMs) {
        this.held = null;
        this.goodSince = null;
        this.inHold = false;
        return {
          stage: 'find',
          instruction: { actor: 'camera', text: 'Point the camera at them', id: 'find-none' },
          hold: false,
          subjectCount: 0,
          blocked: null,
        };
      }
      // Inside the grace window we keep whatever we were saying rather than
      // flashing a new message for one dropped frame.
      return this.current(now, 'find', 0);
    }
    this.lastSeen = now;

    if (people.length < expected) {
      return this.raise(
        {
          id: 'find-count',
          stage: 'find',
          actor: 'camera',
          magnitude: 2,
          weight: 3,
          confidence: 1,
          instruction:
            expected === 2
              ? 'Both of them need to be in frame'
              : `Get all ${expected} of them in frame`,
        },
        now,
        people.length,
      );
    }

    // v1 guides the primary subject's body; extra people are guided by
    // placement and the visual guide (§89). We say nothing we cannot back up.
    const primary = people[0];
    const { deviations } = matchPose({
      pose,
      frameLandmarks: primary,
      worldLandmarks: input.worldLandmarks,
    });

    const active = deviations.filter((d) => d.magnitude > 1);
    const worst = active.reduce(
      (max, d) => Math.max(max, d.magnitude),
      0,
    );

    // ---- HOLD ----
    const settled = this.inHold
      ? worst < this.config.holdExitMagnitude
      : active.length === 0;

    if (settled) {
      if (this.goodSince == null) this.goodSince = now;
      if (this.inHold || now - this.goodSince >= this.config.holdEnterMs) {
        this.inHold = true;
        this.held = null;
        return {
          stage: 'hold',
          instruction: null,
          hold: true,
          subjectCount: people.length,
          blocked: null,
        };
      }
    } else {
      this.goodSince = null;
      this.inHold = false;
    }

    // ---- Ordered stages: fix the earliest stage that still has a problem ----
    const stage = earliestStage(active);
    const candidates = active.filter((d) => d.stage === stage);
    if (!candidates.length) return this.current(now, stage, people.length);

    const best = candidates.reduce((a, b) =>
      deviationPriority(b) > deviationPriority(a) ? b : a,
    );

    return this.raise(best, now, people.length);
  }

  /**
   * Applies dwell and displacement before letting a new instruction through.
   */
  private raise(next: Deviation, now: number, subjectCount: number): GuidanceOutput {
    const held = this.held;

    if (held) {
      const sameThing = held.deviation.id === next.id;
      const elapsed = now - held.since;

      if (sameThing) {
        // Refresh the text but keep the clock running, so wording that depends
        // on the direction of the error can update without resetting dwell.
        held.deviation = next;
      } else if (elapsed < this.config.minInstructionMs) {
        return this.output(held.deviation, subjectCount);
      } else if (
        deviationPriority(next) <
        deviationPriority(held.deviation) * this.config.displacementRatio
      ) {
        return this.output(held.deviation, subjectCount);
      } else {
        this.held = { deviation: next, since: now };
      }
    } else {
      this.held = { deviation: next, since: now };
    }

    this.inHold = false;
    this.goodSince = null;
    return this.output(this.held!.deviation, subjectCount);
  }

  /** Keeps showing whatever is current, used when a frame adds nothing. */
  private current(now: number, stage: GuidanceStage, subjectCount: number): GuidanceOutput {
    if (this.held && now - this.held.since < this.config.minInstructionMs * 2) {
      return this.output(this.held.deviation, subjectCount);
    }
    return {
      stage,
      instruction: null,
      hold: this.inHold,
      subjectCount,
      blocked: null,
    };
  }

  private output(d: Deviation, subjectCount: number): GuidanceOutput {
    return {
      stage: d.stage,
      instruction: { actor: d.actor, text: d.instruction, id: d.id },
      hold: false,
      subjectCount,
      blocked: null,
    };
  }
}

function earliestStage(deviations: Deviation[]): GuidanceStage {
  let best: GuidanceStage = 'refine';
  let bestOrder = Infinity;
  for (const d of deviations) {
    const order = STAGE_ORDER[d.stage];
    if (order < bestOrder) {
      bestOrder = order;
      best = d.stage;
    }
  }
  return best;
}
