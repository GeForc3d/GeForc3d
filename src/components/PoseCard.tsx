import { Link } from 'react-router-dom';
import type { ResolvedPose } from '@/models/pose';
import type { RepresentationType } from '@/models/representation';
import { BODY_POSITION_LABELS, DIFFICULTY_LABELS, PEOPLE_LABELS } from '@/models/taxonomy';
import { Icon } from './Icon';
import { PoseReference } from './PoseReference';

interface Props {
  pose: ResolvedPose;
  to: string;
  representation: RepresentationType;
  /** Short reason this pose was recommended. A few words, or nothing (§32). */
  note?: string;
  selected?: boolean;
  isFavourite?: boolean;
  onToggleFavourite?: (id: string) => void;
  onSelect?: () => void;
}

/**
 * A photography-led card: the human reference fills the frame edge to edge, and
 * the only thing over it is the save control. Name and metadata sit underneath
 * in small type, so the picture is what the eye lands on (§11).
 */
export function PoseCard({
  pose,
  to,
  representation,
  note,
  selected,
  isFavourite = false,
  onToggleFavourite,
  onSelect,
}: Props) {
  return (
    <div className={`pose-card${selected ? ' pose-card--on' : ''}`}>
      <Link
        to={to}
        className="pose-card__link"
        onClick={onSelect}
        aria-label={`${pose.name}. ${BODY_POSITION_LABELS[pose.bodyPosition]}, ${
          PEOPLE_LABELS[pose.peopleType]
        }. ${DIFFICULTY_LABELS[pose.difficulty]}.`}
      >
        <div className="pose-card__media">
          <PoseReference pose={pose} representation={representation} showBadge={false} />
          {pose.difficulty === 'editorial' && (
            <span className="pose-card__diff">{DIFFICULTY_LABELS[pose.difficulty]}</span>
          )}
        </div>
        <div className="pose-card__meta">
          <div className="pose-card__name">{pose.name}</div>
          <div className="pose-card__sub">
            {BODY_POSITION_LABELS[pose.bodyPosition]} · {PEOPLE_LABELS[pose.peopleType]}
            {note ? ` · ${note}` : ''}
          </div>
        </div>
      </Link>
      {onToggleFavourite && (
        <button
          type="button"
          className={`pose-card__fav${isFavourite ? ' pose-card__fav--on' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onToggleFavourite(pose.id);
          }}
          aria-label={isFavourite ? `Remove ${pose.name} from saved` : `Save ${pose.name}`}
          aria-pressed={isFavourite}
        >
          <Icon name={isFavourite ? 'bookmark-filled' : 'bookmark'} size={18} />
        </button>
      )}
    </div>
  );
}
