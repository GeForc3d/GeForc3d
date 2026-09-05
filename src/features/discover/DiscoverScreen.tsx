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
import { constraintsFor, recommend, type Constraints } from '@/recommendations/engine';
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
import { useReferencePreference } from '@/features/saved/referencePreference';
import './discover.css';

const LABELS = {
  scene: SCENE_LABELS as Record<string, string>,
  position: BODY_POSITION_LABELS as Record<string, string>,
  people: PEOPLE_LABELS as Record<string, string>,
};

/**
 * DISCOVER answers "what should I shoot here?" — it recommends.
 * POSES answers "show me everything" — it browses.
 *
 * They must not be the same grid twice (§14). With no shot in progress this
 * screen offers a few curated ways in; once the user has described a shot, it
 * collapses to one recommended set for that shot and nothing else.
 */

interface Edit {
  title: string;
  blurb: string;
  constraints: Partial<Constraints>;
}

/** Curated entry points, each a genuinely different photographic situation. */
const EDITS: Edit[] = [
  {
    title: 'Easy to recreate',
    blurb: 'Nothing to explain twice',
    constraints: { peopleType: 'individual' },
  },
  {
    title: 'Standing, no props',
    blurb: 'Works anywhere you are',
    constraints: { bodyPosition: 'standing', peopleType: 'individual' },
  },
  {
    title: 'Sitting down',
    blurb: 'Cafes, benches, the ground',
    constraints: { bodyPosition: 'sitting', peopleType: 'individual' },
  },
  {
    title: 'The two of you',
    blurb: 'Poses that need a second person',
    constraints: { peopleType: 'couple' },
  },
];

const EMPTY_CONSTRAINTS: Constraints = {
  scene: null,
  bodyPosition: null,
  peopleType: null,
  framing: null,
  vibes: [],
  environmentElements: [],
  searchText: '',
  residualTerms: [],
};

export function DiscoverScreen() {
  const { session, update, recovered, resumeRecovered, dismissRecovered, reset } =
    useShotSession();
  const navigate = useNavigate();
  const [draftText, setDraftText] = useState(session.searchText);
  const [editing, setEditing] = useState(false);
  const { favourites, toggleFavourite } = useSaved();
  const { forPose } = useReferencePreference();

  const interpreted = useMemo(
    () => LocalSceneInterpreter.interpret(session.searchText),
    [session.searchText],
  );
  const constraints = useMemo(() => constraintsFor(session, interpreted), [session, interpreted]);
  const hasIntent = sessionHasIntent(session);

  const results = useMemo(
    () => (hasIntent ? recommend(PoseRepository.all(), constraints, { limit: 12 }) : []),
    [constraints, hasIntent],
  );

  const edits = useMemo(
    () =>
      EDITS.map((edit) => ({
        ...edit,
        poses: recommend(
          PoseRepository.all(),
          { ...EMPTY_CONSTRAINTS, ...edit.constraints },
          { limit: 6 },
        ).map((r) => r.pose),
      })).filter((e) => e.poses.length > 0),
    [],
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
  const submitSearch = () => update({ searchText: draftText.trim(), resultScrollPosition: 0 });
  const pickScene = (s: Scene) =>
    update({ scene: session.scene === s ? null : s, resultScrollPosition: 0 });

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
                  <PoseReference
                    pose={recoveredPose}
                    representation={forPose(recoveredPose.id)}
                    showBadge={false}
                  />
                </div>
              )}
              <div className="resume__text">
                <div className="eyebrow">
                  {recoveredPose ? 'Continue shooting' : 'Pick up where you left off'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                  {recoveredPose?.name ?? describeSession(recovered, LABELS) ?? 'Your last shot'}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {recoveredPose
                    ? describeSession(recovered, LABELS) || 'No filters set'
                    : `${recovered.capturedPoseIds.length} ${
                        recovered.capturedPoseIds.length === 1 ? 'photo' : 'photos'
                      } taken`}
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
            placeholder="She's sitting outside at a cafe with a coffee"
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

        {hasIntent ? (
          <>
            <div className="results-head">
              <h3 className="section-title">
                {results.length ? 'Recommended for your shot' : 'Nothing fits yet'}
              </h3>
              {results.length > 0 && (
                <Link to={routes.poses} className="section__link">
                  Browse all
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
                      representation={forPose(r.pose.id)}
                      note={r.highlight}
                      isFavourite={favourites.includes(r.pose.id)}
                      onToggleFavourite={toggleFavourite}
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
          </>
        ) : (
          <>
            <section className="section">
              <div className="section__head">
                <h3 className="section-title">Where are you?</h3>
              </div>
              <div className="scene-grid">
                {FEATURED_SCENES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="scene-tile"
                    onClick={() => pickScene(s)}
                  >
                    <SceneGlyph scene={s} className="scene-tile__mark" size={22} />
                    {SCENE_LABELS[s]}
                  </button>
                ))}
                <button type="button" className="scene-tile" onClick={() => setEditing(true)}>
                  <Icon name="plus" className="scene-tile__mark" size={22} />
                  More
                </button>
              </div>
            </section>

            {edits.map((edit) => (
              <section className="section" key={edit.title}>
                <div className="section__head">
                  <div>
                    <h3 className="section-title">{edit.title}</h3>
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 1 }}>
                      {edit.blurb}
                    </p>
                  </div>
                </div>
                <div className="rail">
                  {edit.poses.map((pose) => (
                    <Link key={pose.id} to={routes.pose(pose.id)} className="rail__item">
                      <div className="rail__media">
                        <PoseReference
                          pose={pose}
                          representation={forPose(pose.id)}
                          showBadge={false}
                        />
                      </div>
                      <div className="rail__name">{pose.name}</div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </>
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
