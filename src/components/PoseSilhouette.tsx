import { useId, type CSSProperties } from 'react';
import { L, type LandmarkSet } from '@/models/landmarks';
import { distance, midpoint, visibilityOf, type Point } from '@/pose-matching/features';

/**
 * Renders a human silhouette from a target skeleton.
 *
 * This is the DEVELOPMENT reference standing in for photography that has not
 * been shot (§35). It is drawn from the pose's real joint data at real human
 * proportions, so it communicates body shape, placement and framing — which is
 * exactly what the transparent camera guide needs. It is not a photograph, and
 * every surface that shows it says so.
 *
 * Limbs are tapered capsules rather than round-capped strokes: a constant-width
 * stroke leaves a visible ball at every joint and the figure reads as a
 * mannequin. Everything is drawn opaque inside one group so group opacity
 * composites cleanly instead of showing translucent seams.
 */

/**
 * A hint at what the body is resting on. A seated figure drawn in mid-air reads
 * as falling; one line at the seat edge makes it read as sitting.
 */
export type GroundHint = 'none' | 'seat' | 'floor' | 'rail' | 'wall-left' | 'wall-right';

interface Props {
  skeletons: LandmarkSet[];
  ground?: GroundHint;
  opacity?: number;
  fill?: string;
  /** Shade colour for the far side of the figure. Must be fully opaque. */
  shade?: string;
  className?: string;
  style?: CSSProperties;
  /** Rendered aspect ratio of the viewBox (width / height). */
  aspect?: number;
  mirrored?: boolean;
  /** Adds a soft tonal gradient so the figure reads as a body, not a sticker. */
  shaded?: boolean;
}

const p = (s: LandmarkSet, i: number): Point => s[i] ?? { x: 0.5, y: 0.5 };

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const n = (v: number) => v.toFixed(4);

/** Outline of a cone between two circles: two tangents and two arcs. */
function taperedCapsule(a: Point, ra: number, b: Point, rb: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 || d <= Math.abs(ra - rb)) {
    const c = ra >= rb ? a : b;
    const r = Math.max(ra, rb);
    return `M${n(c.x - r)},${n(c.y)}a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0Z`;
  }
  const theta = Math.atan2(dy, dx);
  const phi = Math.acos((ra - rb) / d);

  const a1 = { x: a.x + ra * Math.cos(theta + phi), y: a.y + ra * Math.sin(theta + phi) };
  const b1 = { x: b.x + rb * Math.cos(theta + phi), y: b.y + rb * Math.sin(theta + phi) };
  const b2 = { x: b.x + rb * Math.cos(theta - phi), y: b.y + rb * Math.sin(theta - phi) };
  const a2 = { x: a.x + ra * Math.cos(theta - phi), y: a.y + ra * Math.sin(theta - phi) };

  return [
    `M${n(a1.x)},${n(a1.y)}`,
    `L${n(b1.x)},${n(b1.y)}`,
    `A${n(rb)},${n(rb)} 0 0,0 ${n(b2.x)},${n(b2.y)}`,
    `L${n(a2.x)},${n(a2.y)}`,
    `A${n(ra)},${n(ra)} 0 0,0 ${n(a1.x)},${n(a1.y)}`,
    'Z',
  ].join(' ');
}

interface Metrics {
  unit: number;
  headCentre: Point;
  headRadius: number;
  neckBase: Point;
}

function metricsFor(s: LandmarkSet): Metrics {
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  const hip = midpoint(p(s, L.LEFT_HIP), p(s, L.RIGHT_HIP));
  const torso = Math.max(distance(shoulder, hip), 1e-4);
  // PROPORTIONS.torso is 0.28 of standing height, so this recovers the figure's
  // nominal height however folded the pose is.
  const unit = torso / 0.28;

  const earL = p(s, L.LEFT_EAR);
  const earR = p(s, L.RIGHT_EAR);
  const visL = visibilityOf(s[L.LEFT_EAR]);
  const visR = visibilityOf(s[L.RIGHT_EAR]);
  let headCentre: Point;
  if (visL > 0.3 && visR > 0.3) headCentre = midpoint(earL, earR);
  else headCentre = visL > visR ? earL : earR;

  // The ear line sits slightly forward of the skull centre; pull back toward
  // the neck so a profile head does not float off the shoulders.
  headCentre = {
    x: headCentre.x + (shoulder.x - headCentre.x) * 0.1,
    y: headCentre.y + (shoulder.y - headCentre.y) * 0.06,
  };

  return {
    unit,
    headCentre,
    headRadius: unit * 0.069,
    neckBase: {
      x: shoulder.x + (headCentre.x - shoulder.x) * 0.82,
      y: shoulder.y + (headCentre.y - shoulder.y) * 0.82,
    },
  };
}

/** Torso as a rounded quad that blends into the shoulder and hip capsules. */
function torsoPath(s: LandmarkSet, m: Metrics): string {
  const sl = p(s, L.LEFT_SHOULDER);
  const sr = p(s, L.RIGHT_SHOULDER);
  const hl = p(s, L.LEFT_HIP);
  const hr = p(s, L.RIGHT_HIP);
  const shoulderCentre = midpoint(sl, sr);
  const hipCentre = midpoint(hl, hr);
  const u = m.unit;

  const out = (from: Point, centre: Point, by: number): Point => {
    const dx = from.x - centre.x;
    const dy = from.y - centre.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x: from.x + by, y: from.y };
    return { x: from.x + (dx / len) * by, y: from.y + (dy / len) * by };
  };

  const a = out(sl, shoulderCentre, u * 0.02);
  const b = out(sr, shoulderCentre, u * 0.02);
  const c = out(hr, hipCentre, u * 0.036);
  const d = out(hl, hipCentre, u * 0.036);

  // Waist control points pull the sides in slightly, toward the body axis.
  const waist = (p1: Point, p2: Point, sign: number): Point => {
    const mid = midpoint(p1, p2);
    const axis = midpoint(shoulderCentre, hipCentre);
    const dx = axis.x - mid.x;
    const dy = axis.y - mid.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: mid.x + (dx / len) * u * 0.02 * sign, y: mid.y + (dy / len) * u * 0.02 * sign };
  };

  return [
    `M${n(a.x)},${n(a.y)}`,
    `L${n(b.x)},${n(b.y)}`,
    `Q${n(waist(b, c, 1).x)},${n(waist(b, c, 1).y)} ${n(c.x)},${n(c.y)}`,
    `L${n(d.x)},${n(d.y)}`,
    `Q${n(waist(d, a, 1).x)},${n(waist(d, a, 1).y)} ${n(a.x)},${n(a.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Limb RADII as fractions of nominal body height, taken from ordinary adult
 * proportions. Each chain tapers from the body outward, the way a real limb
 * narrows toward the hand or foot.
 */
const W = {
  shoulder: 0.026,
  elbow: 0.02,
  wrist: 0.013,
  hand: 0.018,
  hip: 0.046,
  knee: 0.032,
  calf: 0.03,
  ankle: 0.019,
  foot: 0.014,
  neck: 0.032,
} as const;

/**
 * The figure in draw order, back to front. Order is what makes a flat
 * silhouette readable: legs sit behind the pelvis, arms sit in front of the
 * torso, and only the parts that need to read against the body carry a
 * hairline. Stroking everything turns the figure into a wireframe.
 */
interface Layers {
  back: string[];
  body: string[];
  front: string[];
}

function bodyLayers(s: LandmarkSet, m: Metrics): Layers {
  const u = m.unit;
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));

  const cap = (a: Point, ra: number, b: Point, rb: number) =>
    taperedCapsule(a, ra * u, b, rb * u);

  const leg = (hip: number, knee: number, ankle: number, toe: number) => {
    const k = p(s, knee);
    const a = p(s, ankle);
    const calf = lerp(k, a, 0.35);
    return [
      cap(p(s, hip), W.hip, k, W.knee),
      cap(k, W.knee, calf, W.calf),
      cap(calf, W.calf, a, W.ankle),
      cap(a, W.ankle, p(s, toe), W.foot),
    ];
  };

  const arm = (sh: number, el: number, wr: number, hand: number) => {
    const e = p(s, el);
    const w = p(s, wr);
    return [
      cap(p(s, sh), W.shoulder, e, W.elbow),
      cap(e, W.elbow, w, W.wrist),
      cap(w, W.wrist, p(s, hand), W.hand * 0.85),
    ];
  };

  return {
    back: [
      ...leg(L.LEFT_HIP, L.LEFT_KNEE, L.LEFT_ANKLE, L.LEFT_FOOT_INDEX),
      ...leg(L.RIGHT_HIP, L.RIGHT_KNEE, L.RIGHT_ANKLE, L.RIGHT_FOOT_INDEX),
    ],
    body: [
      // Neck flares out of the shoulders rather than sitting on them as a pole.
      cap(shoulder, W.neck * 1.5, m.neckBase, W.neck),
      cap(p(s, L.LEFT_HIP), W.hip * 0.94, p(s, L.RIGHT_HIP), W.hip * 0.94),
      torsoPath(s, m),
    ],
    front: [
      ...arm(L.LEFT_SHOULDER, L.LEFT_ELBOW, L.LEFT_WRIST, L.LEFT_INDEX),
      ...arm(L.RIGHT_SHOULDER, L.RIGHT_ELBOW, L.RIGHT_WRIST, L.RIGHT_INDEX),
    ],
  };
}

export function PoseSilhouette({
  skeletons,
  opacity = 1,
  fill = 'var(--silhouette-fill, #C7D3E2)',
  shade = 'var(--silhouette-shade, #7A8CA6)',
  className,
  style,
  aspect = 3 / 4,
  mirrored = false,
  shaded = true,
  ground = 'none',
}: Props) {
  const gid = useId().replace(/:/g, '');
  const height = 1;
  const width = aspect;
  const paint = shaded ? `url(#g${gid})` : fill;

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {shaded && (
        <defs>
          {/* Both stops are fully opaque. A gradient that varies opacity makes
              every overlapping limb visible through the torso. */}
          {/* userSpaceOnUse, not the default objectBoundingBox: with per-shape
              bounding boxes every limb gets its own gradient and the figure
              renders as a patchwork of mismatched tones. */}
          <linearGradient
            id={`g${gid}`}
            gradientUnits="userSpaceOnUse"
            x1={width * 0.15}
            y1={0}
            x2={width * 0.95}
            y2={height * 0.9}
          >
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor={shade} />
          </linearGradient>
        </defs>
      )}
      <g opacity={opacity} transform={mirrored ? `translate(${width} 0) scale(-1 1)` : undefined}>
        {ground !== 'none' &&
          skeletons.length > 0 &&
          groundMark(
            skeletons[0].map((q) => ({ ...q, x: q.x * width })),
            ground,
            width,
            height,
          )}
        {skeletons.map((skeleton, si) => {
          // Skeletons are authored in a square 0..1 box; map x into the viewBox.
          const s = skeleton.map((q) => ({ ...q, x: q.x * width }));
          const m = metricsFor(s);
          const layers = bodyLayers(s, m);
          const hairline = {
            stroke: 'rgba(9, 15, 26, 0.22)',
            strokeWidth: m.unit * 0.005,
          };
          return (
            <g key={si} fill={paint}>
              <g {...hairline}>
                {layers.back.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
              {layers.body.map((d, i) => (
                <path key={i} d={d} />
              ))}
              <g {...hairline}>
                {layers.front.map((d, i) => (
                  <path key={i} d={d} />
                ))}
                <ellipse
                  cx={m.headCentre.x}
                  cy={m.headCentre.y}
                  rx={m.headRadius * 0.84}
                  ry={m.headRadius}
                  transform={`rotate(${headTilt(s, m)} ${m.headCentre.x} ${m.headCentre.y})`}
                  stroke="none"
                />
                {facePlane(s, m)}
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * A small profile bump where the face is pointing.
 *
 * Without it a silhouette cannot say which way someone is facing, and facing is
 * half of what a pose reference has to communicate. It is drawn in the same
 * fill so it reads as part of the head rather than as a feature, and it comes
 * from the nose landmark, so it flattens out as the subject turns away — which
 * is itself the correct signal.
 */
function facePlane(s: LandmarkSet, m: Metrics): JSX.Element | null {
  const nose = s[L.NOSE];
  if (!nose || (nose.visibility ?? 1) < 0.4) return null;
  const dx = nose.x - m.headCentre.x;
  const dy = nose.y - m.headCentre.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const r = m.headRadius;
  const reach = Math.min(len, r * 0.86);
  return (
    <ellipse
      cx={m.headCentre.x + (dx / len) * reach}
      cy={m.headCentre.y + (dy / len) * reach * 0.9}
      rx={r * 0.28}
      ry={r * 0.32}
      stroke="none"
    />
  );
}

/** Aligns the head ellipse with the neck so a tilted head does not look bolted on. */
function headTilt(s: LandmarkSet, m: Metrics): number {
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  const dx = m.headCentre.x - shoulder.x;
  const dy = m.headCentre.y - shoulder.y;
  if (Math.hypot(dx, dy) < 1e-6) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

/**
 * The surface the pose depends on, drawn as a single understated rule. It is
 * information, not decoration: a seated pose without it is unreadable.
 */
function groundMark(
  s: LandmarkSet,
  hint: GroundHint,
  width: number,
  height: number,
): JSX.Element | null {
  const stroke = 'rgba(154, 170, 192, 0.3)';
  const w = 0.0035;

  if (hint === 'seat' || hint === 'floor' || hint === 'rail') {
    const y =
      hint === 'seat'
        ? Math.max(p(s, L.LEFT_HIP).y, p(s, L.RIGHT_HIP).y) + 0.012
        : hint === 'rail'
          ? (p(s, L.LEFT_WRIST).y + p(s, L.RIGHT_WRIST).y) / 2
          : Math.max(...s.map((q) => q.y)) + 0.035;
    if (y > height) return null;
    return (
      <line x1={width * 0.06} y1={y} x2={width * 0.94} y2={y} stroke={stroke} strokeWidth={w} />
    );
  }

  const bodyX = (p(s, L.LEFT_SHOULDER).x + p(s, L.RIGHT_SHOULDER).x) / 2;
  const spread = Math.abs(p(s, L.LEFT_SHOULDER).x - p(s, L.RIGHT_SHOULDER).x);
  const x =
    hint === 'wall-left'
      ? Math.max(width * 0.04, bodyX - spread - 0.05)
      : Math.min(width * 0.96, bodyX + spread + 0.05);
  return (
    <line x1={x} y1={height * 0.06} x2={x} y2={height * 0.96} stroke={stroke} strokeWidth={w} />
  );
}
