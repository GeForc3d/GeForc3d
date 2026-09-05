import { describe, expect, it } from 'vitest';
import { PoseRepository, representationOf } from '@/data/poseRepository';
import {
  BODY_PROPORTIONS,
  REPRESENTATION_TYPES,
  diverseRepresentationFor,
} from '@/models/representation';
import { representationFor } from '@/features/saved/referencePreference';
import { matchPose } from '@/pose-matching/matcher';
import { SubjectShapeCalibration } from '@/pose-matching/features';
import { buildTargetSkeleton } from '@/models/skeleton';
import { L } from '@/models/landmarks';

/**
 * Representation is a way of DRAWING a pose, never a new pose and never an
 * input to matching (§8, §9). These tests are the guard on both promises.
 */

const all = PoseRepository.all();

describe('representation does not inflate the catalogue (§8)', () => {
  it('keeps one pose per concept however many bodies it is drawn on', () => {
    expect(all.length).toBe(41);
    expect(new Set(all.map((p) => p.id)).size).toBe(41);
    for (const p of all) {
      expect(p.representations.length).toBe(REPRESENTATION_TYPES.length);
    }
  });

  it('keeps family, signature and compatibility identical across representations', () => {
    for (const pose of all) {
      for (const rep of pose.representations) {
        // Representations carry geometry only; everything taxonomic lives on
        // the pose and cannot vary by body.
        expect(Object.keys(rep)).toEqual([
          'id',
          'representationType',
          'previewImage',
          'overlayImage',
          'targetSkeletons',
          'isPlaceholder',
        ]);
      }
    }
  });

  it('gives every representation one skeleton per person in the pose', () => {
    for (const pose of all) {
      for (const rep of pose.representations) {
        expect(rep.targetSkeletons.length).toBe(pose.targetSubjects.length);
        expect(rep.targetSkeletons[0].length).toBe(33);
      }
    }
  });

  it('actually draws different bodies', () => {
    const pose = PoseRepository.get('easy-frontal')!;
    const petite = representationOf(pose, 'petite').targetSkeletons[0];
    const plus = representationOf(pose, 'plus').targetSkeletons[0];
    const hipSpan = (s: typeof petite) => Math.abs(s[L.LEFT_HIP].x - s[L.RIGHT_HIP].x);
    expect(hipSpan(plus)).toBeGreaterThan(hipSpan(petite) * 1.1);
    expect(BODY_PROPORTIONS.plus.mass).toBeGreaterThan(BODY_PROPORTIONS.petite.mass);
  });
});

describe('matching ignores body proportions (§9)', () => {
  const pose = PoseRepository.get('weight-shift')!;

  it('reaches the same verdict whichever body performs the pose', () => {
    const verdicts = REPRESENTATION_TYPES.map((type) => {
      const skeleton = buildTargetSkeleton(
        pose.targetSubjects[0].rig,
        {
          centreX: pose.compositionTarget.anchorX,
          centreY: pose.compositionTarget.anchorY,
          heightFraction: pose.compositionTarget.subjectHeight,
        },
        BODY_PROPORTIONS[type],
      );
      const shape = new SubjectShapeCalibration();
      shape.observe(skeleton);
      return matchPose({
        pose,
        frameLandmarks: skeleton,
        shoulderRatio: shape.get(),
      }).deviations.filter((d) => d.magnitude > 1);
    });
    // A correctly performed pose produces no corrections on any body.
    for (const v of verdicts) expect(v.map((d) => d.id)).toEqual([]);
  });

  it('does not penalise a wider or taller body on the joint targets', () => {
    for (const type of REPRESENTATION_TYPES) {
      const skeleton = buildTargetSkeleton(
        pose.targetSubjects[0].rig,
        {
          centreX: pose.compositionTarget.anchorX,
          centreY: pose.compositionTarget.anchorY,
          heightFraction: pose.compositionTarget.subjectHeight,
        },
        BODY_PROPORTIONS[type],
      );
      const shape = new SubjectShapeCalibration();
      shape.observe(skeleton);
      const joints = matchPose({
        pose,
        frameLandmarks: skeleton,
        shoulderRatio: shape.get(),
      }).deviations.filter((d) => d.id.startsWith('joint-'));
      expect(joints, `${type} was penalised on joints`).toEqual([]);
    }
  });

  it('derives matcher targets from the canonical body, not a representation', () => {
    const canonical = pose.targetSkeletons[0];
    const average = representationOf(pose, 'average').targetSkeletons[0];
    for (const i of [L.LEFT_SHOULDER, L.RIGHT_HIP, L.LEFT_KNEE]) {
      expect(canonical[i].x).toBeCloseTo(average[i].x, 6);
      expect(canonical[i].y).toBeCloseTo(average[i].y, 6);
    }
  });
});

describe('default reference behaviour (§7)', () => {
  it('spreads bodies across the catalogue rather than showing one', () => {
    const used = new Set(all.map((p) => diverseRepresentationFor(p.id)));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it('is stable, so a pose does not change body between screens', () => {
    const a = diverseRepresentationFor('look-back');
    const b = diverseRepresentationFor('look-back');
    expect(a).toBe(b);
  });

  it('honours an explicit choice and returns to the mix when cleared', () => {
    expect(representationFor({ mode: 'fixed', type: 'curvy' }, 'look-back')).toBe('curvy');
    expect(representationFor({ mode: 'diverse' }, 'look-back')).toBe(
      diverseRepresentationFor('look-back'),
    );
  });
});
