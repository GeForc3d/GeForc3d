import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  title?: ReactNode;
  subtitle?: string;
  /** Where Back should land when there is no history to pop. */
  backFallback?: string;
  showBack?: boolean;
  right?: ReactNode;
}

export function Header({ title, subtitle, backFallback, showBack = true, right }: Props) {
  const navigate = useNavigate();

  const goBack = () => {
    // Prefer real browser history so Safari's swipe-back stays consistent with
    // the in-app control (§10, §11).
    if (window.history.length > 1) navigate(-1);
    else navigate(backFallback ?? '/');
  };

  return (
    <header className="header">
      {showBack && (
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Back">
          <Icon name="back" size={22} />
        </button>
      )}
      <h1 className="header__title">
        {title}
        {subtitle && <span className="header__sub">{subtitle}</span>}
      </h1>
      {right}
    </header>
  );
}
