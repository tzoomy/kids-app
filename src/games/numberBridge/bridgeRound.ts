// Pure helpers for Number Bridge (docs/specs/number-bridge.md): level plan, adaptive trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import { BRIDGE_NUMBER_KEYS, type BridgeNumberKey, type LevelDescriptor, type NumberBridgeContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { BridgeMode, BridgeState } from './bridgeMachine';

export interface NumberBridgePlan {
  mode: BridgeMode;
  stones: number;
  gaps: number;
  range: number;
  dots: boolean;
  /** L5: audio-only idle hint (counting aloud only, no pulse on the right choice stone). */
  audioOnly: boolean;
}

const DEFAULT_STONES = 3;
const DEFAULT_GAPS = 1;
const DEFAULT_RANGE = 5;

/** Reads the game-specific levers of one level (`extra.mode`, `extra.stones`, `extra.gaps`, `extra.range`, `extra.dots`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): NumberBridgePlan {
  const mode: BridgeMode = level?.extra?.mode === 'missing' ? 'missing' : 'one-more';
  const rawStones = level?.extra?.stones;
  const stones =
    typeof rawStones === 'number' && Number.isInteger(rawStones) && rawStones >= 2 ? rawStones : DEFAULT_STONES;
  const rawGaps = level?.extra?.gaps;
  const gaps =
    typeof rawGaps === 'number' && Number.isInteger(rawGaps) && rawGaps >= 1 ? rawGaps : DEFAULT_GAPS;
  const rawRange = level?.extra?.range;
  const range =
    typeof rawRange === 'number' && Number.isInteger(rawRange) && rawRange >= stones ? rawRange : DEFAULT_RANGE;
  const dots = level?.extra?.dots === true;
  const audioOnly = level?.support === 'audio-only';
  return { mode, stones, gaps, range, dots, audioOnly };
}

/**
 * Adaptive trial for one completed bridge:
 * - `one-more`: always clean (exposure), itemId = `one-more-<gaps>`.
 * - `missing`: itemId = missing number string, clean only on first-tap unhinted answer.
 */
export function trialForBridge(state: BridgeState, hinted: boolean): TrialResult {
  if (state.mode === 'one-more') {
    return {
      itemId: `one-more-${state.initialGaps.length}`,
      firstTryCorrect: true,
      hinted: false,
    };
  }
  return {
    itemId: String(state.answer),
    firstTryCorrect: state.tries === 1,
    hinted,
  };
}

function numberKey(n: number): BridgeNumberKey {
  const key = String(n) as BridgeNumberKey;
  if (!(BRIDGE_NUMBER_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Number out of supported 1..10 range: ${n}`);
  }
  return key;
}

/** Hebrew intro line for the first bridge of a visit in `one-more` or `missing` mode. */
export function introLine(content: NumberBridgeContent, mode: BridgeMode): SpeechRequest {
  return mode === 'missing'
    ? { lineId: 'bridge.intro.missing.he', lang: 'he', text: content.linesHe.introMissing }
    : { lineId: 'bridge.intro.oneMore.he', lang: 'he', text: content.linesHe.introOneMore };
}

/** Learning-language line spoken on each pile tap in `one-more` mode ("One more!" / "Encore une !"). */
export function oneMoreLine(content: NumberBridgeContent, lang: Lang): SpeechRequest {
  return {
    lineId: `bridge.oneMore.${lang}`,
    lang,
    text: content.oneMorePhrase[lang],
  };
}

/** Counting word 1-10 in the given learning language (`en` or `fr`), device TTS in Pass 1. */
export function numberLine(content: NumberBridgeContent, n: number, lang: Lang): SpeechRequest {
  const key = numberKey(n);
  return {
    lineId: `bridge.number.${n}.${lang}`,
    lang,
    text: content.numbers[key][lang],
  };
}

/** Gentle Hebrew retry line when a wrong number stone is tapped. */
export function notThisLine(content: NumberBridgeContent): SpeechRequest {
  return {
    lineId: 'bridge.notThis.he',
    lang: 'he',
    text: content.linesHe.notThis,
  };
}

/** Hebrew celebration line when the rabbit reaches the far bank. */
export function crossedLine(content: NumberBridgeContent): SpeechRequest {
  return {
    lineId: 'bridge.crossed.he',
    lang: 'he',
    text: content.linesHe.crossed,
  };
}

/** Counting words in `lang` for every stone before the current gap (for wrong-tap and hint counting). */
export function countUpToGapLines(content: NumberBridgeContent, state: BridgeState, lang: Lang): SpeechRequest[] {
  const gapIdx = state.gaps[0] ?? state.sequence.length;
  return state.sequence.slice(0, gapIdx).map((n) => numberLine(content, n, lang));
}

/** Counting words in `lang` for every stone in the completed bridge during crossing. */
export function countBridgeLines(content: NumberBridgeContent, sequence: readonly number[], lang: Lang): SpeechRequest[] {
  return sequence.map((n) => numberLine(content, n, lang));
}
