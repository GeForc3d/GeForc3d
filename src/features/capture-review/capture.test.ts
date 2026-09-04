import { describe, expect, it, vi } from 'vitest';
import { captureFrame, CaptureError } from '@/camera/capture';
import { visibleSourceRect, type ViewGeometry } from '@/camera/coordinates';

/**
 * The captured photograph must contain only camera pixels, at the framing the
 * photographer actually saw (§80). These tests assert what is drawn, using a
 * stubbed 2D context rather than a real canvas.
 */

const GEOMETRY: ViewGeometry = {
  videoWidth: 1920,
  videoHeight: 1080,
  containerWidth: 390,
  containerHeight: 780,
  mirrored: false,
};

interface Recorded {
  drawArgs: unknown[][];
  transforms: string[];
}

function stubCanvas(recorded: Recorded, blob: Blob | null = new Blob(['x'])) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args: unknown[]) => recorded.drawArgs.push(args),
      translate: (x: number, y: number) => recorded.transforms.push(`translate(${x},${y})`),
      scale: (x: number, y: number) => recorded.transforms.push(`scale(${x},${y})`),
    }),
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  return canvas;
}

const video = (w = 1920, h = 1080) => ({ videoWidth: w, videoHeight: h }) as HTMLVideoElement;

describe('capture', () => {
  it('captures exactly the visible crop at source resolution', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    const canvas = stubCanvas(recorded);
    const shot = await captureFrame(video(), GEOMETRY);

    const rect = visibleSourceRect(GEOMETRY);
    expect(canvas.width).toBe(Math.round(rect.width));
    expect(canvas.height).toBe(Math.round(rect.height));
    expect(shot.width).toBe(Math.round(rect.width));

    const [, sx, sy, sw, sh, dx, dy, dw, dh] = recorded.drawArgs[0];
    expect(sx).toBeCloseTo(rect.x, 3);
    expect(sy).toBeCloseTo(rect.y, 3);
    expect(sw).toBeCloseTo(rect.width, 3);
    expect(sh).toBeCloseTo(rect.height, 3);
    expect([dx, dy, dw, dh]).toEqual([0, 0, canvas.width, canvas.height]);
    vi.unstubAllGlobals();
  });

  it('draws only the video, never any overlay surface', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    stubCanvas(recorded);
    const source = video();
    await captureFrame(source, GEOMETRY);
    expect(recorded.drawArgs.length).toBe(1);
    expect(recorded.drawArgs[0][0]).toBe(source);
    vi.unstubAllGlobals();
  });

  it('mirrors the output when the preview was mirrored', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    stubCanvas(recorded);
    await captureFrame(video(), { ...GEOMETRY, mirrored: true });
    expect(recorded.transforms).toContain('scale(-1,1)');
    vi.unstubAllGlobals();
  });

  it('does not mirror an unmirrored preview', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    stubCanvas(recorded);
    await captureFrame(video(), GEOMETRY);
    expect(recorded.transforms).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('refuses to capture before the camera has produced a frame', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    stubCanvas(recorded);
    await expect(captureFrame(video(0, 0), GEOMETRY)).rejects.toBeInstanceOf(CaptureError);
    vi.unstubAllGlobals();
  });

  it('reports an encoding failure instead of returning a broken photo', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    stubCanvas(recorded, null);
    await expect(captureFrame(video(), GEOMETRY)).rejects.toBeInstanceOf(CaptureError);
    vi.unstubAllGlobals();
  });

  it('keeps a portrait crop portrait', async () => {
    const recorded: Recorded = { drawArgs: [], transforms: [] };
    const canvas = stubCanvas(recorded);
    await captureFrame(video(), GEOMETRY);
    expect(canvas.height).toBeGreaterThan(canvas.width);
    vi.unstubAllGlobals();
  });
});
