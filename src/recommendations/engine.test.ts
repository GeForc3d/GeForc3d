import { describe, expect, it } from 'vitest';
import { PoseRepository } from '@/data/poseRepository';
import { constraintsFor, recommend, satisfiesHardConstraints } from './engine';
import { LocalSceneInterpreter, validateTables } from '@/search/sceneInterpreter';
import { createShotSession } from '@/models/shotSession';
import type { Constraints } from './engine';

const all = PoseRepository.all();

const c = (partial: Partial<Constraints>): Constraints => ({
  scene: null,
  bodyPosition: null,
  peopleType: null,
  framing: null,
  vibes: [],
  environmentElements: [],
  searchText: '',
  residualTerms: [],
  ...partial,
});

const namesFor = (partial: Partial<Constraints>) =>
  recommend(all, c(partial)).map((r) => r.pose);

describe('catalogue integrity', () => {
  it('has a substantial, unique catalogue', () => {
    expect(all.length).toBeGreaterThanOrEqual(35);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
  });

  it('gives every pose a resolved skeleton per subject', () => {
    for (const p of all) {
      expect(p.targetSkeletons.length).toBe(p.targetSubjects.length);
      expect(p.targetSkeletons[0].length).toBe(33);
      const finite = p.targetSkeletons.flat().every((l) => Number.isFinite(l.x) && Number.isFinite(l.y));
      expect(finite, `${p.id} has non-finite landmarks`).toBe(true);
    }
  });

  it('keeps every skeleton inside the preview box', () => {
    for (const p of all) {
      for (const s of p.targetSkeletons) {
        const xs = s.map((l) => l.x);
        const ys = s.map((l) => l.y);
        expect(Math.min(...xs), `${p.id} overflows left`).toBeGreaterThan(-0.15);
        expect(Math.max(...xs), `${p.id} overflows right`).toBeLessThan(1.15);
        expect(Math.min(...ys), `${p.id} overflows top`).toBeGreaterThan(-0.05);
        expect(Math.max(...ys), `${p.id} overflows bottom`).toBeLessThan(1.05);
      }
    }
  });

  it('carries the right number of target subjects for its people type', () => {
    for (const p of all) {
      if (p.peopleType === 'individual') expect(p.targetSubjects.length).toBe(1);
      if (p.peopleType === 'couple') expect(p.targetSubjects.length).toBe(2);
      if (p.peopleType === 'group') expect(p.targetSubjects.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never marks a pose compatible and incompatible with the same scene', () => {
    for (const p of all) {
      const overlap = p.compatibleScenes.filter((s) => p.incompatibleScenes.includes(s));
      expect(overlap, `${p.id}`).toEqual([]);
    }
  });

  it('always lists a required element among its compatible elements', () => {
    for (const p of all) {
      for (const r of p.requiredElements) {
        expect(p.compatibleElements, `${p.id} requires ${r}`).toContain(r);
      }
    }
  });

  it('keeps interpreter tables aligned with the taxonomy', () => {
    expect(validateTables()).toEqual([]);
  });

  it('offers easy or moderate options for every body position', () => {
    for (const bp of ['standing', 'sitting', 'lying', 'walking', 'leaning']) {
      const easy = all.filter((p) => p.bodyPosition === bp && p.difficulty !== 'editorial');
      expect(easy.length, bp).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('hard constraints (§21)', () => {
  it('Beach + Standing + Individual excludes everything it should', () => {
    const results = namesFor({ scene: 'beach', bodyPosition: 'standing', peopleType: 'individual' });
    expect(results.length).toBeGreaterThan(3);
    for (const p of results) {
      expect(p.bodyPosition).toBe('standing');
      expect(p.peopleType).toBe('individual');
      expect(p.compatibleScenes).toContain('beach');
    }
    const ids = results.map((p) => p.id);
    expect(ids).not.toContain('table-lean-in');
    expect(ids).not.toContain('lying-back');
    expect(ids).not.toContain('couple-side-by-side');
    expect(ids).not.toContain('group-staggered-line');
  });

  it('Restaurant + Sitting returns no beach-exclusive poses', () => {
    const results = namesFor({ scene: 'restaurant', bodyPosition: 'sitting' });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) expect(p.compatibleScenes).toContain('restaurant');
    expect(results.map((p) => p.id)).not.toContain('ground-knees-up');
  });

  it('Couple + Walking + Beach excludes every individual pose', () => {
    const results = namesFor({ scene: 'beach', bodyPosition: 'walking', peopleType: 'couple' });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) expect(p.peopleType).toBe('couple');
  });

  it('does not offer a standing pose when the user asked to sit', () => {
    const results = namesFor({ bodyPosition: 'sitting' });
    for (const p of results) expect(p.bodyPosition).toBe('sitting');
  });

  it('drops poses whose required element is absent from a stated environment', () => {
    const withoutRailing = namesFor({
      scene: 'balcony',
      environmentElements: ['open-space'],
    });
    expect(withoutRailing.map((p) => p.id)).not.toContain('railing-lean');

    const withRailing = namesFor({ scene: 'balcony', environmentElements: ['railing'] });
    expect(withRailing.map((p) => p.id)).toContain('railing-lean');
  });

  it('honours an explicit scene incompatibility', () => {
    const pose = PoseRepository.get('weight-shift')!;
    expect(satisfiesHardConstraints(pose, c({ scene: 'pool' }))).toBe(false);
  });
});

describe('ranking quality', () => {
  it('ranks window sitting poses top for a cafe window request', () => {
    const results = namesFor({
      scene: 'cafe',
      bodyPosition: 'sitting',
      peopleType: 'individual',
      environmentElements: ['window'],
    });
    expect(results[0].id).toBe('window-gaze');
  });

  it('surfaces railing poses first on a balcony with a railing', () => {
    const results = namesFor({ scene: 'balcony', environmentElements: ['railing'] });
    expect(['railing-lean', 'railing-back-lean']).toContain(results[0].id);
  });

  it('favours easy and moderate poses by default', () => {
    const top = namesFor({ scene: 'beach', peopleType: 'individual' }).slice(0, 5);
    expect(top.filter((p) => p.difficulty === 'editorial').length).toBeLessThanOrEqual(1);
  });

  it('promotes editorial poses when editorial is asked for', () => {
    const top = namesFor({ scene: 'beach', peopleType: 'individual', vibes: ['editorial'] })
      .slice(0, 6)
      .map((p) => p.id);
    expect(top).toContain('turn-and-sweep');
  });

  it('records why a pose ranked, without needing the UI to recompute it', () => {
    const [first] = recommend(
      all,
      c({ scene: 'cafe', bodyPosition: 'sitting', environmentElements: ['window'] }),
    );
    expect(first.reason.scene).toBe('cafe');
    expect(first.reason.elements).toContain('window');
    expect(first.highlight).toBe('Great by a window');
  });
});

describe('diversification (§28, §117)', () => {
  it('spans distinct pose families across the first six results', () => {
    const top = namesFor({ scene: 'beach', peopleType: 'individual' }).slice(0, 6);
    const families = new Set(top.map((p) => p.poseFamily));
    expect(families.size).toBeGreaterThanOrEqual(5);
  });

  it('spans families for a broad unfiltered browse', () => {
    const top = namesFor({ peopleType: 'individual' }).slice(0, 8);
    expect(new Set(top.map((p) => p.poseFamily)).size).toBeGreaterThanOrEqual(7);
  });

  it('returns variants when the user asks for one family', () => {
    const focused = recommend(all, c({}), { familyFocus: 'look-back' });
    expect(focused.length).toBeGreaterThanOrEqual(2);
    for (const r of focused) expect(r.pose.poseFamily).toBe('look-back');
  });

  it('does not lose any pose to diversification', () => {
    const plain = recommend(all, c({ peopleType: 'individual' }), { diversify: 0 });
    const diverse = recommend(all, c({ peopleType: 'individual' }));
    expect(diverse.length).toBe(plain.length);
    expect(new Set(diverse.map((r) => r.pose.id))).toEqual(new Set(plain.map((r) => r.pose.id)));
  });
});

describe('free-text search', () => {
  const search = (text: string) => {
    const session = createShotSession({ searchText: text });
    return recommend(all, constraintsFor(session)).map((r) => r.pose);
  };

  it('reads "sitting at a cafe beside a window, candid"', () => {
    const i = LocalSceneInterpreter.interpret('sitting at a cafe beside a window, candid');
    expect(i.scene).toBe('cafe');
    expect(i.bodyPosition).toBe('sitting');
    expect(i.environmentElements).toContain('window');
    expect(i.vibes).toContain('candid');
  });

  it('reads "couple walking at sunset" as a couple walking', () => {
    const i = LocalSceneInterpreter.interpret('couple walking at sunset');
    expect(i.peopleType).toBe('couple');
    expect(i.bodyPosition).toBe('walking');
  });

  it('reads "girlfriend sitting at a restaurant"', () => {
    const i = LocalSceneInterpreter.interpret('girlfriend sitting at a restaurant');
    expect(i.scene).toBe('restaurant');
    expect(i.bodyPosition).toBe('sitting');
  });

  it('reads "standing beside a railing"', () => {
    const i = LocalSceneInterpreter.interpret('standing beside a railing');
    expect(i.bodyPosition).toBe('standing');
    expect(i.environmentElements).toContain('railing');
  });

  it('reads "full body city photo"', () => {
    const i = LocalSceneInterpreter.interpret('full body city photo');
    expect(i.framing).toBe('full-body');
    expect(i.scene).toBe('city');
  });

  it('reads "girl leaning against a wall"', () => {
    const i = LocalSceneInterpreter.interpret('girl leaning against a wall');
    expect(i.bodyPosition).toBe('leaning');
    expect(i.environmentElements).toContain('wall');
  });

  it('honours inferred position as a hard constraint in results', () => {
    for (const p of search('standing beach pose')) {
      expect(p.bodyPosition).toBe('standing');
      expect(p.compatibleScenes).toContain('beach');
    }
  });

  it('returns couple poses only for a couple query', () => {
    const results = search('romantic couple photo on beach');
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) expect(p.peopleType).toBe('couple');
  });

  it('matches a pose by name', () => {
    expect(search('look back')[0].id).toBe('look-back');
  });

  it('lets an explicit filter override the interpreted text', () => {
    const session = createShotSession({ searchText: 'sitting at a cafe', bodyPosition: 'standing' });
    const results = recommend(all, constraintsFor(session));
    for (const p of results) expect(p.pose.bodyPosition).toBe('standing');
  });

  it('returns nothing rather than nonsense for an impossible combination', () => {
    const results = namesFor({ scene: 'pool', bodyPosition: 'sitting', peopleType: 'group', environmentElements: ['mirror'] });
    expect(results.length).toBe(0);
  });
});
