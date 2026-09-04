import { LANDMARK_GROUPS } from '@/models/landmarks';
import { buildSkeleton, type RigSpec } from '@/models/skeleton';
import { extractFeatures } from '@/pose-matching/features';
import type {
  CameraSuggestions,
  CompositionTarget,
  HeadTarget,
  HipTarget,
  Instruction,
  JointTargets,
  Pose,
  PoseSignature,
  TargetSubject,
  TorsoTarget,
} from '@/models/pose';
import type {
  BodyPosition,
  Difficulty,
  EnvironmentElement,
  Framing,
  PeopleType,
  PoseFamily,
  Scene,
  Vibe,
} from '@/models/taxonomy';

/**
 * Matcher targets are DERIVED from the same rig that draws the visual guide, so
 * the picture the user sees and the geometry the app checks can never drift
 * apart. Only tolerances and weights are authored, and only where a pose needs
 * something other than the default.
 */

const DEFAULT_TOLERANCE = {
  elbow: { tolerance: 24, weight: 0.55 },
  shoulder: { tolerance: 18, weight: 0.85 },
  knee: { tolerance: 22, weight: 0.7 },
  hip: { tolerance: 18, weight: 0.8 },
} as const;

type JointKey = keyof JointTargets;

const JOINT_KIND: Record<JointKey, keyof typeof DEFAULT_TOLERANCE> = {
  leftElbow: 'elbow',
  rightElbow: 'elbow',
  leftShoulder: 'shoulder',
  rightShoulder: 'shoulder',
  leftKnee: 'knee',
  rightKnee: 'knee',
  leftHip: 'hip',
  rightHip: 'hip',
};

export type JointOverrides = Partial<
  Record<JointKey, Partial<{ tolerance: number; weight: number }>>
>;

const FRAMING_COMPOSITION: Record<
  Framing,
  Pick<CompositionTarget, 'subjectHeight' | 'anchorY' | 'toleranceHeight'>
> = {
  'full-body': { subjectHeight: 0.8, anchorY: 0.52, toleranceHeight: 0.12 },
  'three-quarter': { subjectHeight: 0.76, anchorY: 0.5, toleranceHeight: 0.12 },
  'waist-up': { subjectHeight: 0.66, anchorY: 0.46, toleranceHeight: 0.14 },
  portrait: { subjectHeight: 0.55, anchorY: 0.42, toleranceHeight: 0.16 },
};

export interface SubjectDef {
  id?: string;
  label?: string;
  rig: RigSpec;
  placement?: Partial<TargetSubject['placement']>;
}

export interface PoseDef {
  id: string;
  name: string;
  family: PoseFamily;
  difficulty: Difficulty;
  bodyPosition: BodyPosition;
  peopleType?: PeopleType;
  signature: Omit<PoseSignature, 'bodyPosition'>;

  scenes: Scene[];
  notScenes?: Scene[];
  elements?: EnvironmentElement[];
  requires?: EnvironmentElement[];

  framing: Framing[];
  vibes: Vibe[];

  /** Single-subject shorthand. Use `subjects` for couple and group poses. */
  rig?: RigSpec;
  subjects?: SubjectDef[];

  /** Horizontal anchor in the frame. Defaults to centre. */
  anchorX?: number;
  /** Widest a figure may be drawn. Lying poses need almost the full frame. */
  maxWidthFraction?: number;
  cameraHeight?: CompositionTarget['cameraHeight'];
  orientation?: CompositionTarget['orientation'];

  requiredLandmarks?: Pose['requiredVisibleLandmarks'];
  jointOverrides?: JointOverrides;
  /** Joints that carry no meaning in this pose and must not be coached. */
  ignoreJoints?: JointKey[];

  torso?: Partial<TorsoTarget>;
  hip?: Partial<HipTarget>;
  head?: Partial<HeadTarget>;

  subject: string[];
  photographer: string[];
  cameraNote?: string;
  keywords: string[];
}

const REQUIRED_BY_FRAMING: Record<Framing, Pose['requiredVisibleLandmarks']> = {
  'full-body': ['shoulders', 'hips', 'knees', 'ankles'],
  'three-quarter': ['shoulders', 'hips', 'knees'],
  'waist-up': ['face', 'shoulders', 'arms'],
  portrait: ['face', 'shoulders'],
};

export function definePose(def: PoseDef): Pose {
  const peopleType = def.peopleType ?? 'individual';
  const subjectDefs: SubjectDef[] =
    def.subjects ?? (def.rig ? [{ rig: def.rig }] : []);
  if (!subjectDefs.length) throw new Error(`Pose ${def.id} has no subjects`);

  const primaryFraming = def.framing[0];
  const comp = FRAMING_COMPOSITION[primaryFraming];

  const targetSubjects: TargetSubject[] = subjectDefs.map((s, i) => ({
    id: s.id ?? String.fromCharCode(97 + i),
    label: s.label ?? (subjectDefs.length > 1 ? `Person ${i + 1}` : 'Subject'),
    rig: s.rig,
    placement: {
      centreX: s.placement?.centreX ?? (def.anchorX ?? 0.5),
      centreY: s.placement?.centreY ?? comp.anchorY,
      heightFraction: s.placement?.heightFraction ?? comp.subjectHeight,
      maxWidthFraction: s.placement?.maxWidthFraction ?? def.maxWidthFraction,
    },
  }));

  // Derive the matcher targets from the primary subject's rig.
  const primary = buildSkeleton(subjectDefs[0].rig);
  const f = extractFeatures(primary);
  const ignore = new Set<JointKey>(def.ignoreJoints ?? []);

  const jointTargets: JointTargets = {};
  (Object.keys(JOINT_KIND) as JointKey[]).forEach((key) => {
    if (ignore.has(key)) return;
    const value = f[key];
    if (!Number.isFinite(value)) return;
    const base = DEFAULT_TOLERANCE[JOINT_KIND[key]];
    const over = def.jointOverrides?.[key];
    jointTargets[key] = {
      angle: Math.round(value * 10) / 10,
      tolerance: over?.tolerance ?? base.tolerance,
      weight: over?.weight ?? base.weight,
    };
  });

  const rig = subjectDefs[0].rig;
  // Lean and hip tilt are read back off the built skeleton, not off the rig
  // fields. A pose that rotates the whole body has a rig lean of zero and a
  // skeleton lean of ninety degrees, and the matcher must target what the
  // camera will actually see.
  const torsoTarget: TorsoTarget = {
    leanDeg: Math.round(f.torsoLeanDeg * 10) / 10,
    leanTolerance: def.torso?.leanTolerance ?? 11,
    yawDeg: rig.yawDeg ?? 0,
    yawTolerance: def.torso?.yawTolerance ?? 24,
    ...def.torso,
  };

  const hipTarget: HipTarget = {
    tiltDeg: Math.round(f.hipTiltDeg * 10) / 10,
    tolerance: def.hip?.tolerance ?? 9,
    weightSide:
      def.hip?.weightSide ??
      (rig.hipShift == null || Math.abs(rig.hipShift) < 0.15
        ? 'even'
        : // Hips pushed toward image right means the weight is over the
          // subject's own LEFT leg, because subject-left is image +x.
          rig.hipShift > 0
          ? 'left'
          : 'right'),
  };

  const headTarget: HeadTarget = {
    yawDeg: rig.headYawDeg ?? 0,
    yawTolerance: def.head?.yawTolerance ?? 26,
    pitchDeg: rig.headPitchDeg ?? 0,
    pitchTolerance: def.head?.pitchTolerance ?? 18,
    ...def.head,
  };

  const compositionTarget: CompositionTarget = {
    anchorX: def.anchorX ?? 0.5,
    anchorY: comp.anchorY,
    subjectHeight: comp.subjectHeight,
    toleranceX: 0.09,
    toleranceY: 0.1,
    toleranceHeight: comp.toleranceHeight,
    orientation: def.orientation ?? 'portrait',
    cameraHeight: def.cameraHeight ?? 'chest-level',
  };

  const toInstructions = (lines: string[]): Instruction[] =>
    lines.map((text) => ({ text, short: shorten(text) }));

  const cameraSuggestions: CameraSuggestions = {
    framing: primaryFraming,
    cameraHeight: compositionTarget.cameraHeight,
    orientation: compositionTarget.orientation,
    note: def.cameraNote,
  };

  return {
    id: def.id,
    name: def.name,
    peopleType,
    poseFamily: def.family,
    poseSignature: { bodyPosition: def.bodyPosition, ...def.signature },
    difficulty: def.difficulty,
    bodyPosition: def.bodyPosition,
    compatibleScenes: def.scenes,
    incompatibleScenes: def.notScenes ?? [],
    compatibleElements: def.elements ?? [],
    requiredElements: def.requires ?? [],
    framing: def.framing,
    vibes: def.vibes,
    targetSubjects,
    requiredVisibleLandmarks: def.requiredLandmarks ?? REQUIRED_BY_FRAMING[primaryFraming],
    jointTargets,
    torsoTarget,
    hipTarget,
    headTarget,
    compositionTarget,
    subjectInstructions: toInstructions(def.subject),
    photographerInstructions: toInstructions(def.photographer),
    cameraSuggestions,
    searchKeywords: def.keywords,
  };
}

/** Landmark indices a pose actually needs, from its declared groups. */
export const requiredIndices = (pose: Pose): number[] =>
  pose.requiredVisibleLandmarks.flatMap((g) => [...LANDMARK_GROUPS[g]]);

const shorten = (text: string): string => {
  const first = text.split(/[.;]/)[0].trim();
  return first.length <= 42 ? first : `${first.slice(0, 39).trimEnd()}…`;
};
