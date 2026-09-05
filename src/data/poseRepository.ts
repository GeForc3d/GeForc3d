import { buildTargetSkeleton } from '@/models/skeleton';
import {
  BODY_PROPORTIONS,
  REPRESENTATION_TYPES,
  type PoseRepresentation,
  type RepresentationType,
} from '@/models/representation';
import type { Pose, ResolvedPose } from '@/models/pose';
import { ALL_POSES } from './poses';
import { representationAssets, resolveAssets } from './assetManifest';

/**
 * The single source of poses.
 *
 * Each pose is resolved once at module load into its canonical matcher geometry
 * plus one representation per body type. Representations differ only in how the
 * body is DRAWN; the canonical skeleton the computer vision compares against is
 * built from the unmodified rig and is shared by all of them (§9).
 */

const skeletonsFor = (pose: Pose, type?: RepresentationType) =>
  pose.targetSubjects.map((s) =>
    buildTargetSkeleton(
      s.rig,
      {
        centreX: s.placement.centreX,
        centreY: s.placement.centreY,
        heightFraction: s.placement.heightFraction,
        maxWidthFraction: s.placement.maxWidthFraction,
      },
      type ? BODY_PROPORTIONS[type] : undefined,
    ),
  );

const buildRepresentations = (pose: Pose): PoseRepresentation[] =>
  REPRESENTATION_TYPES.map((type) => {
    const assets = representationAssets(pose.id, type);
    return {
      id: `${pose.id}--${type}`,
      representationType: type,
      previewImage: assets.previewImage,
      overlayImage: assets.overlayImage,
      targetSkeletons: skeletonsFor(pose, type),
      isPlaceholder: !assets.previewImage,
    };
  });

const resolve = (pose: Pose): ResolvedPose => ({
  ...pose,
  targetSkeletons: skeletonsFor(pose),
  representations: buildRepresentations(pose),
  assets: resolveAssets(pose.id),
});

const resolved: ResolvedPose[] = ALL_POSES.map(resolve);
const byId = new Map(resolved.map((p) => [p.id, p]));

export const PoseRepository = {
  all(): ResolvedPose[] {
    return resolved;
  },
  get(id: string | null | undefined): ResolvedPose | undefined {
    return id ? byId.get(id) : undefined;
  },
  has(id: string): boolean {
    return byId.has(id);
  },
  count(): number {
    return resolved.length;
  },
};

/** The representation to show, honouring an explicit choice over the default. */
export function representationOf(
  pose: ResolvedPose,
  type: RepresentationType,
): PoseRepresentation {
  return (
    pose.representations.find((r) => r.representationType === type) ?? pose.representations[0]
  );
}

export type { ResolvedPose };
