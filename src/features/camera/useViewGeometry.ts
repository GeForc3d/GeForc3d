import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ViewGeometry } from '@/camera/coordinates';

/**
 * Keeps the coordinate geometry in step with the real element sizes.
 *
 * Everything downstream depends on this being right: the overlay, the detected
 * landmarks, the composition guidance and the capture crop all read it. It is
 * held in a ref for the render loop and mirrored into state for React (§54).
 */
export function useViewGeometry(
  containerRef: RefObject<HTMLElement>,
  videoRef: RefObject<HTMLVideoElement>,
  mirrored: boolean,
) {
  const geometryRef = useRef<ViewGeometry>({
    videoWidth: 0,
    videoHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
    mirrored,
  });
  const [geometry, setGeometry] = useState<ViewGeometry>(geometryRef.current);

  useEffect(() => {
    geometryRef.current = { ...geometryRef.current, mirrored };
    setGeometry((g) => (g.mirrored === mirrored ? g : { ...g, mirrored }));
  }, [mirrored]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const next: ViewGeometry = {
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        containerWidth: Math.round(rect.width),
        containerHeight: Math.round(rect.height),
        mirrored: geometryRef.current.mirrored,
      };
      const prev = geometryRef.current;
      if (
        prev.videoWidth === next.videoWidth &&
        prev.videoHeight === next.videoHeight &&
        prev.containerWidth === next.containerWidth &&
        prev.containerHeight === next.containerHeight
      ) {
        return;
      }
      geometryRef.current = next;
      setGeometry(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    // Video dimensions arrive asynchronously and change on camera switch.
    video?.addEventListener('loadedmetadata', measure);
    video?.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const poll = window.setInterval(measure, 500);

    return () => {
      observer.disconnect();
      video?.removeEventListener('loadedmetadata', measure);
      video?.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.clearInterval(poll);
    };
  }, [containerRef, videoRef]);

  return { geometry, geometryRef };
}
