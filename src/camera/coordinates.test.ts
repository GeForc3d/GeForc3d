import { describe, expect, it } from 'vitest';
import {
  frameToScreen,
  frameToSource,
  isPointVisible,
  mapSourceToFrame,
  screenToFrame,
  sourceToFrame,
  sourceToScreen,
  visibleSourceRect,
  type ViewGeometry,
} from './coordinates';

/** A 4:3 landscape sensor shown in a 9:16 portrait container: sides cropped. */
const PORTRAIT: ViewGeometry = {
  videoWidth: 1280,
  videoHeight: 960,
  containerWidth: 390,
  containerHeight: 780,
  mirrored: false,
};

/** A 9:16 portrait stream in a landscape container: top and bottom cropped. */
const LANDSCAPE: ViewGeometry = {
  videoWidth: 720,
  videoHeight: 1280,
  containerWidth: 800,
  containerHeight: 450,
  mirrored: false,
};

/** Same aspect on both sides: no crop at all. */
const EXACT: ViewGeometry = {
  videoWidth: 720,
  videoHeight: 1280,
  containerWidth: 360,
  containerHeight: 640,
  mirrored: false,
};

describe('cover crop', () => {
  it('crops the sides when the sensor is wider than the container', () => {
    const r = visibleSourceRect(PORTRAIT);
    expect(r.height).toBe(960);
    expect(r.width).toBeCloseTo(960 * (390 / 780), 4);
    expect(r.x).toBeCloseTo((1280 - r.width) / 2, 4);
    expect(r.y).toBe(0);
  });

  it('crops the top and bottom when the sensor is taller than the container', () => {
    const r = visibleSourceRect(LANDSCAPE);
    expect(r.width).toBe(720);
    expect(r.height).toBeCloseTo(720 / (800 / 450), 4);
    expect(r.y).toBeCloseTo((1280 - r.height) / 2, 4);
  });

  it('crops nothing when the aspects match', () => {
    const r = visibleSourceRect(EXACT);
    expect(r).toEqual({ x: 0, y: 0, width: 720, height: 1280 });
  });

  it('degrades safely before video metadata has arrived', () => {
    const r = visibleSourceRect({ ...PORTRAIT, videoWidth: 0, videoHeight: 0 });
    expect(Number.isFinite(r.width)).toBe(true);
    expect(Number.isFinite(r.height)).toBe(true);
  });
});

describe('source to frame', () => {
  it('keeps the centre at the centre in every configuration', () => {
    for (const g of [PORTRAIT, LANDSCAPE, EXACT, { ...PORTRAIT, mirrored: true }]) {
      const f = sourceToFrame({ x: 0.5, y: 0.5 }, g);
      expect(f.x).toBeCloseTo(0.5, 6);
      expect(f.y).toBeCloseTo(0.5, 6);
    }
  });

  it('reports a cropped point as outside the visible frame', () => {
    expect(isPointVisible({ x: 0.02, y: 0.5 }, PORTRAIT)).toBe(false);
    expect(isPointVisible({ x: 0.5, y: 0.5 }, PORTRAIT)).toBe(true);
    expect(isPointVisible({ x: 0.5, y: 0.02 }, LANDSCAPE)).toBe(false);
  });

  it('round-trips through frameToSource', () => {
    for (const g of [PORTRAIT, LANDSCAPE, EXACT, { ...LANDSCAPE, mirrored: true }]) {
      for (const p of [
        { x: 0.5, y: 0.5 },
        { x: 0.42, y: 0.31 },
        { x: 0.6, y: 0.8 },
      ]) {
        const back = frameToSource(sourceToFrame(p, g), g);
        expect(back.x).toBeCloseTo(p.x, 6);
        expect(back.y).toBeCloseTo(p.y, 6);
      }
    }
  });
});

describe('mirroring', () => {
  it('flips horizontally and leaves vertical alone', () => {
    const g = { ...EXACT, mirrored: true };
    const plain = sourceToFrame({ x: 0.3, y: 0.25 }, EXACT);
    const flipped = sourceToFrame({ x: 0.3, y: 0.25 }, g);
    expect(flipped.x).toBeCloseTo(1 - plain.x, 6);
    expect(flipped.y).toBeCloseTo(plain.y, 6);
  });

  it('puts a subject on the sensor left at the screen right when mirrored', () => {
    const g = { ...EXACT, mirrored: true };
    const p = sourceToScreen({ x: 0.2, y: 0.5 }, g);
    expect(p.x).toBeGreaterThan(g.containerWidth / 2);
  });

  it('does not move a subject on the sensor left when not mirrored', () => {
    const p = sourceToScreen({ x: 0.2, y: 0.5 }, EXACT);
    expect(p.x).toBeLessThan(EXACT.containerWidth / 2);
  });
});

describe('screen conversion', () => {
  it('maps the frame corners to the container corners', () => {
    expect(frameToScreen({ x: 0, y: 0 }, PORTRAIT)).toEqual({ x: 0, y: 0 });
    expect(frameToScreen({ x: 1, y: 1 }, PORTRAIT)).toEqual({ x: 390, y: 780 });
  });

  it('round-trips screen to frame', () => {
    const f = screenToFrame({ x: 130, y: 260 }, PORTRAIT);
    const s = frameToScreen(f, PORTRAIT);
    expect(s.x).toBeCloseTo(130, 6);
    expect(s.y).toBeCloseTo(260, 6);
  });

  it('does not divide by zero before layout has happened', () => {
    const f = screenToFrame({ x: 10, y: 10 }, { ...PORTRAIT, containerWidth: 0, containerHeight: 0 });
    expect(f).toEqual({ x: 0, y: 0 });
  });
});

describe('batch mapping', () => {
  it('matches the single-point conversion and reuses its output array', () => {
    const pts = [
      { x: 0.4, y: 0.2, visibility: 0.9 },
      { x: 0.6, y: 0.7, visibility: 0.5 },
    ];
    const out: Array<{ x: number; y: number; visibility?: number }> = [];
    const first = mapSourceToFrame(pts, PORTRAIT, out);
    expect(first).toBe(out);
    for (let i = 0; i < pts.length; i++) {
      const expected = sourceToFrame(pts[i], PORTRAIT);
      expect(out[i].x).toBeCloseTo(expected.x, 8);
      expect(out[i].y).toBeCloseTo(expected.y, 8);
      expect(out[i].visibility).toBe(pts[i].visibility);
    }
    const objects = out.map((o) => o);
    mapSourceToFrame(pts, PORTRAIT, out);
    expect(out.map((o) => o)).toEqual(objects);
  });

  it('truncates when given fewer points than last time', () => {
    const out: Array<{ x: number; y: number }> = [];
    mapSourceToFrame([{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], EXACT, out);
    mapSourceToFrame([{ x: 0.3, y: 0.3 }], EXACT, out);
    expect(out.length).toBe(1);
  });
});
