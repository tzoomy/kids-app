// Pure helpers for Number Bridge (docs/specs/number-bridge.md): level plan, adaptive trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import { BRIDGE_NUMBER_KEYS, type BridgeNumberKey, type LevelDescriptor, type NumberBridgeContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { BridgeMode, BridgeState, EquationOp, EquationOpLever } from './bridgeMachine';

export interface NumberBridgePlan {
  mode: BridgeMode;
  stones: number;
  gaps: number;
  range: number;
  dots: boolean;
  /** L5 / L8: audio-only idle hint (spoken only, no pulse on the right choice stone). */
  audioOnly: boolean;
  /** Equation levels (age-5 stretch L6-L8): `add`, `sub` or `mix`; null on the other levels. */
  op: EquationOpLever | null;
}

const DEFAULT_STONES = 3;
const DEFAULT_GAPS = 1;
const DEFAULT_RANGE = 5;

/** Reads the game-specific levers of one level (`extra.mode`, `extra.stones`, `extra.gaps`, `extra.range`, `extra.dots`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): NumberBridgePlan {
  const rawMode = level?.extra?.mode;
  const mode: BridgeMode = rawMode === 'missing' || rawMode === 'equation' ? rawMode : 'one-more';
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
  const rawOp = level?.extra?.op;
  const op: EquationOpLever | null =
    mode === 'equation' ? (rawOp === 'sub' || rawOp === 'mix' ? rawOp : 'add') : null;
  return { mode, stones, gaps, range, dots, audioOnly, op };
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
  if (state.mode === 'equation') {
    const [a, b] = state.sequence;
    return {
      itemId: `${a}${state.op === 'sub' ? '-' : '+'}${b}`,
      firstTryCorrect: state.tries === 1,
      hinted,
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
    throw new Error(`Number out of supported 1..20 range: ${n}`);
  }
  return key;
}

/** Intro key: one per kind of bridge, so the scene can say a new intro when an equation level starts mid-visit. */
export function introKey(plan: Pick<NumberBridgePlan, 'mode' | 'op'>): string {
  return plan.mode === 'equation' ? `equation-${plan.op ?? 'add'}` : plan.mode;
}

/**
 * Hebrew intro line: the first bridge of a visit (one-more / missing), and the first bridge of each equation level
 * (`op` = the level's add / sub / mix lever).
 */
export function introLine(content: NumberBridgeContent, mode: BridgeMode, op: EquationOpLever | null = null): SpeechRequest {
  if (mode === 'equation') {
    const lever = op ?? 'add';
    const text = lever === 'sub' ? content.linesHe.introSub : lever === 'mix' ? content.linesHe.introMix : content.linesHe.introAdd;
    return { lineId: `bridge.intro.${lever}.he`, lang: 'he', text };
  }
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

export type OperatorWord = 'plus' | 'minus' | 'equals';

/** Operator word between the number words of an equation ("plus", "minus", "equals" / "plus", "moins", "égale"). */
export function operatorLine(content: NumberBridgeContent, word: OperatorWord, lang: Lang): SpeechRequest {
  return { lineId: `bridge.op.${word}.${lang}`, lang, text: content.operatorWords[word][lang] };
}

function opWord(op: EquationOp | null): OperatorWord {
  return op === 'sub' ? 'minus' : 'plus';
}

/** The question of an equation bridge, spoken clip by clip: "three" "plus" "four" "equals". */
export function equationLines(content: NumberBridgeContent, state: Pick<BridgeState, 'sequence' | 'op'>, lang: Lang): SpeechRequest[] {
  const [a, b] = state.sequence;
  return [numberLine(content, a, lang), operatorLine(content, opWord(state.op), lang), numberLine(content, b, lang), operatorLine(content, 'equals', lang)];
}

/** What is said on each hop of an equation crossing: [a], [op, b], [equals, result]. */
export function equationHopLines(content: NumberBridgeContent, state: Pick<BridgeState, 'sequence' | 'op'>, lang: Lang): SpeechRequest[][] {
  const [a, b, result] = state.sequence;
  return [
    [numberLine(content, a, lang)],
    [operatorLine(content, opWord(state.op), lang), numberLine(content, b, lang)],
    [operatorLine(content, 'equals', lang), numberLine(content, result, lang)],
  ];
}

/**
 * Every line Number Bridge can request (unique lineId -> one text), for the voice render list
 * (scripts/tts) and the voice tests. Device TTS speaks any line without a clip.
 */
export function allBridgeVoiceLines(content: NumberBridgeContent): SpeechRequest[] {
  const out: SpeechRequest[] = [
    introLine(content, 'one-more'),
    introLine(content, 'missing'),
    introLine(content, 'equation', 'add'),
    introLine(content, 'equation', 'sub'),
    introLine(content, 'equation', 'mix'),
    notThisLine(content),
    crossedLine(content),
    { lineId: 'bridge.help.he', lang: 'he', text: content.helpTextHe },
  ];
  for (const lang of ['en', 'fr'] as const) {
    out.push(oneMoreLine(content, lang));
    for (const key of BRIDGE_NUMBER_KEYS) out.push(numberLine(content, Number(key), lang));
    for (const word of ['plus', 'minus', 'equals'] as const) out.push(operatorLine(content, word, lang));
  }
  return out;
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
