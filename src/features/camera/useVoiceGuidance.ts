import { useEffect, useRef, useState } from 'react';
import type { GuidanceOutput } from '@/guidance/types';

/**
 * Optional spoken guidance.
 *
 * This exists because of a real property of the situation: the person being
 * photographed cannot see the phone. Without it, every correction has to be
 * relayed out loud by the photographer.
 *
 * Each instruction is spoken ONCE, keyed on its stable id, with a floor on how
 * often anything is spoken at all. Repeating the same line every frame would be
 * worse than silence (§114).
 */

const MIN_GAP_MS = 2200;

interface SpeechLike {
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
}

export function useVoiceGuidance(guidance: GuidanceOutput, enabled: boolean) {
  const lastSpokenId = useRef<string | null>(null);
  const lastSpokenAt = useRef(0);
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  useEffect(() => {
    if (!enabled || !supported) return;
    const synth = window.speechSynthesis as unknown as SpeechLike;

    const line = guidance.hold ? 'Hold it there' : guidance.instruction?.text;
    const id = guidance.hold ? 'hold' : guidance.instruction?.id;
    if (!line || !id) return;
    if (id === lastSpokenId.current) return;

    const now = Date.now();
    if (now - lastSpokenAt.current < MIN_GAP_MS) return;

    lastSpokenId.current = id;
    lastSpokenAt.current = now;
    try {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = 1.05;
      utterance.volume = 1;
      synth.speak(utterance);
    } catch {
      /* speech is a bonus; never let it break the shoot */
    }
  }, [guidance, enabled, supported]);

  // Stop mid-sentence the moment the user turns it off or leaves the camera.
  useEffect(() => {
    if (enabled || !supported) return;
    try {
      (window.speechSynthesis as unknown as SpeechLike).cancel();
    } catch {
      /* ignore */
    }
  }, [enabled, supported]);

  useEffect(
    () => () => {
      if (!supported) return;
      try {
        (window.speechSynthesis as unknown as SpeechLike).cancel();
      } catch {
        /* ignore */
      }
    },
    [supported],
  );

  return { supported };
}
