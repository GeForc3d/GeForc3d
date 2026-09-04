import { useId, type CSSProperties } from 'react';
import { L, type LandmarkSet } from '@/models/landmarks';
import { distance, midpoint, visibilityOf, type Point } from '@/pose-matching/features';

/**
 * Renders a human silhouette from a target skeleton.
 *
 * This is the DEVELOPMENT reference standing in for photography that has not
 * been shot yet (§35). It is drawn from the pose's real joint data, at real
 * human proportions, so it communicates body shape, placement and framing —
 * which is exactly what the transparent camera guide needs. It is not a
 * photograph and every surface that shows it says so.
 *
 * Every part is drawn opaque inside one group so that group-level opacity
 * produces a clean composite instead of overlapping translucent seams.
 */

interface Props {
  skeletons: LandmarkSet[];
  /** 0..1 opacity applied to the whole figure. */
  opacity?: number;
  fill?: string;
  outline?: string;
  className?: string;
  style?: CSSProperties;
  /** Rendered aspect ratio of the viewBox. */
  aspect?: number;
  mirrored?: boolean;
  /** Adds a soft tonal gradient so the figure reads as a body, not a sticker. */
  shaded?: boolean;
}

interface Metrics {
  unit: number;
  headCentre: Point;
  headRadius: number;
}

const p = (s: LandmarkSet, i: number): Point => s[i] ?? { x: 0.5, y: 0.5 };

function metricsFor(s: LandmarkSet): Metrics {
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  const hip = midpoint(p(s, L.LEFT_HIP), p(s, L.RIGHT_HIP));
  const torso = Math.max(distance(shoulder, hip), 1e-4);
  // PROPORTIONS.torso is 0.28 of standing height, so this recovers the figure's
  // nominal height regardless of how folded the pose is.
  const unit = torso / 0.28;

  const earL = p(s, L.LEFT_EAR);
  const earR = p(s, L.RIGHT_EAR);
  const visL = visibilityOf(s[L.LEFT_EAR]);
  const visR = visibilityOf(s[L.RIGHT_EAR]);
  let headCentre: Point;
  if (visL > 0.3 && visR > 0.3) headCentre = midpoint(earL, earR);
  else if (visL > visR) headCentre = earL;
  else headCentre = earR;
  // Nudge back from the visible ear toward the neck so a profile head sits right.
  const neck = shoulder;
  const pull = 0.18;
  headCentre = {
    x: headCentre.x + (neck.x - headCentre.x) * pull * 0.4,
    y: headCentre.y + (neck.y - headCentre.y) * pull * 0.15,
  };
  return { unit, headCentre, headRadius: unit * 0.082 };
}

/** Offsets a point perpendicular to a→b by `amount`. */
function offsetPerp(a: Point, b: Point, at: Point, amount: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: at.x + (-dy / len) * amount, y: at.y + (dx / len) * amount };
}

function torsoPath(s: LandmarkSet, m: Metrics): string {
  const sl = p(s, L.LEFT_SHOULDER);
  const sr = p(s, L.RIGHT_SHOULDER);
  const hl = p(s, L.LEFT_HIP);
  const hr = p(s, L.RIGHT_HIP);
  const grow = m.unit * 0.026;
  const shoulderCentre = midpoint(sl, sr);
  const hipCentre = midpoint(hl, hr);

  const out = (from: Point, centre: Point, by: number): Point => {
    const dx = from.x - centre.x;
    const dy = from.y - centre.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: from.x + (dx / len) * by, y: from.y + (dy / len) * by };
  };

  const a = out(sl, shoulderCentre, grow);
  const b = out(sr, shoulderCentre, grow);
  const c = out(hr, hipCentre, grow * 0.9);
  const d = out(hl, hipCentre, grow * 0.9);

  // Slight waist pinch on both sides so the torso reads as a body.
  const waistL = offsetPerp(a, d, midpoint(a, d), -m.unit * 0.012);
  const waistR = offsetPerp(b, c, midpoint(b, c), m.unit * 0.012);

  return [
    `M${a.x.toFixed(4)},${a.y.toFixed(4)}`,
    `L${b.x.toFixed(4)},${b.y.toFixed(4)}`,
    `Q${waistR.x.toFixed(4)},${waistR.y.toFixed(4)} ${c.x.toFixed(4)},${c.y.toFixed(4)}`,
    `L${d.x.toFixed(4)},${d.y.toFixed(4)}`,
    `Q${waistL.x.toFixed(4)},${waistL.y.toFixed(4)} ${a.x.toFixed(4)},${a.y.toFixed(4)}`,
    'Z',
  ].join(' ');
}

interface Limb {
  a: Point;
  b: Point;
  w: number;
}

function limbsFor(s: LandmarkSet, m: Metrics): Limb[] {
  const u = m.unit;
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  return [
    { a: shoulder, b: m.headCentre, w: u * 0.05 },
    { a: p(s, L.LEFT_SHOULDER), b: p(s, L.LEFT_ELBOW), w: u * 0.054 },
    { a: p(s, L.LEFT_ELBOW), b: p(s, L.LEFT_WRIST), w: u * 0.042 },
    { a: p(s, L.RIGHT_SHOULDER), b: p(s, L.RIGHT_ELBOW), w: u * 0.054 },
    { a: p(s, L.RIGHT_ELBOW), b: p(s, L.RIGHT_WRIST), w: u * 0.042 },
    { a: p(s, L.LEFT_HIP), b: p(s, L.LEFT_KNEE), w: u * 0.076 },
    { a: p(s, L.LEFT_KNEE), b: p(s, L.LEFT_ANKLE), w: u * 0.052 },
    { a: p(s, L.RIGHT_HIP), b: p(s, L.RIGHT_KNEE), w: u * 0.076 },
    { a: p(s, L.RIGHT_KNEE), b: p(s, L.RIGHT_ANKLE), w: u * 0.052 },
    { a: p(s, L.LEFT_ANKLE), b: p(s, L.LEFT_FOOT_INDEX), w: u * 0.038 },
    { a: p(s, L.RIGHT_ANKLE), b: p(s, L.RIGHT_FOOT_INDEX), w: u * 0.038 },
  ];
}

export function PoseSilhouette({
  skeletons,
  opacity = 1,
  fill = 'var(--silhouette-fill, #C7D3E2)',
  outline,
  className,
  style,
  aspect = 3 / 4,
  mirrored = false,
  shaded = true,
}: Props) {
  const gid = useId().replace(/:/g, '');
  const height = 1;
  const width = aspect;

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
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="1" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.72" />
          </linearGradient>
        </defs>
      )}
      <g
        opacity={opacity}
        transform={mirrored ? `translate(${width} 0) scale(-1 1)` : undefined}
      >
        {skeletons.map((skeleton, si) => {
          // Skeletons are authored in a square 0..1 box; map x into the viewBox.
          const s = skeleton.map((q) => ({ ...q, x: q.x * width }));
          const m = metricsFor(s);
          const limbs = limbsFor(s, m);
          const paint = shaded ? `url(#g${gid})` : fill;
          const handR = m.unit * 0.03;
          return (
            <g key={si}>
              {limbs.map((limb, i) => (
                <line
                  key={i}
                  x1={limb.a.x}
                  y1={limb.a.y}
                  x2={limb.b.x}
                  y2={limb.b.y}
                  stroke={paint}
                  strokeWidth={limb.w}
                  strokeLinecap="round"
                />
              ))}
              <path d={torsoPath(s, m)} fill={paint} />
              <circle cx={p(s, L.LEFT_WRIST).x} cy={p(s, L.LEFT_WRIST).y} r={handR} fill={paint} />
              <circle
                cx={p(s, L.RIGHT_WRIST).x}
                cy={p(s, L.RIGHT_WRIST).y}
                r={handR}
                fill={paint}
              />
              <ellipse
                cx={m.headCentre.x}
                cy={m.headCentre.y}
                rx={m.headRadius * 0.86}
                ry={m.headRadius}
                fill={paint}
              />
              {outline && (
                <ellipse
                  cx={m.headCentre.x}
                  cy={m.headCentre.y}
                  rx={m.headRadius * 0.86}
                  ry={m.headRadius}
                  fill="none"
                  stroke={outline}
                  strokeWidth={m.unit * 0.006}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
