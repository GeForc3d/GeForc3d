/**
 * Camera capability detection (§4, §40).
 *
 * Nothing here assumes anything. We do not assume the browser exposes
 * mediaDevices, that the page is allowed to use it, that a rear camera exists,
 * or that torch and zoom are available. Every control the UI offers is backed
 * by a capability we have actually observed.
 */

export type CameraAvailability =
  | 'available'
  | 'permission-required'
  | 'permission-denied'
  | 'api-unavailable'
  | 'insecure-context'
  | 'embedded-blocked'
  | 'no-camera';

export interface EnvironmentReport {
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  isSecureContext: boolean;
  isEmbedded: boolean;
  /** True when the embedding frame has explicitly granted camera permission. */
  embedAllowsCamera: boolean | null;
  /** Best guess at the initial state, before any permission request. */
  availability: CameraAvailability;
}

export function inspectEnvironment(): EnvironmentReport {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const hasMediaDevices = Boolean(nav?.mediaDevices);
  const hasGetUserMedia = Boolean(nav?.mediaDevices?.getUserMedia);
  const isSecureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost');

  let isEmbedded = false;
  try {
    isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    // A cross-origin parent throws on access, which itself means we are embedded.
    isEmbedded = true;
  }

  // Permissions Policy is the only reliable signal about an embedding frame.
  let embedAllowsCamera: boolean | null = null;
  const fl = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } })
    ?.featurePolicy;
  try {
    if (fl?.allowsFeature) embedAllowsCamera = fl.allowsFeature('camera');
  } catch {
    embedAllowsCamera = null;
  }

  let availability: CameraAvailability = 'permission-required';
  if (!hasMediaDevices || !hasGetUserMedia) availability = 'api-unavailable';
  else if (!isSecureContext) availability = 'insecure-context';
  else if (isEmbedded && embedAllowsCamera === false) availability = 'embedded-blocked';

  return {
    hasMediaDevices,
    hasGetUserMedia,
    isSecureContext,
    isEmbedded,
    embedAllowsCamera,
    availability,
  };
}

export interface DeviceReport {
  /** Null when enumeration is not permitted yet, which is normal pre-grant. */
  hasFrontCamera: boolean | null;
  hasRearCamera: boolean | null;
  cameraCount: number;
}

/**
 * Before permission is granted, `enumerateDevices` returns entries with empty
 * labels, so facing direction cannot be known. We report null rather than
 * guessing, and the camera-flip control stays hidden until we actually know.
 */
export async function inspectDevices(): Promise<DeviceReport> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { hasFrontCamera: null, hasRearCamera: null, cameraCount: 0 };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    const labelled = cams.filter((d) => d.label);
    if (!labelled.length) {
      return {
        hasFrontCamera: null,
        hasRearCamera: null,
        cameraCount: cams.length,
      };
    }
    const front = labelled.some((d) => /front|user|face/i.test(d.label));
    const rear = labelled.some((d) => /back|rear|environment|world/i.test(d.label));
    return {
      // Two labelled cameras with no directional words still means both exist.
      hasFrontCamera: front || (!rear && cams.length > 1),
      hasRearCamera: rear || (!front && cams.length > 1),
      cameraCount: cams.length,
    };
  } catch {
    return { hasFrontCamera: null, hasRearCamera: null, cameraCount: 0 };
  }
}

export interface TrackCapabilityReport {
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
  facingMode: string | null;
  width: number;
  height: number;
}

/**
 * Reads what a live track can actually do. Safari on iOS exposes neither torch
 * nor zoom through this API today, so on iPhone this correctly reports false
 * and the app shows no flash or lens buttons rather than fake ones (§40, §115).
 */
export function inspectTrack(track: MediaStreamTrack): TrackCapabilityReport {
  const settings = track.getSettings?.() ?? {};
  let caps: MediaTrackCapabilities = {};
  try {
    caps = track.getCapabilities?.() ?? {};
  } catch {
    caps = {};
  }
  const anyCaps = caps as MediaTrackCapabilities & {
    torch?: boolean;
    zoom?: { min: number; max: number; step?: number };
  };

  return {
    torch: anyCaps.torch === true,
    zoom:
      anyCaps.zoom && typeof anyCaps.zoom.max === 'number' && anyCaps.zoom.max > (anyCaps.zoom.min ?? 1)
        ? {
            min: anyCaps.zoom.min ?? 1,
            max: anyCaps.zoom.max,
            step: anyCaps.zoom.step ?? 0.1,
          }
        : null,
    facingMode: (settings.facingMode as string) ?? null,
    width: settings.width ?? 0,
    height: settings.height ?? 0,
  };
}

/** Maps a getUserMedia rejection onto something the UI can explain. */
export function classifyCameraError(err: unknown): {
  availability: CameraAvailability;
  message: string;
} {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        availability: 'permission-denied',
        message: 'Camera access was blocked.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        availability: 'no-camera',
        message: 'No camera matching that request is available on this device.',
      };
    case 'NotReadableError':
    case 'AbortError':
      return {
        availability: 'no-camera',
        message: 'The camera is busy or was taken by another app.',
      };
    default:
      return {
        availability: 'api-unavailable',
        message: 'The camera could not be started in this browser.',
      };
  }
}
