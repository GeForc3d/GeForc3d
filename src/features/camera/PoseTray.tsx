import { Sheet } from '@/components/Sheet';
import { PoseReference } from '@/components/PoseReference';
import type { ResolvedPose } from '@/models/pose';
import { useReferencePreference } from '@/features/saved/referencePreference';

interface Props {
  open: boolean;
  poses: ResolvedPose[];
  currentId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
  onEditShot: () => void;
}

/**
 * Switching pose mid-shoot. Picking one updates the overlay, the target
 * skeleton and the guidance immediately, without restarting the camera (§44).
 */
export function PoseTray({ open, poses, currentId, onPick, onClose, onEditShot }: Props) {
  const { forPose } = useReferencePreference();
  return (
    <Sheet
      open={open}
      title="Switch pose"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--secondary btn--block" onClick={onEditShot}>
          Edit shot instead
        </button>
      }
    >
      {poses.length ? (
        <div className="tray-grid">
          {poses.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tray-item${p.id === currentId ? ' tray-item--on' : ''}`}
              onClick={() => onPick(p.id)}
              aria-pressed={p.id === currentId}
            >
              <div className="tray-item__media">
                <PoseReference pose={p} representation={forPose(p.id)} showBadge={false} />
              </div>
              <div className="tray-item__name">{p.name}</div>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 14 }}>
          No other poses match this shot setup. Edit the shot to widen it.
        </p>
      )}
    </Sheet>
  );
}
