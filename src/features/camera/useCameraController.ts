import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraController, type CameraState, type FacingMode } from '@/camera/CameraController';
import { inspectEnvironment, type EnvironmentReport } from '@/camera/capabilities';

/**
 * Binds a CameraController to a video element and to the page lifecycle.
 *
 * Tracks are released when the tab is hidden and restarted when it returns, so
 * the camera light never stays on behind another app (§41).
 */
export function useCameraController(initialFacing: FacingMode) {
  const controllerRef = useRef<CameraController | null>(null);
  if (!controllerRef.current) controllerRef.current = new CameraController();
  const controller = controllerRef.current;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<CameraState>(controller.getState());
  const [environment] = useState<EnvironmentReport>(() => inspectEnvironment());
  const [videoReady, setVideoReady] = useState(false);
  const wasLiveRef = useRef(false);

  useEffect(() => controller.subscribe(setState), [controller]);

  const attach = useCallback(() => {
    const video = videoRef.current;
    const stream = controller.getStream();
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      setVideoReady(false);
      const play = () => {
        video.play().catch(() => {
          /* autoplay can be refused until a gesture; the user has already tapped */
        });
      };
      if (video.readyState >= 1) play();
      else video.addEventListener('loadedmetadata', play, { once: true });
    }
  }, [controller]);

  useEffect(() => {
    if (state.status === 'live') attach();
  }, [state.status, attach]);

  const start = useCallback(
    (facing?: FacingMode) => {
      wasLiveRef.current = true;
      return controller.start(facing);
    },
    [controller],
  );

  const stop = useCallback(() => {
    wasLiveRef.current = false;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setVideoReady(false);
    controller.stop();
  }, [controller]);

  const switchCamera = useCallback(() => controller.switchCamera(), [controller]);

  // Release the camera while the page is hidden; take it back on return.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (controller.getState().status === 'live') {
          wasLiveRef.current = true;
          controller.stop();
        }
      } else if (wasLiveRef.current && controller.getState().status === 'idle') {
        void controller.start();
      }
    };
    const onPageHide = () => controller.stop();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [controller]);

  useEffect(() => () => controller.dispose(), [controller]);

  useEffect(() => {
    // Kept out of the initial render so permission is only requested when the
    // user has deliberately entered shooting mode (§38).
    void start(initialFacing);
    return stop;
    // Starting once on mount is the intent; facing changes go through switchCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVideoLoaded = useCallback(() => setVideoReady(true), []);

  return {
    videoRef,
    state,
    environment,
    videoReady,
    onVideoLoaded,
    start,
    stop,
    switchCamera,
    controller,
  };
}
