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
}

export function balloonLevel(descriptor: LevelDescriptor): BalloonLevel {
  const extra = descriptor.extra ?? {};
  return {
    mode: extra.mode === 'digit' ? 'digit' : 'color',
    choiceCount: descriptor.choiceCount ?? 2,
    distractor: descriptor.distractor === 'near' ? 'near' : 'far',
    digitMin: typeof extra.digitMin === 'number' ? extra.digitMin : 0,
    digitMax: typeof extra.digitMax === 'number' ? extra.digitMax : 9,
  };
}

/** Engine item ids: `color-<id>` and `digit-<n>`, so both modes can share one skill per language. */
export function colorItemId(colorId: string): string {
  return `color-${colorId}`;
}

export function digitItemId(value: number): string {
  return `digit-${value}`;
}

/** Item ids the engine may pick as a target on this level. */
export function eligibleItemIds(content: BalloonPopContent, level: BalloonLevel): string[] {
  if (level.mode === 'color') return content.colors.map((c) => colorItemId(c.id));
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

/** Spoken word for an item, in a language. */
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
  const mode: BalloonMode = itemId.startsWith('digit-') ? 'digit' : 'color';
  return content.promptFrames[mode][lang].replace('{name}', itemName(content, itemId, lang));
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
  return { itemId, color: digitColor, label: itemId.slice('digit-'.length) };
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
