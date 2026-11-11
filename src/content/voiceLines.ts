import heLinesJson from './voice-lines-he.json';
import type { SpeechRequest } from '../core/audio/types';

/** Keys of the Hebrew guidance lines in voice-lines-he.json (without the "he." prefix). */
export type HeVoiceKey = Exclude<keyof typeof heLinesJson, '_comment'>;

const HE_LINES = heLinesJson as Record<string, string>;

/** Build a speech request for a Hebrew guidance line, e.g. heLine('retry.0'). */
export function heLine(key: HeVoiceKey): SpeechRequest {
  return { lineId: `he.${key}`, lang: 'he', text: HE_LINES[key] };
}

/** Pick one of the numbered variants of a Hebrew line family (retry, praise). */
export function heVariant(family: 'retry' | 'praise', random: () => number = Math.random): SpeechRequest {
  const keys = Object.keys(HE_LINES).filter((k) => k.startsWith(`${family}.`)) as HeVoiceKey[];
  return heLine(keys[Math.floor(random() * keys.length)] ?? keys[0]);
}
