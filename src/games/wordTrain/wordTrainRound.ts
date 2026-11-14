// Pure helpers for Word Train (docs/specs/word-train.md): level plan, selection, trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, WordTrainContent, WordTrainObject, WordTrainWord } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { WordTrainEvent, WordTrainMode } from './wordTrainMachine';

export interface WordTrainPlan {
  mode: WordTrainMode;
  choiceCount: number;
  loadsPerStar: number;
  wordLength: 3 | 4;
  ghost: boolean;
  distractors: 0 | 1;
  audioOnly: boolean;
  hintPulse: boolean;
}

const DEFAULT_CHOICE_COUNT = 2;
const DEFAULT_LOADS_PER_STAR = 3;

/** Reads the game-specific levers of one level (`extra.*` and `support`). */
export function planForLevel(level: LevelDescriptor | undefined): WordTrainPlan {
  const mode: WordTrainMode = level?.extra?.mode === 'spell' ? 'spell' : 'load';
  const rawChoiceCount = level?.extra?.choiceCount;
  const choiceCount =
    typeof rawChoiceCount === 'number' && Number.isInteger(rawChoiceCount) && rawChoiceCount >= 2
      ? rawChoiceCount
      : DEFAULT_CHOICE_COUNT;
  const rawLoadsPerStar = level?.extra?.loadsPerStar;
  const loadsPerStar =
    typeof rawLoadsPerStar === 'number' && Number.isInteger(rawLoadsPerStar) && rawLoadsPerStar >= 1
      ? rawLoadsPerStar
      : DEFAULT_LOADS_PER_STAR;
  const wordLength: 3 | 4 = level?.extra?.wordLength === 4 ? 4 : 3;
  const ghost = level?.extra?.ghost === true;
  const distractors: 0 | 1 = level?.extra?.distractors === 1 ? 1 : 0;
  const audioOnly = level?.support === 'audio-only';
  const hintPulse = !audioOnly;
  return {
    mode,
    choiceCount,
    loadsPerStar,
    wordLength,
    ghost,
    distractors,
    audioOnly,
    hintPulse,
  };
}

function randIndex(length: number, rng: () => number): number {
  const raw = Math.floor(Math.max(0, Math.min(0.999999999999, rng())) * length);
  return Math.min(length - 1, raw);
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randIndex(i + 1, rng);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Picks `count` objects and one `target` among them.
 * Never repeats `previousTarget` when another object exists; deterministic with `rng`.
 */
export function pickLoadRound(
  objects: readonly WordTrainObject[],
  count: number,
  previousTarget?: string | null,
  rng: () => number = Math.random,
): { choices: WordTrainObject[]; target: WordTrainObject } {
  if (count < 2 || count > objects.length) {
    throw new Error(`Invalid load choice count ${count} for ${objects.length} objects`);
  }
  const eligibleTargets =
    previousTarget && objects.length > 1 ? objects.filter((o) => o.id !== previousTarget) : objects;
  const targetPool = eligibleTargets.length > 0 ? eligibleTargets : objects;
  const target = targetPool[randIndex(targetPool.length, rng)];
  const others = shuffle(
    objects.filter((o) => o.id !== target.id),
    rng,
  ).slice(0, count - 1);
  const choices = shuffle([target, ...others], rng);
  return { choices, target };
}

/**
 * Picks one word of `length` (3 or 4).
 * Never repeats `previousId` when another word of that length exists; deterministic with `rng`.
 */
export function pickWord(
  words: readonly WordTrainWord[],
  length: 3 | 4,
  previousId?: string | null,
  rng: () => number = Math.random,
): WordTrainWord {
  const matching = words.filter((w) => w.word.length === length);
  if (matching.length === 0) {
    throw new Error(`No words of length ${length} available`);
  }
  const eligible = previousId && matching.length > 1 ? matching.filter((w) => w.id !== previousId) : matching;
  const pool = eligible.length > 0 ? eligible : matching;
  return pool[randIndex(pool.length, rng)];
}

/**
 * Builds shuffled letter blocks for `word` plus `distractors` letters drawn from `distractorLetters`.
 * Distractor letters are never in `word`; deterministic with `rng`.
 */
export function buildTiles(
  word: string,
  distractors: number,
  distractorLetters: string,
  rng: () => number = Math.random,
): string[] {
  const baseLetters = word.split('');
  if (distractors <= 0) {
    return shuffle(baseLetters, rng);
  }
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const ch of distractorLetters) {
    if (!word.includes(ch) && !seen.has(ch)) {
      seen.add(ch);
      candidates.push(ch);
    }
  }
  if (candidates.length < distractors) {
    throw new Error(`Not enough distractor letters outside "${word}" (needed ${distractors}, found ${candidates.length})`);
  }
  const pickedDistractors = shuffle(candidates, rng).slice(0, distractors);
  return shuffle([...baseLetters, ...pickedDistractors], rng);
}

/** Load-mode adaptive trial: clean only when loaded on the first pick (`tries === 1`). */
export function trialForLoad(event: Extract<WordTrainEvent, { kind: 'loaded' }>): TrialResult {
  return {
    itemId: event.id,
    firstTryCorrect: event.tries === 1,
    hinted: false,
  };
}

/** Spell-mode adaptive trial: clean only when `bounces === 0` and the idle hint did not fire. */
export function trialForWord(
  event: Extract<WordTrainEvent, { kind: 'spelled' }>,
  hinted: boolean,
  itemId: string = event.word,
): TrialResult {
  return {
    itemId,
    firstTryCorrect: event.bounces === 0,
    hinted,
  };
}

function findObject(content: WordTrainContent, id: string): WordTrainObject {
  const obj = content.objects.find((o) => o.id === id);
  if (!obj) {
    throw new Error(`Unknown word-train object id: ${String(id)}`);
  }
  return obj;
}

function findWord(content: WordTrainContent, id: string): WordTrainWord {
  const w = content.words.find((entry) => entry.id === id);
  if (!w) {
    throw new Error(`Unknown word-train word id: ${String(id)}`);
  }
  return w;
}

/** Hebrew intro line for the start of a visit in load or spell mode. */
export function introLine(content: WordTrainContent, mode: WordTrainMode): SpeechRequest {
  return mode === 'spell'
    ? { lineId: 'wordtrain.intro.spell.he', lang: 'he', text: content.linesHe.introSpell }
    : { lineId: 'wordtrain.intro.load.he', lang: 'he', text: content.linesHe.introLoad };
}

/** English load request: "Load the {word}!" */
export function loadLine(content: WordTrainContent, id: string): SpeechRequest {
  const obj = findObject(content, id);
  return {
    lineId: `wordtrain.load.${obj.id}.en`,
    lang: 'en',
    text: content.linesEn.loadFrame.replace('{word}', obj.en),
  };
}

/** English object name on successful load: "{Word}!" */
export function nameLine(content: WordTrainContent, id: string): SpeechRequest {
  const obj = findObject(content, id);
  const capitalised = obj.en.charAt(0).toUpperCase() + obj.en.slice(1);
  return {
    lineId: `wordtrain.name.${obj.id}.en`,
    lang: 'en',
    text: content.linesEn.nameFrame.replace('{Word}', capitalised),
  };
}

/** English gentle redirect when another object is tapped/dropped: "That's the {word}!" */
export function otherLine(content: WordTrainContent, id: string): SpeechRequest {
  const obj = findObject(content, id);
  return {
    lineId: `wordtrain.other.${obj.id}.en`,
    lang: 'en',
    text: content.linesEn.otherFrame.replace('{word}', obj.en),
  };
}

/** English spell prompt: "Let's spell {word}!" */
export function spellLine(content: WordTrainContent, id: string): SpeechRequest {
  const w = findWord(content, id);
  return {
    lineId: `wordtrain.spell.${w.id}.en`,
    lang: 'en',
    text: content.linesEn.spellFrame.replace('{word}', w.word),
  };
}

/** English single letter name: "{x}". */
export function letterLine(letter: string): SpeechRequest {
  const ch = letter.toLowerCase();
  if (!/^[a-z]$/.test(ch)) {
    throw new Error(`Invalid word-train letter: ${String(letter)}`);
  }
  return {
    lineId: `wordtrain.letter.${ch}.en`,
    lang: 'en',
    text: ch,
  };
}

/** English completed word readout: "{letters}: {word}!" */
export function wordLine(content: WordTrainContent, id: string): SpeechRequest {
  const w = findWord(content, id);
  const letters = w.word.split('').join(', ');
  return {
    lineId: `wordtrain.word.${w.id}.en`,
    lang: 'en',
    text: content.linesEn.wordFrame.replace('{letters}', letters).replace('{word}', w.word),
  };
}
