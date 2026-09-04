import {
  BODY_POSITIONS,
  ENVIRONMENT_ELEMENTS,
  FRAMINGS,
  PEOPLE_TYPES,
  SCENES,
  VIBES,
  type BodyPosition,
  type EnvironmentElement,
  type Framing,
  type PeopleType,
  type Scene,
  type Vibe,
} from '@/models/taxonomy';

/**
 * Turns a free-text description of a shot into explicit, editable constraints.
 *
 * This implementation is entirely local: tokenise, normalise, match against a
 * weighted synonym table. No API key, no network, no account (§18). The
 * interface is deliberately narrow so a semantic or LLM-backed implementation
 * can be dropped in behind it later without touching any caller.
 *
 * Whatever it infers is shown to the user as removable chips. Interpretation is
 * never hidden (§17).
 */

export interface InterpretedShot {
  scene: Scene | null;
  bodyPosition: BodyPosition | null;
  peopleType: PeopleType | null;
  framing: Framing | null;
  vibes: Vibe[];
  environmentElements: EnvironmentElement[];
  /** Tokens that carried no structured meaning; still used for keyword ranking. */
  residualTerms: string[];
}

export interface SceneInterpreter {
  interpret(text: string): InterpretedShot;
}

const EMPTY: InterpretedShot = {
  scene: null,
  bodyPosition: null,
  peopleType: null,
  framing: null,
  vibes: [],
  environmentElements: [],
  residualTerms: [],
};

/** Phrase → value. Multi-word phrases are matched before single tokens. */
type Table<T extends string> = Array<[string[], T, number]>;

const SCENE_TABLE: Table<Scene> = [
  [['beach', 'sand', 'seaside', 'shore', 'coast', 'ocean', 'sea'], 'beach', 3],
  [['cafe', 'coffee shop', 'coffee', 'espresso', 'barista', 'brunch'], 'cafe', 3],
  [['restaurant', 'dinner', 'dining', 'lunch', 'bar', 'bistro'], 'restaurant', 3],
  [['home', 'apartment', 'flat', 'bedroom', 'kitchen', 'living room', 'couch', 'sofa'], 'home', 3],
  [['indoors', 'indoor', 'inside'], 'indoor', 2],
  [['outdoors', 'outdoor', 'outside'], 'outdoor', 2],
  [['city', 'urban', 'downtown', 'skyline', 'rooftop'], 'city', 3],
  [['street', 'alley', 'laneway', 'sidewalk', 'footpath', 'crosswalk'], 'street', 3],
  [['park', 'garden', 'grass', 'lawn', 'field', 'meadow'], 'park', 3],
  [['forest', 'woods', 'woodland', 'trees', 'trail', 'bush'], 'forest', 3],
  [['pool', 'poolside', 'swimming'], 'pool', 3],
  [['hotel', 'lobby', 'resort', 'suite'], 'hotel', 3],
  [['balcony', 'terrace', 'veranda'], 'balcony', 3],
  [['night', 'evening', 'neon', 'after dark', 'nighttime'], 'night', 3],
  [['travel', 'holiday', 'vacation', 'trip', 'abroad', 'airport'], 'travel', 2],
];

const POSITION_TABLE: Table<BodyPosition> = [
  [['standing', 'stand', 'stands', 'upright', 'on her feet'], 'standing', 3],
  [['sitting', 'sit', 'sits', 'seated', 'perched', 'sat'], 'sitting', 3],
  [['lying', 'lying down', 'laying', 'lie down', 'reclining on the ground'], 'lying', 3],
  [['walking', 'walk', 'walks', 'strolling', 'stroll', 'stepping'], 'walking', 3],
  [['leaning', 'lean', 'leans', 'propped against'], 'leaning', 3],
];

const PEOPLE_TABLE: Table<PeopleType> = [
  [
    ['couple', 'together', 'two people', 'both of us', 'partner', 'boyfriend', 'girlfriend and i'],
    'couple',
    3,
  ],
  [['group', 'friends', 'family', 'everyone', 'three people', 'four people'], 'group', 3],
  [
    ['solo', 'alone', 'individual', 'portrait of her', 'by herself', 'by himself', 'one person'],
    'individual',
    2,
  ],
];

const FRAMING_TABLE: Table<Framing> = [
  [['full body', 'full length', 'head to toe', 'whole body'], 'full-body', 3],
  [['three quarter', '3/4', 'knees up', 'mid length'], 'three-quarter', 3],
  [['waist up', 'half body', 'from the waist'], 'waist-up', 3],
  [['portrait', 'close up', 'closeup', 'headshot', 'head shot', 'face'], 'portrait', 3],
];

const VIBE_TABLE: Table<Vibe> = [
  [['casual', 'everyday', 'simple', 'easy'], 'casual', 2],
  [['relaxed', 'chill', 'calm', 'laid back'], 'relaxed', 2],
  [['elegant', 'classy', 'sophisticated', 'refined', 'formal'], 'elegant', 2],
  [['confident', 'strong', 'powerful', 'bold'], 'confident', 2],
  [['romantic', 'intimate', 'loving', 'sweet', 'date'], 'romantic', 2],
  [['editorial', 'fashion', 'magazine', 'high fashion', 'vogue'], 'editorial', 2],
  [['playful', 'fun', 'silly', 'laughing', 'happy'], 'playful', 2],
  [['candid', 'natural', 'unposed', 'not looking', 'looking away', 'in the moment'], 'candid', 2],
];

const ELEMENT_TABLE: Table<EnvironmentElement> = [
  [['wall', 'brick wall', 'against a wall'], 'wall', 3],
  [['chair', 'stool', 'seat'], 'chair', 3],
  [['bench', 'step', 'steps', 'ledge'], 'bench', 3],
  [['table', 'desk', 'counter'], 'table', 3],
  [['window', 'windowsill', 'by the window', 'beside a window'], 'window', 3],
  [['railing', 'rail', 'balustrade', 'fence', 'banister'], 'railing', 3],
  [['mirror', 'reflection'], 'mirror', 3],
  [['tree', 'trees', 'trunk'], 'tree', 2],
  [['water', 'waves', 'sea', 'lake', 'river', 'shoreline'], 'water', 2],
  [['stairs', 'staircase', 'steps'], 'stairs', 3],
  [['car', 'vehicle'], 'car', 3],
  [['open space', 'wide open', 'empty'], 'open-space', 2],
  [['door', 'doorway', 'entrance'], 'door', 3],
  [['plants', 'plant', 'flowers', 'greenery'], 'plants', 2],
  [['ground', 'floor', 'sand', 'grass'], 'ground', 1],
];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'at', 'in', 'on', 'to', 'for', 'with', 'and', 'or', 'my', 'me',
  'i', 'we', 'is', 'are', 'be', 'photo', 'picture', 'shot', 'pic', 'photos', 'pose',
  'poses', 'take', 'taking', 'want', 'need', 'some', 'good', 'nice', 'her', 'his',
  'their', 'she', 'he', 'them', 'it', 'that', 'this',
]);

export const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9/' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Word-boundary aware phrase test, so "sit" does not match "sitting room". */
const containsPhrase = (haystack: string, phrase: string): boolean => {
  const idx = haystack.indexOf(phrase);
  if (idx === -1) return false;
  const before = idx === 0 ? ' ' : haystack[idx - 1];
  const afterIdx = idx + phrase.length;
  const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx];
  return before === ' ' && after === ' ';
};

function bestMatch<T extends string>(text: string, table: Table<T>): { value: T; score: number }[] {
  const hits: { value: T; score: number }[] = [];
  for (const [phrases, value, weight] of table) {
    let best = 0;
    for (const phrase of phrases) {
      if (!containsPhrase(text, phrase)) continue;
      // Longer phrases are stronger evidence than single words.
      best = Math.max(best, weight + phrase.split(' ').length - 1);
    }
    if (best > 0) hits.push({ value, score: best });
  }
  return hits.sort((a, b) => b.score - a.score);
}

const dedupe = <T,>(xs: T[]): T[] => [...new Set(xs)];

export const LocalSceneInterpreter: SceneInterpreter = {
  interpret(raw: string): InterpretedShot {
    const text = ` ${normalise(raw)} `;
    if (!text.trim()) return { ...EMPTY, vibes: [], environmentElements: [], residualTerms: [] };

    const scenes = bestMatch(text, SCENE_TABLE);
    const positions = bestMatch(text, POSITION_TABLE);
    const people = bestMatch(text, PEOPLE_TABLE);
    const framings = bestMatch(text, FRAMING_TABLE);
    const vibes = bestMatch(text, VIBE_TABLE);
    const elements = bestMatch(text, ELEMENT_TABLE);

    // A generic scene only wins if nothing specific matched.
    const specificScene = scenes.find((s) => s.value !== 'indoor' && s.value !== 'outdoor');
    const scene = specificScene?.value ?? scenes[0]?.value ?? null;

    const matchedPhrases = new Set<string>();
    for (const [phrases] of [
      ...SCENE_TABLE,
      ...POSITION_TABLE,
      ...PEOPLE_TABLE,
      ...FRAMING_TABLE,
      ...VIBE_TABLE,
      ...ELEMENT_TABLE,
    ] as Table<string>) {
      for (const phrase of phrases) {
        if (containsPhrase(text, phrase)) phrase.split(' ').forEach((w) => matchedPhrases.add(w));
      }
    }

    const residualTerms = text
      .trim()
      .split(' ')
      .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !matchedPhrases.has(t));

    return {
      scene,
      bodyPosition: positions[0]?.value ?? null,
      peopleType: people[0]?.value ?? null,
      framing: framings[0]?.value ?? null,
      vibes: dedupe(vibes.slice(0, 3).map((v) => v.value)),
      environmentElements: dedupe(elements.slice(0, 3).map((e) => e.value)),
      residualTerms: dedupe(residualTerms).slice(0, 6),
    };
  },
};

/** Guards against taxonomy drift in the tables above. */
export const validateTables = (): string[] => {
  const problems: string[] = [];
  const check = <T extends string>(table: Table<T>, valid: readonly string[], label: string) => {
    for (const [, value] of table) {
      if (!valid.includes(value)) problems.push(`${label}: unknown value ${value}`);
    }
  };
  check(SCENE_TABLE, SCENES, 'scene');
  check(POSITION_TABLE, BODY_POSITIONS, 'position');
  check(PEOPLE_TABLE, PEOPLE_TYPES, 'people');
  check(FRAMING_TABLE, FRAMINGS, 'framing');
  check(VIBE_TABLE, VIBES, 'vibe');
  check(ELEMENT_TABLE, ENVIRONMENT_ELEMENTS, 'element');
  return problems;
};
