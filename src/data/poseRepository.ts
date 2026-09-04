import { buildTargetSkeleton } from '@/models/skeleton';
import type { Pose, ResolvedPose } from '@/models/pose';
import { ALL_POSES } from './poses';
import { resolveAssets } from './assetManifest';

/**
 * The single source of poses. Skeletons are built once at module load and
 * cached; nothing downstream rebuilds them per render.
 */

const resolve = (pose: Pose): ResolvedPose => ({
  ...pose,
  targetSkeletons: pose.targetSubjects.map((s) =>
    buildTargetSkeleton(s.rig, {
      centreX: s.placement.centreX,
      centreY: s.placement.centreY,
      heightFraction: s.placement.heightFraction,
    }),
  ),
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

export type { ResolvedPose };
