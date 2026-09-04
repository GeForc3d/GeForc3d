import {
  LANDMARK_GROUPS,
  type LandmarkSet,
  type Side,
} from '@/models/landmarks';
import type { JointTargets, Pose } from '@/models/pose';
import type { Deviation } from '@/guidance/types';
import { extractFeatures, groupVisibility, type PoseFeatures } from './features';

/**
 * Turns the gap between what the camera sees and what the pose asks for into a
 * ranked list of corrections.
 *
 * Two rules shape everything here:
 *
 *   1. The objective is a good photograph, not skeletal replication (§59). A
 *      difference inside the pose's tolerance produces no correction at all.
 *   2. Every instruction about the body uses the SUBJECT'S anatomical left and
 *      right, taken from the landmark index, never from screen position (§72).
 */

export interface MatchInput {
  pose: Pose;
  /** Landmarks in FRAME space: what the user can actually see (§54). */
  frameLandmarks: LandmarkSet;
  /** Optional 3D world landmarks, which make torso yaw far more reliable. */
  worldLandmarks?: LandmarkSet;
}

export interface MatchResult {
  features: PoseFeatures;
  deviations: Deviation[];
  /** Landmark groups this pose needs that are not confidently visible. */
  missingGroups: Array<keyof typeof LANDMARK_GROUPS>;
}

const MIN_GROUP_VISIBILITY = 0.55;

const sideWord = (side: Side) => (side === 'left' ? 'left' : 'right');

type JointKey = keyof JointTargets;

const JOINT_COPY: Record<JointKey, { side: Side; describe: (delta: number) => string }> = {
  leftElbow: {
    side: 'left',
    describe: (d) => (d > 0 ? 'Straighten your left arm a little' : 'Bend your left elbow more'),
  },
  rightElbow: {
    side: 'right',
    describe: (d) => (d > 0 ? 'Straighten your right arm a little' : 'Bend your right elbow more'),
  },
  leftShoulder: {
    side: 'left',
    describe: (d) => (d > 0 ? 'Lift your left arm away from your body' : 'Bring your left arm closer in'),
  },
  rightShoulder: {
    side: 'right',
    describe: (d) =>
      d > 0 ? 'Lift your right arm away from your body' : 'Bring your right arm closer in',
  },
  leftKnee: {
    side: 'left',
    describe: (d) => (d > 0 ? 'Straighten your left leg' : 'Bend your left knee more'),
  },
  rightKnee: {
    side: 'right',
    describe: (d) => (d > 0 ? 'Straighten your right leg' : 'Bend your right knee more'),
  },
  leftHip: {
    side: 'left',
    describe: (d) => (d > 0 ? 'Open your left hip forward' : 'Bring your left hip back'),
  },
  rightHip: {
    side: 'right',
    describe: (d) => (d > 0 ? 'Open your right hip forward' : 'Bring your right hip back'),
  },
};

/** Confidence in a joint reading, from the visibility of the three landmarks. */
function jointConfidence(pts: LandmarkSet, key: JointKey): number {
  const side: Side = key.startsWith('left') ? 'left' : 'right';
  const group = key.includes('Elbow')
    ? ([11, 13, 15] as const)
    : key.includes('Shoulder')
      ? ([11, 13, 23] as const)
      : key.includes('Knee')
        ? ([23, 25, 27] as const)
        : ([11, 23, 25] as const);
  const offset = side === 'right' ? 1 : 0;
  return groupVisibility(pts, [group[0] + offset, group[1] + offset, group[2] + offset]);
}

export function matchPose({ pose, frameLandmarks, worldLandmarks }: MatchInput): MatchResult {
  const features = extractFeatures(frameLandmarks, worldLandmarks);
  const deviations: Deviation[] = [];

  // ---- FIND: does the pose have the body parts it needs to be judged? ----
  const missingGroups = pose.requiredVisibleLandmarks.filter(
    (g) => groupVisibility(frameLandmarks, LANDMARK_GROUPS[g]) < MIN_GROUP_VISIBILITY,
  );

  if (missingGroups.length) {
    const needsLegs = missingGroups.includes('ankles') || missingGroups.includes('knees');
    deviations.push({
      id: 'find-visibility',
      stage: 'find',
      actor: 'camera',
      magnitude: 2,
      weight: 3,
      confidence: 1,
      instruction: needsLegs ? 'Get their whole body in frame' : 'Get more of them in frame',
    });
  }

  // ---- FRAME: composition, before anything about the body ----
  const c = pose.compositionTarget;
  const f = features.frame;
  if (f.height > 0.02) {
    const dx = c.anchorX - f.centreX;
    if (Math.abs(dx) > c.toleranceX) {
      deviations.push({
        id: 'frame-x',
        stage: 'frame',
        actor: 'camera',
        magnitude: Math.abs(dx) / c.toleranceX,
        weight: 1.6,
        confidence: 1,
        // Panning the camera left moves the subject right in the frame.
        instruction: dx > 0 ? 'Move the camera left' : 'Move the camera right',
      });
    }

    const dh = c.subjectHeight - f.height;
    if (Math.abs(dh) > c.toleranceHeight) {
      deviations.push({
        id: 'frame-scale',
        stage: 'frame',
        actor: 'camera',
        magnitude: Math.abs(dh) / c.toleranceHeight,
        weight: 1.8,
        confidence: 1,
        instruction: dh > 0 ? 'Step a little closer' : 'Step back slightly',
      });
    }

    const dy = c.anchorY - f.centreY;
    if (Math.abs(dy) > c.toleranceY) {
      deviations.push({
        id: 'frame-y',
        stage: 'frame',
        actor: 'camera',
        magnitude: Math.abs(dy) / c.toleranceY,
        weight: 1.3,
        confidence: 1,
        // Raising the camera drops the subject down the frame.
        instruction: dy > 0 ? 'Raise the camera slightly' : 'Lower the camera slightly',
      });
    }
  }

  // ---- BODY: torso before limbs ----
  const t = pose.torsoTarget;
  const yawDelta = angleGap(features.torsoYawDeg, t.yawDeg);
  if (
    features.torsoYawConfidence > 0.35 &&
    Math.abs(yawDelta) > t.yawTolerance &&
    pose.poseSignature.torsoDirection !== 'away'
  ) {
    deviations.push({
      id: 'torso-yaw',
      stage: 'body',
      actor: 'subject',
      magnitude: Math.abs(yawDelta) / t.yawTolerance,
      weight: 2.4,
      confidence: features.torsoYawConfidence,
      // Positive target yaw means turning toward the subject's own left.
      instruction:
        yawDelta < 0 ? 'Turn your body slightly left' : 'Turn your body slightly right',
    });
  }

  const leanDelta = features.torsoLeanDeg - t.leanDeg;
  if (Math.abs(leanDelta) > t.leanTolerance) {
    // Lean is measured in image terms, so it is described by where the subject
    // should send their shoulders rather than by an anatomical side.
    deviations.push({
      id: 'torso-lean',
      stage: 'body',
      actor: 'subject',
      magnitude: Math.abs(leanDelta) / t.leanTolerance,
      weight: 2,
      confidence: 0.9,
      instruction:
        leanDelta > 0
          ? 'Bring your shoulders back over your hips'
          : 'Lean your upper body across a little more',
    });
  }

  const h = pose.hipTarget;
  const hipDelta = features.hipTiltDeg - h.tiltDeg;
  if (Math.abs(hipDelta) > h.tolerance && h.weightSide !== 'even') {
    deviations.push({
      id: 'hip-weight',
      stage: 'body',
      actor: 'subject',
      magnitude: Math.abs(hipDelta) / h.tolerance,
      weight: 2.1,
      confidence: 0.85,
      instruction: `Shift your weight onto your ${sideWord(h.weightSide)} leg`,
    });
  }

  // ---- LIMBS ----
  for (const key of Object.keys(pose.jointTargets) as JointKey[]) {
    const target = pose.jointTargets[key];
    if (!target) continue;
    const actual = features[key];
    if (!Number.isFinite(actual)) continue;
    const confidence = jointConfidence(frameLandmarks, key);
    if (confidence < 0.5) continue;
    const delta = actual - target.angle;
    if (Math.abs(delta) <= target.tolerance) continue;
    deviations.push({
      id: `joint-${key}`,
      stage: 'limbs',
      actor: 'subject',
      magnitude: Math.abs(delta) / target.tolerance,
      weight: target.weight,
      confidence,
      instruction: JOINT_COPY[key].describe(delta),
    });
  }

  // ---- HEAD: only when the face is genuinely readable (§65, §73) ----
  const hd = pose.headTarget;
  if (features.headYawConfidence > 0.45) {
    const delta = angleGap(features.headYawDeg, hd.yawDeg);
    if (Math.abs(delta) > hd.yawTolerance) {
      deviations.push({
        id: 'head-yaw',
        stage: 'head',
        actor: 'subject',
        magnitude: Math.abs(delta) / hd.yawTolerance,
        weight: 1.5,
        confidence: features.headYawConfidence,
        instruction: delta < 0 ? 'Turn your head left' : 'Turn your head right',
      });
    }
  }
  if (features.headPitchConfidence > 0.45) {
    const delta = features.headPitchDeg - hd.pitchDeg;
    if (Math.abs(delta) > hd.pitchTolerance) {
      deviations.push({
        id: 'head-pitch',
        stage: 'head',
        actor: 'subject',
        magnitude: Math.abs(delta) / hd.pitchTolerance,
        weight: 1.1,
        confidence: features.headPitchConfidence,
        instruction: delta > 0 ? 'Lift your chin slightly' : 'Chin slightly down',
      });
    }
  }

  return { features, deviations, missingGroups };
}

/** Signed gap between two angles, wrapped so 179 and -179 are 2 degrees apart. */
export function angleGap(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Priority used to choose the single instruction to show (§70). */
export const deviationPriority = (d: Deviation): number =>
  d.magnitude * d.weight * (0.5 + 0.5 * d.confidence);
