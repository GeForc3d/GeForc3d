import { useCallback, useEffect, useRef } from 'react';
import type { ResolvedPose } from '@/models/pose';
import type { RepresentationType } from '@/models/representation';
import { representationOf } from '@/data/poseRepository';
import type { OverlayTransform } from '@/models/shotSession';
import { PoseSilhouette } from '@/components/PoseSilhouette';
import { backSideFor } from '@/components/PoseReference';
import { BODY_PROPORTIONS } from '@/models/representation';
import { reportBrokenAsset } from '@/data/assetManifest';

/**
 * The transparent human guide over the live camera.
 *
 * Gestures are handled with Pointer Events on a dedicated layer so they never
 * fight the browser: one finger drags, two fingers scale. During a gesture the
 * transform is written straight to the element's style, and only the settled
 * result is committed to session state — dragging must not re-render React
 * sixty times a second (§50, §110).
 */

interface Props {
  pose: ResolvedPose;
  /** Which body the guide is drawn as. */
  representation: RepresentationType;
  transform: OverlayTransform;
  opacity: number;
  mirrored: boolean;
  locked: boolean;
  onCommit: (t: OverlayTransform) => void;
  containerWidth: number;
  containerHeight: number;
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 3.2;

const cssFor = (t: OverlayTransform, w: number, h: number) =>
  `translate(${t.x * w}px, ${t.y * h}px) scale(${t.scale})`;

export function GuideOverlay({
  pose,
  representation,
  transform,
  opacity,
  mirrored,
  locked,
  onCommit,
  containerWidth,
  containerHeight,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<OverlayTransform>(transform);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startTransform: OverlayTransform;
    startCentre: { x: number; y: number };
    startSpread: number;
  } | null>(null);

  // Follow external changes (reset, restore, pose switch) when idle.
  useEffect(() => {
    if (gesture.current) return;
    liveRef.current = transform;
    const el = elRef.current;
    if (el) el.style.transform = cssFor(transform, containerWidth, containerHeight);
  }, [transform, containerWidth, containerHeight]);

  const apply = useCallback(
    (t: OverlayTransform) => {
      liveRef.current = t;
      const el = elRef.current;
      if (el) el.style.transform = cssFor(t, containerWidth, containerHeight);
    },
    [containerWidth, containerHeight],
  );

  const centreOf = (map: Map<number, { x: number; y: number }>) => {
    let x = 0;
    let y = 0;
    for (const p of map.values()) {
      x += p.x;
      y += p.y;
    }
    const n = map.size || 1;
    return { x: x / n, y: y / n };
  };

  const spreadOf = (map: Map<number, { x: number; y: number }>) => {
    const pts = [...map.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = {
      startTransform: { ...liveRef.current },
      startCentre: centreOf(pointers.current),
      startSpread: spreadOf(pointers.current),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (locked || !pointers.current.has(e.pointerId) || !gesture.current) return;
    e.preventDefault();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gesture.current;
    const centre = centreOf(pointers.current);
    const dx = (centre.x - g.startCentre.x) / (containerWidth || 1);
    const dy = (centre.y - g.startCentre.y) / (containerHeight || 1);

    let scale = g.startTransform.scale;
    const spread = spreadOf(pointers.current);
    if (pointers.current.size >= 2 && g.startSpread > 8) {
      scale = clamp(g.startTransform.scale * (spread / g.startSpread), MIN_SCALE, MAX_SCALE);
    }

    apply({
      x: clamp(g.startTransform.x + dx, -1.2, 1.2),
      y: clamp(g.startTransform.y + dy, -1.2, 1.2),
      scale,
    });
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      onCommit(liveRef.current);
    } else {
      // A finger lifted mid-pinch: rebase so the remaining finger does not jump.
      gesture.current = {
        startTransform: { ...liveRef.current },
        startCentre: centreOf(pointers.current),
        startSpread: spreadOf(pointers.current),
      };
    }
  };

  const rep = representationOf(pose, representation);
  const usingPhoto = Boolean(rep.overlayImage);

  return (
    <>
      <div
        className="guide"
        ref={elRef}
        style={{
          transform: cssFor(transform, containerWidth, containerHeight),
          opacity,
        }}
        aria-hidden="true"
      >
        <div className="guide__inner">
          {usingPhoto ? (
            <img
              src={rep.overlayImage!}
              alt=""
              style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
              onError={() => reportBrokenAsset(rep.overlayImage!)}
            />
          ) : (
            <PoseSilhouette
              skeletons={rep.targetSkeletons}
              variant="overlay"
              mass={BODY_PROPORTIONS[rep.representationType].mass}
              backSide={backSideFor(pose)}
              mirrored={mirrored}
              fill="#EAF1FB"
              aspect={containerHeight > 0 ? containerWidth / containerHeight : 3 / 4}
            />
          )}
        </div>
      </div>

      <div
        className={`guide-gestures${locked ? ' guide-gestures--locked' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        role="application"
        aria-label="Pose guide. Drag to move, pinch to resize."
      />
    </>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
