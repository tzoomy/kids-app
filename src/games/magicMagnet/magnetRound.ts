// Pure helpers for Magic Magnet (docs/specs/magic-magnet.md): level plan, round selection, adaptive trials, and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, MagicMagnetContent, MagnetObject } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import { taskInstructionLang, type TaskLang, type TaskTrack } from '../../core/audio/taskInstruction';
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

/** French definite article of each object (agreement for « Est-ce que le trombone … » / « la vis … »). */
const FR_ARTICLE: Record<string, 'le' | 'la'> = {
  paperclip: 'le',
  nail: 'le',
  screw: 'la',
  'bottle-cap': 'la',
  ball: 'la',
  leaf: 'la',
  feather: 'la',
  apple: 'la',
};

/** Age-5 predict question: ONE learning-language sentence that already names the object (no Hebrew prefix, no word line). */
export function askTaskLine(content: MagicMagnetContent, id: string, lang: Lang): SpeechRequest {
  const obj = findContentObject(content, id);
  if (lang === 'en') {
    return { lineId: `magnet.ask.${obj.id}.en`, lang, text: `Will the ${obj.en} stick to the magnet?` };
  }
  const article = FR_ARTICLE[obj.id];
  if (!article) throw new Error(`No French article for magic-magnet object: ${obj.id}`);
  return { lineId: `magnet.ask.${obj.id}.fr`, lang, text: `Est-ce que ${article} ${obj.fr} va coller à l'aimant ?` };
}

/**
 * Predict question lines: Hebrew question then the object word in the learning language (age 2 / default), or a single
 * learning-language sentence for age 5.
 */
export function askLines(
  content: MagicMagnetContent,
  id: string,
  lang: Lang,
  track: TaskTrack = 'age2',
): SpeechRequest[] {
  if (track === 'age5') return [askTaskLine(content, id, lang)];
  const obj = findContentObject(content, id);
  return [
    { lineId: `magnet.ask.${obj.id}.he`, lang: 'he', text: obj.askHe },
    wordLine(content, obj.id, lang),
  ];
}

/** Predict-mode question lines for `id`: word-only on L4 (`audioOnly`), otherwise the ask for the track. */
export function questionLines(
  content: MagicMagnetContent,
  id: string,
  lang: Lang,
  audioOnly: boolean,
  track: TaskTrack = 'age2',
): SpeechRequest[] {
  return audioOnly ? [wordLine(content, id, lang)] : askLines(content, id, lang, track);
}

export interface RoundStartLineOptions {
  includeIntro: boolean;
  mode: MagnetMode;
  targetId?: string | null;
  lang: Lang | null;
  audioOnly: boolean;
  /** Defaults to 'age2' (today's Hebrew behaviour). */
  track?: TaskTrack;
}

/** Voice lines spoken at the start of a round: optional visit intro, plus the first predict question in predict mode. */
export function roundStartLines(
  content: MagicMagnetContent,
  opts: RoundStartLineOptions,
): SpeechRequest[] {
  const lines: SpeechRequest[] = [];
  const track = opts.track ?? 'age2';
  if (opts.includeIntro) lines.push(introLine(content, opts.mode, opts.lang ? taskInstructionLang(track, opts.lang) : 'he'));
  if (opts.mode === 'predict' && opts.lang && opts.targetId) {
    lines.push(...questionLines(content, opts.targetId, opts.lang, opts.audioOnly, track));
  }
  return lines;
}

const INTRO_TEXT: Record<Lang, Record<MagnetMode, string>> = {
  en: {
    free: "Let's find out what sticks to the magnet! Drag the magnet.",
    predict: "Let's guess what will stick to the magnet, then we'll check!",
  },
  fr: {
    free: "Découvrons ce qui colle à l'aimant ! Fais glisser l'aimant.",
    predict: "Devinons ce qui va coller à l'aimant, puis nous vérifierons !",
  },
};
const TEST_TEXT: Record<Lang, string> = {
  en: "Let's check! Bring the magnet close.",
  fr: "Vérifions ! Approche l'aimant.",
};

/** Intro line for the start of a visit in free or predict mode (Hebrew by default, learning language for age 5). */
export function introLine(content: MagicMagnetContent, mode: MagnetMode, taskLang: TaskLang = 'he'): SpeechRequest {
  if (taskLang !== 'he') {
    return { lineId: `magnet.intro.${mode}.${taskLang}`, lang: taskLang, text: INTRO_TEXT[taskLang][mode] };
  }
  return mode === 'predict'
    ? { lineId: 'magnet.intro.predict.he', lang: 'he', text: content.linesHe.introPredict }
    : { lineId: 'magnet.intro.free.he', lang: 'he', text: content.linesHe.introFree };
}

/** Prompt after a prediction is chosen ("בואי נבדוק! קרבי את המגנט."), or the learning-language one for age 5. */
export function testLine(content: MagicMagnetContent, taskLang: TaskLang = 'he'): SpeechRequest {
  if (taskLang !== 'he') return { lineId: `magnet.test.${taskLang}`, lang: taskLang, text: TEST_TEXT[taskLang] };
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
