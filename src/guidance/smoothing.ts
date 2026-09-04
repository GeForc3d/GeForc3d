import { LANDMARK_COUNT, type Landmark, type LandmarkSet } from '@/models/landmarks';

/**
 * Landmark smoothing (§68).
 *
 * Raw detection jitters by a few percent every frame, which is enough to make
 * an unsmoothed instruction flicker between "move left" and "move right". This
 * is a velocity-adaptive exponential filter: it follows fast, deliberate
 * movement closely and heavily damps small noise while the subject holds still.
 */
export class LandmarkSmoother {
  private state: Landmark[] | null = null;
  private lastTime = 0;

  constructor(
    private readonly minAlpha = 0.18,
    private readonly maxAlpha = 0.85,
    /** Movement in normalised units per second that counts as fast. */
    private readonly fastSpeed = 0.9,
  ) {}

  reset(): void {
    this.state = null;
    this.lastTime = 0;
  }

  push(points: LandmarkSet, now: number): LandmarkSet {
    if (!this.state) {
      this.state = points.map((p) => ({ ...p }));
      this.lastTime = now;
      return this.state;
    }
    const dt = Math.max(1, now - this.lastTime) / 1000;
    this.lastTime = now;

    for (let i = 0; i < Math.min(points.length, LANDMARK_COUNT); i++) {
      const raw = points[i];
      const prev = this.state[i] ?? (this.state[i] = { ...raw });
      const speed = Math.hypot(raw.x - prev.x, raw.y - prev.y) / dt;
      const t = Math.min(1, speed / this.fastSpeed);
      const alpha = this.minAlpha + (this.maxAlpha - this.minAlpha) * t;
      prev.x += (raw.x - prev.x) * alpha;
      prev.y += (raw.y - prev.y) * alpha;
      if (raw.z != null) prev.z = (prev.z ?? raw.z) + (raw.z - (prev.z ?? raw.z)) * alpha;
      // Visibility is smoothed gently in both directions so a single dropped
      // frame never revokes an instruction.
      prev.visibility =
        (prev.visibility ?? 0) + ((raw.visibility ?? 0) - (prev.visibility ?? 0)) * 0.3;
    }
    this.state.length = Math.min(points.length, LANDMARK_COUNT);
    return this.state;
  }
}
