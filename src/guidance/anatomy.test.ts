import { describe, expect, it } from 'vitest';
import { buildTargetSkeleton } from '@/models/skeleton';
import { PoseRepository } from '@/data/poseRepository';
import { matchPose } from '@/pose-matching/matcher';
import { L, type LandmarkSet } from '@/models/landmarks';
import { mapSourceToFrame, sourceToFrame, type ViewGeometry } from '@/camera/coordinates';

/**
 * SUBJECT-RELATIVE LEFT AND RIGHT (§72, §119).
 *
 * "Raise your right hand" must mean the photographed person's own right hand,
 * under a rear camera, under a mirrored front camera, and under any coordinate
 * transform in between. This suite is the guard on that promise.
 */

const pose = PoseRepository.get('easy-frontal')!;

const REAR: ViewGeometry = {
  videoWidth: 720,
  videoHeight: 1280,
  containerWidth: 360,
  containerHeight: 640,
  mirrored: false,
};
const FRONT_MIRRORED: ViewGeometry = { ...REAR, mirrored: true };
const CROPPED_MIRRORED: ViewGeometry = {
  videoWidth: 1280,
  videoHeight: 960,
  containerWidth: 390,
  containerHeight: 780,
  mirrored: true,
};

/** The subject bends their own right elbow far more than the pose asks. */
const bentRightElbow = (): LandmarkSet =>
  buildTargetSkeleton(
    { ...pose.targetSubjects[0].rig, armR: { upper: 90, lower: 5 } },
    {
      centreX: pose.compositionTarget.anchorX,
      centreY: pose.compositionTarget.anchorY,
      heightFraction: pose.compositionTarget.subjectHeight,
    },
  );

const throughCamera = (source: LandmarkSet, g: ViewGeometry): LandmarkSet => {
  const out: LandmarkSet = [];
  return mapSourceToFrame(source, g, out) as LandmarkSet;
};

describe('anatomical sides survive every transform', () => {
  it('names the right elbow under a rear camera', () => {
    const d = matchPose({ pose, frameLandmarks: throughCamera(bentRightElbow(), REAR) }).deviations;
    const elbow = d.find((x) => x.id === 'joint-rightElbow');
    expect(elbow?.instruction).toMatch(/your right/i);
  });

  it('still names the right elbow when the preview is mirrored', () => {
    const d = matchPose({
      pose,
      frameLandmarks: throughCamera(bentRightElbow(), FRONT_MIRRORED),
    }).deviations;
    const elbow = d.find((x) => x.id === 'joint-rightElbow');
    expect(elbow?.instruction).toMatch(/your right/i);
    expect(d.find((x) => x.id === 'joint-leftElbow')).toBeUndefined();
  });

  it('still names the right elbow when mirrored AND cropped', () => {
    const d = matchPose({
      pose,
      frameLandmarks: throughCamera(bentRightElbow(), CROPPED_MIRRORED),
    }).deviations;
    expect(d.find((x) => x.id === 'joint-rightElbow')?.instruction).toMatch(/your right/i);
  });

  it('produces the identical instruction in all three configurations', () => {
    const texts = [REAR, FRONT_MIRRORED, CROPPED_MIRRORED].map(
      (g) =>
        matchPose({ pose, frameLandmarks: throughCamera(bentRightElbow(), g) }).deviations.find(
          (x) => x.id === 'joint-rightElbow',
        )?.instruction,
    );
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toBeDefined();
  });

  it('keeps the anatomical landmark indices pointing at the same physical arm', () => {
    const source = bentRightElbow();
    const mirrored = throughCamera(source, FRONT_MIRRORED);
    // Mirroring moves the subject's right shoulder to the other side of the
    // screen, but it is still index 12 and still their right shoulder.
    expect(mirrored[L.RIGHT_SHOULDER].x).toBeGreaterThan(mirrored[L.LEFT_SHOULDER].x);
    expect(source[L.RIGHT_SHOULDER].x).toBeLessThan(source[L.LEFT_SHOULDER].x);
  });
});

describe('camera guidance is photographer-relative, not anatomical', () => {
  const offCentre = (sourceX: number): LandmarkSet =>
    buildTargetSkeleton(pose.targetSubjects[0].rig, {
      centreX: sourceX,
      centreY: pose.compositionTarget.anchorY,
      heightFraction: pose.compositionTarget.subjectHeight,
    });

  it('pans toward the side the photographer actually sees, unmirrored', () => {
    const d = matchPose({ pose, frameLandmarks: throughCamera(offCentre(0.2), REAR) }).deviations;
    expect(d.find((x) => x.id === 'frame-x')?.instruction).toMatch(/left/i);
  });

  it('pans the other way for the same sensor position when mirrored', () => {
    const plain = matchPose({
      pose,
      frameLandmarks: throughCamera(offCentre(0.2), REAR),
    }).deviations.find((x) => x.id === 'frame-x')?.instruction;
    const mirrored = matchPose({
      pose,
      frameLandmarks: throughCamera(offCentre(0.2), FRONT_MIRRORED),
    }).deviations.find((x) => x.id === 'frame-x')?.instruction;
    expect(plain).not.toBe(mirrored);
  });

  it('agrees with the raw transform about which way the subject moved', () => {
    const onScreen = sourceToFrame({ x: 0.2, y: 0.5 }, FRONT_MIRRORED);
    expect(onScreen.x).toBeGreaterThan(0.5);
  });
});
