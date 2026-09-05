import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_REFERENCE_PREFERENCE,
  diverseRepresentationFor,
  REPRESENTATION_TYPES,
  type ReferencePreference,
  type RepresentationType,
} from '@/models/representation';
import { storage } from '@/utilities/storage';

/**
 * Which body poses are demonstrated on.
 *
 * Never asked for at first launch (§7). The default spreads representations
 * across the catalogue so the library itself shows that the product is not
 * built around one body type, and the preference is optional and reversible.
 */

const KEY = 'pose.reference.v1';

type Listener = () => void;
const listeners = new Set<Listener>();

const read = (): ReferencePreference => {
  const raw = storage.get<ReferencePreference | null>(KEY, null);
  if (!raw || typeof raw !== 'object') return DEFAULT_REFERENCE_PREFERENCE;
  if (raw.mode === 'fixed' && REPRESENTATION_TYPES.includes(raw.type)) return raw;
  return DEFAULT_REFERENCE_PREFERENCE;
};

export const ReferencePreferenceStore = {
  get: read,
  set(next: ReferencePreference) {
    storage.set(KEY, next);
    listeners.forEach((l) => l());
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Resolves the preference to a concrete body for one pose. */
export const representationFor = (
  preference: ReferencePreference,
  poseId: string,
): RepresentationType =>
  preference.mode === 'fixed' ? preference.type : diverseRepresentationFor(poseId);

export function useReferencePreference() {
  const [preference, setPreference] = useState<ReferencePreference>(read);

  useEffect(
    () => ReferencePreferenceStore.subscribe(() => setPreference(read())),
    [],
  );

  const update = useCallback((next: ReferencePreference) => {
    ReferencePreferenceStore.set(next);
  }, []);

  const forPose = useCallback(
    (poseId: string) => representationFor(preference, poseId),
    [preference],
  );

  return { preference, setPreference: update, forPose };
}
