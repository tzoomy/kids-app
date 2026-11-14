// Pure helpers for Potion Lab (docs/specs/potion-lab.md): level plan, adaptive trials, requests and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, PotionLabContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechLang, SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import {
  SECONDARY_COLORS,
  type PotionColor,
  type PotionEvent,
  type SecondaryColor,
} from './potionMachine';

export type PotionMode = 'free' | 'request';

export interface PotionPlan {
  mode: PotionMode;
  mixesPerStar: number;
  /** L4: the request is spoken only, with no target color swatch. */
  audioOnly: boolean;
  /** L2: idle hint pulses both matching pots; L3+: no pot pulse. */
  hintPulse: boolean;
}

const DEFAULT_MIXES_PER_STAR = 3;

/** Reads the game-specific levers of one level (`extra.mode`, `extra.mixesPerStar`, `extra.hintPulse`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): PotionPlan {
  const mode: PotionMode = level?.extra?.mode === 'request' ? 'request' : 'free';
  const rawMixes = level?.extra?.mixesPerStar;
  const mixesPerStar =
    typeof rawMixes === 'number' && Number.isInteger(rawMixes) && rawMixes >= 1 ? rawMixes : DEFAULT_MIXES_PER_STAR;
  const audioOnly = level?.support === 'audio-only';
  const hintPulse = !audioOnly && level?.extra?.hintPulse !== false;
  return { mode, mixesPerStar, audioOnly, hintPulse };
}

/** Free-mode adaptive trial: every completed mix is one clean exposure trial for the result color. */
export function trialForMix(event: Extract<PotionEvent, { kind: 'mixed' }>): TrialResult {
  return { itemId: event.result, firstTryCorrect: true, hinted: false };
}

/** Request-mode adaptive trial: one trial per matched request, clean only on a first-try unhinted match. */
export function trialForRequest(
  event: Extract<PotionEvent, { kind: 'matched' }>,
  hinted: boolean,
): TrialResult {
  return {
    itemId: event.result,
    firstTryCorrect: event.tries === 1,
    hinted,
  };
}

/** Picks the next secondary color request, never repeating `previous`. */
export function nextRequest(
  previous: SecondaryColor | null,
  rng: () => number = Math.random,
): SecondaryColor {
  const candidates = previous ? SECONDARY_COLORS.filter((c) => c !== previous) : [...SECONDARY_COLORS];
  const raw = Math.floor(Math.max(0, rng()) * candidates.length);
  const index = Math.min(candidates.length - 1, raw);
  return candidates[index];
}

/** Color name in the given language (`he`, `en`, or `fr`), device TTS in Pass 1. */
export function colorLine(content: PotionLabContent, color: PotionColor, lang: SpeechLang): SpeechRequest {
  return {
    lineId: `potion.color.${color}.${lang}`,
    lang,
    text: content.colors[color][lang],
  };
}

/** Naming sequence for a mix result: Hebrew first, then the round's active learning language. */
export function namingLines(
  content: PotionLabContent,
  color: PotionColor,
  learningLang: Lang,
): [SpeechRequest, SpeechRequest] {
  return [colorLine(content, color, 'he'), colorLine(content, color, learningLang)];
}

/** Hebrew request line for a secondary color ("אפשר להכין <color he>?"). */
export function requestLine(content: PotionLabContent, color: SecondaryColor): SpeechRequest {
  return {
    lineId: `potion.request.${color}.he`,
    lang: 'he',
    text: content.linesHe.requestFrame.replace('{color}', content.colors[color].he),
  };
}

/** Gentle Hebrew retry line when a request-mode mix produced another color. */
export function tryAgainLine(content: PotionLabContent, target: SecondaryColor): SpeechRequest {
  return {
    lineId: 'potion.tryAgain.he',
    lang: 'he',
    text: content.linesHe.tryAgainFrame.replace('{color}', content.colors[target].he),
  };
}

/** Hebrew intro line for the start of a visit in free or request mode. */
export function introLine(content: PotionLabContent, mode: PotionMode): SpeechRequest {
  return mode === 'request'
    ? { lineId: 'potion.intro.request.he', lang: 'he', text: content.linesHe.introRequest }
    : { lineId: 'potion.intro.free.he', lang: 'he', text: content.linesHe.introFree };
}

export interface VisitStartLinesInput {
  includeIntro: boolean;
  mode: PotionMode;
  request: SecondaryColor | null;
  learningLang: Lang | null;
}

/** Voice lines spoken when a visit/round begins: optional intro, then the request in Hebrew and the learning language. */
export function visitStartLines(
  content: PotionLabContent,
  { includeIntro, mode, request, learningLang }: VisitStartLinesInput,
): SpeechRequest[] {
  const lines: SpeechRequest[] = [];
  if (includeIntro) lines.push(introLine(content, mode));
  if (request !== null && learningLang) {
    lines.push(requestLine(content, request), colorLine(content, request, learningLang));
  }
  return lines;
}
