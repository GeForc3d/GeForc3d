/**
 * The controlled vocabulary of the product. Everything the user can filter by,
 * everything a pose can be tagged with, lives here and nowhere else.
 */

export const SCENES = [
  'beach',
  'cafe',
  'restaurant',
  'home',
  'indoor',
  'outdoor',
  'city',
  'street',
  'park',
  'forest',
  'pool',
  'hotel',
  'balcony',
  'night',
  'travel',
  'other',
] as const;
export type Scene = (typeof SCENES)[number];

export const BODY_POSITIONS = ['standing', 'sitting', 'lying', 'walking', 'leaning'] as const;
export type BodyPosition = (typeof BODY_POSITIONS)[number];

export const PEOPLE_TYPES = ['individual', 'couple', 'group'] as const;
export type PeopleType = (typeof PEOPLE_TYPES)[number];

export const FRAMINGS = ['full-body', 'three-quarter', 'waist-up', 'portrait'] as const;
export type Framing = (typeof FRAMINGS)[number];

export const VIBES = [
  'casual',
  'relaxed',
  'elegant',
  'confident',
  'romantic',
  'editorial',
  'playful',
  'candid',
] as const;
export type Vibe = (typeof VIBES)[number];

export const ENVIRONMENT_ELEMENTS = [
  'wall',
  'chair',
  'bench',
  'table',
  'window',
  'railing',
  'mirror',
  'tree',
  'water',
  'stairs',
  'car',
  'open-space',
  'door',
  'plants',
  'ground',
] as const;
export type EnvironmentElement = (typeof ENVIRONMENT_ELEMENTS)[number];

export const DIFFICULTIES = ['easy', 'moderate', 'editorial'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Pose families exist so the catalogue stays MECE (§25) and so results can be
 * diversified by photographic concept rather than by tag overlap (§28).
 */
export const POSE_FAMILIES = [
  // individual - standing
  'contrapposto',
  'relaxed-frontal',
  'crossed-stance',
  'side-profile',
  'look-back',
  'walk-toward',
  'walk-away',
  'walk-across',
  'hair-interaction',
  'object-interaction',
  'over-shoulder',
  'movement',
  // individual - leaning
  'lean-side',
  'lean-back',
  'lean-forward',
  'lean-frame',
  // individual - seated
  'seated-forward',
  'seated-elbow',
  'seated-side',
  'seated-cross-leg',
  'seated-ground',
  'seated-perch',
  'seated-recline',
  // individual - lying
  'lying-propped',
  'lying-supine',
  'lying-side',
  // couple
  'couple-side-by-side',
  'couple-walking',
  'couple-embrace',
  'couple-behind',
  'couple-facing',
  'couple-lean',
  'couple-seated',
  // group
  'group-line',
  'group-cluster',
  'group-walking',
] as const;
export type PoseFamily = (typeof POSE_FAMILIES)[number];

/* ---------- Human-facing labels. The UI never hard-codes a label string. ---------- */

export const SCENE_LABELS: Record<Scene, string> = {
  beach: 'Beach',
  cafe: 'Cafe',
  restaurant: 'Restaurant',
  home: 'Home',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  city: 'City',
  street: 'Street',
  park: 'Park',
  forest: 'Forest',
  pool: 'Pool',
  hotel: 'Hotel',
  balcony: 'Balcony',
  night: 'Night',
  travel: 'Travel',
  other: 'Other',
};

export const BODY_POSITION_LABELS: Record<BodyPosition, string> = {
  standing: 'Standing',
  sitting: 'Sitting',
  lying: 'Lying',
  walking: 'Walking',
  leaning: 'Leaning',
};

export const PEOPLE_LABELS: Record<PeopleType, string> = {
  individual: 'Individual',
  couple: 'Couple',
  group: 'Group',
};

export const FRAMING_LABELS: Record<Framing, string> = {
  'full-body': 'Full body',
  'three-quarter': '3/4',
  'waist-up': 'Waist up',
  portrait: 'Portrait',
};

export const VIBE_LABELS: Record<Vibe, string> = {
  casual: 'Casual',
  relaxed: 'Relaxed',
  elegant: 'Elegant',
  confident: 'Confident',
  romantic: 'Romantic',
  editorial: 'Editorial',
  playful: 'Playful',
  candid: 'Candid',
};

export const ELEMENT_LABELS: Record<EnvironmentElement, string> = {
  wall: 'Wall',
  chair: 'Chair',
  bench: 'Bench',
  table: 'Table',
  window: 'Window',
  railing: 'Railing',
  mirror: 'Mirror',
  tree: 'Tree',
  water: 'Water',
  stairs: 'Stairs',
  car: 'Car',
  'open-space': 'Open space',
  door: 'Door',
  plants: 'Plants',
  ground: 'Ground',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  editorial: 'Editorial',
};

export const FAMILY_LABELS: Record<PoseFamily, string> = {
  contrapposto: 'Contrapposto',
  'relaxed-frontal': 'Relaxed frontal',
  'crossed-stance': 'Crossed stance',
  'side-profile': 'Side profile',
  'look-back': 'Look back',
  'walk-toward': 'Walking toward',
  'walk-away': 'Walking away',
  'walk-across': 'Walking across',
  'hair-interaction': 'Hair interaction',
  'object-interaction': 'Object interaction',
  'over-shoulder': 'Over the shoulder',
  movement: 'Movement',
  'lean-side': 'Shoulder lean',
  'lean-back': 'Back against',
  'lean-forward': 'Forward lean',
  'lean-frame': 'Framed',
  'seated-forward': 'Seated forward',
  'seated-elbow': 'Elbow supported',
  'seated-side': 'Seated side-on',
  'seated-cross-leg': 'Cross-legged',
  'seated-ground': 'Seated on the ground',
  'seated-perch': 'Perched',
  'seated-recline': 'Reclined',
  'lying-propped': 'Propped',
  'lying-supine': 'On the back',
  'lying-side': 'On the side',
  'couple-side-by-side': 'Side by side',
  'couple-walking': 'Walking together',
  'couple-embrace': 'Embrace',
  'couple-behind': 'From behind',
  'couple-facing': 'Facing each other',
  'couple-lean': 'Shoulder lean',
  'couple-seated': 'Seated together',
  'group-line': 'Staggered line',
  'group-cluster': 'Cluster',
  'group-walking': 'Walking group',
};

/** Scenes surfaced on the home screen, in order. `other` is reachable via More. */
export const FEATURED_SCENES: Scene[] = [
  'beach',
  'cafe',
  'restaurant',
  'city',
  'park',
  'home',
  'night',
  'travel',
];
