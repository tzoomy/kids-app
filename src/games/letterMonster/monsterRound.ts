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
  /** Foods offered: 2-3 on L1-L4, 4-6 on the L5-L8 ceiling levels. */
  choices: number;
  /** L4: the request is spoken only, with nothing on the sign and no hint wiggle. */
  audioOnly: boolean;
  hintWiggle: boolean;
}

/** Reads the game-specific levers of one level (`extra.request`, `extra.choices`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): MonsterPlan {
  const rawRequest = level?.extra?.request;
  const requestKind: MonsterRequestKind =
    rawRequest === 'letter' || rawRequest === 'ending' || rawRequest === 'word' ? rawRequest : 'color';
  const rawChoices = level?.extra?.choices;
  const choices =
    typeof rawChoices === 'number' && Number.isInteger(rawChoices) && rawChoices >= 2 && rawChoices <= 6
      ? rawChoices
      : 2;
  const audioOnly = level?.support === 'audio-only';
  return { requestKind, choices, audioOnly, hintWiggle: !audioOnly };
}

/** Adaptive item id for a request (`color:red`, `letter:B`, `ending:T`, `word:apple`). */
export function requestItemId(request: MonsterRequest): string {
  switch (request.kind) {
    case 'color':
      return `color:${request.color}`;
    case 'word':
      return `word:${request.foodId}`;
    default:
      return `${request.kind}:${request.letter}`;
  }
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

/** Hebrew letter request ("המפלצת רוצה משהו שמתחיל באות הזו."; the letter itself follows in the next line). */
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

/** Hebrew ending-letter request ("המפלצת רוצה משהו שמסתיים ב..."). */
export function askEndingLine(content: LetterMonsterContent): SpeechRequest {
  return { lineId: 'monster.askEnding.he', lang: 'he', text: content.linesHe.askEnding };
}

/** Canonical model word in `lang` for the given ending letter (first matching food in content). */
export function modelWordForEnding(content: LetterMonsterContent, letter: string, lang: Lang): string {
  const upper = letter.toUpperCase();
  const food = content.foods.find((f) => f.ending[lang].toUpperCase() === upper);
  if (!food) throw new Error(`No food in ${lang} ends with "${letter}"`);
  return food.word[lang];
}


/** French "de" + vowel, œ/æ, or mute h becomes "d'". Leaves "de biscuit" / "de pomme" alone. */
export function elideFrenchDe(text: string): string {
  return text.replace(/\bde ([aeiouyæœhàâäéèêëïîôùûüAEIOUYÆŒHÀÂÄÉÈÊËÏÎÔÙÛÜ])/gu, "d'$1");
}

/** Learning-language letter + model word ("T... at the end of carrot!" / "T... à la fin de biscuit !"). */
export function endingModelLine(content: LetterMonsterContent, letter: string, lang: Lang): SpeechRequest {
  const upper = letter.toUpperCase();
  const word = modelWordForEnding(content, upper, lang);
  let text = content.endingFrames[lang].replace('{letter}', upper).replace('{word}', word);
  if (lang === 'fr') text = elideFrenchDe(text);
  return {
    lineId: `monster.ending.${upper}.${lang}`,
    lang,
    text,
  };
}

/** Hebrew word-reading request ("המפלצת רוצה את המילה..."). */
export function askWordLine(content: LetterMonsterContent): SpeechRequest {
  return { lineId: 'monster.askWord.he', lang: 'he', text: content.linesHe.askWord };
}

/** Learning-language word that is also written on the sign ("apple!" / "pomme !"). */
export function wordLine(content: LetterMonsterContent, foodId: string, lang: Lang): SpeechRequest {
  const food = content.foods.find((f) => f.id === foodId);
  if (!food) throw new Error(`Unknown food id: ${foodId}`);
  return {
    lineId: `monster.word.${foodId}.${lang}`,
    lang,
    text: `${food.word[lang]}${lang === 'fr' ? ' !' : '!'}`,
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
  if (request.kind === 'ending') {
    return [askEndingLine(content), endingModelLine(content, request.letter, lang)];
  }
  if (request.kind === 'word') {
    return [askWordLine(content), wordLine(content, request.foodId, lang)];
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
