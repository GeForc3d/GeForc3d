import { useId, type CSSProperties } from 'react';
import { L, type LandmarkSet } from '@/models/landmarks';
import { distance, midpoint, visibilityOf, type Point } from '@/pose-matching/features';

/**
 * Draws a human form from a target skeleton.
 *
 * This is a DEVELOPMENT reference standing in for photography that has not been
 * shot. Its job is to make a pose readable in about a second, so it is drawn as
 * one continuous body rather than as jointed segments: no outlines at the
 * joints, no capsule ends showing, no visible articulation. Depth comes from
 * two flat tones — the limbs on the far side of the body sit behind in a darker
 * tone — which is how a figure reads without looking mechanical.
 *
 * Two variants:
 *   reference — two-tone with a surface mark, for cards and pose detail.
 *   overlay   — one flat tone, no surface, for laying over the live camera,
 *               where the real scene supplies everything else (§26).
 */

export type GroundHint = 'none' | 'seat' | 'floor' | 'rail' | 'wall-left' | 'wall-right';

interface Props {
  skeletons: LandmarkSet[];
  ground?: GroundHint;
  opacity?: number;
  fill?: string;
  shade?: string;
  className?: string;
  style?: CSSProperties;
  aspect?: number;
  mirrored?: boolean;
  variant?: 'reference' | 'overlay';
  /**
   * Scale the figure to fill the frame. Card and detail thumbnails want this;
   * the camera overlay must not, because there the skeleton's placement in the
   * frame IS the composition the photographer is being asked to match.
   */
  fit?: boolean;
  /** Silhouette thickness multiplier from the body representation. */
  mass?: number;
  /**
   * Which of the subject's own sides is turned away from the camera. Those
   * limbs are drawn behind the torso so the pose reads three-dimensionally.
   */
  backSide?: 'left' | 'right' | null;
}

const p = (s: LandmarkSet, i: number): Point => s[i] ?? { x: 0.5, y: 0.5 };
const n = (v: number) => v.toFixed(4);

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

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
  mass: number;
  headCentre: Point;
  headRadius: number;
  neckBase: Point;
}

function metricsFor(s: LandmarkSet, mass: number): Metrics {
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  const hip = midpoint(p(s, L.LEFT_HIP), p(s, L.RIGHT_HIP));
  const torso = Math.max(distance(shoulder, hip), 1e-4);
  const unit = torso / 0.28;

  const earL = p(s, L.LEFT_EAR);
  const earR = p(s, L.RIGHT_EAR);
  const visL = visibilityOf(s[L.LEFT_EAR]);
  const visR = visibilityOf(s[L.RIGHT_EAR]);
  let headCentre = visL > 0.3 && visR > 0.3 ? midpoint(earL, earR) : visL > visR ? earL : earR;
  headCentre = {
    x: headCentre.x + (shoulder.x - headCentre.x) * 0.1,
    y: headCentre.y + (shoulder.y - headCentre.y) * 0.06,
  };

  return {
    unit,
    mass,
    headCentre,
    headRadius: unit * 0.069,
    neckBase: lerp(shoulder, headCentre, 0.82),
  };
}

/** Torso as one rounded mass that blends into the shoulders and hips. */
function torsoPath(s: LandmarkSet, m: Metrics): string {
  const sl = p(s, L.LEFT_SHOULDER);
  const sr = p(s, L.RIGHT_SHOULDER);
  const hl = p(s, L.LEFT_HIP);
  const hr = p(s, L.RIGHT_HIP);
  const shoulderCentre = midpoint(sl, sr);
  const hipCentre = midpoint(hl, hr);
  const u = m.unit * m.mass;

  const out = (from: Point, centre: Point, by: number): Point => {
    const dx = from.x - centre.x;
    const dy = from.y - centre.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x: from.x + by, y: from.y };
    return { x: from.x + (dx / len) * by, y: from.y + (dy / len) * by };
  };

  const a = out(sl, shoulderCentre, u * 0.022);
  const b = out(sr, shoulderCentre, u * 0.022);
  const c = out(hr, hipCentre, u * 0.038);
  const d = out(hl, hipCentre, u * 0.038);

  const waist = (p1: Point, p2: Point): Point => {
    const mid = midpoint(p1, p2);
    const axis = midpoint(shoulderCentre, hipCentre);
    const dx = axis.x - mid.x;
    const dy = axis.y - mid.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: mid.x + (dx / len) * u * 0.018, y: mid.y + (dy / len) * u * 0.018 };
  };

  const wR = waist(b, c);
  const wL = waist(d, a);
  return [
    `M${n(a.x)},${n(a.y)}`,
    `L${n(b.x)},${n(b.y)}`,
    `Q${n(wR.x)},${n(wR.y)} ${n(c.x)},${n(c.y)}`,
    `L${n(d.x)},${n(d.y)}`,
    `Q${n(wL.x)},${n(wL.y)} ${n(a.x)},${n(a.y)}`,
    'Z',
  ].join(' ');
}

/** Limb radii as fractions of nominal body height, from adult proportions. */
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

function limbPaths(s: LandmarkSet, m: Metrics, side: 'left' | 'right'): string[] {
  const u = m.unit * m.mass;
  const cap = (a: Point, ra: number, b: Point, rb: number) =>
    taperedCapsule(a, ra * u, b, rb * u);

  const sh = side === 'left' ? L.LEFT_SHOULDER : L.RIGHT_SHOULDER;
  const el = side === 'left' ? L.LEFT_ELBOW : L.RIGHT_ELBOW;
  const wr = side === 'left' ? L.LEFT_WRIST : L.RIGHT_WRIST;
  const hand = side === 'left' ? L.LEFT_INDEX : L.RIGHT_INDEX;
  const hip = side === 'left' ? L.LEFT_HIP : L.RIGHT_HIP;
  const kn = side === 'left' ? L.LEFT_KNEE : L.RIGHT_KNEE;
  const an = side === 'left' ? L.LEFT_ANKLE : L.RIGHT_ANKLE;
  const toe = side === 'left' ? L.LEFT_FOOT_INDEX : L.RIGHT_FOOT_INDEX;

  const k = p(s, kn);
  const a = p(s, an);
  const calf = lerp(k, a, 0.35);

  return [
    cap(p(s, hip), W.hip, k, W.knee),
    cap(k, W.knee, calf, W.calf),
    cap(calf, W.calf, a, W.ankle),
    cap(a, W.ankle, p(s, toe), W.foot),
    cap(p(s, sh), W.shoulder, p(s, el), W.elbow),
    cap(p(s, el), W.elbow, p(s, wr), W.wrist),
    cap(p(s, wr), W.wrist, p(s, hand), W.hand * 0.85),
  ];
}

function corePaths(s: LandmarkSet, m: Metrics): string[] {
  const u = m.unit * m.mass;
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  const cap = (a: Point, ra: number, b: Point, rb: number) =>
    taperedCapsule(a, ra * u, b, rb * u);
  return [
    cap(shoulder, W.neck * 1.45, m.neckBase, W.neck * 0.95),
    cap(p(s, L.LEFT_HIP), W.hip * 0.95, p(s, L.RIGHT_HIP), W.hip * 0.95),
    torsoPath(s, m),
  ];
}

export function PoseSilhouette({
  skeletons,
  ground = 'none',
  opacity = 1,
  fill = 'var(--silhouette-fill, #C7D3E2)',
  shade = 'var(--silhouette-shade, #8496AE)',
  className,
  style,
  aspect = 3 / 4,
  mirrored = false,
  variant = 'reference',
  fit = variant === 'reference',
  mass = 1,
  backSide = null,
}: Props) {
  const gid = useId().replace(/:/g, '');
  const height = 1;
  const width = aspect;
  const front = variant === 'overlay' ? fill : `url(#f${gid})`;
  const back = variant === 'overlay' ? fill : `url(#b${gid})`;

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {variant === 'reference' && (
        <defs>
          {/* Both stops are opaque: a gradient that varies alpha would show
              every overlapping limb through the torso. */}
          <linearGradient
            id={`f${gid}`}
            gradientUnits="userSpaceOnUse"
            x1={width * 0.2}
            y1={0}
            x2={width * 0.9}
            y2={height}
          >
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor={shade} />
          </linearGradient>
          <linearGradient
            id={`b${gid}`}
            gradientUnits="userSpaceOnUse"
            x1={width * 0.2}
            y1={0}
            x2={width * 0.9}
            y2={height}
          >
            <stop offset="0%" stopColor={shade} />
            <stop offset="100%" stopColor={shade} />
          </linearGradient>
        </defs>
      )}
      <g opacity={opacity} transform={mirrored ? `translate(${width} 0) scale(-1 1)` : undefined}>
        <g transform={fit ? fitTransform(skeletons, width, height, mass) : undefined}>
        {variant === 'reference' &&
          ground !== 'none' &&
          skeletons.length > 0 &&
          groundMark(
            skeletons[0].map((q) => ({ ...q, x: q.x * width })),
            ground,
            width,
            height,
          )}
        {skeletons.map((skeleton, si) => {
          const s = skeleton.map((q) => ({ ...q, x: q.x * width }));
          const m = metricsFor(s, mass);
          const far = backSide;
          const near = far === 'left' ? 'right' : far === 'right' ? 'left' : null;
          return (
            <g key={si}>
              {far && (
                <g fill={back}>
                  {limbPaths(s, m, far).map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
              )}
              <g fill={front}>
                {!far &&
                  limbPaths(s, m, 'left').map((d, i) => <path key={`l${i}`} d={d} />)}
                {!far &&
                  limbPaths(s, m, 'right').map((d, i) => <path key={`r${i}`} d={d} />)}
                {corePaths(s, m).map((d, i) => (
                  <path key={`c${i}`} d={d} />
                ))}
                {near && limbPaths(s, m, near).map((d, i) => <path key={`n${i}`} d={d} />)}
                <ellipse
                  cx={m.headCentre.x}
                  cy={m.headCentre.y}
                  rx={m.headRadius * 0.84}
                  ry={m.headRadius}
                  transform={`rotate(${headTilt(s, m)} ${m.headCentre.x} ${m.headCentre.y})`}
                />
                {facePlane(s, m)}
              </g>
            </g>
          );
        })}
        </g>
      </g>
    </svg>
  );
}

/**
 * Scales the figure to fill its frame.
 *
 * A pose's skeleton is placed for the CAMERA, where where-you-stand-in-frame is
 * part of the instruction. A thumbnail has no such job: a small figure adrift in
 * a big rectangle just wastes the card (§11). The bounds are padded by the
 * silhouette's own thickness so limbs are not clipped at the edge.
 */
function fitTransform(
  skeletons: LandmarkSet[],
  width: number,
  height: number,
  mass: number,
): string | undefined {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const skeleton of skeletons) {
    for (const q of skeleton) {
      const x = q.x * width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return undefined;

  // Landmarks are joint centres; the drawn body extends past them by roughly a
  // hip radius, and further for a heavier build.
  const bleed = 0.055 * mass;
  minX -= bleed;
  maxX += bleed;
  minY -= bleed;
  maxY += bleed;

  const margin = 0.03;
  const scale = Math.min(
    (width * (1 - margin * 2)) / (maxX - minX),
    (height * (1 - margin * 2)) / (maxY - minY),
  );
  const tx = width / 2 - ((minX + maxX) / 2) * scale;
  const ty = height / 2 - ((minY + maxY) / 2) * scale;
  return `translate(${n(tx)} ${n(ty)}) scale(${n(scale)})`;
}

/**
 * A small profile bump where the face points, drawn in the body tone so it
 * reads as part of the head. It flattens out as the subject turns away, which
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
    />
  );
}

/** Aligns the head with the neck so a tilted head does not look bolted on. */
function headTilt(s: LandmarkSet, m: Metrics): number {
  const shoulder = midpoint(p(s, L.LEFT_SHOULDER), p(s, L.RIGHT_SHOULDER));
  const dx = m.headCentre.x - shoulder.x;
  const dy = m.headCentre.y - shoulder.y;
  if (Math.hypot(dx, dy) < 1e-6) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

/** The surface the pose depends on, as one understated rule. */
function groundMark(
  s: LandmarkSet,
  hint: GroundHint,
  width: number,
  height: number,
): JSX.Element | null {
  const stroke = 'rgba(154, 170, 192, 0.28)';
  const w = 0.0035;

  if (hint === 'seat' || hint === 'floor' || hint === 'rail') {
    const y =
      hint === 'seat'
        ? Math.max(p(s, L.LEFT_HIP).y, p(s, L.RIGHT_HIP).y) + 0.012
        : hint === 'rail'
          ? (p(s, L.LEFT_WRIST).y + p(s, L.RIGHT_WRIST).y) / 2
          : Math.max(...s.map((q) => q.y)) + 0.035;
    if (y > height) return null;
    return <line x1={0} y1={y} x2={width} y2={y} stroke={stroke} strokeWidth={w} />;
  }

  const bodyX = (p(s, L.LEFT_SHOULDER).x + p(s, L.RIGHT_SHOULDER).x) / 2;
  const spread = Math.abs(p(s, L.LEFT_SHOULDER).x - p(s, L.RIGHT_SHOULDER).x);
  const x =
    hint === 'wall-left'
      ? Math.max(width * 0.03, bodyX - spread - 0.05)
      : Math.min(width * 0.97, bodyX + spread + 0.05);
  return <line x1={x} y1={0} x2={x} y2={height} stroke={stroke} strokeWidth={w} />;
}
