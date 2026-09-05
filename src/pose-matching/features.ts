import {
  L,
  ankleOf,
  earOf,
  elbowOf,
  hipOf,
  kneeOf,
  shoulderOf,
  wristOf,
  type Landmark,
  type LandmarkSet,
  type Side,
} from '@/models/landmarks';

/**
 * Geometry shared by target skeletons and live detections. Everything here is
 * scale- and translation-invariant and expressed in the SUBJECT's own frame, so
 * a 155cm person and a 190cm person hit the same numbers for the same pose
 * (§53). The single exception is `frame`, which is deliberately about where the
 * subject sits in the picture and is used only for composition guidance.
 */

export interface Point {
  x: number;
  y: number;
}

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed angle of vector a→b, degrees, 0 = image right, 90 = image down. */
export const vectorAngle = (a: Point, b: Point): number =>
  (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** Interior angle at `vertex` between the two arms, 0..180 degrees. */
export function jointAngle(vertex: Point, a: Point, b: Point): number {
  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = b.x - vertex.x;
  const v2y = b.y - vertex.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-9 || n2 < 1e-9) return 180;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Smallest signed difference a - b wrapped to [-180, 180]. */
export const angleDelta = (a: number, b: number): number => {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export interface FrameGeometry {
  /** Subject centre of mass in normalised frame coordinates. */
  centreX: number;
  centreY: number;
  /** Visible subject height as a fraction of frame height. */
  height: number;
  /** Space above the top of the head, as a fraction of frame height. */
  headroom: number;
  /** Bounding box of the confidently visible landmarks. */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PoseFeatures {
  /** Interior joint angles, keyed by the subject's own side. */
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
  leftKnee: number;
  rightKnee: number;
  leftHip: number;
  rightHip: number;

  /** Torso lean in the image plane. + = leaning toward image right. */
  torsoLeanDeg: number;
  /**
   * Torso rotation about the vertical axis, degrees.
   * + = subject turned toward their own left. Estimated from the ratio of the
   * projected shoulder width to the torso length, which is stable across body
   * shapes but sign-ambiguous in 2D; the sign comes from the face when it is
   * visible, or from 3D world landmarks when the detector supplies them.
   */
  torsoYawDeg: number;
  /** Confidence in `torsoYawDeg`, 0..1. */
  torsoYawConfidence: number;

  /** Hip line tilt. + = the subject's left hip is lower. */
  hipTiltDeg: number;
  /** Shoulder line tilt. + = the subject's left shoulder is lower. */
  shoulderTiltDeg: number;
  /** Lateral offset of the hip centre from the ankle centre, in torso units. */
  hipShift: number;

  /** Head rotation relative to the torso. + = toward the subject's own left. */
  headYawDeg: number;
  headYawConfidence: number;
  /** + = chin toward the chest. */
  headPitchDeg: number;
  headPitchConfidence: number;

  /** Shoulder-centre to hip-centre distance; the natural scale unit. */
  torsoLength: number;
  frame: FrameGeometry;
}

const MIN_VIS = 0.5;

export const isVisible = (p: Landmark | undefined, min = MIN_VIS): boolean =>
  !!p && (p.visibility ?? 1) >= min;

export const visibilityOf = (p: Landmark | undefined): number => p?.visibility ?? 0;

/** Mean visibility across a set of landmark indices. */
export const groupVisibility = (pts: LandmarkSet, indices: readonly number[]): number => {
  if (!indices.length) return 1;
  let sum = 0;
  for (const i of indices) sum += visibilityOf(pts[i]);
  return sum / indices.length;
};

function safeJoint(pts: LandmarkSet, v: number, a: number, b: number): number {
  const pv = pts[v];
  const pa = pts[a];
  const pb = pts[b];
  if (!pv || !pa || !pb) return NaN;
  return jointAngle(pv, pa, pb);
}

/** Elbow interior angle. 180 = straight arm, 90 = right angle. */
const elbowAngle = (pts: LandmarkSet, side: Side) =>
  safeJoint(pts, elbowOf(side), shoulderOf(side), wristOf(side));

/** Arm elevation relative to the torso, measured at the shoulder. */
const shoulderAngle = (pts: LandmarkSet, side: Side) =>
  safeJoint(pts, shoulderOf(side), hipOf(side), elbowOf(side));

const kneeAngle = (pts: LandmarkSet, side: Side) =>
  safeJoint(pts, kneeOf(side), hipOf(side), ankleOf(side));

const hipAngle = (pts: LandmarkSet, side: Side) =>
  safeJoint(pts, hipOf(side), shoulderOf(side), kneeOf(side));

/**
 * The widest shoulder-to-torso ratio observed for the current subject.
 *
 * Torso yaw is read from how much of the shoulder width is still projected, but
 * that ratio depends on build as much as on rotation: broad shoulders read as
 * "less turned" and narrow shoulders as "more turned" against a fixed
 * assumption. Calibrating on the subject in front of the camera removes their
 * build from the estimate entirely, which is what stops a person being coached
 * differently for having a different body (§9).
 */
export class SubjectShapeCalibration {
  /** Canonical ratio, used until the subject has been observed. */
  private ratio = NOMINAL_SHOULDER_RATIO;
  private observed = false;

  observe(pts: LandmarkSet): void {
    const sl = pts[L.LEFT_SHOULDER];
    const sr = pts[L.RIGHT_SHOULDER];
    const hl = pts[L.LEFT_HIP];
    const hr = pts[L.RIGHT_HIP];
    if (!sl || !sr || !hl || !hr) return;
    if (Math.min(visibilityOf(sl), visibilityOf(sr)) < 0.6) return;
    const torso = distance(midpoint(sl, sr), midpoint(hl, hr));
    if (torso < 1e-5) return;
    const ratio = distance(sl, sr) / torso;
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    // The widest projection seen is the closest this subject has come to
    // square-on, which is the only reading that reflects their build alone.
    if (!this.observed || ratio > this.ratio) {
      this.ratio = ratio;
      this.observed = true;
    }
  }

  get(): number {
    return this.ratio;
  }

  reset(): void {
    this.ratio = NOMINAL_SHOULDER_RATIO;
    this.observed = false;
  }
}

/** Shoulder width over torso length for the canonical figure. */
export const NOMINAL_SHOULDER_RATIO = 0.2 / 0.28;

/**
 * Estimates torso yaw from the projected shoulder width. A front-on torso
 * projects its full shoulder width; a profile projects almost none. The
 * reference ratio is the subject's own when one has been observed, so build
 * does not masquerade as rotation.
 */
export function estimateTorsoYaw(
  pts: LandmarkSet,
  world?: LandmarkSet,
  shoulderRatio = NOMINAL_SHOULDER_RATIO,
): { yawDeg: number; confidence: number } {
  const sl = pts[L.LEFT_SHOULDER];
  const sr = pts[L.RIGHT_SHOULDER];
  const hl = pts[L.LEFT_HIP];
  const hr = pts[L.RIGHT_HIP];
  if (!sl || !sr || !hl || !hr) return { yawDeg: 0, confidence: 0 };

  // 3D world landmarks give the sign and magnitude directly and are far more
  // reliable. Use them whenever the detector provides them.
  if (world) {
    const wsl = world[L.LEFT_SHOULDER];
    const wsr = world[L.RIGHT_SHOULDER];
    if (wsl && wsr) {
      const dx = wsl.x - wsr.x;
      const dz = (wsl.z ?? 0) - (wsr.z ?? 0);
      if (Math.hypot(dx, dz) > 1e-4) {
        // Subject-left shoulder moving away from camera (+z) means the subject
        // has turned toward their own left.
        const yaw = (Math.atan2(dz, dx) * 180) / Math.PI;
        const vis = Math.min(visibilityOf(wsl) || 1, visibilityOf(wsr) || 1);
        return { yawDeg: clampAngle(yaw), confidence: Math.min(1, 0.55 + 0.45 * vis) };
      }
    }
  }

  const shoulderSpan = distance(sl, sr);
  const torso = distance(midpoint(sl, sr), midpoint(hl, hr));
  if (torso < 1e-6) return { yawDeg: 0, confidence: 0 };
  const ratio = Math.min(1, shoulderSpan / torso / Math.max(shoulderRatio, 1e-6));
  const magnitude = (Math.acos(ratio) * 180) / Math.PI;

  // The sign is recovered from the face: a head turned toward the subject's own
  // left brings their right ear forward and pushes the nose to image right.
  const nose = pts[L.NOSE];
  const earL = pts[L.LEFT_EAR];
  const earR = pts[L.RIGHT_EAR];
  let sign = 0;
  if (isVisible(nose, 0.4) && (isVisible(earL, 0.3) || isVisible(earR, 0.3))) {
    const visL = visibilityOf(earL);
    const visR = visibilityOf(earR);
    if (Math.abs(visL - visR) > 0.2) sign = visL < visR ? 1 : -1;
    else if (earL && earR) {
      const headCentre = midpoint(earL, earR);
      sign = nose!.x > headCentre.x ? 1 : -1;
    }
  }
  const confidence = sign === 0 ? 0.25 : Math.min(0.7, 0.3 + magnitude / 90);
  return { yawDeg: clampAngle(magnitude * (sign || 1)), confidence: sign === 0 ? 0.15 : confidence };
}

const clampAngle = (a: number) => Math.max(-180, Math.min(180, a));

/**
 * Head yaw relative to the torso, from the nose's offset within the ear span.
 * Deliberately coarse: at full-body photography distance, face landmarks are
 * small and noisy, so this is gated hard by confidence downstream (§65, §73).
 */
export function estimateHeadYaw(pts: LandmarkSet): { yawDeg: number; confidence: number } {
  const nose = pts[L.NOSE];
  const earL = pts[earOf('left')];
  const earR = pts[earOf('right')];
  if (!nose || !earL || !earR) return { yawDeg: 0, confidence: 0 };

  const visN = visibilityOf(nose);
  const visL = visibilityOf(earL);
  const visR = visibilityOf(earR);
  if (visN < 0.5) return { yawDeg: 0, confidence: 0 };

  const span = distance(earL, earR);
  const headScale = Math.max(span, 1e-6);

  // Strong occlusion of one ear is the clearest profile signal available.
  if (visL < 0.25 && visR > 0.6) return { yawDeg: 75, confidence: 0.6 };
  if (visR < 0.25 && visL > 0.6) return { yawDeg: -75, confidence: 0.6 };

  const centre = midpoint(earL, earR);
  const offset = (nose.x - centre.x) / headScale; // roughly -0.5..0.5
  const yaw = clampAngle(offset * 160);
  const confidence = Math.min(0.75, Math.min(visL, visR) * 0.9) * (span > 1e-4 ? 1 : 0);
  return { yawDeg: yaw, confidence };
}

/** Chin-down/up relative to the ear line. */
export function estimateHeadPitch(pts: LandmarkSet): { pitchDeg: number; confidence: number } {
  const nose = pts[L.NOSE];
  const earL = pts[earOf('left')];
  const earR = pts[earOf('right')];
  const sl = pts[L.LEFT_SHOULDER];
  const sr = pts[L.RIGHT_SHOULDER];
  if (!nose || !earL || !earR || !sl || !sr) return { pitchDeg: 0, confidence: 0 };
  const earCentre = midpoint(earL, earR);
  const shoulderCentre = midpoint(sl, sr);
  const neck = distance(earCentre, shoulderCentre);
  if (neck < 1e-6) return { pitchDeg: 0, confidence: 0 };
  const drop = (nose.y - earCentre.y) / neck;
  const pitch = clampAngle(drop * 120);
  const confidence = Math.min(0.7, Math.min(visibilityOf(earL), visibilityOf(earR)));
  return { pitchDeg: pitch, confidence };
}

/** Bounding geometry over the landmarks the caller considers relevant. */
export function frameGeometry(pts: LandmarkSet, indices: readonly number[]): FrameGeometry {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (const i of indices) {
    const p = pts[i];
    if (!isVisible(p, 0.35)) continue;
    minX = Math.min(minX, p!.x);
    maxX = Math.max(maxX, p!.x);
    minY = Math.min(minY, p!.y);
    maxY = Math.max(maxY, p!.y);
    sx += p!.x;
    sy += p!.y;
    n++;
  }
  if (!n) {
    return {
      centreX: 0.5,
      centreY: 0.5,
      height: 0,
      headroom: 0,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };
  }
  return {
    centreX: sx / n,
    centreY: sy / n,
    height: maxY - minY,
    headroom: minY,
    top: minY,
    bottom: maxY,
    left: minX,
    right: maxX,
  };
}

export const ALL_BODY_INDICES: readonly number[] = [
  L.NOSE,
  L.LEFT_SHOULDER,
  L.RIGHT_SHOULDER,
  L.LEFT_ELBOW,
  L.RIGHT_ELBOW,
  L.LEFT_WRIST,
  L.RIGHT_WRIST,
  L.LEFT_HIP,
  L.RIGHT_HIP,
  L.LEFT_KNEE,
  L.RIGHT_KNEE,
  L.LEFT_ANKLE,
  L.RIGHT_ANKLE,
];

export function extractFeatures(
  pts: LandmarkSet,
  world?: LandmarkSet,
  shoulderRatio = NOMINAL_SHOULDER_RATIO,
): PoseFeatures {
  const sl = pts[L.LEFT_SHOULDER];
  const sr = pts[L.RIGHT_SHOULDER];
  const hl = pts[L.LEFT_HIP];
  const hr = pts[L.RIGHT_HIP];

  const shoulderCentre = sl && sr ? midpoint(sl, sr) : { x: 0.5, y: 0.4 };
  const hipCentre = hl && hr ? midpoint(hl, hr) : { x: 0.5, y: 0.6 };
  const torsoLength = distance(shoulderCentre, hipCentre);

  // Lean: the hip→shoulder vector against vertical. Straight up is -90 degrees
  // in image angle terms, so a positive result means leaning to image right.
  const torsoLeanDeg = sl && sr && hl && hr ? vectorAngle(hipCentre, shoulderCentre) + 90 : 0;

  const yaw = estimateTorsoYaw(pts, world, shoulderRatio);
  const head = estimateHeadYaw(pts);
  const pitch = estimateHeadPitch(pts);

  const hipTiltDeg = hl && hr ? vectorAngle(hr, hl) : 0;
  const shoulderTiltDeg = sl && sr ? vectorAngle(sr, sl) : 0;

  const al = pts[L.LEFT_ANKLE];
  const ar = pts[L.RIGHT_ANKLE];
  const ankleCentre = al && ar && isVisible(al, 0.4) && isVisible(ar, 0.4) ? midpoint(al, ar) : null;
  const hipShift =
    ankleCentre && torsoLength > 1e-6 ? (hipCentre.x - ankleCentre.x) / torsoLength : 0;

  return {
    leftElbow: elbowAngle(pts, 'left'),
    rightElbow: elbowAngle(pts, 'right'),
    leftShoulder: shoulderAngle(pts, 'left'),
    rightShoulder: shoulderAngle(pts, 'right'),
    leftKnee: kneeAngle(pts, 'left'),
    rightKnee: kneeAngle(pts, 'right'),
    leftHip: hipAngle(pts, 'left'),
    rightHip: hipAngle(pts, 'right'),
    torsoLeanDeg,
    torsoYawDeg: yaw.yawDeg,
    torsoYawConfidence: yaw.confidence,
    hipTiltDeg,
    shoulderTiltDeg,
    hipShift,
    // Absolute head yaw in the image, NOT torso-relative. Subtracting the
    // torso estimate only when it happened to be confident put the measurement
    // in a different space from the target depending on the frame. Head is
    // evaluated after the torso already matches, so absolute is the right
    // comparison and it is stable.
    headYawDeg: head.yawDeg,
    headYawConfidence: Math.min(head.confidence, 0.75),
    headPitchDeg: pitch.pitchDeg,
    headPitchConfidence: pitch.confidence,
    torsoLength,
    frame: frameGeometry(pts, ALL_BODY_INDICES),
  };
}
