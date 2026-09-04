import { useCallback, useEffect, useState } from 'react';
import { KEYS, storage } from '@/utilities/storage';

/**
 * Favourites and recents, on device, no account (§85, §86). "Viewed" and
 * "actually shot" are tracked separately so the app can later tell the user
 * which poses worked rather than which ones they glanced at.
 */

const MAX_RECENT = 30;

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

const read = (key: string): string[] => storage.get<string[]>(key, []);

const write = (key: string, ids: string[]) => {
  storage.set(key, ids);
  emit();
};

export const SavedStore = {
  favourites: () => read(KEYS.favourites),
  isFavourite: (id: string) => read(KEYS.favourites).includes(id),
  toggleFavourite(id: string) {
    const current = read(KEYS.favourites);
    write(
      KEYS.favourites,
      current.includes(id) ? current.filter((x) => x !== id) : [id, ...current],
    );
  },
  recentlyViewed: () => read(KEYS.recentlyViewed),
  markViewed(id: string) {
    const current = read(KEYS.recentlyViewed).filter((x) => x !== id);
    write(KEYS.recentlyViewed, [id, ...current].slice(0, MAX_RECENT));
  },
  recentlyUsed: () => read(KEYS.recentlyUsed),
  markUsed(id: string) {
    const current = read(KEYS.recentlyUsed).filter((x) => x !== id);
    write(KEYS.recentlyUsed, [id, ...current].slice(0, MAX_RECENT));
  },
  clear(key: keyof typeof KEYS) {
    storage.remove(KEYS[key]);
    emit();
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Re-renders on any change to saved state, from any screen. */
export function useSaved() {
  const [, bump] = useState(0);
  useEffect(() => SavedStore.subscribe(() => bump((n) => n + 1)), []);
  const toggleFavourite = useCallback((id: string) => SavedStore.toggleFavourite(id), []);
  return {
    favourites: SavedStore.favourites(),
    recentlyViewed: SavedStore.recentlyViewed(),
    recentlyUsed: SavedStore.recentlyUsed(),
    isFavourite: (id: string) => SavedStore.favourites().includes(id),
    toggleFavourite,
  };
}
