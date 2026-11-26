// Mystery Egg speech requests: one place for the speech RATE and the PLAY MODE of a voice line (pure, no Phaser).
// Spec: docs/specs/mystery-egg.md (AC-21 single voice, AC-23 in-game rate), docs/specs/game-shell.md (AC-27 slide rate).
import type { SpeechRequest } from '../../core/audio/types';
import { allAssetsManifest } from './assets';

/** In-game speech (mission voice and help lines in the build and map scenes) plays 20% faster than recorded. */
export const GAME_SPEECH_RATE = 1.2;
/** Slide voice-over (intro and world entry) plays at the recorded speed (Gemini records slower retakes for it). */
export const SLIDE_SPEECH_RATE = 1;

export type SpeechKind = 'game' | 'slide';

/** The request for a manifest voice line at the rate of its kind; null when the id is not a voice line with a transcript. */
export function eggSpeechRequest(lineId: string, kind: SpeechKind): SpeechRequest | null {
  const entry = allAssetsManifest()[lineId];
  if (!entry || entry.kind !== 'vo' || !entry.lang || !entry.transcript) return null;
  return { lineId, lang: entry.lang, text: entry.transcript, rate: kind === 'slide' ? SLIDE_SPEECH_RATE : GAME_SPEECH_RATE };
}

export type VoicePlayMode = 'interrupt' | 'queue';

/**
 * How a line takes the floor. Every line interrupts the current clip (a child's tap or a new event wins), except the
 * success line: it fires while the cat's own line (`vo-fr-cat-croissants`, 6 s) is still playing, so it waits for it to end
 * instead of cutting it. The AudioManager guarantees that two clips never play at once either way.
 */
export function voicePlayMode(lineId: string): VoicePlayMode {
  return lineId === 'vo-fr-success' ? 'queue' : 'interrupt';
}
