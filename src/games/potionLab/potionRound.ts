// Pure helpers for Potion Lab (docs/specs/potion-lab.md): level plan, adaptive trials, requests and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, PotionLabContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import { taskInstructionLang, type TaskLang, type TaskTrack } from '../../core/audio/taskInstruction';
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

/**
 * Age-5 French-first / English-first task asks (Wave 2). The request is one idiomatic sentence that already contains the
 * color, so the old "Hebrew request + color word" pair collapses to a single line. French takes the partitive with
 * elision: `du vert`, `du violet`, `de l'orange`.
 */
const REQUEST_TEXT: Record<'en' | 'fr', Record<SecondaryColor, string>> = {
  en: { green: 'Can you make green?', orange: 'Can you make orange?', purple: 'Can you make purple?' },
  fr: { green: 'Peux-tu faire du vert ?', orange: "Peux-tu faire de l'orange ?", purple: 'Peux-tu faire du violet ?' },
};
const TRY_AGAIN_TEXT: Record<'en' | 'fr', Record<SecondaryColor, string>> = {
  en: {
    green: "Lovely! Now let's try to make green.",
    orange: "Lovely! Now let's try to make orange.",
    purple: "Lovely! Now let's try to make purple.",
  },
  fr: {
    green: 'Bravo ! Maintenant, essayons de faire du vert.',
    orange: "Bravo ! Maintenant, essayons de faire de l'orange.",
    purple: 'Bravo ! Maintenant, essayons de faire du violet.',
  },
};
const INTRO_TEXT: Record<'en' | 'fr', Record<PotionMode, string>> = {
  en: { free: "Let's mix colors! Tap two pots.", request: "Let's make a new color!" },
  fr: { free: 'Mélangeons des couleurs ! Appuie sur deux pots.', request: 'Faisons une nouvelle couleur !' },
};

/** Request line for a secondary color: Hebrew ("אפשר להכין <color he>?") by default, or one EN/FR sentence for age 5. */
export function requestLine(content: PotionLabContent, color: SecondaryColor, taskLang: TaskLang = 'he'): SpeechRequest {
  if (taskLang !== 'he') {
    return { lineId: `potion.request.${color}.${taskLang}`, lang: taskLang, text: REQUEST_TEXT[taskLang][color] };
  }
  return {
    lineId: `potion.request.${color}.he`,
    lang: 'he',
    text: content.linesHe.requestFrame.replace('{color}', content.colors[color].he),
  };
}

/**
 * Next-step task ask when a request-mode mix produced another color. Hebrew (`potion.tryAgain.he`, one shared id) by
 * default; age 5 hears a unique `potion.tryAgain.<color>.<lang>` line.
 */
export function tryAgainLine(content: PotionLabContent, target: SecondaryColor, taskLang: TaskLang = 'he'): SpeechRequest {
  if (taskLang !== 'he') {
    return { lineId: `potion.tryAgain.${target}.${taskLang}`, lang: taskLang, text: TRY_AGAIN_TEXT[taskLang][target] };
  }
  return {
    lineId: 'potion.tryAgain.he',
    lang: 'he',
    text: content.linesHe.tryAgainFrame.replace('{color}', content.colors[target].he),
  };
}

/** Intro line for the start of a visit in free or request mode (Hebrew by default, EN/FR for age 5). */
export function introLine(content: PotionLabContent, mode: PotionMode, taskLang: TaskLang = 'he'): SpeechRequest {
  if (taskLang !== 'he') {
    return { lineId: `potion.intro.${mode}.${taskLang}`, lang: taskLang, text: INTRO_TEXT[taskLang][mode] };
  }
  return mode === 'request'
    ? { lineId: 'potion.intro.request.he', lang: 'he', text: content.linesHe.introRequest }
    : { lineId: 'potion.intro.free.he', lang: 'he', text: content.linesHe.introFree };
}

export interface VisitStartLinesInput {
  includeIntro: boolean;
  mode: PotionMode;
  request: SecondaryColor | null;
  learningLang: Lang | null;
  /** Defaults to 'age2' (today's Hebrew behaviour). */
  track?: TaskTrack;
}

/** The request lines of one request: age 2 = Hebrew request then the color word; age 5 = one learning-language sentence. */
export function requestLines(
  content: PotionLabContent,
  color: SecondaryColor,
  learningLang: Lang,
  track: TaskTrack = 'age2',
): SpeechRequest[] {
  return track === 'age5'
    ? [requestLine(content, color, taskInstructionLang(track, learningLang))]
    : [requestLine(content, color), colorLine(content, color, learningLang)];
}

/** Voice lines spoken when a visit/round begins: optional intro, then the request (see `requestLines`). */
export function visitStartLines(
  content: PotionLabContent,
  { includeIntro, mode, request, learningLang, track = 'age2' }: VisitStartLinesInput,
): SpeechRequest[] {
  const lines: SpeechRequest[] = [];
  if (includeIntro) lines.push(introLine(content, mode, learningLang ? taskInstructionLang(track, learningLang) : 'he'));
  if (request !== null && learningLang) lines.push(...requestLines(content, request, learningLang, track));
  return lines;
}
