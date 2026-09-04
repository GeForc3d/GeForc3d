import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PoseCard } from '@/components/PoseCard';
import { PoseRepository } from '@/data/poseRepository';
import { routes } from '@/app/routes';
import { useShotSession } from '@/app/ShotSessionContext';
import { useSaved } from './savedStore';
import '@/features/discover/discover.css';

type Tab = 'favourites' | 'used' | 'viewed';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'favourites', label: 'Saved' },
  { id: 'used', label: 'Shot with' },
  { id: 'viewed', label: 'Recent' },
];

export function SavedScreen() {
  const { favourites, recentlyUsed, recentlyViewed, toggleFavourite } = useSaved();
  const { update } = useShotSession();
  const [tab, setTab] = useState<Tab>('favourites');

  const ids = tab === 'favourites' ? favourites : tab === 'used' ? recentlyUsed : recentlyViewed;
  const poses = ids.map((id) => PoseRepository.get(id)).filter(Boolean);

  const emptyCopy: Record<Tab, string> = {
    favourites: 'Save a pose from its page and it lands here, ready for the next shoot.',
    used: 'Poses you have actually taken a photo with show up here, so you can go back to what worked.',
    viewed: 'Poses you have opened recently appear here.',
  };

  return (
    <div className="screen">
      <Header title="Saved" showBack={false} />
      <div className="screen__scroll">
        <div className="chip-scroll" style={{ paddingTop: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip${tab === t.id ? ' chip--on' : ''}`}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ height: 'var(--space-4)' }} />

        {poses.length ? (
          <div className="screen__pad">
            <div className="pose-grid">
              {poses.map((p) => (
                <PoseCard
                  key={p!.id}
                  pose={p!}
                  to={routes.pose(p!.id)}
                  isFavourite={favourites.includes(p!.id)}
                  onToggleFavourite={toggleFavourite}
                  onSelect={() => update({ selectedPoseId: p!.id })}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty">
            <div className="empty__title">Nothing here yet</div>
            <p className="empty__body">{emptyCopy[tab]}</p>
            <Link
              to={routes.poses}
              className="btn btn--secondary"
              style={{ marginTop: 'var(--space-4)' }}
            >
              Browse poses
            </Link>
          </div>
        )}

        <div className="screen__bottom-space" />
      </div>
    </div>
  );
}
