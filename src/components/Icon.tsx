import type { SVGProps } from 'react';

/**
 * One coherent icon set drawn to a single spec: 24px box, 1.6 stroke, round
 * caps and joins, no fills, no novelty. Adding a general-purpose icon library
 * for twenty glyphs would cost more than it saves (§95).
 */

export type IconName =
  | 'back'
  | 'close'
  | 'search'
  | 'camera'
  | 'camera-flip'
  | 'shutter'
  | 'grid'
  | 'person'
  | 'couple'
  | 'group'
  | 'lock'
  | 'unlock'
  | 'opacity'
  | 'mirror'
  | 'reset'
  | 'next'
  | 'prev'
  | 'gallery'
  | 'bookmark'
  | 'bookmark-filled'
  | 'filter'
  | 'chevron-down'
  | 'chevron-right'
  | 'check'
  | 'share'
  | 'eye'
  | 'eye-off'
  | 'align'
  | 'plus'
  | 'warning'
  | 'info'
  | 'compass'
  | 'voice'
  | 'voice-off'
  | 'settings';

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

const P: Record<IconName, JSX.Element> = {
  back: <path d="M15 5 8 12l7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-2h6.4l1.1 2h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </>
  ),
  'camera-flip': (
    <>
      <path d="M4 9.5A2.5 2.5 0 0 1 6.5 7h11A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M9.5 13a2.5 2.5 0 0 1 4.3-1.8M14.5 14a2.5 2.5 0 0 1-4.3 1.8" />
      <path d="M13.8 9.6h-1.6v1.6M10.2 17.4h1.6v-1.6" />
    </>
  ),
  shutter: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.2" />
    </>
  ),
  grid: <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </>
  ),
  couple: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.6" />
      <path d="M3 20c0-3.2 2.5-5.4 5.5-5.4S14 16.8 14 20M14.5 20c0-2.8 1.8-4.7 4-4.7 1 0 1.9.4 2.5 1" />
    </>
  ),
  group: (
    <>
      <circle cx="12" cy="7.5" r="2.8" />
      <circle cx="5.5" cy="9.5" r="2.3" />
      <circle cx="18.5" cy="9.5" r="2.3" />
      <path d="M7 20c0-2.9 2.2-4.9 5-4.9s5 2 5 4.9M2 19.5c0-2.2 1.3-3.7 3.3-3.8M22 19.5c0-2.2-1.3-3.7-3.3-3.8" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    </>
  ),
  unlock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.3-1.3" />
    </>
  ),
  opacity: (
    <>
      <path d="M12 3.5c3.4 3.6 5.5 6.3 5.5 9a5.5 5.5 0 0 1-11 0c0-2.7 2.1-5.4 5.5-9z" />
      <path d="M12 6v14" />
    </>
  ),
  mirror: (
    <>
      <path d="M12 3v18" />
      <path d="M9 7.5 4 12l5 4.5zM15 7.5 20 12l-5 4.5z" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4 4v4h4" />
    </>
  ),
  next: <path d="M9 5l7 7-7 7" />,
  prev: <path d="M15 5l-7 7 7 7" />,
  gallery: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" />
      <path d="M3.8 16.2 8.6 12l3.3 2.9 3-2.6 5.2 4.5" />
      <circle cx="9" cy="9" r="1.4" />
    </>
  ),
  bookmark: <path d="M6.5 4.5h11v15.5l-5.5-4-5.5 4z" />,
  'bookmark-filled': <path d="M6.5 4.5h11v15.5l-5.5-4-5.5 4z" fill="currentColor" />,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  'chevron-right': <path d="M9.5 6l6 6-6 6" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  share: (
    <>
      <path d="M12 15.5V4M8.5 7.5 12 4l3.5 3.5" />
      <path d="M5.5 12.5v6A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M4 4.5 20 19.5" />
      <path d="M9.6 6.5A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.7M6.4 8.3A17.4 17.4 0 0 0 2.5 12S6 18 12 18a9.3 9.3 0 0 0 3-.5" />
      <path d="M10.2 10.4a2.8 2.8 0 0 0 3.6 3.9" />
    </>
  ),
  align: (
    <>
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
      <circle cx="12" cy="12" r="4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  warning: (
    <>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.6v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.9v.1" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.5 4.1-4.1 1.5 1.5-4.1z" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </>
  ),
  'voice-off': (
    <>
      <path d="M4 4l16 16" />
      <path d="M15 5.2V6a3 3 0 0 0-5.6-1.5M9 9.4V11a3 3 0 0 0 4.6 2.5" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 9.9 5.6M18.5 11.5a6.4 6.4 0 0 1-.5 2.5M12 18v3M9 21h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </>
  ),
};

export function Icon({ name, size = 22, ...rest }: Props) {
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
      {P[name]}
    </svg>
  );
}
