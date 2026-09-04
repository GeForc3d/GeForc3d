import { useState } from 'react';
import type { ResolvedPose } from '@/models/pose';
import { reportBrokenAsset } from '@/data/assetManifest';
import { PoseSilhouette, type GroundHint } from './PoseSilhouette';
import type { Pose } from '@/models/pose';

interface Props {
  pose: ResolvedPose;
  kind?: 'preview' | 'overlay';
  className?: string;
  /** Shows the development-reference badge. Off for the camera overlay. */
  showBadge?: boolean;
  aspect?: number;
}

/**
 * The human reference for a pose.
 *
 * Uses real photography when the asset manifest supplies it. Until then it
 * renders the pose's own target skeleton as an anatomical silhouette and says
 * plainly that it is a development reference (§34, §35). It never shows a
 * broken image: a declared asset that fails to load falls back to the render
 * and is recorded for the dev asset report (§36).
 */
export function PoseReference({
  pose,
  kind = 'preview',
  className,
  showBadge = true,
  aspect = 3 / 4,
}: Props) {
  const src = kind === 'preview' ? pose.assets.previewImage : pose.assets.overlayImage;
  const [failed, setFailed] = useState(false);
  const usingPhoto = Boolean(src) && !failed;

  if (usingPhoto) {
    return (
      <img
        className={['pose-ref', 'pose-ref--photo', className].filter(Boolean).join(' ')}
        src={src!}
        alt={`${pose.name} reference`}
        loading="lazy"
        decoding="async"
        onError={() => {
          reportBrokenAsset(src!);
          setFailed(true);
        }}
      />
    );
  }

  return (
    <div className={['pose-ref', className].filter(Boolean).join(' ')}>
      <div className="pose-render">
        <PoseSilhouette
          skeletons={pose.targetSkeletons}
          aspect={aspect}
          ground={groundFor(pose)}
        />
      </div>
      {showBadge && (
        <span className="dev-badge pose-render__badge">
          {failed ? 'Asset missing' : 'Reference render'}
        </span>
      )}
    </div>
  );
}

/** What the pose is resting on, from its own body position and rig lean. */
export function groundFor(pose: Pose): GroundHint {
  switch (pose.bodyPosition) {
    case 'sitting':
      return 'seat';
    case 'lying':
      return 'floor';
    case 'leaning': {
      // A railing is a horizontal line the subject rests on; a wall is a
      // vertical surface beside them. Drawing one as the other misleads.
      if (pose.requiredElements.includes('railing')) return 'rail';
      const lean = pose.targetSubjects[0]?.rig.leanDeg ?? 0;
      if (Math.abs(lean) < 3) return 'none';
      return lean < 0 ? 'wall-left' : 'wall-right';
    }
    default:
      return 'none';
  }
}
