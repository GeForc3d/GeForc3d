import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { routes } from './routes';

/**
 * Three primary destinations, and none of them is Camera: camera is a mode you
 * enter with a pose in hand, not a place you browse to (§9). The nav disappears
 * entirely while shooting.
 */
const TABS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: routes.home, label: 'Discover', icon: 'compass' },
  { to: routes.poses, label: 'Poses', icon: 'gallery' },
  { to: routes.saved, label: 'Saved', icon: 'bookmark' },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const immersive = pathname.startsWith('/camera');

  return (
    <div className={`app${immersive ? ' app--immersive' : ''}`}>
      {children}
      {!immersive && (
        <nav className="nav" aria-label="Primary">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === routes.home}
              className={({ isActive }) => `nav__item${isActive ? ' nav__item--on' : ''}`}
            >
              <Icon name={t.icon} size={21} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
