import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PoseCard } from '@/components/PoseCard';
import { PoseRepository } from '@/data/poseRepository';
import { routes } from '@/app/routes';
import { useSaved } from './savedStore';
import { useReferencePreference } from './referencePreference';
import { REPRESENTATION_LABELS, REPRESENTATION_TYPES } from '@/models/representation';
import '@/features/discover/discover.css';

type Tab = 'favourites' | 'used' | 'viewed';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'favourites', label: 'Saved' },
  { id: 'used', label: 'Shot with' },
  { id: 'viewed', label: 'Recent' },
];

export function SavedScreen() {
  const { favourites, recentlyUsed, recentlyViewed, toggleFavourite } = useSaved();
  const [tab, setTab] = useState<Tab>('favourites');
  const { preference, setPreference, forPose } = useReferencePreference();

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
                  representation={forPose(p!.id)}
                  isFavourite={favourites.includes(p!.id)}
                  onToggleFavourite={toggleFavourite}
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

        <section className="section" style={{ paddingTop: 'var(--space-8)' }}>
          <div className="section__head">
            <h3 className="section-title">Reference appearance</h3>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>
            Which body poses are demonstrated on. This only changes the reference you see, never
            which poses are suggested or how the camera judges a pose.
          </p>
          <div className="chip-row">
            <button
              type="button"
              className={`chip${preference.mode === 'diverse' ? ' chip--on' : ''}`}
              onClick={() => setPreference({ mode: 'diverse' })}
              aria-pressed={preference.mode === 'diverse'}
            >
              Diverse mix
            </button>
            {REPRESENTATION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip${
                  preference.mode === 'fixed' && preference.type === t ? ' chip--on' : ''
                }`}
                onClick={() => setPreference({ mode: 'fixed', type: t })}
                aria-pressed={preference.mode === 'fixed' && preference.type === t}
              >
                {REPRESENTATION_LABELS[t]}
              </button>
            ))}
          </div>
        </section>

        <div className="screen__bottom-space" />
      </div>
    </div>
  );
}
