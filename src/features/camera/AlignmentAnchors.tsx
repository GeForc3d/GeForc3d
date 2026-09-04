import { useEffect, useRef, type RefObject } from 'react';
import { L, type LandmarkSet } from '@/models/landmarks';
import { midpoint } from '@/pose-matching/features';

interface Props {
  peopleRef: RefObject<LandmarkSet[]>;
  active: boolean;
  hold: boolean;
}

/**
 * Four understated anchors — head, shoulders, hips, feet — drawn on a canvas
 * rather than through React, and faded out as the pose settles (§76).
 *
 * Deliberately not a bright fitness skeleton. The transparent human guide is
 * the reference; this only confirms the app can see the person.
 */
export function AlignmentAnchors({ peopleRef, active, hold }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const alphaRef = useRef(0);

  useEffect(() => {
    if (!active) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let running = true;
    const draw = () => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(draw);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const people = peopleRef.current ?? [];
      // Anchors fade away as alignment improves, so a good pose is uncluttered.
      const targetAlpha = people.length ? (hold ? 0.12 : 0.5) : 0;
      alphaRef.current += (targetAlpha - alphaRef.current) * 0.12;
      if (alphaRef.current < 0.01) return;

      for (const person of people) {
        const points = anchorPoints(person);
        for (const p of points) {
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(234, 241, 251, ${alphaRef.current})`;
          ctx.fill();
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, hold, peopleRef]);

  return <canvas className="anchors" ref={canvasRef} aria-hidden="true" />;
}

function anchorPoints(p: LandmarkSet) {
  const vis = (i: number) => (p[i] && (p[i].visibility ?? 1) > 0.5 ? p[i] : null);
  const sl = vis(L.LEFT_SHOULDER);
  const sr = vis(L.RIGHT_SHOULDER);
  const hl = vis(L.LEFT_HIP);
  const hr = vis(L.RIGHT_HIP);
  const al = vis(L.LEFT_ANKLE);
  const ar = vis(L.RIGHT_ANKLE);
  return [
    vis(L.NOSE),
    sl && sr ? midpoint(sl, sr) : null,
    hl && hr ? midpoint(hl, hr) : null,
    al,
    ar,
  ];
}
