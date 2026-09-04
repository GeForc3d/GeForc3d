import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { PoseCard } from '@/components/PoseCard';
import { PoseRepository } from '@/data/poseRepository';
import { routes } from '@/app/routes';
import { useShotSession } from '@/app/ShotSessionContext';
import { constraintsFor, recommend } from '@/recommendations/engine';
import { LocalSceneInterpreter } from '@/search/sceneInterpreter';
import { ShotSetupBar } from '@/features/shot-setup/ShotSetupBar';
import { ShotSetupSheet, type ShotSetupDraft } from '@/features/shot-setup/ShotSetupSheet';
import { useSaved } from '@/features/saved/savedStore';
import type { Scene } from '@/models/taxonomy';
import '@/features/discover/discover.css';

/**
 * The pose library and the filtered results are the same screen. Scroll
 * position is written back into the session so Back from a pose returns you
 * exactly where you were (§11).
 */
export function PoseLibraryScreen() {
  const { session, update } = useShotSession();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { favourites, toggleFavourite } = useSaved();

  const interpreted = useMemo(
    () => LocalSceneInterpreter.interpret(session.searchText),
    [session.searchText],
  );
  const constraints = useMemo(
    () => constraintsFor(session, interpreted),
    [session, interpreted],
  );

  const results = useMemo(
    () => recommend(PoseRepository.all(), constraints),
    [constraints],
  );

  // Restore scroll on mount, then keep the session up to date as the user moves.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && session.resultScrollPosition > 0) el.scrollTop = session.resultScrollPosition;
    // Restoring once on mount is the point; re-running would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => update({ resultScrollPosition: el.scrollTop }));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [update]);

  const setup: ShotSetupDraft = {
    scene: constraints.scene as Scene | null,
    bodyPosition: constraints.bodyPosition as ShotSetupDraft['bodyPosition'],
    peopleType: constraints.peopleType as ShotSetupDraft['peopleType'],
    framing: constraints.framing as ShotSetupDraft['framing'],
    vibes: constraints.vibes,
    environmentElements: constraints.environmentElements,
  };

  const anyFilter =
    setup.scene ||
    setup.bodyPosition ||
    setup.peopleType ||
    setup.framing ||
    setup.vibes.length ||
    setup.environmentElements.length ||
    session.searchText;

  return (
    <div className="screen">
      <Header
        title="Poses"
        subtitle={`${results.length} of ${PoseRepository.count()}`}
        backFallback={routes.home}
        right={
          <button
            type="button"
            className={`icon-btn${anyFilter ? ' icon-btn--on' : ''}`}
            onClick={() => setEditing(true)}
            aria-label="Filter poses"
          >
            <Icon name="filter" size={21} />
          </button>
        }
      />

      <div className="screen__scroll" ref={scrollRef}>
        <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
          <ShotSetupBar
            value={setup}
            onChange={(next) => update({ ...next, resultScrollPosition: 0 })}
            onEdit={() => setEditing(true)}
            searchText={session.searchText || undefined}
            onClearSearch={() => update({ searchText: '' })}
          />
        </div>

        {results.length ? (
          <div className="screen__pad">
            <div className="pose-grid">
              {results.map((r) => (
                <PoseCard
                  key={r.pose.id}
                  pose={r.pose}
                  to={routes.pose(r.pose.id)}
                  note={r.highlight}
                  selected={session.selectedPoseId === r.pose.id}
                  isFavourite={favourites.includes(r.pose.id)}
                  onToggleFavourite={toggleFavourite}
                  onSelect={() => update({ selectedPoseId: r.pose.id })}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty">
            <div className="empty__title">No poses match</div>
            <p className="empty__body">
              Scene, position and people are firm requirements, so a narrow combination can rule
              everything out. Remove a chip to widen it.
            </p>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ marginTop: 'var(--space-4)' }}
              onClick={() =>
                update({
                  scene: null,
                  bodyPosition: null,
                  peopleType: null,
                  framing: null,
                  vibes: [],
                  environmentElements: [],
                  searchText: '',
                })
              }
            >
              Clear all filters
            </button>
          </div>
        )}

        <div className="screen__bottom-space" />
      </div>

      <ShotSetupSheet
        open={editing}
        value={setup}
        onCancel={() => setEditing(false)}
        onApply={(next) => {
          update({ ...next, resultScrollPosition: 0 });
          setEditing(false);
          navigate(routes.poses, { replace: true });
        }}
        title="Filter"
      />
    </div>
  );
}
