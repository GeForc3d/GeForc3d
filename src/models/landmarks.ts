/**
 * MediaPipe Pose Landmarker topology.
 *
 * CRITICAL SEMANTIC: MediaPipe's `LEFT_*` / `RIGHT_*` indices are the SUBJECT'S
 * anatomical left and right, not the viewer's. They stay anatomical no matter
 * which camera is used or whether the preview is mirrored. Every instruction we
 * speak to the subject ("raise your right hand") is derived from these indices
 * and never from screen position. See §72 and `guidance/anatomy.test.ts`.
 *
 * For a subject facing a non-mirrored camera, subject-left appears at a LARGER
 * image x than subject-right. That single fact anchors the whole coordinate
 * model in this codebase.
 */

export const L = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type LandmarkIndex = (typeof L)[keyof typeof L];

export const LANDMARK_COUNT = 33;

/** Landmark groups a pose can declare as required. */
export const LANDMARK_GROUPS = {
  face: [L.NOSE, L.LEFT_EYE, L.RIGHT_EYE, L.LEFT_EAR, L.RIGHT_EAR],
  shoulders: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER],
  arms: [L.LEFT_ELBOW, L.RIGHT_ELBOW, L.LEFT_WRIST, L.RIGHT_WRIST],
  hips: [L.LEFT_HIP, L.RIGHT_HIP],
  knees: [L.LEFT_KNEE, L.RIGHT_KNEE],
  ankles: [L.LEFT_ANKLE, L.RIGHT_ANKLE],
} as const;

export type LandmarkGroup = keyof typeof LANDMARK_GROUPS;

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  /** 0..1 model confidence that the landmark is present and located here. */
  visibility?: number;
}

/** A full 33-point landmark set in normalised image space (0..1 of the frame). */
export type LandmarkSet = Landmark[];

/** Bones used for silhouette + debug rendering. */
export const SKELETON_BONES: Array<[number, number]> = [
  [L.LEFT_SHOULDER, L.RIGHT_SHOULDER],
  [L.LEFT_SHOULDER, L.LEFT_HIP],
  [L.RIGHT_SHOULDER, L.RIGHT_HIP],
  [L.LEFT_HIP, L.RIGHT_HIP],
  [L.LEFT_SHOULDER, L.LEFT_ELBOW],
  [L.LEFT_ELBOW, L.LEFT_WRIST],
  [L.RIGHT_SHOULDER, L.RIGHT_ELBOW],
  [L.RIGHT_ELBOW, L.RIGHT_WRIST],
  [L.LEFT_HIP, L.LEFT_KNEE],
  [L.LEFT_KNEE, L.LEFT_ANKLE],
  [L.RIGHT_HIP, L.RIGHT_KNEE],
  [L.RIGHT_KNEE, L.RIGHT_ANKLE],
];

export const SIDE_LABEL = { left: 'left', right: 'right' } as const;
export type Side = keyof typeof SIDE_LABEL;

/** Anatomical accessors. `side` is always the subject's own side. */
export const shoulderOf = (side: Side) => (side === 'left' ? L.LEFT_SHOULDER : L.RIGHT_SHOULDER);
export const elbowOf = (side: Side) => (side === 'left' ? L.LEFT_ELBOW : L.RIGHT_ELBOW);
export const wristOf = (side: Side) => (side === 'left' ? L.LEFT_WRIST : L.RIGHT_WRIST);
export const hipOf = (side: Side) => (side === 'left' ? L.LEFT_HIP : L.RIGHT_HIP);
export const kneeOf = (side: Side) => (side === 'left' ? L.LEFT_KNEE : L.RIGHT_KNEE);
export const ankleOf = (side: Side) => (side === 'left' ? L.LEFT_ANKLE : L.RIGHT_ANKLE);
export const earOf = (side: Side) => (side === 'left' ? L.LEFT_EAR : L.RIGHT_EAR);
export const eyeOf = (side: Side) => (side === 'left' ? L.LEFT_EYE : L.RIGHT_EYE);
