import type { SVGProps } from 'react';
import type { Scene } from '@/models/taxonomy';

/**
 * A distinct mark per scene, drawn to the same spec as the icon set: 24px box,
 * 1.6 stroke, round joins. Eight identical watermarks would have been
 * decoration; eight different ones are a way to recognise a tile at a glance.
 */
const GLYPHS: Partial<Record<Scene, JSX.Element>> = {
  beach: (
    <>
      <circle cx="17" cy="7.5" r="3" />
      <path d="M2.5 15.5c1.6 0 1.6 1.6 3.2 1.6s1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6" />
      <path d="M2.5 19.6c1.6 0 1.6 1.6 3.2 1.6s1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6" />
    </>
  ),
  cafe: (
    <>
      <path d="M4.5 9.5h12v5.2a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5z" />
      <path d="M16.5 11h1.7a2.4 2.4 0 0 1 0 4.8h-1.7" />
      <path d="M7.5 3.5v2.2M11 3.5v2.2M14.5 3.5v2.2" />
    </>
  ),
  restaurant: (
    <>
      <path d="M6.5 3.5v7a2.2 2.2 0 0 0 4.4 0v-7M8.7 5.6v-2.1M8.7 12.7V20.5" />
      <path d="M17.2 3.5c-1.4 1.2-2 3-2 5.2 0 1.6.7 2.6 2 3v8.8" />
    </>
  ),
  city: (
    <>
      <path d="M3.5 20.5V10l5-2.5V20.5" />
      <path d="M8.5 20.5V5l6 2.4v13.1" />
      <path d="M14.5 20.5V11l6 2.2v7.3" />
      <path d="M2.5 20.5h19" />
    </>
  ),
  park: (
    <>
      <path d="M12 20.5v-5" />
      <path d="M12 3.5 6.5 11h11z" />
      <path d="M12 8 7.5 15.5h9z" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.5 12 3.8l8.5 6.7" />
      <path d="M5.6 12v8.5h12.8V12" />
      <path d="M10 20.5v-5.4h4v5.4" />
    </>
  ),
  night: (
    <>
      <path d="M19.5 14.2A7.6 7.6 0 0 1 9.6 4.6a8 8 0 1 0 9.9 9.6z" />
      <path d="M17.5 4v2.6M16.2 5.3h2.6" />
    </>
  ),
  travel: (
    <>
      <path d="M3 13.4 20 5l-3.4 8.7 2 6.6-3.4-1.4-3.7 2.6-.6-4.6z" />
      <path d="M11 17.9 20 5" />
    </>
  ),
  hotel: (
    <>
      <path d="M3.5 20.5V6.5M3.5 12h9.4a4 4 0 0 1 4 4v4.5H3.5" />
      <circle cx="7.7" cy="8.6" r="1.9" />
    </>
  ),
  pool: (
    <>
      <path d="M8 20V5.5a2 2 0 0 1 4 0V20M14 20V5.5a2 2 0 0 1 4 0V20" />
      <path d="M8 10.5h6M8 15h6" />
      <path d="M2.5 20c1.6 0 1.6 1.5 3.2 1.5" />
    </>
  ),
  forest: (
    <>
      <path d="M8 20v-3.5M8 3.5 3.5 12h9zM8 8 4.8 16.5h6.4" />
      <path d="M16.5 20v-3M16.5 7 13 14h7z" />
    </>
  ),
  street: (
    <>
      <path d="M4 21 9 3M20 21 15 3" />
      <path d="M12 5v2.5M12 11v2.5M12 17v2.5" />
    </>
  ),
  balcony: (
    <>
      <path d="M3.5 10.5h17M3.5 20.5h17M3.5 10.5v10M20.5 10.5v10" />
      <path d="M8.5 10.5v10M12 10.5v10M15.5 10.5v10" />
      <path d="M6 6.5 12 3l6 3.5" />
    </>
  ),
  indoor: (
    <>
      <rect x="3.5" y="4" width="17" height="16.5" rx="2" />
      <path d="M8.5 20.5V13h7v7.5M8.5 8h7" />
    </>
  ),
  outdoor: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.6M12 18.9v2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.9 19.1l1.9-1.9M17.2 6.8l1.9-1.9" />
    </>
  ),
  other: <path d="M6.5 12h.1M12 12h.1M17.5 12h.1" />,
};

interface Props extends SVGProps<SVGSVGElement> {
  scene: Scene;
  size?: number;
}

export function SceneGlyph({ scene, size = 24, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GLYPHS[scene] ?? GLYPHS.other}
    </svg>
  );
}
