import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { PoseRepository } from '@/data/poseRepository';
import { buildAssetReport, getBrokenAssets } from '@/data/assetManifest';
import { routes } from '@/app/routes';

/**
 * The honest inventory of what art still has to be produced (§35, §36).
 * Reachable from the pose count on the home screen; not part of the consumer
 * flow, and not linked from anywhere a normal user would land.
 */
export function AssetReportScreen() {
  const poses = PoseRepository.all();
  const rows = buildAssetReport(poses);
  const missingPreview = rows.filter((r) => !r.hasPreviewPhoto);
  const missingOverlay = rows.filter((r) => !r.hasOverlayCutout);
  const broken = getBrokenAssets();

  return (
    <div className="screen">
      <Header title="Asset status" subtitle="Development" backFallback={routes.home} />
      <div className="screen__scroll screen__pad">
        <div className="notice" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="notice__title">
            {rows.length - missingPreview.length} of {rows.length} poses have a photograph
          </div>
          <p className="notice__body">
            Every pose without one renders an anatomical silhouette from its own target skeleton,
            badged as a reference render. The silhouette is the real camera guide; the photograph is
            what is still outstanding. Register files in <code>src/data/assetManifest.ts</code>.
          </p>
        </div>

        {broken.length > 0 && (
          <div className="notice notice--danger" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="notice__title">{broken.length} declared assets failed to load</div>
            <p className="notice__body">{broken.join(', ')}</p>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-3)', textAlign: 'left' }}>
              <th style={{ padding: '8px 0', fontWeight: 600 }}>Pose</th>
              <th style={{ padding: '8px 0', fontWeight: 600, width: 70 }}>Photo</th>
              <th style={{ padding: '8px 0', fontWeight: 600, width: 70 }}>Cutout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.poseId} style={{ borderTop: '1px solid var(--hairline)' }}>
                <td style={{ padding: '10px 0' }}>
                  {r.name}
                  <div style={{ color: 'var(--text-3)', fontSize: 11 }}>{r.poseId}</div>
                </td>
                <td style={{ color: r.hasPreviewPhoto ? 'var(--good)' : 'var(--text-3)' }}>
                  <Icon name={r.hasPreviewPhoto ? 'check' : 'close'} size={16} />
                </td>
                <td style={{ color: r.hasOverlayCutout ? 'var(--good)' : 'var(--text-3)' }}>
                  <Icon name={r.hasOverlayCutout ? 'check' : 'close'} size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-4)' }}>
          {missingPreview.length} photographs and {missingOverlay.length} transparent cutouts
          outstanding.
        </p>
        <div className="screen__bottom-space" />
      </div>
    </div>
  );
}
