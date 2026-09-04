import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BRAND } from '@/app/brand';
import { routes } from '@/app/routes';
import { useShotSession } from '@/app/ShotSessionContext';
import { Icon } from '@/components/Icon';
import { SceneGlyph } from '@/components/SceneGlyph';
import { PoseCard } from '@/components/PoseCard';
import { PoseReference } from '@/components/PoseReference';
import { PoseRepository } from '@/data/poseRepository';
import { constraintsFor, recommend } from '@/recommendations/engine';
import { LocalSceneInterpreter } from '@/search/sceneInterpreter';
import { describeSession, sessionHasIntent } from '@/models/shotSession';
import {
  BODY_POSITION_LABELS,
  FEATURED_SCENES,
  PEOPLE_LABELS,
  SCENE_LABELS,
  type Scene,
} from '@/models/taxonomy';
import { ShotSetupBar } from '@/features/shot-setup/ShotSetupBar';
import { ShotSetupSheet, type ShotSetupDraft } from '@/features/shot-setup/ShotSetupSheet';
import { useSaved } from '@/features/saved/savedStore';
import './discover.css';

const LABELS = {
  scene: SCENE_LABELS as Record<string, string>,
  position: BODY_POSITION_LABELS as Record<string, string>,
  people: PEOPLE_LABELS as Record<string, string>,
};

/**
 * The first useful screen asks what you are shooting and nothing else. No
 * account, no carousel, no permission prompt (§7).
 */
export function DiscoverScreen() {
  const { session, update, recovered, resumeRecovered, dismissRecovered, reset } =
    useShotSession();
  const navigate = useNavigate();
  const [draftText, setDraftText] = useState(session.searchText);
  const [editing, setEditing] = useState(false);
  const { favourites, toggleFavourite } = useSaved();

  const interpreted = useMemo(
    () => LocalSceneInterpreter.interpret(session.searchText),
    [session.searchText],
  );
  const constraints = useMemo(
    () => constraintsFor(session, interpreted),
    [session, interpreted],
  );
  const hasIntent = sessionHasIntent(session);

  const results = useMemo(
    () => recommend(PoseRepository.all(), constraints, { limit: hasIntent ? 12 : 6 }),
    [constraints, hasIntent],
  );

  const setup: ShotSetupDraft = {
    scene: constraints.scene as Scene | null,
    bodyPosition: constraints.bodyPosition as ShotSetupDraft['bodyPosition'],
    peopleType: constraints.peopleType as ShotSetupDraft['peopleType'],
    framing: constraints.framing as ShotSetupDraft['framing'],
    vibes: constraints.vibes,
    environmentElements: constraints.environmentElements,
  };

  const commitSetup = (next: ShotSetupDraft) => update({ ...next, resultScrollPosition: 0 });

  const submitSearch = () => {
    update({ searchText: draftText.trim(), resultScrollPosition: 0 });
  };

  const pickScene = (s: Scene) => {
    update({ scene: session.scene === s ? null : s, resultScrollPosition: 0 });
  };

  const recoveredPose = PoseRepository.get(recovered?.selectedPoseId);

  return (
    <div className="screen">
      <div className="screen__scroll">
        <div className="discover__brand">
          <span className="discover__wordmark">{BRAND.name}</span>
          <Link to={routes.assets} className="discover__count">
            {PoseRepository.count()} poses
          </Link>
        </div>

        {recovered && (
          <section className="resume" aria-label="Continue your last shoot">
            <div className="resume__body">
              {recoveredPose && (
                <div className="resume__thumb">
                  <PoseReference pose={recoveredPose} showBadge={false} />
                </div>
              )}
              <div className="resume__text">
                <div className="eyebrow">Continue shooting</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                  {recoveredPose?.name ?? 'Unfinished shoot'}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {describeSession(recovered, LABELS) || 'No filters set'}
                </div>
              </div>
            </div>
            <div className="resume__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  dismissRecovered();
                  reset();
                }}
              >
                Start new
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  resumeRecovered();
                  const id = recovered.selectedPoseId;
                  if (id && PoseRepository.has(id)) navigate(routes.pose(id));
                }}
              >
                Resume
              </button>
            </div>
          </section>
        )}

        <h2 className="discover__prompt">What are you shooting?</h2>
        <p className="discover__sub">{BRAND.shortDescription}</p>

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <Icon name="search" size={19} style={{ color: 'var(--text-3)', flex: 'none' }} />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Describe your shot"
            placeholder="Standing photo at the beach at sunset"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
          />
          <button
            type="submit"
            className="search__go"
            disabled={!draftText.trim()}
            aria-label="Search poses"
          >
            <Icon name="next" size={18} />
          </button>
        </form>

        {(hasIntent || draftText) && (
          <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
            <ShotSetupBar
              value={setup}
              onChange={commitSetup}
              onEdit={() => setEditing(true)}
              searchText={session.searchText || undefined}
              onClearSearch={() => {
                setDraftText('');
                update({ searchText: '' });
              }}
            />
            {session.searchText && (
              <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
                Read from what you typed. Remove anything that is wrong.
              </p>
            )}
          </div>
        )}

        {!hasIntent && (
          <section className="section">
            <div className="section__head">
              <h3 className="section-title">Or choose a scene</h3>
              <Link to={routes.poses} className="section__link">
                Browse all
              </Link>
            </div>
            <div className="scene-grid">
              {FEATURED_SCENES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`scene-tile${session.scene === s ? ' scene-tile--on' : ''}`}
                  onClick={() => pickScene(s)}
                  aria-pressed={session.scene === s}
                >
                  <SceneGlyph scene={s} className="scene-tile__mark" size={58} />
                  {SCENE_LABELS[s]}
                </button>
              ))}
              <button type="button" className="scene-tile" onClick={() => setEditing(true)}>
                <Icon name="plus" className="scene-tile__mark" size={58} />
                More
              </button>
            </div>
          </section>
        )}

        {(
          <>
            <div className="results-head">
              <h3 className="section-title">
                {!hasIntent
                  ? 'Good places to start'
                  : results.length
                    ? 'Poses for this shot'
                    : 'Nothing fits yet'}
              </h3>
              {results.length > 0 && (
                <Link to={routes.poses} className="section__link">
                  See all
                </Link>
              )}
            </div>
            {results.length > 0 ? (
              <div className="screen__pad">
                <div className="pose-grid">
                  {results.map((r) => (
                    <PoseCard
                      key={r.pose.id}
                      pose={r.pose}
                      to={routes.pose(r.pose.id)}
                      note={r.highlight}
                      isFavourite={favourites.includes(r.pose.id)}
                      onToggleFavourite={toggleFavourite}
                      onSelect={() => update({ selectedPoseId: r.pose.id })}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty">
                <div className="empty__title">That combination has no poses</div>
                <p className="empty__body">
                  Try removing one of the chips above. Scene, position and people are treated as
                  firm requirements, so a narrow set can rule everything out.
                </p>
              </div>
            )}
          </>
        )}

        {hasIntent && (
          <section className="section">
            <div className="section__head">
              <h3 className="section-title">Change the scene</h3>
            </div>
            <div className="chip-scroll">
              {FEATURED_SCENES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${session.scene === s ? ' chip--on' : ''}`}
                  onClick={() => pickScene(s)}
                  aria-pressed={session.scene === s}
                >
                  {SCENE_LABELS[s]}
                </button>
              ))}
              <button type="button" className="chip chip--add" onClick={() => setEditing(true)}>
                More
              </button>
            </div>
          </section>
        )}

        <div className="screen__bottom-space" />
      </div>

      <ShotSetupSheet
        open={editing}
        value={setup}
        onCancel={() => setEditing(false)}
        onApply={(next) => {
          commitSetup(next);
          setEditing(false);
        }}
        title="Your shot"
      />
    </div>
  );
}
