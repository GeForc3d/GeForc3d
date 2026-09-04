import type { GuidanceOutput } from '@/guidance/types';

interface Props {
  guidance: GuidanceOutput;
  /** A truthful, functional status line: model loading, guide off, and so on. */
  status?: string | null;
  enabled: boolean;
}

/**
 * One instruction at a time, labelled with who has to move (§70, §71).
 *
 * CAMERA means the photographer. POSE means the person being photographed. The
 * labels are small on purpose: this sits over a live viewfinder and must not
 * become the thing you are looking at.
 */
export function GuidanceHud({ guidance, status, enabled }: Props) {
  if (status) {
    return (
      <div className="hud">
        <div className="hud__card hud__card--status" role="status">
          {status}
        </div>
      </div>
    );
  }

  if (!enabled) return null;

  if (guidance.hold) {
    return (
      <div className="hud">
        <div className="hud__card hud__card--hold" role="status" aria-live="polite">
          Hold
        </div>
      </div>
    );
  }

  if (!guidance.instruction) return null;

  const isCamera = guidance.instruction.actor === 'camera';
  return (
    <div className="hud">
      <div className="hud__card" role="status" aria-live="polite">
        <span className={`hud__actor hud__actor--${isCamera ? 'camera' : 'subject'}`}>
          {isCamera ? 'Camera' : 'Pose'}
        </span>
        <span className="hud__text">{guidance.instruction.text}</span>
      </div>
    </div>
  );
}
