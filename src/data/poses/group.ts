import { definePose } from '../definePose';
import type { Pose } from '@/models/pose';

/**
 * Group poses. v1 guides groups through placement regions and composition, not
 * per-person joint matching (§89). The camera reports this honestly: with Group
 * selected, live guidance covers framing and headcount only.
 */
export const GROUP_POSES: Pose[] = [
  definePose({
    id: 'group-staggered-line',
    name: 'Staggered Line',
    family: 'group-line',
    difficulty: 'easy',
    bodyPosition: 'standing',
    peopleType: 'group',
    signature: {
      torsoDirection: 'three-quarter',
      weightDistribution: 'even',
      legPattern: 'parallel',
      armPattern: 'relaxed',
      headDirection: 'to-camera',
      movementState: 'static',
      environmentInteraction: 'touch',
      cameraRelationship: 'chest-level',
    },
    scenes: ['beach', 'city', 'street', 'park', 'travel', 'night', 'outdoor', 'hotel'],
    elements: ['open-space', 'wall', 'ground'],
    framing: ['full-body', 'three-quarter'],
    vibes: ['casual', 'playful', 'candid'],
    subjects: [
      {
        label: 'Left',
        placement: { centreX: 0.26, centreY: 0.54, heightFraction: 0.72 },
        rig: {
          yawDeg: -22,
          armL: { upper: 84, lower: 80 },
          armR: { upper: 90, lower: 92 },
          legL: { upper: 90, lower: 90 },
          legR: { upper: 90, lower: 90 },
        },
      },
      {
        label: 'Centre',
        placement: { centreX: 0.5, centreY: 0.5, heightFraction: 0.78 },
        rig: {
          yawDeg: 4,
          armL: { upper: 92, lower: 92 },
          armR: { upper: 88, lower: 88 },
          legL: { upper: 90, lower: 90 },
          legR: { upper: 90, lower: 90 },
        },
      },
      {
        label: 'Right',
        placement: { centreX: 0.74, centreY: 0.54, heightFraction: 0.72 },
        rig: {
          yawDeg: 22,
          armL: { upper: 90, lower: 92 },
          armR: { upper: 96, lower: 100 },
          legL: { upper: 90, lower: 90 },
          legR: { upper: 90, lower: 90 },
        },
      },
    ],
    subject: [
      'Do not stand in a straight line. Stagger forward and back so you overlap slightly.',
      'Everyone angles their shoulders toward the middle of the group.',
    ],
    photographer: [
      'Step back further than you think and shoot at chest height so nobody at the edge stretches.',
      'Check the heads first: no two at exactly the same height, none cut off.',
    ],
    keywords: ['group', 'friends', 'three people', 'line', 'everyone', 'family'],
  }),

  definePose({
    id: 'group-cluster-seated',
    name: 'Seated Cluster',
    family: 'group-cluster',
    difficulty: 'easy',
    bodyPosition: 'sitting',
    peopleType: 'group',
    signature: {
      torsoDirection: 'three-quarter',
      weightDistribution: 'seated',
      legPattern: 'folded',
      armPattern: 'relaxed',
      headDirection: 'to-camera',
      movementState: 'static',
      environmentInteraction: 'sit',
      cameraRelationship: 'chest-level',
    },
    scenes: ['beach', 'park', 'home', 'restaurant', 'cafe', 'outdoor', 'travel', 'forest'],
    requires: ['ground'],
    elements: ['ground', 'bench', 'table', 'chair', 'stairs'],
    framing: ['three-quarter'],
    vibes: ['casual', 'candid', 'relaxed', 'playful'],
    ignoreJoints: ['leftHip', 'rightHip'],
    subjects: [
      {
        label: 'Left',
        placement: { centreX: 0.29, centreY: 0.55, heightFraction: 0.6 },
        rig: {
          yawDeg: -30,
          legScale: 0.8,
          armL: { upper: 70, lower: 40, foreshorten: 0.85 },
          armR: { upper: 100, lower: 96 },
          legL: { upper: 44, lower: 112, foreshorten: 0.8 },
          legR: { upper: 92, lower: 96, foreshorten: 0.8 },
        },
      },
      {
        label: 'Centre',
        placement: { centreX: 0.5, centreY: 0.52, heightFraction: 0.64 },
        rig: {
          yawDeg: 6,
          legScale: 0.8,
          armL: { upper: 62, lower: 118, foreshorten: 0.85 },
          armR: { upper: 118, lower: 62, foreshorten: 0.85 },
          legL: { upper: 20, lower: 116, foreshorten: 0.8 },
          legR: { upper: 30, lower: 120, foreshorten: 0.8 },
        },
      },
      {
        label: 'Right',
        placement: { centreX: 0.71, centreY: 0.55, heightFraction: 0.6 },
        rig: {
          yawDeg: 30,
          legScale: 0.8,
          armL: { upper: 84, lower: 88 },
          armR: { upper: 112, lower: 142, foreshorten: 0.85 },
          legL: { upper: 88, lower: 96, foreshorten: 0.8 },
          legR: { upper: 136, lower: 70, foreshorten: 0.8 },
        },
      },
    ],
    subject: [
      'Sit in a loose arc rather than a row, and let your knees and shoulders overlap.',
      'Lean in toward the middle. Groups always sit too far apart.',
    ],
    photographer: [
      'Get down to their level and shoot slightly from above their eye line, not from standing.',
    ],
    keywords: ['group', 'sitting', 'friends', 'cluster', 'picnic', 'circle', 'family'],
  }),

  definePose({
    id: 'group-walking-line',
    name: 'Walking Line',
    family: 'group-walking',
    difficulty: 'moderate',
    bodyPosition: 'walking',
    peopleType: 'group',
    signature: {
      torsoDirection: 'to-camera',
      weightDistribution: 'in-motion',
      legPattern: 'stride',
      armPattern: 'relaxed',
      headDirection: 'to-camera',
      movementState: 'walking',
      environmentInteraction: 'none',
      cameraRelationship: 'chest-level',
    },
    scenes: ['beach', 'city', 'street', 'park', 'travel', 'outdoor', 'night'],
    elements: ['open-space', 'ground'],
    framing: ['full-body'],
    vibes: ['playful', 'candid', 'confident'],
    subjects: [
      {
        label: 'Left',
        placement: { centreX: 0.27, centreY: 0.53, heightFraction: 0.74 },
        rig: {
          yawDeg: -12,
          armL: { upper: 70, lower: 52, foreshorten: 0.9 },
          armR: { upper: 104, lower: 118, foreshorten: 0.9 },
          legL: { upper: 78, lower: 90, foreshorten: 0.92 },
          legR: { upper: 102, lower: 98 },
        },
      },
      {
        label: 'Centre',
        placement: { centreX: 0.5, centreY: 0.51, heightFraction: 0.78 },
        rig: {
          yawDeg: 6,
          armL: { upper: 102, lower: 116, foreshorten: 0.9 },
          armR: { upper: 76, lower: 60, foreshorten: 0.9 },
          legL: { upper: 100, lower: 96 },
          legR: { upper: 78, lower: 90, foreshorten: 0.92 },
        },
      },
      {
        label: 'Right',
        placement: { centreX: 0.73, centreY: 0.53, heightFraction: 0.74 },
        rig: {
          yawDeg: 12,
          armL: { upper: 74, lower: 56, foreshorten: 0.9 },
          armR: { upper: 106, lower: 120, foreshorten: 0.9 },
          legL: { upper: 80, lower: 92, foreshorten: 0.92 },
          legR: { upper: 100, lower: 96 },
        },
      },
    ],
    jointOverrides: {
      leftKnee: { tolerance: 34 },
      rightKnee: { tolerance: 34 },
      leftElbow: { tolerance: 38 },
      rightElbow: { tolerance: 38 },
    },
    subject: [
      'Walk toward the camera in a loose row, shoulders almost touching.',
      'Talk to each other while you walk. Nobody should be marching.',
    ],
    photographer: [
      'Give yourself a lot of distance and burst. Somebody always blinks.',
      'Full body, level horizon, and check nobody at the edge is half out of frame.',
    ],
    keywords: ['group', 'walking', 'friends', 'together', 'line', 'movement'],
  }),
];
