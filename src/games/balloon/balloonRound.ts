// Pure round logic for Balloon Pop (docs/specs/balloon-pop.md): level levers, item ids, round
// building, answer checking and request text. No Phaser dependency, so it is unit-testable.
import type { BalloonMode, BalloonPopContent, LevelDescriptor } from '../../content/schema';
import { shuffle, type Lang } from '../templates/choiceServe';

/** The levers Balloon Pop reads from a content level descriptor, with defaults applied. */
export interface BalloonLevel {
  mode: BalloonMode;
  /** Number of balloons. */
  choiceCount: number;
  /** `near`: look- or sound-alike digits first (digit levels only). */
  distractor: 'far' | 'near';
  /** Inclusive digit range on digit levels. */
  digitMin: number;
  digitMax: number;
  /** "k more than n" levels: n in baseMin..baseMax, k in 1..stepMax. */
  baseMin: number;
  baseMax: number;
  stepMax: number;
  /** Sum levels: both addends in 1..addendMax. */
  addendMax: number;
}

/** Numbers 10 and up use the `number` request frame ("Éclate le nombre…"); 0-9 keep the `digit` frame ("chiffre"). */
export const NUMBER_FRAME_FROM = 10;

export function balloonLevel(descriptor: LevelDescriptor): BalloonLevel {
  const extra = descriptor.extra ?? {};
  const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
  const mode: BalloonMode = extra.mode === 'digit' || extra.mode === 'more' || extra.mode === 'sum' ? extra.mode : 'color';
  return {
    mode,
    choiceCount: descriptor.choiceCount ?? 2,
    distractor: descriptor.distractor === 'near' ? 'near' : 'far',
    digitMin: num(extra.digitMin, 0),
    digitMax: num(extra.digitMax, 9),
    baseMin: num(extra.baseMin, 1),
    baseMax: num(extra.baseMax, 10),
    stepMax: num(extra.stepMax, 2),
    addendMax: num(extra.addendMax, 5),
  };
}

/** Engine item ids: `color-<id>` and `digit-<n>`, so both modes can share one skill per language. */
export function colorItemId(colorId: string): string {
  return `color-${colorId}`;
}

export function digitItemId(value: number): string {
  return `digit-${value}`;
}

/** Age-5 stretch item ids: `more-<n>-<k>` ("k more than n") and `sum-<a>-<b>` ("a plus b"). */
export function moreItemId(n: number, k: number): string {
  return `more-${n}-${k}`;
}

export function sumItemId(a: number, b: number): string {
  return `sum-${a}-${b}`;
}

interface ParsedRequest {
  kind: 'color' | 'digit' | 'more' | 'sum';
  /** The number on the right balloon (null for colours). */
  answer: number | null;
  /** more: [n, k]; sum: [a, b]; digit: [value]. */
  parts: number[];
}

function parseRequest(itemId: string): ParsedRequest {
  if (itemId.startsWith('color-')) return { kind: 'color', answer: null, parts: [] };
  const digit = /^digit-(\d+)$/.exec(itemId);
  if (digit) return { kind: 'digit', answer: Number(digit[1]), parts: [Number(digit[1])] };
  const more = /^more-(\d+)-(\d+)$/.exec(itemId);
  if (more) return { kind: 'more', answer: Number(more[1]) + Number(more[2]), parts: [Number(more[1]), Number(more[2])] };
  const sum = /^sum-(\d+)-(\d+)$/.exec(itemId);
  if (sum) return { kind: 'sum', answer: Number(sum[1]) + Number(sum[2]), parts: [Number(sum[1]), Number(sum[2])] };
  throw new Error(`balloon-pop: unknown item "${itemId}"`);
}

/** The number the right balloon shows for a request (`digit-7` -> 7, `more-5-2` -> 7, `sum-3-4` -> 7); null for colours. */
export function answerFor(itemId: string): number | null {
  return parseRequest(itemId).answer;
}

/** Item ids the engine may pick as a target on this level. */
export function eligibleItemIds(content: BalloonPopContent, level: BalloonLevel): string[] {
  if (level.mode === 'color') return content.colors.map((c) => colorItemId(c.id));
  if (level.mode === 'more') {
    const ids: string[] = [];
    for (let n = level.baseMin; n <= level.baseMax; n++) for (let k = 1; k <= level.stepMax; k++) ids.push(moreItemId(n, k));
    return ids;
  }
  if (level.mode === 'sum') {
    const ids: string[] = [];
    for (let a = 1; a <= level.addendMax; a++) for (let b = 1; b <= level.addendMax; b++) ids.push(sumItemId(a, b));
    return ids;
  }
  return content.digits
    .filter((d) => d.value >= level.digitMin && d.value <= level.digitMax)
    .map((d) => digitItemId(d.value));
}

export interface BalloonChoice {
  itemId: string;
  /** PALETTE key of the balloon body. */
  color: string;
  /** Numeral drawn on the balloon (digit levels), else null. */
  label: string | null;
}

export interface BalloonRoundSpec {
  language: Lang;
  level: BalloonLevel;
  targetItemId: string;
  /** Balloons in display order (the target is one of them). */
  choices: BalloonChoice[];
  /** Spoken request, also the LTR prompt bubble. */
  promptText: string;
  /** Static audio line id; no clip exists in Pass 1, so device TTS speaks it. */
  lineId: string;
}

/** Light balloon colours used on digit levels, where the colour must not be a cue. */
export const DIGIT_BALLOON_COLORS = ['yellow', 'teal', 'pink', 'orange', 'green', 'blue'] as const;

function numberWord(content: BalloonPopContent, value: number, lang: Lang): string {
  const digit = content.digits.find((d) => d.value === value);
  if (!digit) throw new Error(`balloon-pop: no number word for ${value}`);
  return digit.name[lang];
}

/** Spoken word for a colour or digit item, in a language. */
export function itemName(content: BalloonPopContent, itemId: string, lang: Lang): string {
  if (itemId.startsWith('color-')) {
    const color = content.colors.find((c) => colorItemId(c.id) === itemId);
    if (color) return color.name[lang];
  } else if (itemId.startsWith('digit-')) {
    const digit = content.digits.find((d) => digitItemId(d.value) === itemId);
    if (digit) return digit.name[lang];
  }
  throw new Error(`balloon-pop: unknown item "${itemId}"`);
}

/** The request text for one item, in the given language. */
export function promptFor(content: BalloonPopContent, itemId: string, lang: Lang): string {
  const req = parseRequest(itemId);
  if (req.kind === 'more') {
    const [n, k] = req.parts;
    return content.promptFrames.more[lang].replace('{k}', numberWord(content, k, lang)).replace('{n}', numberWord(content, n, lang));
  }
  if (req.kind === 'sum') {
    const [a, b] = req.parts;
    return content.promptFrames.sum[lang].replace('{a}', numberWord(content, a, lang)).replace('{b}', numberWord(content, b, lang));
  }
  const frame = req.kind === 'digit' ? (req.answer! >= NUMBER_FRAME_FROM ? 'number' : 'digit') : 'color';
  return content.promptFrames[frame][lang].replace('{name}', itemName(content, itemId, lang));
}

/**
 * Wrong balloons for a "k more than n" or "a plus b" request: the likely slips first on `near` levels
 * (n itself, the other step, one off the answer, an addend), then other numbers close to the answer.
 * Returned as `digit-<v>` ids; never the answer, never below 0 or above the largest number word.
 */
function stretchDistractors(
  content: BalloonPopContent,
  level: BalloonLevel,
  req: ParsedRequest,
  k: number,
  random: () => number,
): string[] {
  const answer = req.answer!;
  const values = new Set(content.digits.map((d) => d.value));
  const ok = (v: number) => values.has(v) && v !== answer;
  const slips =
    req.kind === 'more'
      ? [req.parts[0], answer + 1, answer - 1, req.parts[0] + (req.parts[1] === 1 ? 2 : 1)]
      : [answer - 1, answer + 1, req.parts[0], req.parts[1], Math.abs(req.parts[0] - req.parts[1])];
  const picked: number[] = [];
  if (level.distractor === 'near') for (const v of slips) if (picked.length < k && ok(v) && !picked.includes(v)) picked.push(v);
  const window = shuffle([...values].filter((v) => ok(v) && Math.abs(v - answer) <= 5), random);
  const rest = shuffle([...values].filter((v) => ok(v)), random);
  for (const v of [...window, ...rest]) {
    if (picked.length >= k) break;
    if (!picked.includes(v)) picked.push(v);
  }
  return picked.map(digitItemId);
}

/**
 * Picks `k` other items to share the sky with `targetId`. On a `near` digit level the target's
 * look- or sound-alike digits (content `near`, inside the level's range) come first; the rest is random.
 */
export function pickDistractors(
  content: BalloonPopContent,
  level: BalloonLevel,
  targetId: string,
  k: number,
  random: () => number = Math.random,
): string[] {
  if (level.mode === 'more' || level.mode === 'sum') return stretchDistractors(content, level, parseRequest(targetId), k, random);
  const pool = shuffle(
    eligibleItemIds(content, level).filter((id) => id !== targetId),
    random,
  );
  const picked: string[] = [];
  if (level.mode === 'digit' && level.distractor === 'near') {
    const target = content.digits.find((d) => digitItemId(d.value) === targetId);
    for (const n of target?.near ?? []) {
      const id = digitItemId(n);
      if (picked.length < k && pool.includes(id) && !picked.includes(id)) picked.push(id);
    }
  }
  for (const id of pool) {
    if (picked.length >= k) break;
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

function choiceFor(content: BalloonPopContent, itemId: string, digitColor: string): BalloonChoice {
  if (itemId.startsWith('color-')) {
    const color = content.colors.find((c) => colorItemId(c.id) === itemId);
    return { itemId, color: color?.color ?? 'red', label: null };
  }
  // Digits and the stretch requests show the number of the answer (`more-5-2` shows 7).
  return { itemId, color: digitColor, label: String(answerFor(itemId)) };
}

/**
 * Builds one trial. The engine chooses the target (`targetItemId`); the level decides the mode, the
 * balloon count and the distractors. Colour balloons each have a different colour; digit balloons
 * each show a different numeral on a light colour that is no cue to the answer.
 */
export function buildBalloonRound(
  content: BalloonPopContent,
  descriptor: LevelDescriptor,
  language: Lang,
  targetItemId: string,
  random: () => number = Math.random,
): BalloonRoundSpec {
  const level = balloonLevel(descriptor);
  const eligible = eligibleItemIds(content, level);
  const target = eligible.includes(targetItemId) ? targetItemId : eligible[0];
  const others = pickDistractors(content, level, target, level.choiceCount - 1, random);
  const ids = shuffle([target, ...others], random);
  const digitColors = shuffle([...DIGIT_BALLOON_COLORS], random);
  return {
    language,
    level,
    targetItemId: target,
    choices: ids.map((id, i) => choiceFor(content, id, digitColors[i % digitColors.length])),
    promptText: promptFor(content, target, language),
    lineId: `balloon.${target}.${language}`,
  };
}

/** True when the tapped balloon is the requested one. */
export function isCorrectBalloon(itemId: string, targetItemId: string): boolean {
  return itemId === targetItemId;
}
