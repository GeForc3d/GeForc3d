/**
 * Safe local persistence. Private browsing, blocked site data and embedded
 * hosts can all make storage throw on access, so every call is guarded and the
 * app works fine when nothing persists.
 */

const memory = new Map<string, string>();
let available: boolean | null = null;

const canUse = (): boolean => {
  if (available !== null) return available;
  try {
    const k = '__pose_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
};

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = canUse() ? window.localStorage.getItem(key) : memory.get(key) ?? null;
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      const raw = JSON.stringify(value);
      if (canUse()) window.localStorage.setItem(key, raw);
      else memory.set(key, raw);
    } catch {
      /* storage full or blocked; the app keeps working without persistence */
    }
  },
  remove(key: string): void {
    try {
      if (canUse()) window.localStorage.removeItem(key);
      else memory.delete(key);
    } catch {
      /* ignore */
    }
  },
  isPersistent: (): boolean => canUse(),
};

export const KEYS = {
  session: 'pose.session.v1',
  favourites: 'pose.favourites.v1',
  recentlyViewed: 'pose.recent.viewed.v1',
  recentlyUsed: 'pose.recent.used.v1',
  captures: 'pose.captures.v1',
  seenIntro: 'pose.seen.v1',
} as const;
