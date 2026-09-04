import { Icon } from '@/components/Icon';
import type { EnvironmentReport } from '@/camera/capabilities';

interface Props {
  environment: EnvironmentReport;
  error: { availability: string; message: string } | null;
  onRetry: () => void;
}

/**
 * Honest camera failure states (§4, §105, §115).
 *
 * When an embedding host blocks getUserMedia there is no way around it and we
 * do not pretend otherwise. We offer the one thing that does work — opening the
 * same page in a normal browser tab, which still needs no installation.
 */
export function CameraBlocked({ environment, error, onRetry }: Props) {
  const openInBrowser = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const embedded = environment.isEmbedded;
  const denied = error?.availability === 'permission-denied';
  const noApi = error?.availability === 'api-unavailable' || !environment.hasGetUserMedia;
  const insecure = !environment.isSecureContext;

  let title = 'Camera unavailable';
  let body = error?.message ?? 'The camera could not be started.';

  if (embedded && (denied || noApi || environment.embedAllowsCamera === false)) {
    title = 'This window cannot use the camera';
    body =
      'The page hosting this app has not granted camera access, and that is not something the app can override. Opening it in a normal browser tab works, and still needs no installation.';
  } else if (denied) {
    title = 'Camera access was blocked';
    body =
      'Allow camera access for this site and try again. On iPhone: Settings, Safari, Camera, then set it to Ask or Allow.';
  } else if (insecure) {
    title = 'Camera needs a secure connection';
    body =
      'Browsers only allow camera access over https. Open this page on an https address and the camera will work.';
  } else if (noApi) {
    title = 'This browser has no camera API';
    body = 'Try Safari or Chrome. Everything else in the app still works here.';
  }

  return (
    <div className="cam__blocked" role="alert">
      <Icon name="warning" size={30} style={{ color: 'var(--warn)' }} />
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="cam__blocked-actions">
        {embedded && (
          <button type="button" className="btn btn--primary" onClick={openInBrowser}>
            Open camera version
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
