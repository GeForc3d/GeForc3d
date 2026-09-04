import { describe, expect, it } from 'vitest';
import { buildSkeleton, buildTargetSkeleton, type RigSpec } from './skeleton';
import { L } from './landmarks';
import { extractFeatures, estimateHeadYaw } from '@/pose-matching/features';

const NEUTRAL: RigSpec = {
  armL: { upper: 100, lower: 100 },
  armR: { upper: 80, lower: 80 },
  legL: { upper: 95, lower: 92 },
  legR: { upper: 85, lower: 88 },
};

describe('skeleton rig conventions', () => {
  it('places the subject left side at a larger image x when facing camera', () => {
    const s = buildSkeleton(NEUTRAL);
    expect(s[L.LEFT_SHOULDER].x).toBeGreaterThan(s[L.RIGHT_SHOULDER].x);
    expect(s[L.LEFT_HIP].x).toBeGreaterThan(s[L.RIGHT_HIP].x);
  });

  it('puts the head above the hips and the feet below', () => {
    const s = buildSkeleton(NEUTRAL);
    expect(s[L.NOSE].y).toBeLessThan(s[L.LEFT_HIP].y);
    expect(s[L.LEFT_ANKLE].y).toBeGreaterThan(s[L.LEFT_HIP].y);
  });

  it('drifts the nose to image right when the subject turns to their own left', () => {
    const turned = buildSkeleton({ ...NEUTRAL, yawDeg: 60 });
    const front = buildSkeleton(NEUTRAL);
    expect(turned[L.NOSE].x).toBeGreaterThan(front[L.NOSE].x);
  });

  it('occludes the subject left ear when they turn to their own left', () => {
    const s = buildSkeleton({ ...NEUTRAL, yawDeg: 70 });
    expect(s[L.LEFT_EAR].visibility!).toBeLessThan(0.3);
    expect(s[L.RIGHT_EAR].visibility!).toBeGreaterThan(0.9);
  });

  it('compresses the shoulder span toward a profile as yaw increases', () => {
    const front = buildSkeleton(NEUTRAL);
    const profile = buildSkeleton({ ...NEUTRAL, yawDeg: 85 });
    const spanF = Math.abs(front[L.LEFT_SHOULDER].x - front[L.RIGHT_SHOULDER].x);
    const spanP = Math.abs(profile[L.LEFT_SHOULDER].x - profile[L.RIGHT_SHOULDER].x);
    expect(spanP).toBeLessThan(spanF * 0.2);
  });

  it('normalises into the requested preview box', () => {
    const s = buildTargetSkeleton(NEUTRAL, { centreX: 0.5, centreY: 0.5, heightFraction: 0.8 });
    const ys = s.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.8, 4);
    expect(Math.min(...ys)).toBeGreaterThan(0.05);
    expect(Math.max(...ys)).toBeLessThan(0.95);
  });
});

describe('feature extraction round-trips the rig', () => {
  it('reports a straight arm as ~180 degrees at the elbow', () => {
    const s = buildSkeleton({ ...NEUTRAL, armL: { upper: 90, lower: 90 } });
    expect(extractFeatures(s).leftElbow).toBeGreaterThan(178);
  });

  it('reports a right-angled elbow as ~90 degrees', () => {
    const s = buildSkeleton({ ...NEUTRAL, armR: { upper: 90, lower: 0 } });
    expect(extractFeatures(s).rightElbow).toBeCloseTo(90, 0);
  });

  it('reports torso lean toward image right as positive', () => {
    const f = extractFeatures(buildSkeleton({ ...NEUTRAL, leanDeg: 12 }));
    expect(f.torsoLeanDeg).toBeGreaterThan(8);
    const g = extractFeatures(buildSkeleton({ ...NEUTRAL, leanDeg: -12 }));
    expect(g.torsoLeanDeg).toBeLessThan(-8);
  });

  it('recovers the sign of a turn toward the subject own left', () => {
    const f = extractFeatures(buildSkeleton({ ...NEUTRAL, yawDeg: 55 }));
    expect(f.torsoYawDeg).toBeGreaterThan(20);
    const g = extractFeatures(buildSkeleton({ ...NEUTRAL, yawDeg: -55 }));
    expect(g.torsoYawDeg).toBeLessThan(-20);
  });

  it('reads head yaw toward the subject own left as positive', () => {
    const s = buildSkeleton({ ...NEUTRAL, headYawDeg: 45 });
    expect(estimateHeadYaw(s).yawDeg).toBeGreaterThan(10);
    const t = buildSkeleton({ ...NEUTRAL, headYawDeg: -45 });
    expect(estimateHeadYaw(t).yawDeg).toBeLessThan(-10);
  });

  it('reports a dropped subject-left shoulder as positive tilt', () => {
    const f = extractFeatures(buildSkeleton({ ...NEUTRAL, shoulderTiltDeg: 8 }));
    expect(f.shoulderTiltDeg).toBeGreaterThan(4);
  });
});
