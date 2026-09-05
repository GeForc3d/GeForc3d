import type { LandmarkSet } from './landmarks';
import type { PoseRepresentation } from './representation';
import type { RigSpec } from './skeleton';
import type {
  BodyPosition,
  Difficulty,
  EnvironmentElement,
  Framing,
  PeopleType,
  PoseFamily,
  Scene,
  Vibe,
} from './taxonomy';

/** Discrete descriptors used to detect near-duplicate poses (§27). */
export interface PoseSignature {
  bodyPosition: BodyPosition;
  torsoDirection: 'to-camera' | 'three-quarter' | 'profile' | 'away';
  weightDistribution: 'even' | 'one-leg' | 'seated' | 'supported' | 'in-motion';
  legPattern: 'parallel' | 'staggered' | 'crossed' | 'bent' | 'folded' | 'stride' | 'extended';
  armPattern:
    | 'relaxed'
    | 'one-raised'
    | 'both-raised'
    | 'crossed'
    | 'on-hip'
    | 'supported'
    | 'to-face'
    | 'holding'
    | 'behind';
  headDirection: 'to-camera' | 'away' | 'over-shoulder' | 'down' | 'up' | 'to-partner';
  movementState: 'static' | 'walking' | 'turning' | 'dynamic';
  environmentInteraction: 'none' | 'lean' | 'sit' | 'hold' | 'touch';
  cameraRelationship: 'eye-level' | 'chest-level' | 'waist-level' | 'low' | 'high';
}

/** Where the subject should sit in the frame. */
export interface CompositionTarget {
  /** Horizontal anchor for the subject's centre of mass, 0..1 across the frame. */
  anchorX: number;
  /** Vertical anchor for the subject's centre of mass, 0..1 down the frame. */
  anchorY: number;
  /** Fraction of frame height the subject should occupy. */
  subjectHeight: number;
  /** Acceptable slack before we ask the photographer to move. */
  toleranceX: number;
  toleranceY: number;
  toleranceHeight: number;
  orientation: 'portrait' | 'landscape' | 'either';
  cameraHeight: 'eye-level' | 'chest-level' | 'waist-level' | 'low' | 'high';
}

export interface JointTarget {
  /** Angle in degrees, in the subject's own body frame. */
  angle: number;
  /** How far off is acceptable before we mention it. */
  tolerance: number;
  /** Relative importance when ranking corrections. Higher wins. */
  weight: number;
}

/** Named joints the matcher can evaluate. Keys are the subject's own sides. */
export interface JointTargets {
  leftElbow?: JointTarget;
  rightElbow?: JointTarget;
  leftShoulder?: JointTarget;
  rightShoulder?: JointTarget;
  leftKnee?: JointTarget;
  rightKnee?: JointTarget;
  leftHip?: JointTarget;
  rightHip?: JointTarget;
}

export interface TorsoTarget {
  /** Lean in the image plane, degrees. + = toward image right. */
  leanDeg: number;
  leanTolerance: number;
  /** Rotation about the vertical axis. + = subject turning to their own left. */
  yawDeg: number;
  yawTolerance: number;
}

export interface HipTarget {
  /** Hip line tilt, degrees. + = subject's left hip drops. */
  tiltDeg: number;
  tolerance: number;
  /** Which leg carries the weight, in the subject's own terms. */
  weightSide: 'left' | 'right' | 'even';
}

export interface HeadTarget {
  /** + = subject turns toward their own left. */
  yawDeg: number;
  yawTolerance: number;
  /** + = chin down. */
  pitchDeg: number;
  pitchTolerance: number;
}

/** Instruction copy, authored per pose, spoken to a specific actor. */
export interface Instruction {
  text: string;
  /** Optional short form used in the camera HUD. */
  short?: string;
}

export interface CameraSuggestions {
  framing: Framing;
  cameraHeight: CompositionTarget['cameraHeight'];
  orientation: CompositionTarget['orientation'];
  note?: string;
}

/** One person's target within a pose. Individual poses have one; couples two. */
export interface TargetSubject {
  /** Stable id within the pose, e.g. 'a' | 'b'. */
  id: string;
  /** Label shown when guidance must distinguish people. */
  label: string;
  rig: RigSpec;
  /** Where this subject sits in the pose's own preview box. */
  placement: {
    centreX: number;
    centreY: number;
    heightFraction: number;
    maxWidthFraction?: number;
  };
  /** Resolved landmarks, filled by the repository at load time. */
  skeleton?: LandmarkSet;
}

export interface Pose {
  id: string;
  name: string;

  peopleType: PeopleType;
  poseFamily: PoseFamily;
  poseSignature: PoseSignature;
  difficulty: Difficulty;
  bodyPosition: BodyPosition;

  compatibleScenes: Scene[];
  incompatibleScenes: Scene[];
  compatibleElements: EnvironmentElement[];
  requiredElements: EnvironmentElement[];

  framing: Framing[];
  vibes: Vibe[];

  /** Multi-person from the ground up (§24). */
  targetSubjects: TargetSubject[];

  requiredVisibleLandmarks: Array<'face' | 'shoulders' | 'arms' | 'hips' | 'knees' | 'ankles'>;

  jointTargets: JointTargets;
  torsoTarget: TorsoTarget;
  hipTarget: HipTarget;
  headTarget: HeadTarget;
  compositionTarget: CompositionTarget;

  subjectInstructions: Instruction[];
  photographerInstructions: Instruction[];
  cameraSuggestions: CameraSuggestions;

  searchKeywords: string[];
}

/**
 * A pose with its human references resolved.
 *
 * `targetSkeletons` is the CANONICAL geometry the matcher compares against and
 * never varies by representation (§9). `representations` are what the user
 * sees, one per body type.
 */
export interface ResolvedPose extends Pose {
  targetSkeletons: LandmarkSet[];
  representations: PoseRepresentation[];
  assets: PoseAssets;
}

export interface PoseAssets {
  poseId: string;
  /** Realistic human reference photograph. Null until real photography lands. */
  previewImage: string | null;
  /** Transparent human cutout used over the live camera. */
  overlayImage: string | null;
  /**
   * True when the preview shown to the user is the procedurally rendered
   * development silhouette rather than a photograph. Surfaced in the UI.
   */
  previewIsPlaceholder: boolean;
  overlayIsPlaceholder: boolean;
}
