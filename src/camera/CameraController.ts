import {
  classifyCameraError,
  inspectDevices,
  inspectTrack,
  type DeviceReport,
  type TrackCapabilityReport,
} from './capabilities';

/**
 * Owns the MediaStream and its lifecycle (§41). One place starts tracks, one
 * place stops them, and nothing leaves a camera running when the user has
 * navigated away or backgrounded the tab.
 */

export type FacingMode = 'environment' | 'user';

export interface CameraState {
  status: 'idle' | 'starting' | 'live' | 'error';
  facingMode: FacingMode;
  capabilities: TrackCapabilityReport | null;
  devices: DeviceReport;
  error: { availability: string; message: string } | null;
}

type Listener = (state: CameraState) => void;

export class CameraController {
  private stream: MediaStream | null = null;
  private listeners = new Set<Listener>();
  private startToken = 0;

  private state: CameraState = {
    status: 'idle',
    facingMode: 'environment',
    capabilities: null,
    devices: { hasFrontCamera: null, hasRearCamera: null, cameraCount: 0 },
    error: null,
  };

  getState(): CameraState {
    return this.state;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private set(patch: Partial<CameraState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  /**
   * Requests the camera. Falls back from an exact facing constraint to a soft
   * one, because a device with only a front camera legitimately cannot satisfy
   * `exact: 'environment'` and that is not an error worth showing the user.
   */
  async start(facingMode: FacingMode = this.state.facingMode): Promise<void> {
    const token = ++this.startToken;
    this.stop();
    this.set({ status: 'starting', facingMode, error: null });

    if (!navigator.mediaDevices?.getUserMedia) {
      this.set({
        status: 'error',
        error: {
          availability: 'api-unavailable',
          message: 'This browser does not expose a camera API to web pages.',
        },
      });
      return;
    }

    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      { video: { facingMode }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // A newer start() ran while we were awaiting; discard this stream.
        if (token !== this.startToken) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.stream = stream;
        const track = stream.getVideoTracks()[0];
        const devices = await inspectDevices();
        if (token !== this.startToken) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.set({
          status: 'live',
          facingMode,
          capabilities: track ? inspectTrack(track) : null,
          devices,
          error: null,
        });
        return;
      } catch (err) {
        lastError = err;
        // A denied permission will not be fixed by a looser constraint.
        if ((err as { name?: string })?.name === 'NotAllowedError') break;
      }
    }

    if (token !== this.startToken) return;
    this.set({ status: 'error', error: classifyCameraError(lastError) });
  }

  /** Switches cameras without tearing down more than necessary. */
  async switchCamera(): Promise<void> {
    const next: FacingMode = this.state.facingMode === 'environment' ? 'user' : 'environment';
    await this.start(next);
  }

  async setTorch(on: boolean): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || !this.state.capabilities?.torch) return false;
    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      return false;
    }
  }

  async setZoom(value: number): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0];
    const zoom = this.state.capabilities?.zoom;
    if (!track || !zoom) return false;
    const clamped = Math.min(zoom.max, Math.max(zoom.min, value));
    try {
      await track.applyConstraints({
        advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Stops every track. Safe to call repeatedly. */
  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.state.status !== 'idle') this.set({ status: 'idle', capabilities: null });
  }

  dispose(): void {
    this.startToken++;
    this.stop();
    this.listeners.clear();
  }
}
