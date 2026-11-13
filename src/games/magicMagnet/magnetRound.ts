// Pure helpers for Magic Magnet (docs/specs/magic-magnet.md): level plan, round selection, adaptive trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, MagicMagnetContent, MagnetObject } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { MagnetEvent, MagnetMode } from './magnetMachine';

export interface MagnetPlan {
  mode: MagnetMode;
  objectCount: number;
  /** L4: the target is only named in the learning language, with no glow ring. */
  audioOnly: boolean;
  /** L2: idle hint pulses both prediction buttons; L3+: no button pulse. */
  hintPulse: boolean;
}

const DEFAULT_OBJECT_COUNT = 4;

/** Reads the game-specific levers of one level (`extra.mode`, `extra.objectCount`, `extra.hintPulse`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): MagnetPlan {
  const mode: MagnetMode = level?.extra?.mode === 'predict' ? 'predict' : 'free';
  const rawCount = level?.extra?.objectCount;
  const objectCount =
    typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount >= 2 ? rawCount : DEFAULT_OBJECT_COUNT;
  const audioOnly = level?.support === 'audio-only';
  const hintPulse = !audioOnly && level?.extra?.hintPulse !== false;
  return { mode, objectCount, audioOnly, hintPulse };
}

function sameIdSet(subset: readonly MagnetObject[], previousIds: readonly string[]): boolean {
  if (subset.length !== previousIds.length) return false;
  const prev = new Set(previousIds);
  if (prev.size !== subset.length) return false;
  return subset.every((o) => prev.has(o.id));
}

function validSubsets(objects: readonly MagnetObject[], count: number): MagnetObject[][] {
  const out: MagnetObject[][] = [];
  const current: MagnetObject[] = [];
  const walk = (start: number, hasMetal: boolean, hasNonMetal: boolean) => {
    if (current.length === count) {
      if (hasMetal && hasNonMetal) out.push([...current]);
      return;
    }
    const needed = count - current.length;
    for (let i = start; i <= objects.length - needed; i++) {
      const obj = objects[i];
      current.push(obj);
      walk(i + 1, hasMetal || obj.metal, hasNonMetal || !obj.metal);
      current.pop();
    }
  };
  walk(0, false, false);
  return out;
}

function randIndex(length: number, rng: () => number): number {
  const raw = Math.floor(Math.max(0, Math.min(0.999999999999, rng())) * length);
  return Math.min(length - 1, raw);
}

/**
 * Picks `count` objects with at least one metal and one non-metal object.
 * Never repeats the exact id set of `previousIds` when another valid set exists; deterministic with `rng`.
 */
export function pickRoundObjects(
  objects: readonly MagnetObject[],
  count: number,
  previousIds?: readonly string[] | null,
  rng: () => number = Math.random,
): MagnetObject[] {
  if (count < 2 || count > objects.length) {
    throw new Error(`Invalid round object count ${count} for ${objects.length} objects`);
  }
  const allValid = validSubsets(objects, count);
  if (allValid.length === 0) {
    throw new Error(`No valid subset of ${count} objects contains both metal and non-metal items`);
  }
  const prev = previousIds ?? [];
  const withoutPrev = prev.length === count ? allValid.filter((s) => !sameIdSet(s, prev)) : allValid;
  const pool = withoutPrev.length > 0 ? withoutPrev : allValid;
  const chosen = [...pool[randIndex(pool.length, rng)]];

  // Deterministic Fisher-Yates shuffle so table positions and predict order vary.
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = randIndex(i + 1, rng);
    const tmp = chosen[i];
    chosen[i] = chosen[j];
    chosen[j] = tmp;
  }
  return chosen;
}

/** Free-mode adaptive trial: every touched object is one clean exposure trial. */
export function trialForTouch(id: string): TrialResult {
  return { itemId: id, firstTryCorrect: true, hinted: false };
}

/** Predict-mode adaptive trial: clean only when the prediction matched the truth and the idle hint did not fire. */
export function trialForReveal(
  event: Extract<MagnetEvent, { kind: 'revealed' }>,
  hinted: boolean,
): TrialResult {
  return {
    itemId: event.id,
    firstTryCorrect: event.correct,
    hinted,
  };
}

function findContentObject(content: MagicMagnetContent, id: string): MagnetObject {
  const obj = content.objects.find((o) => o.id === id);
  if (!obj) {
    throw new Error(`Unknown magic-magnet object id: ${String(id)}`);
  }
  return obj;
}

/** Object word in the active learning language (`en` or `fr`). */
export function wordLine(content: MagicMagnetContent, id: string, lang: Lang): SpeechRequest {
  const obj = findContentObject(content, id);
  return {
    lineId: `magnet.word.${obj.id}.${lang}`,
    lang,
    text: obj[lang],
  };
}

/** Reaction sequence after touching an object: Hebrew reaction, object word in learning lang, sticks/doesn't stick in learning lang. */
export function reactionLines(
  content: MagicMagnetContent,
  id: string,
  lang: Lang,
): [SpeechRequest, SpeechRequest, SpeechRequest] {
  const obj = findContentObject(content, id);
  const resultWord = obj.metal
    ? { lineId: `magnet.sticks.${lang}`, lang, text: content.resultWords.sticks[lang] }
    : { lineId: `magnet.notSticks.${lang}`, lang, text: content.resultWords.notSticks[lang] };
  return [
    { lineId: `magnet.react.${obj.id}.he`, lang: 'he', text: obj.reactHe },
    wordLine(content, obj.id, lang),
    resultWord,
  ];
}

/** Predict question sequence: Hebrew question, then the object word in the learning language. */
export function askLines(
  content: MagicMagnetContent,
  id: string,
  lang: Lang,
): [SpeechRequest, SpeechRequest] {
  const obj = findContentObject(content, id);
  return [
    { lineId: `magnet.ask.${obj.id}.he`, lang: 'he', text: obj.askHe },
    wordLine(content, obj.id, lang),
  ];
}

/** Hebrew intro line for the start of a visit in free or predict mode. */
export function introLine(content: MagicMagnetContent, mode: MagnetMode): SpeechRequest {
  return mode === 'predict'
    ? { lineId: 'magnet.intro.predict.he', lang: 'he', text: content.linesHe.introPredict }
    : { lineId: 'magnet.intro.free.he', lang: 'he', text: content.linesHe.introFree };
}

/** Hebrew prompt after a prediction is chosen ("בואי נבדוק! קרבי את המגנט."). */
export function testLine(content: MagicMagnetContent): SpeechRequest {
  return { lineId: 'magnet.test.he', lang: 'he', text: content.linesHe.test };
}

/** Hebrew feedback line for a matching prediction. */
export function rightLine(content: MagicMagnetContent): SpeechRequest {
  return { lineId: 'magnet.right.he', lang: 'he', text: content.linesHe.right };
}

/** Hebrew feedback line for a non-matching prediction ("וואו, הפתעה!"). */
export function surpriseLine(content: MagicMagnetContent): SpeechRequest {
  return { lineId: 'magnet.surprise.he', lang: 'he', text: content.linesHe.surprise };
}
