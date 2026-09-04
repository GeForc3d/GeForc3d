import type {
  BodyPosition,
  EnvironmentElement,
  Framing,
  PeopleType,
  Scene,
  Vibe,
} from './taxonomy';

/**
 * The current photography objective. Every screen reads from it, and it is
 * mutable at every point in the flow — there is no wizard (§12).
 */
export interface ShotSession {
  id: string;
  searchText: string;
  scene: Scene | null;
  bodyPosition: BodyPosition | null;
  peopleType: PeopleType | null;
  framing: Framing | null;
  vibes: Vibe[];
  environmentElements: EnvironmentElement[];

  selectedPoseId: string | null;
  resultScrollPosition: number;

  /** Manual guide transform, persisted so a refresh mid-shoot loses nothing. */
  overlayTransform: OverlayTransform;
  overlayOpacity: number;
  overlayMirrored: boolean;
  overlayLocked: boolean;
  guideEnabled: boolean;
  gridEnabled: boolean;
  /** Speak each new instruction aloud, so the subject hears it too. */
  voiceEnabled: boolean;

  /** Poses actually shot in this session, in order. */
  capturedPoseIds: string[];
  facingMode: 'environment' | 'user';

  createdAt: number;
  updatedAt: number;
}

export interface OverlayTransform {
  /** Translation as a fraction of the viewport, so it survives rotation. */
  x: number;
  y: number;
  scale: number;
}

export const IDENTITY_TRANSFORM: OverlayTransform = { x: 0, y: 0, scale: 1 };

/** True when the user has expressed any shooting intent at all. */
export const sessionHasIntent = (s: ShotSession): boolean =>
  Boolean(
    s.searchText.trim() ||
      s.scene ||
      s.bodyPosition ||
      s.peopleType ||
      s.framing ||
      s.vibes.length ||
      s.environmentElements.length,
  );

export const createShotSession = (partial: Partial<ShotSession> = {}): ShotSession => {
  const now = Date.now();
  return {
    id: `shot_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    searchText: '',
    scene: null,
    bodyPosition: null,
    peopleType: null,
    framing: null,
    vibes: [],
    environmentElements: [],
    selectedPoseId: null,
    resultScrollPosition: 0,
    overlayTransform: { ...IDENTITY_TRANSFORM },
    overlayOpacity: 0.35,
    overlayMirrored: false,
    overlayLocked: false,
    guideEnabled: true,
    gridEnabled: true,
    voiceEnabled: false,
    capturedPoseIds: [],
    facingMode: 'environment',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
};

/** The user-facing one-line description of a session, e.g. "Beach · Standing · Individual". */
export const describeSession = (
  s: ShotSession,
  labels: {
    scene: Record<string, string>;
    position: Record<string, string>;
    people: Record<string, string>;
  },
): string => {
  const parts: string[] = [];
  if (s.scene) parts.push(labels.scene[s.scene]);
  if (s.bodyPosition) parts.push(labels.position[s.bodyPosition]);
  if (s.peopleType) parts.push(labels.people[s.peopleType]);
  if (!parts.length && s.searchText.trim()) return s.searchText.trim();
  return parts.join(' · ');
};
