import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { PoseCard } from '@/components/PoseCard';
import { PoseReference } from '@/components/PoseReference';
import { PoseRepository } from '@/data/poseRepository';
import { routes } from '@/app/routes';
import { useShotSession } from '@/app/ShotSessionContext';
import { constraintsFor, recommend } from '@/recommendations/engine';
import {
  BODY_POSITION_LABELS,
  DIFFICULTY_LABELS,
  ELEMENT_LABELS,
  FRAMING_LABELS,
  PEOPLE_LABELS,
} from '@/models/taxonomy';
import { SavedStore, useSaved } from '@/features/saved/savedStore';
import { useReferencePreference } from '@/features/saved/referencePreference';
import { REPRESENTATION_LABELS, REPRESENTATION_TYPES, type RepresentationType } from '@/models/representation';
import './poseDetail.css';

/**
 * The reference photograph is the screen. Everything else is one short
 * instruction, one photographer note, and a way into the camera (§37).
 */
export function PoseDetailScreen() {
  const { poseId } = useParams();
  const navigate = useNavigate();
  const { session, update } = useShotSession();
  const { favourites, toggleFavourite } = useSaved();
  const { forPose } = useReferencePreference();
  const pose = PoseRepository.get(poseId);

  /**
   * Seeing the pose on a body closer to the person being photographed is the
   * whole reason representations exist (§6). The choice is local to this screen
   * and resets to the user's preference when they leave; it never edits the
   * catalogue or creates a second pose.
   */
  const [chosen, setChosen] = useState<RepresentationType | null>(null);
  const representation = chosen ?? (pose ? forPose(pose.id) : 'average');

  useEffect(() => {
    if (pose) SavedStore.markViewed(pose.id);
  }, [pose]);

  const related = useMemo(() => {
    if (!pose) return [];
    const constraints = constraintsFor(session);
    return recommend(PoseRepository.all(), constraints, { limit: 5 })
      .filter((r) => r.pose.id !== pose.id)
      .slice(0, 4);
  }, [pose, session]);

  if (!pose) return <Navigate to={routes.poses} replace />;

  const fav = favourites.includes(pose.id);
  const lead = pose.subjectInstructions[0]?.text ?? '';
  const tip = pose.photographerInstructions[0]?.text ?? '';

  const useThisPose = () => {
    update({ selectedPoseId: pose.id });
    navigate(routes.camera);
  };

  return (
    <div className="screen">
      <Header
        title={pose.name}
        backFallback={routes.poses}
        right={
          <button
            type="button"
            className={`icon-btn${fav ? ' icon-btn--on' : ''}`}
            onClick={() => toggleFavourite(pose.id)}
            aria-label={fav ? 'Remove from saved' : 'Save pose'}
            aria-pressed={fav}
          >
            <Icon name={fav ? 'bookmark-filled' : 'bookmark'} size={21} />
          </button>
        }
      />

      <div className="screen__scroll">
        <div className="detail__media">
          <PoseReference pose={pose} representation={representation} aspect={4 / 5} />
          <div className="detail__fade" />
        </div>

        <div className="detail__reps">
          <span className="eyebrow">Shown on</span>
          <div className="rep-switch">
            {REPRESENTATION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`rep-switch__item${
                  representation === t ? ' rep-switch__item--on' : ''
                }`}
                onClick={() => setChosen(t)}
                aria-pressed={representation === t}
              >
                {REPRESENTATION_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="detail__head">
          <h2 className="detail__name">{pose.name}</h2>
          <div className="detail__meta">
            {BODY_POSITION_LABELS[pose.bodyPosition]} · {PEOPLE_LABELS[pose.peopleType]} ·{' '}
            {DIFFICULTY_LABELS[pose.difficulty]} · {FRAMING_LABELS[pose.framing[0]]}
          </div>
          {pose.requiredElements.length > 0 && (
            <div className="detail__req">
              <Icon name="info" size={16} />
              Needs {pose.requiredElements.map((e) => ELEMENT_LABELS[e].toLowerCase()).join(' and ')}
            </div>
          )}
        </div>

        <div className="detail__block">
          <p className="detail__lead">{lead}</p>
          {tip && (
            <div className="detail__tip">
              <Icon name="camera" size={17} />
              <span className="detail__tip-text">{tip}</span>
            </div>
          )}
        </div>

        {pose.subjectInstructions.length > 1 && (
          <div className="detail__block">
            <span className="eyebrow">Tell them</span>
            <ul className="detail__list">
              {pose.subjectInstructions.slice(1).map((i, n) => (
                <li key={i.text}>
                  <span className="detail__bullet">{n + 2}</span>
                  {i.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pose.representations.every((r) => r.isPlaceholder) && (
          <div className="detail__block">
            <div className="notice">
              <div className="notice__title">This is a reference render, not a photograph</div>
              <p className="notice__body">
                Drawn from this pose's own joint data at real human proportions, so it shows the
                shape, the body turn and the framing. Photography has not been shot for this build.
                Once it is, it drops into the same slot and this notice goes away.
              </p>
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="detail__related">
            <span className="eyebrow">Also works here</span>
            <div className="pose-grid" style={{ marginTop: 'var(--space-3)' }}>
              {related.map((r) => (
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
        )}

        <div style={{ height: 'var(--space-8)' }} />

        <div className="detail__actions">
          <Link
            to={routes.poses}
            className="btn btn--secondary"
            style={{ paddingInline: 'var(--space-4)' }}
          >
            More poses
          </Link>
          <button type="button" className="btn btn--primary" onClick={useThisPose}>
            <Icon name="camera" size={19} />
            {session.selectedPoseId === pose.id ? 'Back to camera' : 'Use this pose'}
          </button>
        </div>
      </div>
    </div>
  );
}
