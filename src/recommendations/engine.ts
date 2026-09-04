import type { ResolvedPose } from '@/models/pose';
import type { ShotSession } from '@/models/shotSession';
import { LocalSceneInterpreter, normalise, type InterpretedShot } from '@/search/sceneInterpreter';
import type { EnvironmentElement, PoseFamily, Scene, Vibe } from '@/models/taxonomy';

/**
 * Layered recommendation (§22). Hard constraints filter, everything else
 * scores, and the final pass diversifies by pose family so the user sees six
 * different photographs rather than six variants of one.
 */

export interface MatchReason {
  scene?: Scene;
  bodyPosition?: string;
  peopleType?: string;
  elements: EnvironmentElement[];
  vibes: Vibe[];
  framing?: string;
  keywordHits: string[];
}

export interface Recommendation {
  pose: ResolvedPose;
  score: number;
  reason: MatchReason;
  /** Short human phrase, e.g. "Great by a window". Empty when nothing stands out. */
  highlight: string;
}

export interface Constraints {
  scene: Scene | null;
  bodyPosition: string | null;
  peopleType: string | null;
  framing: string | null;
  vibes: Vibe[];
  environmentElements: EnvironmentElement[];
  searchText: string;
  /** Terms from free text that carried no structured meaning. */
  residualTerms: string[];
}

/**
 * Merges what the user explicitly picked with what their text implies.
 * Explicit selections always win; interpretation only fills blanks.
 */
export function constraintsFor(
  session: Pick<
    ShotSession,
    | 'searchText'
    | 'scene'
    | 'bodyPosition'
    | 'peopleType'
    | 'framing'
    | 'vibes'
    | 'environmentElements'
  >,
  interpreted?: InterpretedShot,
): Constraints {
  const i = interpreted ?? LocalSceneInterpreter.interpret(session.searchText);
  return {
    scene: session.scene ?? i.scene,
    bodyPosition: session.bodyPosition ?? i.bodyPosition,
    peopleType: session.peopleType ?? i.peopleType,
    framing: session.framing ?? i.framing,
    vibes: session.vibes.length ? session.vibes : i.vibes,
    environmentElements: session.environmentElements.length
      ? session.environmentElements
      : i.environmentElements,
    searchText: session.searchText,
    residualTerms: i.residualTerms,
  };
}

/**
 * STEP 1 — hard constraints. Scene, body position and people type are absolute
 * once chosen (§21). A pose that cannot be done in the chosen scene, or is for
 * a different number of people, never appears at any score.
 */
export function satisfiesHardConstraints(pose: ResolvedPose, c: Constraints): boolean {
  if (c.peopleType && pose.peopleType !== c.peopleType) return false;
  if (c.bodyPosition && pose.bodyPosition !== c.bodyPosition) return false;
  if (c.scene) {
    if (pose.incompatibleScenes.includes(c.scene)) return false;
    if (!pose.compatibleScenes.includes(c.scene)) return false;
  }
  // A pose that needs a railing is not a recommendation when the user has told
  // us what is actually around them and a railing is not on the list.
  if (pose.requiredElements.length && c.environmentElements.length) {
    const missing = pose.requiredElements.filter((e) => !c.environmentElements.includes(e));
    if (missing.length) return false;
  }
  return true;
}

const DIFFICULTY_BONUS = { easy: 6, moderate: 3, editorial: 0 } as const;

function scorePose(pose: ResolvedPose, c: Constraints): { score: number; reason: MatchReason } {
  const reason: MatchReason = { elements: [], vibes: [], keywordHits: [] };
  let score = 0;

  // STEP 2 — scene compatibility. A pose listing few scenes is a specialist in
  // the ones it does list, so it outranks a pose that fits everywhere.
  if (c.scene && pose.compatibleScenes.includes(c.scene)) {
    const specificity = 1 - pose.compatibleScenes.length / 16;
    score += 16 + specificity * 10;
    reason.scene = c.scene;
  }

  // STEP 3 — environment. Required elements the user confirmed are worth more
  // than merely compatible ones.
  for (const el of c.environmentElements) {
    if (pose.requiredElements.includes(el)) {
      score += 14;
      reason.elements.push(el);
    } else if (pose.compatibleElements.includes(el)) {
      score += 6;
      reason.elements.push(el);
    }
  }
  // A pose with unmet hard requirements is still shown when the user has not
  // told us what is around, but it ranks below poses that need nothing.
  if (pose.requiredElements.length && !c.environmentElements.length) score -= 4;

  // STEP 4 — framing.
  if (c.framing) {
    const idx = pose.framing.indexOf(c.framing as (typeof pose.framing)[number]);
    if (idx === 0) score += 10;
    else if (idx > 0) score += 5;
    else score -= 6;
    if (idx >= 0) reason.framing = c.framing;
  }

  // STEP 5 — vibe.
  for (const v of c.vibes) {
    if (pose.vibes.includes(v)) {
      score += 8;
      reason.vibes.push(v);
    }
  }

  // STEP 6 — difficulty. Easy and moderate lead unless the user asked for
  // editorial explicitly.
  const wantsEditorial = c.vibes.includes('editorial') || /editorial|fashion/.test(c.searchText);
  score += wantsEditorial && pose.difficulty === 'editorial' ? 8 : DIFFICULTY_BONUS[pose.difficulty];

  // STEP 7 — keyword relevance over the raw query.
  const query = normalise(c.searchText);
  if (query) {
    const terms = [...new Set([...query.split(' ').filter((t) => t.length > 2), ...c.residualTerms])];
    const haystack = normalise(
      [pose.name, ...pose.searchKeywords, pose.poseFamily.replace(/-/g, ' ')].join(' '),
    );
    for (const t of terms) {
      if (haystack.includes(t)) {
        score += 7;
        reason.keywordHits.push(t);
      }
    }
    if (normalise(pose.name) === query) score += 25;
  }

  if (c.bodyPosition) reason.bodyPosition = c.bodyPosition;
  if (c.peopleType) reason.peopleType = c.peopleType;

  return { score, reason };
}

const ELEMENT_PHRASE: Partial<Record<EnvironmentElement, string>> = {
  window: 'Great by a window',
  railing: 'Made for a railing',
  wall: 'Needs a wall',
  table: 'Works at a table',
  water: 'Strong near water',
  stairs: 'Good on steps',
  bench: 'Good on a bench',
  door: 'Uses the doorway',
  mirror: 'Uses a mirror',
  tree: 'Works with a tree',
  chair: 'Needs a chair',
  ground: 'Down on the ground',
};

/**
 * A highlight only earns its place when it says something specific about THIS
 * pose in THIS situation. A line that could sit under any card is clutter (§32).
 */
function highlightFor(pose: ResolvedPose, reason: MatchReason): string {
  const required = pose.requiredElements.find((e) => reason.elements.includes(e));
  if (required && ELEMENT_PHRASE[required]) return ELEMENT_PHRASE[required]!;
  const el = reason.elements[0];
  if (el && ELEMENT_PHRASE[el]) return ELEMENT_PHRASE[el]!;
  if (pose.requiredElements.length) {
    const first = pose.requiredElements[0];
    return ELEMENT_PHRASE[first] ?? '';
  }
  return '';
}

export interface RankOptions {
  /** How aggressively to spread results across pose families. 0 disables. */
  diversify?: number;
  limit?: number;
  /** When set, results stay within this family (the user asked for variants). */
  familyFocus?: PoseFamily | null;
}

/**
 * STEP 8 — diversification. Walks the ranked list and pushes a pose down when
 * its family has already appeared, so the top of the list spans distinct
 * photographic concepts before it offers variants (§28).
 */
function diversify(items: Recommendation[], strength: number): Recommendation[] {
  if (strength <= 0) return items;
  const seen = new Map<PoseFamily, number>();
  const out: Recommendation[] = [];
  const pool = [...items];

  while (pool.length) {
    let bestIdx = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const fam = pool[i].pose.poseFamily;
      const repeats = seen.get(fam) ?? 0;
      // Position in the pool still matters, so a much stronger pose can win
      // through even when its family has appeared.
      const value = pool[i].score - repeats * strength - i * 0.01;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    const [chosen] = pool.splice(bestIdx, 1);
    seen.set(chosen.pose.poseFamily, (seen.get(chosen.pose.poseFamily) ?? 0) + 1);
    out.push(chosen);
  }
  return out;
}

export function recommend(
  poses: ResolvedPose[],
  c: Constraints,
  options: RankOptions = {},
): Recommendation[] {
  const { diversify: strength = 14, limit, familyFocus = null } = options;

  const eligible = poses.filter((p) => {
    if (!satisfiesHardConstraints(p, c)) return false;
    if (familyFocus && p.poseFamily !== familyFocus) return false;
    return true;
  });

  const scored: Recommendation[] = eligible.map((pose) => {
    const { score, reason } = scorePose(pose, c);
    return { pose, score, reason, highlight: highlightFor(pose, reason) };
  });

  scored.sort((a, b) => b.score - a.score || a.pose.name.localeCompare(b.pose.name));
  const ordered = familyFocus ? scored : diversify(scored, strength);
  return limit ? ordered.slice(0, limit) : ordered;
}

/** Poses compatible with the session, used by the in-camera pose switcher. */
export function compatiblePoses(
  poses: ResolvedPose[],
  c: Constraints,
  limit = 24,
): ResolvedPose[] {
  return recommend(poses, c, { limit }).map((r) => r.pose);
}
