import type { Pose } from '@/models/pose';
import { STANDING_POSES } from './standing';
import { LEANING_POSES } from './leaning';
import { SEATED_POSES } from './seated';
import { LYING_POSES, WALKING_POSES } from './lyingWalking';
import { COUPLE_POSES } from './couple';
import { GROUP_POSES } from './group';

export const ALL_POSES: Pose[] = [
  ...STANDING_POSES,
  ...LEANING_POSES,
  ...SEATED_POSES,
  ...WALKING_POSES,
  ...LYING_POSES,
  ...COUPLE_POSES,
  ...GROUP_POSES,
];

export {
  STANDING_POSES,
  LEANING_POSES,
  SEATED_POSES,
  LYING_POSES,
  WALKING_POSES,
  COUPLE_POSES,
  GROUP_POSES,
};
