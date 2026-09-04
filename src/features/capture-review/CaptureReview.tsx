import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { shareCapture, type Capture } from '@/camera/capture';
import type { ResolvedPose } from '@/models/pose';
import './captureReview.css';

interface Props {
  capture: Capture;
  pose: ResolvedPose;
  shotCount: number;
  onKeep: () => void;
  onRetake: () => void;
  onNextPose: () => void;
}

/**
 * Review after a capture. Shooting is a session: none of these actions ends it
 * or sends the photographer back through discovery (§81, §82, §83).
 */
export function CaptureReview({
  capture,
  pose,
  shotCount,
  onKeep,
  onRetake,
  onNextPose,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const save = async () => {
    setSharing(true);
    const filename = `pose-${pose.id}-${new Date(capture.takenAt)
      .toISOString()
      .replace(/[:.]/g, '-')}.jpg`;
    const result = await shareCapture(capture, filename);
    setSharing(false);
    if (result.ok && result.method === 'share') setMessage(null);
    else if (result.ok) setMessage('Saved to your downloads.');
    else setMessage(result.message ?? 'Could not save the photo.');
  };

  return (
    <div className="review" role="dialog" aria-modal="true" aria-label="Review photo">
      <div className="review__media">
        <img src={capture.url} alt={`Photo taken with the ${pose.name} pose`} />
      </div>

      <div className="review__bar">
        <div className="review__meta">
          <div className="review__pose">{pose.name}</div>
          <div className="review__count">
            {capture.width}×{capture.height} · {shotCount} {shotCount === 1 ? 'shot' : 'shots'} this
            session
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={save}
          disabled={sharing}
          aria-label="Share or save photo"
        >
          <Icon name="share" size={21} />
        </button>
      </div>

      {message && <p className="review__message">{message}</p>}

      <div className="review__actions">
        <button type="button" className="btn btn--secondary" onClick={onRetake}>
          Retake
        </button>
        <button type="button" className="btn btn--secondary" onClick={onNextPose}>
          Next pose
        </button>
        <button type="button" className="btn btn--primary" onClick={onKeep}>
          Keep shooting
        </button>
      </div>
    </div>
  );
}
