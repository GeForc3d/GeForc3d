import { useState } from 'react';
import type { Pose, ResolvedPose } from '@/models/pose';
import type { PoseRepresentation, RepresentationType } from '@/models/representation';
import { BODY_PROPORTIONS } from '@/models/representation';
import { reportBrokenAsset } from '@/data/assetManifest';
import { representationOf } from '@/data/poseRepository';
import { PoseSilhouette, type GroundHint } from './PoseSilhouette';

interface Props {
  pose: ResolvedPose;
  /** Which body to show. Callers resolve this from the user's preference. */
  representation: RepresentationType;
  kind?: 'preview' | 'overlay';
  className?: string;
  showBadge?: boolean;
  aspect?: number;
  mirrored?: boolean;
}

/**
 * The human reference for a pose, on a chosen body.
 *
 * Uses photography as soon as the asset manifest supplies it, per pose and per
 * representation. Until then it renders the development figure and says so.
 * A declared asset that fails to load never shows a broken image: it falls back
 * to the render and is recorded for the asset report (§36).
 */
export function PoseReference({
  pose,
  representation,
  kind = 'preview',
  className,
  showBadge = true,
  aspect = 3 / 4,
  mirrored = false,
}: Props) {
  const rep = representationOf(pose, representation);
  const src = kind === 'preview' ? rep.previewImage : rep.overlayImage;
  const [failed, setFailed] = useState(false);
  const usingPhoto = Boolean(src) && !failed;

  if (usingPhoto) {
    return (
      <img
        className={['pose-ref', 'pose-ref--photo', className].filter(Boolean).join(' ')}
        src={src!}
        alt={`${pose.name} demonstrated by a ${rep.representationType} figure`}
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
          skeletons={rep.targetSkeletons}
          aspect={aspect}
          ground={groundFor(pose)}
          mass={BODY_PROPORTIONS[rep.representationType].mass}
          backSide={backSideFor(pose)}
          mirrored={mirrored}
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

/** What the pose is resting on, from its body position and rig lean. */
export function groundFor(pose: Pose): GroundHint {
  switch (pose.bodyPosition) {
    case 'sitting':
      return 'seat';
    case 'lying':
      return 'floor';
    case 'leaning': {
      if (pose.requiredElements.includes('railing')) return 'rail';
      const lean = pose.targetSubjects[0]?.rig.leanDeg ?? 0;
      if (Math.abs(lean) < 3) return 'none';
      return lean < 0 ? 'wall-left' : 'wall-right';
    }
    default:
      return 'none';
  }
}

/**
 * Which of the subject's own sides is turned away from the camera, so those
 * limbs can be drawn behind the body. A subject turning toward their own left
 * (positive yaw) sends their left side away.
 */
export function backSideFor(pose: Pose): 'left' | 'right' | null {
  const raw = pose.targetSubjects[0]?.rig.yawDeg ?? 0;
  const yaw = ((raw + 180) % 360) - 180;
  const folded = Math.abs(yaw) > 90 ? (yaw > 0 ? yaw - 180 : yaw + 180) : yaw;
  if (folded > 14) return 'left';
  if (folded < -14) return 'right';
  return null;
}

export type { PoseRepresentation };
