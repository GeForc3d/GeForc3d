import type { PoseAssets } from '@/models/pose';
import { appBasePath } from '@/utilities/basePath';
import type { RepresentationType } from '@/models/representation';

/**
 * ASSET HONESTY (§35, §36).
 *
 * This manifest is where real human reference photography is registered. It is
 * currently EMPTY: no licensed photographic references ship with this build.
 *
 * Until an entry exists for a pose, the app renders a procedurally generated
 * anatomical silhouette derived from that pose's own target skeleton, and
 * labels it as a development reference everywhere it appears. The silhouette is
 * production-quality for its functional job — the transparent camera guide —
 * but it is NOT a photograph and the UI never implies that it is.
 *
 * To add a real reference:
 *   1. Drop the files into `public/assets/poses/`.
 *   2. Add an entry below.
 *   3. Nothing else changes. The resolver picks them up and the placeholder
 *      badges disappear for that pose.
 *
 * `previewImage` should be a full-colour photograph of the pose in a
 * representative scene. `overlayImage` should be the same pose as a transparent
 * PNG cutout on a fully transparent background, with the subject's feet at the
 * bottom edge and no cropping of the head or hands.
 */

export interface PoseAssetEntry {
  previewImage?: string;
  overlayImage?: string;
  /**
   * Per-body-type references. A pose may ship photography for some
   * representations before others; each falls back to the pose-level asset,
   * then to the development render.
   */
  representations?: Partial<Record<RepresentationType, PoseAssetEntry>>;
}

export const POSE_ASSET_MANIFEST: Record<string, PoseAssetEntry> = {
  // e.g. 'look-back': {
  //   previewImage: 'assets/poses/look-back/average-preview.jpg',
  //   overlayImage: 'assets/poses/look-back/average-overlay.png',
  //   representations: {
  //     curvy: {
  //       previewImage: 'assets/poses/look-back/curvy-preview.jpg',
  //       overlayImage: 'assets/poses/look-back/curvy-overlay.png',
  //     },
  //   },
  // },
};

const base = appBasePath;

/**
 * Assets for one body type, falling back to the pose-level entry.
 *
 * Photography can therefore land representation by representation rather than
 * needing all six shot before any of them can be used.
 */
export const representationAssets = (
  poseId: string,
  type: RepresentationType,
): { previewImage: string | null; overlayImage: string | null } => {
  const entry = POSE_ASSET_MANIFEST[poseId];
  const specific = entry?.representations?.[type];
  const preview = specific?.previewImage ?? entry?.previewImage;
  const overlay = specific?.overlayImage ?? entry?.overlayImage;
  return {
    previewImage: preview ? `${base()}${preview}` : null,
    overlayImage: overlay ? `${base()}${overlay}` : null,
  };
};

export const resolveAssets = (poseId: string): PoseAssets => {
  const entry = POSE_ASSET_MANIFEST[poseId];
  const preview = entry?.previewImage ? `${base()}${entry.previewImage}` : null;
  const overlay = entry?.overlayImage ? `${base()}${entry.overlayImage}` : null;
  return {
    poseId,
    previewImage: preview,
    overlayImage: overlay,
    previewIsPlaceholder: !preview,
    overlayIsPlaceholder: !overlay,
  };
};

/** Assets a declared manifest entry promised but the browser could not load. */
const brokenAssets = new Set<string>();

export const reportBrokenAsset = (url: string): void => {
  if (brokenAssets.has(url)) return;
  brokenAssets.add(url);
  // Surfaced in the dev asset report rather than swallowed.
  console.warn(`[POSE] declared asset failed to load, falling back to render: ${url}`);
};

export const getBrokenAssets = (): string[] => [...brokenAssets];

export interface AssetReportRow {
  poseId: string;
  name: string;
  hasPreviewPhoto: boolean;
  hasOverlayCutout: boolean;
}

export const buildAssetReport = (
  poses: Array<{ id: string; name: string }>,
): AssetReportRow[] =>
  poses.map((p) => {
    const e = POSE_ASSET_MANIFEST[p.id];
    return {
      poseId: p.id,
      name: p.name,
      hasPreviewPhoto: Boolean(e?.previewImage),
      hasOverlayCutout: Boolean(e?.overlayImage),
    };
  });
