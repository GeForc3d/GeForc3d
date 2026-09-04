import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** Renders a remove affordance. The chip body stays independently tappable. */
  onRemove?: () => void;
  removeLabel?: string;
  variant?: 'default' | 'add';
  disabled?: boolean;
}

export function Chip({
  children,
  selected,
  onClick,
  onRemove,
  removeLabel,
  variant = 'default',
  disabled,
}: ChipProps) {
  const className = [
    'chip',
    selected ? 'chip--on' : '',
    variant === 'add' ? 'chip--add' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onRemove) {
    return (
      <span className={className}>
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick || disabled}
          style={{ color: 'inherit', font: 'inherit', cursor: onClick ? 'pointer' : 'default' }}
        >
          {children}
        </button>
        <button
          type="button"
          className="chip__x"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Remove'}
        >
          <Icon name="close" size={14} />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected === undefined ? undefined : selected}
    >
      {children}
    </button>
  );
}
