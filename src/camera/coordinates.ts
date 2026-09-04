/**
 * Coordinate transforms between the camera sensor, the visible preview and the
 * screen (§54).
 *
 * There are three spaces and they are not interchangeable:
 *
 *   SOURCE  — raw video pixels. What `getUserMedia` produces and what MediaPipe
 *             analyses. Normalised as 0..1 of `videoWidth` / `videoHeight`.
 *   FRAME   — the part of the source the user can actually SEE, after
 *             `object-fit: cover` has cropped it, and after mirroring. This is
 *             the photograph. All composition guidance lives here.
 *   SCREEN  — CSS pixels inside the preview container.
 *
 * Getting these wrong is the classic failure of a browser camera app: the
 * overlay drifts from the person, or guidance says "move left" while the
 * subject is already off the visible edge. Every conversion goes through here.
 */

export interface ViewGeometry {
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
  /** True when the preview is displayed flipped, as front cameras normally are. */
  mirrored: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const isUsableGeometry = (g: ViewGeometry): boolean =>
  g.videoWidth > 0 && g.videoHeight > 0 && g.containerWidth > 0 && g.containerHeight > 0;

/**
 * The rectangle of SOURCE pixels visible under `object-fit: cover`, in source
 * pixel units. Cover scales to fill and crops the overflowing axis evenly.
 */
export function visibleSourceRect(g: ViewGeometry): Rect {
  if (!isUsableGeometry(g)) {
    return { x: 0, y: 0, width: g.videoWidth || 1, height: g.videoHeight || 1 };
  }
  const videoAspect = g.videoWidth / g.videoHeight;
  const containerAspect = g.containerWidth / g.containerHeight;

  if (videoAspect > containerAspect) {
    // Source is wider than the container: crop the left and right.
    const width = g.videoHeight * containerAspect;
    return { x: (g.videoWidth - width) / 2, y: 0, width, height: g.videoHeight };
  }
  // Source is taller than the container: crop the top and bottom.
  const height = g.videoWidth / containerAspect;
  return { x: 0, y: (g.videoHeight - height) / 2, width: g.videoWidth, height };
}

/**
 * Normalised SOURCE point to normalised FRAME point. Values outside 0..1 mean
 * the point has been cropped out of the visible picture, which callers must
 * handle rather than clamp away.
 */
export function sourceToFrame(p: Point, g: ViewGeometry): Point {
  const r = visibleSourceRect(g);
  const sx = p.x * g.videoWidth;
  const sy = p.y * g.videoHeight;
  const fx = (sx - r.x) / r.width;
  const fy = (sy - r.y) / r.height;
  return { x: g.mirrored ? 1 - fx : fx, y: fy };
}

/** Normalised FRAME point back to normalised SOURCE point. */
export function frameToSource(p: Point, g: ViewGeometry): Point {
  const r = visibleSourceRect(g);
  const fx = g.mirrored ? 1 - p.x : p.x;
  return {
    x: (r.x + fx * r.width) / g.videoWidth,
    y: (r.y + p.y * r.height) / g.videoHeight,
  };
}

/** Normalised FRAME point to CSS pixels within the container. */
export function frameToScreen(p: Point, g: ViewGeometry): Point {
  return { x: p.x * g.containerWidth, y: p.y * g.containerHeight };
}

/** CSS pixels within the container to normalised FRAME point. */
export function screenToFrame(p: Point, g: ViewGeometry): Point {
  return {
    x: g.containerWidth ? p.x / g.containerWidth : 0,
    y: g.containerHeight ? p.y / g.containerHeight : 0,
  };
}

/** The full journey: a MediaPipe landmark to a position on screen. */
export function sourceToScreen(p: Point, g: ViewGeometry): Point {
  return frameToScreen(sourceToFrame(p, g), g);
}

/** True when a normalised SOURCE point survives the cover crop. */
export const isPointVisible = (p: Point, g: ViewGeometry, margin = 0): boolean => {
  const f = sourceToFrame(p, g);
  return f.x >= -margin && f.x <= 1 + margin && f.y >= -margin && f.y <= 1 + margin;
};

/**
 * Converts a whole landmark set from SOURCE to FRAME space in one pass, reusing
 * the caller's output array so the inference loop allocates nothing per frame.
 */
export function mapSourceToFrame<T extends { x: number; y: number }>(
  points: readonly T[],
  g: ViewGeometry,
  out: Array<{ x: number; y: number; z?: number; visibility?: number }>,
): Array<{ x: number; y: number; z?: number; visibility?: number }> {
  const r = visibleSourceRect(g);
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as T & { z?: number; visibility?: number };
    const fx = (p.x * g.videoWidth - r.x) / r.width;
    const fy = (p.y * g.videoHeight - r.y) / r.height;
    const target = out[i] ?? (out[i] = { x: 0, y: 0 });
    target.x = g.mirrored ? 1 - fx : fx;
    target.y = fy;
    target.z = p.z;
    target.visibility = p.visibility;
  }
  out.length = points.length;
  return out;
}

/**
 * Horizontal direction as the PHOTOGRAPHER experiences it.
 *
 * Guidance about the camera is expressed in screen terms and must therefore
 * account for mirroring; guidance about the subject's body is anatomical and
 * must NOT (§72). Keeping the two conversions in separate functions is what
 * stops them being confused.
 */
export const screenDirection = (deltaFrameX: number): 'left' | 'right' =>
  deltaFrameX < 0 ? 'left' : 'right';
