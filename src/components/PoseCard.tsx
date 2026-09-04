import { Link } from 'react-router-dom';
import type { ResolvedPose } from '@/models/pose';
import {
  BODY_POSITION_LABELS,
  DIFFICULTY_LABELS,
  PEOPLE_LABELS,
} from '@/models/taxonomy';
import { Icon } from './Icon';
import { PoseReference } from './PoseReference';
import { SavedStore } from '@/features/saved/savedStore';

interface Props {
  pose: ResolvedPose;
  to: string;
  /** Short reason this pose was recommended. Kept to a few words (§32). */
  note?: string;
  selected?: boolean;
  isFavourite?: boolean;
  onToggleFavourite?: (id: string) => void;
  onSelect?: () => void;
}

export function PoseCard({
  pose,
  to,
  note,
  selected,
  isFavourite,
  onToggleFavourite,
  onSelect,
}: Props) {
  const fav = isFavourite ?? SavedStore.isFavourite(pose.id);
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
          <PoseReference pose={pose} showBadge={false} />
          {pose.difficulty !== 'easy' && (
            <span
              className={`pose-card__diff${
                pose.difficulty === 'editorial' ? ' pose-card__diff--editorial' : ''
              }`}
            >
              {DIFFICULTY_LABELS[pose.difficulty]}
            </span>
          )}
        </div>
        <div className="pose-card__meta">
          <div className="pose-card__name">{pose.name}</div>
          <div className="pose-card__sub">
            {BODY_POSITION_LABELS[pose.bodyPosition]} · {PEOPLE_LABELS[pose.peopleType]}
          </div>
          {note && <div className="pose-card__note">{note}</div>}
        </div>
      </Link>
      {onToggleFavourite && (
        <button
          type="button"
          className={`pose-card__fav${fav ? ' pose-card__fav--on' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onToggleFavourite(pose.id);
          }}
          aria-label={fav ? `Remove ${pose.name} from saved` : `Save ${pose.name}`}
          aria-pressed={fav}
        >
          <Icon name={fav ? 'bookmark-filled' : 'bookmark'} size={19} />
        </button>
      )}
    </div>
  );
}
