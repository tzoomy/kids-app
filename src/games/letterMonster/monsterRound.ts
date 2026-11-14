// Pure helpers for Letter Monster (docs/specs/letter-monster.md): level plan, adaptive trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LetterMonsterColorId, LetterMonsterContent, LevelDescriptor } from '../../content/schema';
import { heLine } from '../../content/voiceLines';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { MonsterEvent, MonsterRequest, MonsterRequestKind } from './monsterMachine';

export interface MonsterPlan {
  requestKind: MonsterRequestKind;
  choices: 2 | 3;
  /** L4: the request is spoken only, with nothing on the sign and no hint wiggle. */
  audioOnly: boolean;
  hintWiggle: boolean;
}

/** Reads the game-specific levers of one level (`extra.request`, `extra.choices`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): MonsterPlan {
  const requestKind: MonsterRequestKind = level?.extra?.request === 'letter' ? 'letter' : 'color';
  const choices: 2 | 3 = level?.extra?.choices === 3 ? 3 : 2;
  const audioOnly = level?.support === 'audio-only';
  return { requestKind, choices, audioOnly, hintWiggle: !audioOnly };
}

/** Adaptive item id for a request (`color:red` or `letter:B`). */
export function requestItemId(request: MonsterRequest): string {
  return request.kind === 'color' ? `color:${request.color}` : `letter:${request.letter}`;
}

/** One adaptive trial per fed request: clean only on a first-try unhinted feed. */
export function trialForRequest(
  event: Extract<MonsterEvent, { kind: 'fed' }>,
  hinted: boolean,
): TrialResult {
  return {
    itemId: requestItemId(event.request),
    firstTryCorrect: event.tries === 1,
    hinted,
  };
}

/** Hebrew intro spoken on the first request of a visit. */
export function introLine(content: LetterMonsterContent): SpeechRequest {
  return {
    lineId: 'monster.intro.he',
    lang: 'he',
    text: content.linesHe.intro,
  };
}

/** Hebrew color request ("המפלצת רוצה משהו אדום."). */
export function askColorLine(content: LetterMonsterContent, color: LetterMonsterColorId): SpeechRequest {
  return {
    lineId: `monster.askColor.${color}.he`,
    lang: 'he',
    text: content.linesHe.askColorFrame.replace('{color}', content.colors[color].he),
  };
}

/** Learning-language color word after the Hebrew request ("Red!" / "Rouge !"). */
export function colorWordLine(content: LetterMonsterContent, color: LetterMonsterColorId, lang: Lang): SpeechRequest {
  const suffix = lang === 'fr' ? ' !' : '!';
  return {
    lineId: `monster.color.${color}.${lang}`,
    lang,
    text: `${content.colors[color][lang]}${suffix}`,
  };
}

/** Hebrew letter request ("המפלצת רוצה משהו שמתחיל ב..."). */
export function askLetterLine(content: LetterMonsterContent): SpeechRequest {
  return {
    lineId: 'monster.askLetter.he',
    lang: 'he',
    text: content.linesHe.askLetter,
  };
}

/** Canonical model word in `lang` for the given initial letter (first matching food in content). */
export function modelWordForLetter(content: LetterMonsterContent, letter: string, lang: Lang): string {
  const upper = letter.toUpperCase();
  const food = content.foods.find((f) => f.initial[lang].toUpperCase() === upper);
  if (!food) throw new Error(`No food in ${lang} starts with "${letter}"`);
  return food.word[lang];
}

/** Learning-language letter + model word ("B... like banana!" / "B... comme banane !"). */
export function letterModelLine(content: LetterMonsterContent, letter: string, lang: Lang): SpeechRequest {
  const upper = letter.toUpperCase();
  const word = modelWordForLetter(content, upper, lang);
  return {
    lineId: `monster.letter.${upper}.${lang}`,
    lang,
    text: content.letterFrames[lang].replace('{letter}', upper).replace('{word}', word),
  };
}

/** Full two-line request sequence (Hebrew prompt, then learning-language key word). */
export function requestLines(
  content: LetterMonsterContent,
  request: MonsterRequest,
  lang: Lang,
): [SpeechRequest, SpeechRequest] {
  if (request.kind === 'color') {
    return [askColorLine(content, request.color), colorWordLine(content, request.color, lang)];
  }
  return [askLetterLine(content), letterModelLine(content, request.letter, lang)];
}

/** Learning-language naming line when a food is fed ("A banana!" / "Une banane !"). */
export function foodLine(content: LetterMonsterContent, foodId: string, lang: Lang): SpeechRequest {
  const food = content.foods.find((f) => f.id === foodId);
  if (!food) throw new Error(`Unknown food id: ${foodId}`);
  return {
    lineId: `monster.food.${foodId}.${lang}`,
    lang,
    text: food.phrase[lang],
  };
}

/** Gentle Hebrew retry line when a non-matching food is tapped. */
export function notThisLine(content: LetterMonsterContent): SpeechRequest {
  return {
    lineId: 'monster.notThis.he',
    lang: 'he',
    text: content.linesHe.notThis,
  };
}

/** Celebration lines after the monster eats the matching food: food name in `lang`, then `he.praise.0`. */
export function fedLines(
  content: LetterMonsterContent,
  foodId: string,
  lang: Lang,
): [SpeechRequest, SpeechRequest] {
  return [foodLine(content, foodId, lang), heLine('praise.0')];
}
