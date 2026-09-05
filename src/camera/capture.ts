import { visibleSourceRect, type ViewGeometry } from './coordinates';

/**
 * Captures a clean photograph from the video stream (§80).
 *
 * The output contains only camera pixels: no overlay, no grid, no HUD, no
 * controls. It is drawn from the video element directly, never from a
 * screenshot of the page.
 *
 * We capture the VISIBLE crop rather than the whole sensor, because the visible
 * crop is what the photographer framed. It is still full source resolution for
 * that framing — nothing is downscaled.
 */

export interface Capture {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  takenAt: number;
}

export interface CaptureOptions {
  /** Mirrored previews produce mirrored photographs, as phone cameras do. */
  mirrored?: boolean;
  quality?: number;
  type?: 'image/jpeg' | 'image/png';
}

export class CaptureError extends Error {}

export async function captureFrame(
  video: HTMLVideoElement,
  geometry: ViewGeometry,
  options: CaptureOptions = {},
): Promise<Capture> {
  const { quality = 0.92, type = 'image/jpeg', mirrored = geometry.mirrored } = options;

  if (!video.videoWidth || !video.videoHeight) {
    throw new CaptureError('The camera has not produced a frame yet.');
  }

  const rect = visibleSourceRect(geometry);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CaptureError('This browser could not create a drawing surface.');

  if (mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    if (canvas.toBlob) canvas.toBlob(resolve, type, quality);
    else resolve(null);
  });

  if (!blob) throw new CaptureError('The photo could not be encoded.');

  return {
    url: URL.createObjectURL(blob),
    blob,
    width,
    height,
    takenAt: Date.now(),
  };
}

export const releaseCapture = (capture: Capture | null): void => {
  if (capture) URL.revokeObjectURL(capture.url);
};

export interface ShareResult {
  ok: boolean;
  method: 'share' | 'download' | 'none';
  message?: string;
}

/**
 * Saving on iOS Safari: there is no API that writes to the Photos library. The
 * honest best path is the share sheet, which does offer "Save Image". Where
 * that is unavailable we fall back to a download, and where neither works we
 * say so rather than pretending (§84).
 */
export async function shareCapture(capture: Capture, filename: string): Promise<ShareResult> {
  const file = new File([capture.blob], filename, { type: capture.blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  // The share sheet is the only route to the iOS Photos library, and it is the
  // one that works inside an embedded viewer too.
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return { ok: true, method: 'share' };
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return { ok: false, method: 'share', message: 'Sharing was cancelled.' };
      }
    }
  }

  // A download link is inert in a sandboxed viewer and does nothing visible on
  // iOS either, so we do not pretend it worked. Press and hold on the photo is
  // the instruction that is actually true everywhere (§84, §115).
  if (isEmbedded()) {
    return {
      ok: false,
      method: 'none',
      message: 'Press and hold the photo to save it.',
    };
  }

  try {
    const a = document.createElement('a');
    a.href = capture.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, method: 'download' };
  } catch {
    return {
      ok: false,
      method: 'none',
      message: 'Press and hold the photo to save it.',
    };
  }
}

/** A sandboxed viewer cannot start a download, however the link is written. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
