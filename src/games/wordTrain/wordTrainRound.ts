// Pure helpers for Word Train (docs/specs/word-train.md): level plan, selection, trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, WordTrainContent, WordTrainObject, WordTrainWord } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { WordTrainEvent, WordTrainMode } from './wordTrainMachine';

export interface WordTrainPlan {
  mode: WordTrainMode;
  choiceCount: number;
  loadsPerStar: number;
  /** Shortest word length of the level (3-6). */
  wordLength: number;
  /** Longest word length of the level; equals `wordLength` unless `extra.wordLengthMax` widens it (L8: 5-6). */
  wordLengthMax: number;
  ghost: boolean;
  distractors: 0 | 1 | 2;
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
  const rawLength = level?.extra?.wordLength;
  const wordLength =
    typeof rawLength === 'number' && Number.isInteger(rawLength) && rawLength >= 3 && rawLength <= 6 ? rawLength : 3;
  const rawMax = level?.extra?.wordLengthMax;
  const wordLengthMax =
    typeof rawMax === 'number' && Number.isInteger(rawMax) && rawMax >= wordLength && rawMax <= 6 ? rawMax : wordLength;
  const ghost = level?.extra?.ghost === true;
  const rawDistractors = level?.extra?.distractors;
  const distractors: 0 | 1 | 2 = rawDistractors === 1 ? 1 : rawDistractors === 2 ? 2 : 0;
  const audioOnly = level?.support === 'audio-only';
  const hintPulse = !audioOnly;
  return {
    mode,
    choiceCount,
    loadsPerStar,
    wordLength,
    wordLengthMax,
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

/** The spelling bank of one language (English and French words live in the same content list). */
export function wordsForLang(words: readonly WordTrainWord[], lang: Lang): WordTrainWord[] {
  return words.filter((w) => w.lang === lang);
}

/**
 * Resolves the language of one round. Load mode (age 2, and any level below the spell levels) is
 * English only whatever the parent setting; spell mode follows the setting. The adaptive skill key
 * is the one that holds the level (`skillLang`): the English key for load levels, the round's key
 * for spell levels, so Shai's stored progress and speech stay exactly as before.
 */
export function resolveRoundLanguages(opts: {
  settingLang: Lang;
  /** Plan of the level on the English skill key. */
  planEn: WordTrainPlan;
  /** Plan of the level on the setting language's skill key. */
  planSetting: WordTrainPlan;
}): { roundLang: Lang; skillLang: Lang; plan: WordTrainPlan } {
  if (opts.planEn.mode === 'load') {
    return { roundLang: 'en', skillLang: 'en', plan: opts.planEn };
  }
  if (opts.planSetting.mode === 'load') {
    return { roundLang: 'en', skillLang: opts.settingLang, plan: opts.planSetting };
  }
  return { roundLang: opts.settingLang, skillLang: opts.settingLang, plan: opts.planSetting };
}

/**
 * Picks one word with a length from `length` to `maxLength` (default: exactly `length`).
 * Never repeats `previousId` when another matching word exists; deterministic with `rng`.
 * Pass the words of one language (see `wordsForLang`).
 */
export function pickWord(
  words: readonly WordTrainWord[],
  length: number,
  previousId?: string | null,
  rng: () => number = Math.random,
  maxLength: number = length,
): WordTrainWord {
  const matching = words.filter((w) => w.word.length >= length && w.word.length <= maxLength);
  if (matching.length === 0) {
    throw new Error(`No words of length ${length}-${maxLength} available`);
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

/** Standard French letter names (not phonics) spoken for a placed or bounced letter in a French round. */
export const FRENCH_LETTER_NAMES: Readonly<Record<string, string>> = {
  a: 'a',
  b: 'bé',
  c: 'cé',
  d: 'dé',
  e: 'e',
  f: 'effe',
  g: 'gé',
  h: 'ache',
  i: 'i',
  j: 'ji',
  k: 'ka',
  l: 'elle',
  m: 'emme',
  n: 'enne',
  o: 'o',
  p: 'pé',
  q: 'ku',
  r: 'erre',
  s: 'esse',
  t: 'té',
  u: 'u',
  v: 'vé',
  w: 'double vé',
  x: 'ixe',
  y: 'i grec',
  z: 'zède',
};

function linesFor(content: WordTrainContent, lang: Lang) {
  return lang === 'fr' ? content.linesFr : content.linesEn;
}

/**
 * Hebrew intro line for the start of a visit in load or spell mode. The French spell round has its own
 * Hebrew intro; English spell and load keep their original line ids.
 */
export function introLine(content: WordTrainContent, mode: WordTrainMode, lang: Lang = 'en'): SpeechRequest {
  if (mode === 'spell') {
    return lang === 'fr'
      ? { lineId: 'wordtrain.intro.spell.fr.he', lang: 'he', text: content.linesHe.introSpellFr }
      : { lineId: 'wordtrain.intro.spell.he', lang: 'he', text: content.linesHe.introSpell };
  }
  return { lineId: 'wordtrain.intro.load.he', lang: 'he', text: content.linesHe.introLoad };
}

/** English load request: "Load the {word}!" (load mode is English only). */
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

/** Spell prompt in the word's language: "Let's spell {word}!" / "Épelons {word} !" */
export function spellLine(content: WordTrainContent, id: string): SpeechRequest {
  const w = findWord(content, id);
  return {
    lineId: `wordtrain.spell.${w.id}.${w.lang}`,
    lang: w.lang,
    text: linesFor(content, w.lang).spellFrame.replace('{word}', w.word),
  };
}

/** Single letter name: the letter itself in English, the standard French name ("bé") in French. */
export function letterLine(letter: string, lang: Lang = 'en'): SpeechRequest {
  const ch = letter.toLowerCase();
  if (!/^[a-z]$/.test(ch)) {
    throw new Error(`Invalid word-train letter: ${String(letter)}`);
  }
  return {
    lineId: `wordtrain.letter.${ch}.${lang}`,
    lang,
    text: lang === 'fr' ? FRENCH_LETTER_NAMES[ch] : ch,
  };
}

/** Completed word readout in the word's language: "{letters}: {word}!" / "{letters} : {word} !" */
export function wordLine(content: WordTrainContent, id: string): SpeechRequest {
  const w = findWord(content, id);
  const letters = w.word.split('').join(', ');
  return {
    lineId: `wordtrain.word.${w.id}.${w.lang}`,
    lang: w.lang,
    text: linesFor(content, w.lang).wordFrame.replace('{letters}', letters).replace('{word}', w.word),
  };
}
