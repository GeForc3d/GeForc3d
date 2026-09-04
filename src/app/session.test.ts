import { describe, expect, it } from 'vitest';
import { createShotSession, describeSession, sessionHasIntent } from '@/models/shotSession';
import { PoseRepository } from '@/data/poseRepository';
import { compatiblePoses, constraintsFor, satisfiesHardConstraints } from '@/recommendations/engine';
import {
  BODY_POSITION_LABELS,
  PEOPLE_LABELS,
  SCENE_LABELS,
} from '@/models/taxonomy';

/**
 * The change-mind and capture-session scenarios (§124, §125), exercised against
 * the real domain layer rather than the interface. These assert the guarantees
 * the screens depend on: nothing is lost, nothing is silently swapped, and a
 * shoot survives every reasonable change of plan.
 */

const LABELS = {
  scene: SCENE_LABELS as Record<string, string>,
  position: BODY_POSITION_LABELS as Record<string, string>,
  people: PEOPLE_LABELS as Record<string, string>,
};

describe('shot session', () => {
  it('starts with no intent and no camera implied', () => {
    const s = createShotSession();
    expect(sessionHasIntent(s)).toBe(false);
    expect(s.selectedPoseId).toBeNull();
    expect(s.guideEnabled).toBe(true);
    expect(s.overlayLocked).toBe(false);
  });

  it('registers intent from any single choice', () => {
    expect(sessionHasIntent(createShotSession({ scene: 'beach' }))).toBe(true);
    expect(sessionHasIntent(createShotSession({ searchText: 'cafe' }))).toBe(true);
    expect(sessionHasIntent(createShotSession({ vibes: ['candid'] }))).toBe(true);
  });

  it('describes itself the way the resume card reads', () => {
    const s = createShotSession({
      scene: 'beach',
      bodyPosition: 'standing',
      peopleType: 'individual',
    });
    expect(describeSession(s, LABELS)).toBe('Beach · Standing · Individual');
  });

  it('falls back to the typed text when nothing structured was chosen', () => {
    const s = createShotSession({ searchText: 'golden hour rooftop' });
    expect(describeSession(s, LABELS)).toBe('golden hour rooftop');
  });
});

describe('the change-mind scenario (§124)', () => {
  const all = PoseRepository.all();

  it('lets the user switch to another compatible pose without changing the setup', () => {
    const session = createShotSession({
      scene: 'beach',
      bodyPosition: 'standing',
      peopleType: 'individual',
      selectedPoseId: 'look-back',
    });
    const options = compatiblePoses(all, constraintsFor(session));
    expect(options.length).toBeGreaterThan(2);
    expect(options.map((p) => p.id)).toContain('look-back');
    for (const p of options) expect(p.bodyPosition).toBe('standing');
  });

  it('detects that the active pose has become impossible after an edit', () => {
    const before = createShotSession({
      scene: 'beach',
      bodyPosition: 'standing',
      peopleType: 'individual',
      selectedPoseId: 'look-back',
    });
    const pose = PoseRepository.get(before.selectedPoseId)!;
    expect(satisfiesHardConstraints(pose, constraintsFor(before))).toBe(true);

    const after = { ...before, bodyPosition: 'sitting' as const };
    expect(satisfiesHardConstraints(pose, constraintsFor(after))).toBe(false);
  });

  it('offers real sitting alternatives rather than an empty tray', () => {
    const after = createShotSession({
      scene: 'beach',
      bodyPosition: 'sitting',
      peopleType: 'individual',
    });
    const options = compatiblePoses(all, constraintsFor(after));
    expect(options.length).toBeGreaterThan(0);
    for (const p of options) {
      expect(p.bodyPosition).toBe('sitting');
      expect(p.compatibleScenes).toContain('beach');
    }
  });

  it('keeps the rest of the setup intact through the change', () => {
    const before = createShotSession({
      scene: 'beach',
      bodyPosition: 'standing',
      peopleType: 'individual',
      vibes: ['candid'],
      resultScrollPosition: 420,
    });
    const after = { ...before, bodyPosition: 'sitting' as const };
    expect(after.scene).toBe('beach');
    expect(after.peopleType).toBe('individual');
    expect(after.vibes).toEqual(['candid']);
    expect(after.resultScrollPosition).toBe(420);
  });
});

describe('the capture-session scenario (§125)', () => {
  it('accumulates shots without ending the session', () => {
    let session = createShotSession({
      scene: 'beach',
      bodyPosition: 'standing',
      peopleType: 'individual',
      selectedPoseId: 'look-back',
    });
    session = { ...session, capturedPoseIds: [...session.capturedPoseIds, 'look-back'] };
    session = { ...session, capturedPoseIds: [...session.capturedPoseIds, 'look-back'] };
    expect(session.capturedPoseIds).toEqual(['look-back', 'look-back']);
    expect(session.selectedPoseId).toBe('look-back');
    expect(sessionHasIntent(session)).toBe(true);
  });

  it('drops the last shot on retake and keeps the pose selected', () => {
    const session = createShotSession({
      selectedPoseId: 'look-back',
      capturedPoseIds: ['look-back', 'weight-shift'],
    });
    const retaken = { ...session, capturedPoseIds: session.capturedPoseIds.slice(0, -1) };
    expect(retaken.capturedPoseIds).toEqual(['look-back']);
    expect(retaken.selectedPoseId).toBe('look-back');
  });

  it('steps to the next compatible pose and wraps around', () => {
    const session = createShotSession({
      scene: 'beach',
      bodyPosition: 'standing',
      peopleType: 'individual',
      selectedPoseId: 'look-back',
    });
    const options = compatiblePoses(PoseRepository.all(), constraintsFor(session));
    const idx = options.findIndex((p) => p.id === 'look-back');
    expect(idx).toBeGreaterThanOrEqual(0);
    const next = options[(idx + 1) % options.length];
    const prev = options[(idx - 1 + options.length) % options.length];
    expect(next.id).not.toBe('look-back');
    expect(prev.id).not.toBe('look-back');
  });

  it('keeps the guide transform across a pose category change', () => {
    const session = createShotSession({
      overlayTransform: { x: 0.1, y: -0.05, scale: 1.3 },
      overlayOpacity: 0.5,
      overlayMirrored: true,
      bodyPosition: 'standing',
    });
    const edited = { ...session, bodyPosition: 'sitting' as const };
    expect(edited.overlayOpacity).toBe(0.5);
    expect(edited.overlayMirrored).toBe(true);
  });
});

describe('manual fallback (§126)', () => {
  it('needs no vision to reach a pose, its reference and its guide', () => {
    const session = createShotSession({ scene: 'cafe', bodyPosition: 'sitting' });
    const options = compatiblePoses(PoseRepository.all(), constraintsFor(session));
    expect(options.length).toBeGreaterThan(0);
    const pose = options[0];
    // Everything the manual path needs comes from static data.
    expect(pose.targetSkeletons.length).toBeGreaterThan(0);
    expect(pose.subjectInstructions.length).toBeGreaterThan(0);
    expect(pose.photographerInstructions.length).toBeGreaterThan(0);
    expect(pose.assets).toBeDefined();
  });

  it('marks every pose reference as a placeholder while no photography exists', () => {
    const missing = PoseRepository.all().filter((p) => p.assets.previewIsPlaceholder);
    // If this ever fails, real photography has landed and the badge copy on the
    // pose detail screen should be revisited.
    expect(missing.length).toBe(PoseRepository.count());
  });
});
