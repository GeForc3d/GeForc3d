import type { LandmarkSet } from '@/models/landmarks';
import { appBasePath } from '@/utilities/basePath';

/**
 * MediaPipe Pose Landmarker, running entirely on device (§55, §107).
 *
 * No frame ever leaves the browser. The model and its WASM runtime are bundled
 * with the app rather than fetched from a CDN, so the camera works in embedded
 * and offline contexts where a remote fetch would be blocked.
 *
 * The import is dynamic so a device that never opens the camera never pays for
 * a 5MB model, and so a failure to load degrades to manual mode instead of
 * taking the whole app down (§74).
 */

export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

export interface DetectionResult {
  /** One entry per detected person, normalised to the source video frame. */
  people: LandmarkSet[];
  /** Metric 3D landmarks for the first person, when the model provides them. */
  world: LandmarkSet | null;
  inferenceMs: number;
  timestamp: number;
}

export interface DetectorOptions {
  maxPeople?: number;
  /** Paths are relative to the document, matching the app's relative base. */
  wasmPath?: string;
  modelPath?: string;
}

interface LandmarkerLike {
  detectForVideo(
    video: HTMLVideoElement,
    timestamp: number,
  ): {
    landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
    worldLandmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
  };
  close(): void;
}

const baseUrl = appBasePath;

export class PoseDetector {
  private landmarker: LandmarkerLike | null = null;
  private status: DetectorStatus = 'idle';
  private error: string | null = null;
  private busy = false;
  private lastTimestamp = -1;
  private loadPromise: Promise<void> | null = null;

  constructor(private readonly options: DetectorOptions = {}) {}

  getStatus(): DetectorStatus {
    return this.status;
  }

  getError(): string | null {
    return this.error;
  }

  isReady(): boolean {
    return this.status === 'ready' && this.landmarker !== null;
  }

  /** Idempotent. Concurrent callers share one load. */
  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    this.status = 'loading';
    this.error = null;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const base = baseUrl();
      const fileset = await vision.FilesetResolver.forVisionTasks(
        this.options.wasmPath ?? `${base}vision/wasm`,
      );
      this.landmarker = (await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: this.options.modelPath ?? `${base}vision/models/pose_landmarker_lite.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: this.options.maxPeople ?? 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })) as unknown as LandmarkerLike;
      this.status = 'ready';
    } catch (err) {
      // A GPU delegate failure is common on older devices; retry on CPU once.
      const retried = await this.retryOnCpu();
      if (retried) return;
      this.status = 'error';
      this.error =
        err instanceof Error ? err.message : 'The pose model could not be loaded.';
      this.landmarker = null;
    }
  }

  private async retryOnCpu(): Promise<boolean> {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const base = baseUrl();
      const fileset = await vision.FilesetResolver.forVisionTasks(
        this.options.wasmPath ?? `${base}vision/wasm`,
      );
      this.landmarker = (await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            this.options.modelPath ?? `${base}vision/models/pose_landmarker_lite.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: this.options.maxPeople ?? 1,
      })) as unknown as LandmarkerLike;
      this.status = 'ready';
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Runs one inference. Returns null when the detector is busy or the frame is
   * stale, so the caller never queues work it cannot keep up with (§56).
   */
  detect(video: HTMLVideoElement, timestampMs: number): DetectionResult | null {
    if (!this.landmarker || this.busy) return null;
    if (timestampMs <= this.lastTimestamp) return null;
    if (!video.videoWidth || video.readyState < 2) return null;

    this.busy = true;
    const started = performance.now();
    try {
      this.lastTimestamp = timestampMs;
      const result = this.landmarker.detectForVideo(video, timestampMs);
      const people = (result.landmarks ?? []) as LandmarkSet[];
      const world = (result.worldLandmarks?.[0] ?? null) as LandmarkSet | null;
      return {
        people,
        world,
        inferenceMs: performance.now() - started,
        timestamp: timestampMs,
      };
    } catch {
      // A single bad frame must not kill the loop.
      return null;
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    try {
      this.landmarker?.close();
    } catch {
      /* already gone */
    }
    this.landmarker = null;
    this.status = 'idle';
    this.loadPromise = null;
    this.lastTimestamp = -1;
  }
}
