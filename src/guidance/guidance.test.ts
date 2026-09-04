import { describe, expect, it } from 'vitest';
import { buildTargetSkeleton, type RigSpec } from '@/models/skeleton';
import { PoseRepository } from '@/data/poseRepository';
import { GuidanceEngine, DEFAULT_GUIDANCE_CONFIG } from './GuidanceEngine';
import { LandmarkSmoother } from './smoothing';
import { matchPose } from '@/pose-matching/matcher';
import { L, type LandmarkSet } from '@/models/landmarks';
import { normalizeSkeleton } from '@/pose-matching/normalize';

/**
 * Guidance is tested entirely without a camera (§118). Synthetic skeletons are
 * built from the same rig the catalogue uses, then deliberately broken.
 */

const pose = PoseRepository.get('easy-frontal')!;

/** Rebuilds this pose's own target as if the subject nailed it perfectly. */
const perfect = (overrides: Partial<RigSpec> = {}, placement = {}): LandmarkSet =>
  buildTargetSkeleton(
    { ...pose.targetSubjects[0].rig, ...overrides },
    {
      centreX: pose.compositionTarget.anchorX,
      centreY: pose.compositionTarget.anchorY,
      heightFraction: pose.compositionTarget.subjectHeight,
      ...placement,
    },
  );

const run = (
  people: LandmarkSet[],
  engine = new GuidanceEngine(),
  frames = 1,
  step = 120,
  target = pose,
) => {
  let out = engine.evaluate({ pose: target, people, now: 0 });
  for (let i = 1; i < frames; i++) {
    out = engine.evaluate({ pose: target, people, now: i * step });
  }
  return out;
};

describe('find', () => {
  it('asks the photographer to point the camera when nobody is detected', () => {
    const engine = new GuidanceEngine();
    const out = run([], engine, 12, 120);
    expect(out.stage).toBe('find');
    expect(out.instruction?.actor).toBe('camera');
    expect(out.subjectCount).toBe(0);
  });

  it('does not panic over a single dropped frame', () => {
    const engine = new GuidanceEngine();
    engine.evaluate({ pose, people: [perfect({ leanDeg: 30 })], now: 0 });
    const out = engine.evaluate({ pose, people: [], now: 100 });
    expect(out.instruction?.id).not.toBe('find-none');
  });

  it('asks for both people in a couple pose when only one is visible', () => {
    const couple = PoseRepository.get('couple-side-by-side')!;
    const engine = new GuidanceEngine();
    const one = buildTargetSkeleton(couple.targetSubjects[0].rig, {
      centreX: 0.5,
      centreY: 0.5,
      heightFraction: 0.78,
    });
    const out = engine.evaluate({ pose: couple, people: [one], now: 0 });
    expect(out.stage).toBe('find');
    expect(out.instruction?.text).toMatch(/both/i);
  });

  it('does not judge a portrait pose on legs it never asked for (§58)', () => {
    const portrait = PoseRepository.get('over-the-shoulder')!;
    const legless = buildTargetSkeleton(portrait.targetSubjects[0].rig, {
      centreX: portrait.compositionTarget.anchorX,
      centreY: portrait.compositionTarget.anchorY,
      heightFraction: portrait.compositionTarget.subjectHeight,
    }).map((p, i) =>
      i >= L.LEFT_KNEE ? { ...p, visibility: 0 } : p,
    );
    const { missingGroups } = matchPose({ pose: portrait, frameLandmarks: legless });
    expect(missingGroups).toEqual([]);
  });
});

describe('framing', () => {
  it('asks the photographer to step back when the subject fills too much', () => {
    const tooBig = perfect({}, { heightFraction: 0.99 });
    const { deviations } = matchPose({ pose, frameLandmarks: tooBig });
    const scale = deviations.find((d) => d.id === 'frame-scale');
    expect(scale?.instruction).toMatch(/step back/i);
    expect(scale?.actor).toBe('camera');
  });

  it('asks the photographer to come closer when the subject is small', () => {
    const tooSmall = perfect({}, { heightFraction: 0.35 });
    const { deviations } = matchPose({ pose, frameLandmarks: tooSmall });
    expect(deviations.find((d) => d.id === 'frame-scale')?.instruction).toMatch(/closer/i);
  });

  it('pans the camera the way that moves the subject toward the anchor', () => {
    const left = perfect({}, { centreX: 0.2 });
    const right = perfect({}, { centreX: 0.8 });
    const dl = matchPose({ pose, frameLandmarks: left }).deviations.find((d) => d.id === 'frame-x');
    const dr = matchPose({ pose, frameLandmarks: right }).deviations.find((d) => d.id === 'frame-x');
    expect(dl?.instruction).toMatch(/left/i);
    expect(dr?.instruction).toMatch(/right/i);
  });

  it('fixes framing before it starts talking about the body', () => {
    const engine = new GuidanceEngine();
    const broken = perfect({ leanDeg: 26 }, { heightFraction: 0.35 });
    const out = run([broken], engine, 3);
    expect(out.stage).toBe('frame');
    expect(out.instruction?.actor).toBe('camera');
  });
});

describe('body and limbs', () => {
  it('raises a torso instruction when the lean is well off', () => {
    const leaning = perfect({ leanDeg: 28 });
    const { deviations } = matchPose({ pose, frameLandmarks: leaning });
    expect(deviations.some((d) => d.id === 'torso-lean')).toBe(true);
  });

  it('says nothing about a lean inside tolerance (§59)', () => {
    const { deviations } = matchPose({ pose, frameLandmarks: perfect({ leanDeg: 4 }) });
    expect(deviations.find((d) => d.id === 'torso-lean')).toBeUndefined();
  });

  it('names the subject own arm when that arm is wrong', () => {
    const bent = perfect({ armR: { upper: 90, lower: 10 } });
    const { deviations } = matchPose({ pose, frameLandmarks: bent });
    const elbow = deviations.find((d) => d.id === 'joint-rightElbow');
    expect(elbow).toBeDefined();
    expect(elbow!.instruction).toMatch(/right/i);
    expect(elbow!.instruction).not.toMatch(/left/i);
  });

  it('handles the body before the limbs', () => {
    const engine = new GuidanceEngine();
    const broken = perfect({ leanDeg: 28, armR: { upper: 90, lower: 10 } });
    expect(run([broken], engine, 3).stage).toBe('body');
  });

  it('produces nothing at all for a perfect pose', () => {
    const { deviations } = matchPose({ pose, frameLandmarks: perfect() });
    expect(deviations.filter((d) => d.magnitude > 1)).toEqual([]);
  });
});

describe('head', () => {
  it('asks for a head turn when the yaw is off and the face is readable', () => {
    const turned = perfect({ headYawDeg: 55 });
    const { deviations } = matchPose({ pose, frameLandmarks: turned });
    const head = deviations.find((d) => d.id === 'head-yaw');
    expect(head).toBeDefined();
    expect(head!.instruction).toMatch(/head right/i);
  });

  it('stays silent about the head when the face is not confident (§73)', () => {
    const noFace = perfect({ headYawDeg: 55 }).map((p, i) =>
      i <= L.MOUTH_RIGHT ? { ...p, visibility: 0.05 } : p,
    );
    const { deviations } = matchPose({ pose, frameLandmarks: noFace });
    expect(deviations.some((d) => d.stage === 'head')).toBe(false);
  });

  it('leaves the head until the body is right', () => {
    const engine = new GuidanceEngine();
    const broken = perfect({ leanDeg: 28, headYawDeg: 60 });
    expect(run([broken], engine, 3).stage).toBe('body');
  });
});

describe('hold stability (§69)', () => {
  it('does not enter hold from a single good frame', () => {
    const engine = new GuidanceEngine();
    const out = engine.evaluate({ pose, people: [perfect()], now: 0 });
    expect(out.hold).toBe(false);
  });

  it('enters hold after a short stable period', () => {
    const engine = new GuidanceEngine();
    const good = perfect();
    engine.evaluate({ pose, people: [good], now: 0 });
    engine.evaluate({ pose, people: [good], now: 300 });
    const out = engine.evaluate({ pose, people: [good], now: 700 });
    expect(out.hold).toBe(true);
    expect(out.stage).toBe('hold');
    expect(out.instruction).toBeNull();
  });

  it('does not drop out of hold on a tiny wobble', () => {
    const engine = new GuidanceEngine();
    const good = perfect();
    for (const t of [0, 300, 700]) engine.evaluate({ pose, people: [good], now: t });
    const wobble = perfect({ leanDeg: 12 });
    expect(engine.evaluate({ pose, people: [wobble], now: 800 }).hold).toBe(true);
  });

  it('leaves hold when the pose genuinely breaks', () => {
    const engine = new GuidanceEngine();
    const good = perfect();
    for (const t of [0, 300, 700]) engine.evaluate({ pose, people: [good], now: t });
    const broken = perfect({ leanDeg: 40 });
    const out = engine.evaluate({ pose, people: [broken], now: 900 });
    expect(out.hold).toBe(false);
    expect(out.instruction).not.toBeNull();
  });
});

describe('instruction stability (§68)', () => {
  it('never shows more than one instruction', () => {
    const engine = new GuidanceEngine();
    const broken = perfect({ leanDeg: 30, armR: { upper: 40, lower: 0 }, headYawDeg: 70 });
    const out = run([broken], engine, 4);
    expect(out.instruction).not.toBeNull();
    expect(typeof out.instruction!.text).toBe('string');
  });

  it('holds an instruction for its dwell time rather than swapping every frame', () => {
    const engine = new GuidanceEngine();
    const a = perfect({ leanDeg: 30 });
    const first = engine.evaluate({ pose, people: [a], now: 0 });
    // A different, slightly more important problem arrives immediately.
    const b = perfect({ leanDeg: 14, armR: { upper: 20, lower: -20 } });
    const second = engine.evaluate({ pose, people: [b], now: 200 });
    expect(second.instruction?.id).toBe(first.instruction?.id);
  });

  it('does swap once the dwell time has passed and the rival is clearly bigger', () => {
    const engine = new GuidanceEngine();
    engine.evaluate({ pose, people: [perfect({ armR: { upper: 84, lower: 60 } })], now: 0 });
    const worse = perfect({ leanDeg: 40 });
    const out = engine.evaluate({
      pose,
      people: [worse],
      now: DEFAULT_GUIDANCE_CONFIG.minInstructionMs + 200,
    });
    expect(out.instruction?.id).toBe('torso-lean');
  });

  it('smooths jitter instead of chasing it', () => {
    const smoother = new LandmarkSmoother();
    const base = perfect();
    let last = smoother.push(base, 0);
    const noisy = base.map((p, i) => ({ ...p, x: p.x + (i % 2 ? 0.01 : -0.01) }));
    last = smoother.push(noisy, 60);
    const drift = Math.abs(last[L.NOSE].x - base[L.NOSE].x);
    expect(drift).toBeLessThan(0.006);
  });
});

describe('normalisation is body-shape independent (§53)', () => {
  it('produces near-identical skeletons for very different builds', () => {
    const small = perfect({}, { heightFraction: 0.45, centreX: 0.3 });
    const large = perfect({}, { heightFraction: 0.9, centreX: 0.7 });
    const a = normalizeSkeleton(small);
    const b = normalizeSkeleton(large);
    expect(a.valid && b.valid).toBe(true);
    for (const i of [L.LEFT_SHOULDER, L.RIGHT_KNEE, L.NOSE]) {
      expect(a.points[i].x).toBeCloseTo(b.points[i].x, 5);
      expect(a.points[i].y).toBeCloseTo(b.points[i].y, 5);
    }
  });

  it('gives the same joint verdict regardless of where the subject stands', () => {
    const near = perfect({ armR: { upper: 90, lower: 5 } }, { heightFraction: 0.9 });
    const far = perfect({ armR: { upper: 90, lower: 5 } }, { heightFraction: 0.45 });
    const a = matchPose({ pose, frameLandmarks: near }).deviations.find(
      (d) => d.id === 'joint-rightElbow',
    );
    const b = matchPose({ pose, frameLandmarks: far }).deviations.find(
      (d) => d.id === 'joint-rightElbow',
    );
    expect(a?.instruction).toBe(b?.instruction);
  });
});
