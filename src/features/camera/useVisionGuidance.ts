import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { PoseDetector, type DetectorStatus } from '@/vision/PoseDetector';
import { GuidanceEngine } from '@/guidance/GuidanceEngine';
import { LandmarkSmoother } from '@/guidance/smoothing';
import type { GuidanceOutput } from '@/guidance/types';
import { mapSourceToFrame, type ViewGeometry } from '@/camera/coordinates';
import type { Pose } from '@/models/pose';
import type { LandmarkSet } from '@/models/landmarks';

/**
 * Runs pose detection and guidance without dragging React through it (§56, §110).
 *
 * Inference is throttled, single-flight and skips stale frames. Landmarks live
 * in refs and never enter component state. Only the guidance TEXT — which
 * changes a few times a minute — is published to React.
 */

export interface VisionStats {
  fps: number;
  inferenceMs: number;
  detected: number;
}

export interface UseVisionOptions {
  enabled: boolean;
  pose: Pose | undefined;
  videoRef: RefObject<HTMLVideoElement>;
  geometryRef: RefObject<ViewGeometry>;
  /** Target analyses per second. 12 is a good balance on a modern iPhone. */
  targetHz?: number;
}

const IDLE: GuidanceOutput = {
  stage: 'find',
  instruction: null,
  hold: false,
  subjectCount: 0,
  blocked: null,
};

export function useVisionGuidance({
  enabled,
  pose,
  videoRef,
  geometryRef,
  targetHz = 12,
}: UseVisionOptions) {
  const detectorRef = useRef<PoseDetector | null>(null);
  const engineRef = useRef(new GuidanceEngine());
  const smootherRef = useRef(new LandmarkSmoother());
  const framePointsRef = useRef<LandmarkSet>([]);
  const peopleRef = useRef<LandmarkSet[]>([]);
  const rafRef = useRef(0);
  const lastRunRef = useRef(0);
  const statsRef = useRef<VisionStats>({ fps: 0, inferenceMs: 0, detected: 0 });
  const frameTimesRef = useRef<number[]>([]);

  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [guidance, setGuidance] = useState<GuidanceOutput>(IDLE);
  const guidanceRef = useRef<GuidanceOutput>(IDLE);
  const [stats, setStats] = useState<VisionStats>(statsRef.current);

  // Load the model only once the user is actually shooting with guidance on.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const detector = detectorRef.current ?? new PoseDetector({ maxPeople: 2 });
    detectorRef.current = detector;
    setStatus(detector.getStatus() === 'ready' ? 'ready' : 'loading');
    void detector.load().then(() => {
      if (!cancelled) setStatus(detector.getStatus());
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Restart the state machine whenever the pose changes: a correction for the
  // previous pose must never survive into the next one.
  useEffect(() => {
    engineRef.current.reset(performance.now());
    smootherRef.current.reset();
    guidanceRef.current = IDLE;
    setGuidance(IDLE);
  }, [pose?.id]);

  const publish = useCallback((next: GuidanceOutput) => {
    const prev = guidanceRef.current;
    const same =
      prev.stage === next.stage &&
      prev.hold === next.hold &&
      prev.instruction?.id === next.instruction?.id &&
      prev.instruction?.text === next.instruction?.text &&
      prev.subjectCount === next.subjectCount;
    if (same) return;
    guidanceRef.current = next;
    setGuidance(next);
  }, []);

  useEffect(() => {
    if (!enabled || !pose) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 1000 / targetHz;
    let running = true;

    const loop = () => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(loop);

      const now = performance.now();
      if (now - lastRunRef.current < interval) return;
      lastRunRef.current = now;

      const detector = detectorRef.current;
      const video = videoRef.current;
      const geometry = geometryRef.current;
      if (!detector?.isReady() || !video || !geometry) return;
      if (document.visibilityState === 'hidden') return;

      const result = detector.detect(video, now);
      if (!result) return;

      // Frame-rate accounting for the debug overlay only.
      const times = frameTimesRef.current;
      times.push(now);
      while (times.length > 20) times.shift();
      const span = times.length > 1 ? times[times.length - 1] - times[0] : 0;
      statsRef.current = {
        fps: span > 0 ? ((times.length - 1) * 1000) / span : 0,
        inferenceMs: result.inferenceMs,
        detected: result.people.length,
      };

      const people: LandmarkSet[] = [];
      for (let i = 0; i < result.people.length; i++) {
        const mapped =
          i === 0
            ? (mapSourceToFrame(result.people[i], geometry, framePointsRef.current) as LandmarkSet)
            : (mapSourceToFrame(result.people[i], geometry, []) as LandmarkSet);
        people.push(i === 0 ? (smootherRef.current.push(mapped, now) as LandmarkSet) : mapped);
      }
      peopleRef.current = people;

      publish(
        engineRef.current.evaluate({
          pose,
          people,
          worldLandmarks: result.world ?? undefined,
          now,
        }),
      );
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, pose, targetHz, videoRef, geometryRef, publish]);

  // Stats are for the debug overlay, so a slow refresh is plenty.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setStats({ ...statsRef.current }), 500);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(
    () => () => {
      detectorRef.current?.close();
      detectorRef.current = null;
    },
    [],
  );

  return {
    status,
    guidance: enabled ? guidance : IDLE,
    stats,
    peopleRef,
    error: detectorRef.current?.getError() ?? null,
  };
}
