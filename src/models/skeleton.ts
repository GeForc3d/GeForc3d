import { L, LANDMARK_COUNT, type Landmark, type LandmarkSet } from './landmarks';
import type { BodyProportions } from './representation';

/**
 * Target skeletons are authored through a small forward-kinematic rig rather
 * than by typing 33 coordinate pairs per pose. Authoring in joint angles keeps
 * every pose anatomically consistent, makes near-duplicate detection possible,
 * and gives the silhouette renderer and the matcher a shared source of truth.
 *
 * Image convention throughout: x increases to the right, y increases DOWNWARD,
 * z increases AWAY from the camera. Angles are degrees measured clockwise on
 * screen from the +x axis, so 90 = straight down, -90 = straight up, 0 = to the
 * image right.
 *
 * Yaw convention: `yawDeg > 0` means the subject rotates toward their own LEFT,
 * which swings their nose toward image-right and brings their RIGHT ear into
 * view. Derived in `skeleton.test.ts`.
 */

/**
 * Canonical segment lengths as fractions of nominal standing height. A
 * representation scales these to draw a different body; the matcher always uses
 * the canonical figure, so proportions never affect scoring (§9).
 */
export interface SegmentLengths {
  shoulderWidth: number;
  hipWidth: number;
  torso: number;
  neck: number;
  headRadius: number;
  upperArm: number;
  forearm: number;
  thigh: number;
  shin: number;
  foot: number;
}

export const PROPORTIONS: SegmentLengths = {
  shoulderWidth: 0.2,
  hipWidth: 0.135,
  torso: 0.28,
  neck: 0.135,
  headRadius: 0.072,
  upperArm: 0.16,
  forearm: 0.15,
  thigh: 0.245,
  shin: 0.235,
  foot: 0.06,
};

export interface Vec2 {
  x: number;
  y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export const polar = (from: Vec2, angleDeg: number, length: number): Vec2 => ({
  x: from.x + Math.cos(rad(angleDeg)) * length,
  y: from.y + Math.sin(rad(angleDeg)) * length,
});

export const rotateAround = (p: Vec2, origin: Vec2, angleDeg: number): Vec2 => {
  const c = Math.cos(rad(angleDeg));
  const s = Math.sin(rad(angleDeg));
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
};

/** One limb chain: two angles in image degrees. */
export interface LimbSpec {
  /** Shoulder→elbow, or hip→knee. 90 = straight down. */
  upper: number;
  /** Elbow→wrist, or knee→ankle. 90 = straight down. */
  lower: number;
  /** Optional shortening to convey the limb pointing toward/away from camera. */
  foreshorten?: number;
}

export interface RigSpec {
  /** Whole-body rotation about the vertical axis. + = subject turns to their own left. */
  yawDeg?: number;
  /** Lateral lean of the torso in the image plane. + = leaning toward image right. */
  leanDeg?: number;
  /**
   * Rotates the WHOLE figure about the hip centre once it is built. Lean tips
   * the torso relative to the legs; this tips everything together, which is what
   * lying poses need. Negative rotates the head toward image left.
   */
  rotateDeg?: number;
  /** Contrapposto hip push as a fraction of hip width. + = hips toward image right. */
  hipShift?: number;
  /** Shoulder line tilt. + = subject's left shoulder drops. */
  shoulderTiltDeg?: number;
  /** Hip line tilt. + = subject's left hip drops. */
  hipTiltDeg?: number;
  /** Head rotation relative to the torso. + = toward the subject's own left. */
  headYawDeg?: number;
  /** + = chin down. */
  headPitchDeg?: number;
  /** + = head tips toward image right. */
  headRollDeg?: number;
  /** Subject's own left arm. */
  armL: LimbSpec;
  /** Subject's own right arm. */
  armR: LimbSpec;
  /** Subject's own left leg. */
  legL: LimbSpec;
  /** Subject's own right leg. */
  legR: LimbSpec;
  /**
   * Vertical compression of the leg chain, for seated and lying poses where the
   * FK chain is authored in the image plane but the body is folded in depth.
   */
  legScale?: number;
}

const clone = (p: Vec2): Landmark => ({ x: p.x, y: p.y, z: 0, visibility: 1 });

/**
 * Builds a 33-point landmark set from a rig spec, in an arbitrary unit space.
 * `normaliseSkeleton` maps it into the 0..1 preview box afterwards.
 */
export function buildSkeleton(spec: RigSpec, body?: BodyProportions): LandmarkSet {
  const P = body ? scaleProportions(body) : PROPORTIONS;
  const yaw = spec.yawDeg ?? 0;
  const lean = spec.leanDeg ?? 0;
  const legScale = spec.legScale ?? 1;

  const hipCentre: Vec2 = { x: (spec.hipShift ?? 0) * P.hipWidth, y: 0 };

  // Hip line, tilted then leaned with the torso.
  const hipTilt = spec.hipTiltDeg ?? 0;
  const hipL = polar(hipCentre, 0 + hipTilt, P.hipWidth / 2);
  const hipR = polar(hipCentre, 180 + hipTilt, P.hipWidth / 2);

  // Torso.
  const shoulderCentre = polar(hipCentre, -90 + lean, P.torso);
  const shTilt = (spec.shoulderTiltDeg ?? 0) + lean;
  const shL = polar(shoulderCentre, 0 + shTilt, P.shoulderWidth / 2);
  const shR = polar(shoulderCentre, 180 + shTilt, P.shoulderWidth / 2);

  // Arms hang from the shoulders using authored image angles.
  const armChain = (shoulder: Vec2, s: LimbSpec) => {
    const f = s.foreshorten ?? 1;
    const elbow = polar(shoulder, s.upper, P.upperArm * f);
    const wrist = polar(elbow, s.lower, P.forearm * f);
    return { elbow, wrist };
  };
  const aL = armChain(shL, spec.armL);
  const aR = armChain(shR, spec.armR);

  const legChain = (hip: Vec2, s: LimbSpec) => {
    const f = (s.foreshorten ?? 1) * legScale;
    const knee = polar(hip, s.upper, P.thigh * f);
    const ankle = polar(knee, s.lower, P.shin * f);
    const heel = polar(ankle, s.lower - 90, P.foot * 0.35);
    const toe = polar(ankle, s.lower - 155, P.foot);
    return { knee, ankle, heel, toe };
  };
  const lL = legChain(hipL, spec.legL);
  const lR = legChain(hipR, spec.legR);

  // Head as a rigid sphere rotated by the combined body + head yaw. Points on
  // the head are (lateral, vertical, forward) in the head's own frame and are
  // projected with the same rotation used for the torso.
  const yawTotal = yaw + (spec.headYawDeg ?? 0);
  const roll = lean + (spec.headRollDeg ?? 0);
  const pitch = spec.headPitchDeg ?? 0;
  const headCentre = polar(shoulderCentre, -90 + roll, P.neck);
  const r = P.headRadius;
  const cy = Math.cos(rad(yawTotal));
  const sy = Math.sin(rad(yawTotal));

  /** lat = toward the subject's own left; fwd = toward the camera. */
  const headPoint = (lat: number, up: number, fwd: number): Vec2 => {
    const x = lat * cy + fwd * sy;
    const y = -up + (pitch / 90) * r * 0.6;
    return rotateAround({ x: headCentre.x + x, y: headCentre.y + y }, headCentre, roll);
  };

  const nose = headPoint(0, -0.05 * r, 0.95 * r);
  const eyeL = headPoint(0.34 * r, 0.24 * r, 0.85 * r);
  const eyeR = headPoint(-0.34 * r, 0.24 * r, 0.85 * r);
  const earL = headPoint(0.92 * r, 0.1 * r, 0);
  const earR = headPoint(-0.92 * r, 0.1 * r, 0);
  const mouthL = headPoint(0.24 * r, -0.36 * r, 0.85 * r);
  const mouthR = headPoint(-0.24 * r, -0.36 * r, 0.85 * r);

  // Lateral foreshortening for the body under yaw, about the body centreline.
  // This uses the BODY yaw only. `cy` above folds in the head yaw and belongs
  // to the head alone; using it here would make a turned head shrink the torso.
  const axis = hipCentre.x;
  const bodyC = Math.cos(rad(yaw));
  const squash = (p: Vec2): Vec2 => ({ x: axis + (p.x - axis) * bodyC, y: p.y });

  const spin = spec.rotateDeg ?? 0;
  const pts: Landmark[] = new Array(LANDMARK_COUNT);
  const set = (i: number, p: Vec2, vis = 1) => {
    const q = spin ? rotateAround(p, hipCentre, spin) : p;
    pts[i] = { ...clone(q), visibility: vis };
  };

  set(L.NOSE, nose);
  set(L.LEFT_EYE, eyeL, visibilityForYaw(yawTotal, 'left', 'eye'));
  set(L.LEFT_EYE_INNER, eyeL, visibilityForYaw(yawTotal, 'left', 'eye'));
  set(L.LEFT_EYE_OUTER, eyeL, visibilityForYaw(yawTotal, 'left', 'eye'));
  set(L.RIGHT_EYE, eyeR, visibilityForYaw(yawTotal, 'right', 'eye'));
  set(L.RIGHT_EYE_INNER, eyeR, visibilityForYaw(yawTotal, 'right', 'eye'));
  set(L.RIGHT_EYE_OUTER, eyeR, visibilityForYaw(yawTotal, 'right', 'eye'));
  set(L.LEFT_EAR, earL, visibilityForYaw(yawTotal, 'left', 'ear'));
  set(L.RIGHT_EAR, earR, visibilityForYaw(yawTotal, 'right', 'ear'));
  set(L.MOUTH_LEFT, mouthL);
  set(L.MOUTH_RIGHT, mouthR);

  set(L.LEFT_SHOULDER, squash(shL));
  set(L.RIGHT_SHOULDER, squash(shR));
  set(L.LEFT_ELBOW, squash(aL.elbow));
  set(L.RIGHT_ELBOW, squash(aR.elbow));
  set(L.LEFT_WRIST, squash(aL.wrist));
  set(L.RIGHT_WRIST, squash(aR.wrist));
  set(L.LEFT_PINKY, squash(aL.wrist));
  set(L.RIGHT_PINKY, squash(aR.wrist));
  set(L.LEFT_INDEX, squash(aL.wrist));
  set(L.RIGHT_INDEX, squash(aR.wrist));
  set(L.LEFT_THUMB, squash(aL.wrist));
  set(L.RIGHT_THUMB, squash(aR.wrist));

  set(L.LEFT_HIP, squash(hipL));
  set(L.RIGHT_HIP, squash(hipR));
  set(L.LEFT_KNEE, squash(lL.knee));
  set(L.RIGHT_KNEE, squash(lR.knee));
  set(L.LEFT_ANKLE, squash(lL.ankle));
  set(L.RIGHT_ANKLE, squash(lR.ankle));
  set(L.LEFT_HEEL, squash(lL.heel));
  set(L.RIGHT_HEEL, squash(lR.heel));
  set(L.LEFT_FOOT_INDEX, squash(lL.toe));
  set(L.RIGHT_FOOT_INDEX, squash(lR.toe));

  return pts;
}

/**
 * A facial landmark on the far side of a turned head is occluded. We express
 * that as reduced visibility so downstream guidance treats it as unreliable,
 * exactly as MediaPipe would report it.
 */
function visibilityForYaw(yawDeg: number, side: 'left' | 'right', kind: 'ear' | 'eye'): number {
  // Subject's left features rotate away from camera as yaw increases.
  const signed = side === 'left' ? yawDeg : -yawDeg;
  const threshold = kind === 'ear' ? 55 : 80;
  if (signed <= 0) return 1;
  if (signed >= threshold) return 0.1;
  return 1 - 0.9 * (signed / threshold);
}

export interface NormalisedSkeletonBox {
  /** Fraction of the preview box height the body occupies. */
  heightFraction: number;
  /** Horizontal centre of the body within the preview box, 0..1. */
  centreX: number;
  /** Vertical centre of the body within the preview box, 0..1. */
  centreY: number;
  /**
   * Widest the figure may become. Wide poses (legs extended, lying down) are
   * scaled to fit rather than allowed to run off the edge of the preview.
   */
  maxWidthFraction?: number;
}

/**
 * Maps a rig-space skeleton into the pose's own 0..1 preview box, honouring the
 * pose's intended placement within the frame (§78 composition anchors).
 */
export function normaliseSkeleton(pts: LandmarkSet, box: NormalisedSkeletonBox): LandmarkSet {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const h = Math.max(maxY - minY, 1e-6);
  const w = Math.max(maxX - minX, 1e-6);
  const scale = Math.min(box.heightFraction / h, (box.maxWidthFraction ?? 0.9) / w);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return pts.map((p) => ({
    x: box.centreX + (p.x - cx) * scale,
    y: box.centreY + (p.y - cy) * scale,
    z: p.z ?? 0,
    visibility: p.visibility ?? 1,
  }));
}

export const buildTargetSkeleton = (
  spec: RigSpec,
  box: NormalisedSkeletonBox,
  body?: BodyProportions,
): LandmarkSet => normaliseSkeleton(buildSkeleton(spec, body), box);

/** Applies a representation's multipliers to the canonical segment lengths. */
function scaleProportions(body: BodyProportions): SegmentLengths {
  return {
    shoulderWidth: PROPORTIONS.shoulderWidth * body.shoulderWidth,
    hipWidth: PROPORTIONS.hipWidth * body.hipWidth,
    torso: PROPORTIONS.torso * body.torso,
    neck: PROPORTIONS.neck * body.neck,
    headRadius: PROPORTIONS.headRadius * body.headRadius,
    upperArm: PROPORTIONS.upperArm * body.limb,
    forearm: PROPORTIONS.forearm * body.limb,
    thigh: PROPORTIONS.thigh * body.limb,
    shin: PROPORTIONS.shin * body.limb,
    foot: PROPORTIONS.foot * body.limb,
  };
}
