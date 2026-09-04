import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createShotSession,
  IDENTITY_TRANSFORM,
  sessionHasIntent,
  type OverlayTransform,
  type ShotSession,
} from '@/models/shotSession';
import { KEYS, storage } from '@/utilities/storage';

/**
 * The active shooting objective. One store, mutable from every screen, so the
 * user can change their mind anywhere without restarting (§12, §14, §15).
 *
 * Deliberately excludes anything that changes at camera frame rate. Landmark
 * data and overlay drag state live in refs inside the camera feature; only the
 * committed result lands here.
 */

interface Ctx {
  session: ShotSession;
  update: (patch: Partial<ShotSession>) => void;
  reset: () => void;
  /** A previous session recovered from storage that the user has not resumed. */
  recovered: ShotSession | null;
  resumeRecovered: () => void;
  dismissRecovered: () => void;
  resetOverlay: () => void;
}

const ShotSessionCtx = createContext<Ctx | null>(null);

const REVIVE_WINDOW_MS = 1000 * 60 * 60 * 8;

function readStored(): ShotSession | null {
  const raw = storage.get<ShotSession | null>(KEYS.session, null);
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  if (Date.now() - (raw.updatedAt ?? 0) > REVIVE_WINDOW_MS) return null;
  // Merge over a fresh session so a schema addition never breaks an old save.
  return { ...createShotSession(), ...raw };
}

export function ShotSessionProvider({ children }: { children: ReactNode }) {
  const stored = useRef<ShotSession | null>(null);
  if (stored.current === null) stored.current = readStored();

  const [session, setSession] = useState<ShotSession>(() => createShotSession());
  const [recovered, setRecovered] = useState<ShotSession | null>(() => {
    const s = stored.current;
    return s && sessionHasIntent(s) ? s : null;
  });

  // Persist, but never overwrite a recoverable session with an empty new one
  // before the user has decided what to do with it (§15).
  useEffect(() => {
    if (recovered && !sessionHasIntent(session)) return;
    storage.set(KEYS.session, session);
  }, [session, recovered]);

  const update = useCallback((patch: Partial<ShotSession>) => {
    setSession((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }));
  }, []);

  const reset = useCallback(() => {
    setRecovered(null);
    setSession(createShotSession());
  }, []);

  const resumeRecovered = useCallback(() => {
    const s = stored.current;
    if (s) setSession({ ...s, updatedAt: Date.now() });
    setRecovered(null);
  }, []);

  const dismissRecovered = useCallback(() => setRecovered(null), []);

  const resetOverlay = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      overlayTransform: { ...IDENTITY_TRANSFORM },
      overlayMirrored: false,
      overlayOpacity: 0.35,
      updatedAt: Date.now(),
    }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({ session, update, reset, recovered, resumeRecovered, dismissRecovered, resetOverlay }),
    [session, update, reset, recovered, resumeRecovered, dismissRecovered, resetOverlay],
  );

  return <ShotSessionCtx.Provider value={value}>{children}</ShotSessionCtx.Provider>;
}

export function useShotSession(): Ctx {
  const ctx = useContext(ShotSessionCtx);
  if (!ctx) throw new Error('useShotSession must be used inside ShotSessionProvider');
  return ctx;
}

export type { OverlayTransform };
