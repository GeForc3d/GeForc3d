import { Chip } from '@/components/Chip';
import {
  BODY_POSITION_LABELS,
  ELEMENT_LABELS,
  FRAMING_LABELS,
  PEOPLE_LABELS,
  SCENE_LABELS,
  VIBE_LABELS,
} from '@/models/taxonomy';
import type { ShotSetupDraft } from './ShotSetupSheet';
import './shotSetup.css';

interface Props {
  value: ShotSetupDraft;
  onChange: (next: ShotSetupDraft) => void;
  onEdit: () => void;
  /** Free text the user typed, shown as its own removable chip. */
  searchText?: string;
  onClearSearch?: () => void;
  /** Chips the interpreter inferred rather than the user picking (§17). */
  inferred?: Partial<Record<keyof ShotSetupDraft, boolean>>;
}

/**
 * The shot setup, always visible and always editable. There is no wizard: every
 * value can be removed or changed at any point without restarting (§12).
 */
export function ShotSetupBar({ value, onChange, onEdit, searchText, onClearSearch }: Props) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];

  if (value.scene)
    chips.push({
      key: 'scene',
      label: SCENE_LABELS[value.scene],
      remove: () => onChange({ ...value, scene: null }),
    });
  if (value.bodyPosition)
    chips.push({
      key: 'position',
      label: BODY_POSITION_LABELS[value.bodyPosition],
      remove: () => onChange({ ...value, bodyPosition: null }),
    });
  if (value.peopleType)
    chips.push({
      key: 'people',
      label: PEOPLE_LABELS[value.peopleType],
      remove: () => onChange({ ...value, peopleType: null }),
    });
  if (value.framing)
    chips.push({
      key: 'framing',
      label: FRAMING_LABELS[value.framing],
      remove: () => onChange({ ...value, framing: null }),
    });
  for (const v of value.vibes)
    chips.push({
      key: `vibe-${v}`,
      label: VIBE_LABELS[v],
      remove: () => onChange({ ...value, vibes: value.vibes.filter((x) => x !== v) }),
    });
  for (const e of value.environmentElements)
    chips.push({
      key: `el-${e}`,
      label: ELEMENT_LABELS[e],
      remove: () =>
        onChange({
          ...value,
          environmentElements: value.environmentElements.filter((x) => x !== e),
        }),
    });

  return (
    <div className="setup">
      {searchText && onClearSearch && (
        <Chip onRemove={onClearSearch} removeLabel="Clear search">
          “{searchText}”
        </Chip>
      )}
      {chips.map((c) => (
        <Chip key={c.key} selected onRemove={c.remove} removeLabel={`Remove ${c.label}`}>
          {c.label}
        </Chip>
      ))}
      <Chip variant="add" onClick={onEdit}>
        {chips.length || searchText ? '+ Add detail' : '+ Add detail'}
      </Chip>
    </div>
  );
}
