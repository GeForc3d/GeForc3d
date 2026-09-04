import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import {
  BODY_POSITIONS,
  BODY_POSITION_LABELS,
  ELEMENT_LABELS,
  ENVIRONMENT_ELEMENTS,
  FRAMINGS,
  FRAMING_LABELS,
  PEOPLE_LABELS,
  PEOPLE_TYPES,
  SCENES,
  SCENE_LABELS,
  VIBES,
  VIBE_LABELS,
  type BodyPosition,
  type EnvironmentElement,
  type Framing,
  type PeopleType,
  type Scene,
  type Vibe,
} from '@/models/taxonomy';
import './shotSetup.css';

export interface ShotSetupDraft {
  scene: Scene | null;
  bodyPosition: BodyPosition | null;
  peopleType: PeopleType | null;
  framing: Framing | null;
  vibes: Vibe[];
  environmentElements: EnvironmentElement[];
}

interface Props {
  open: boolean;
  value: ShotSetupDraft;
  onCancel: () => void;
  onApply: (next: ShotSetupDraft) => void;
  title?: string;
  applyLabel?: string;
}

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/**
 * All edits happen against a draft. Cancel restores exactly what was committed
 * before the sheet opened (§14) — nothing is applied as you tap.
 */
export function ShotSetupSheet({
  open,
  value,
  onCancel,
  onApply,
  title = 'Edit shot',
  applyLabel = 'Apply',
}: Props) {
  const [draft, setDraft] = useState<ShotSetupDraft>(value);
  const [showMore, setShowMore] = useState(
    Boolean(value.framing || value.vibes.length || value.environmentElements.length),
  );

  useEffect(() => {
    if (open) {
      setDraft(value);
      setShowMore(
        Boolean(value.framing || value.vibes.length || value.environmentElements.length),
      );
    }
    // Re-seeding only on open is deliberate: reopening restores the committed
    // state, and typing in the sheet never fights the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const single = <T,>(current: T | null, v: T): T | null => (current === v ? null : v);

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onApply(draft)}>
            {applyLabel}
          </button>
        </>
      }
    >
      <div className="setup-group">
        <div className="setup-group__title">
          <span className="eyebrow">Scene</span>
          {draft.scene && (
            <button
              type="button"
              className="setup-group__hint"
              onClick={() => setDraft({ ...draft, scene: null })}
            >
              Clear
            </button>
          )}
        </div>
        <div className="chip-row">
          {SCENES.map((s) => (
            <Chip
              key={s}
              selected={draft.scene === s}
              onClick={() => setDraft({ ...draft, scene: single(draft.scene, s) })}
            >
              {SCENE_LABELS[s]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="setup-group">
        <div className="setup-group__title">
          <span className="eyebrow">Position</span>
        </div>
        <div className="chip-row">
          {BODY_POSITIONS.map((b) => (
            <Chip
              key={b}
              selected={draft.bodyPosition === b}
              onClick={() =>
                setDraft({ ...draft, bodyPosition: single(draft.bodyPosition, b) })
              }
            >
              {BODY_POSITION_LABELS[b]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="setup-group">
        <div className="setup-group__title">
          <span className="eyebrow">People</span>
        </div>
        <div className="chip-row">
          {PEOPLE_TYPES.map((p) => (
            <Chip
              key={p}
              selected={draft.peopleType === p}
              onClick={() => setDraft({ ...draft, peopleType: single(draft.peopleType, p) })}
            >
              {PEOPLE_LABELS[p]}
            </Chip>
          ))}
        </div>
      </div>

      <hr className="hairline" style={{ margin: 'var(--space-5) 0' }} />

      <button
        type="button"
        className={`setup-disclosure${showMore ? ' setup-disclosure--open' : ''}`}
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
      >
        More detail
        <Icon name="chevron-down" size={18} />
      </button>

      {showMore && (
        <>
          <div className="setup-group">
            <div className="setup-group__title">
              <span className="eyebrow">Framing</span>
            </div>
            <div className="chip-row">
              {FRAMINGS.map((f) => (
                <Chip
                  key={f}
                  selected={draft.framing === f}
                  onClick={() => setDraft({ ...draft, framing: single(draft.framing, f) })}
                >
                  {FRAMING_LABELS[f]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="setup-group">
            <div className="setup-group__title">
              <span className="eyebrow">Vibe</span>
            </div>
            <div className="chip-row">
              {VIBES.map((v) => (
                <Chip
                  key={v}
                  selected={draft.vibes.includes(v)}
                  onClick={() => setDraft({ ...draft, vibes: toggle(draft.vibes, v) })}
                >
                  {VIBE_LABELS[v]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="setup-group">
            <div className="setup-group__title">
              <span className="eyebrow">What is around you</span>
              <span className="setup-group__hint">Unlocks poses that need it</span>
            </div>
            <div className="chip-row">
              {ENVIRONMENT_ELEMENTS.map((e) => (
                <Chip
                  key={e}
                  selected={draft.environmentElements.includes(e)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      environmentElements: toggle(draft.environmentElements, e),
                    })
                  }
                >
                  {ELEMENT_LABELS[e]}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 'var(--space-5)' }}
        onClick={() =>
          setDraft({
            scene: null,
            bodyPosition: null,
            peopleType: null,
            framing: null,
            vibes: [],
            environmentElements: [],
          })
        }
      >
        Clear all
      </button>
    </Sheet>
  );
}
