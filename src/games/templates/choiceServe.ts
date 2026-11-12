// Generic "choice/serve" game template logic: pick a round, decide correctness.
// No Phaser dependency — pure and unit-testable. Rendering lives in the game scene
// that uses this template (e.g. src/games/restaurant/RestaurantScene.ts).
import type { RestaurantItem } from '../../content/schema';

export type Lang = 'en' | 'fr';

/** What the animal asks for. `noun` and `quantity` are decided by the level's `counts`. */
export type RequestKind = 'noun' | 'quantity' | 'attribute' | 'two-step' | 'negation';

/** The levers choice-serve reads from a content level descriptor. */
export interface ChoiceServeLevel {
  choiceCount: number;
  counts: readonly number[];
  distractor?: string;
  request?: string;
  /** `audio-only`: the request is spoken only, with no text bubble. */
  support?: string;
}

/** Frames for two-item requests, with `{a}` and `{b}` placeholders (from content). */
export type TwoStepFrames = Record<Lang, string>;

export interface ChoiceOption {
  item: RestaurantItem;
  count: 1 | 2 | 3;
  /** Set on colour-variant plates (attribute and negation requests); drawn procedurally in that colour. */
  color?: string;
}

export interface RoundSpec {
  language: Lang;
  request: RequestKind;
  /** The primary target (the item the engine selected). */
  target: ChoiceOption;
  /** Every plate that must be served: one entry, or two for a two-item request. */
  targets: ChoiceOption[];
  choices: ChoiceOption[];
  promptText: string;
  /** Static audio line id; lines without a clip fall back to device TTS. */
  lineId: string;
  /** No visual cue for the request (no text bubble). */
  audioOnly: boolean;
}

const NEW_REQUESTS: readonly string[] = ['attribute', 'two-step', 'negation'];

export function shuffle<T>(arr: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickLanguage(setting: 'both' | Lang, random: () => number = Math.random): Lang {
  if (setting !== 'both') return setting;
  return random() < 0.5 ? 'en' : 'fr';
}

function promptFor(item: RestaurantItem, lang: Lang, count: number): string {
  const key = String(count) as '1' | '2' | '3';
  return item.prompts[lang][key] ?? item.prompts[lang]['1'];
}

function supportedCounts(item: RestaurantItem, lang: Lang, candidates: readonly number[]): number[] {
  return candidates.filter((c) => Boolean(item.prompts[lang][String(c) as '1' | '2' | '3']));
}

/**
 * Picks `k` distractor items for `target`.
 * - `far` prefers colors that differ from the target and from each other.
 * - `near` prefers one item sharing the target's color, the rest random.
 * Anything else (or too few matches) falls back to random items.
 */
export function pickDistractors(
  target: RestaurantItem,
  others: readonly RestaurantItem[],
  k: number,
  distractor: string | undefined,
  random: () => number = Math.random,
): RestaurantItem[] {
  const pool = shuffle(
    others.filter((o) => o.id !== target.id),
    random,
  );
  const picked: RestaurantItem[] = [];
  if (distractor === 'far') {
    const usedColors = new Set([target.color]);
    for (const item of pool) {
      if (picked.length >= k) break;
      if (!usedColors.has(item.color)) {
        picked.push(item);
        usedColors.add(item.color);
      }
    }
  } else if (distractor === 'near') {
    const sameColor = pool.find((item) => item.color === target.color);
    if (sameColor && k > 0) picked.push(sameColor);
  }
  for (const item of pool) {
    if (picked.length >= k) break;
    if (!picked.includes(item)) picked.push(item);
  }
  return picked;
}

function buildFixedTargetRound(
  items: readonly RestaurantItem[],
  item: RestaurantItem,
  level: ChoiceServeLevel,
  language: Lang,
  random: () => number,
): RoundSpec {
  const n = level.choiceCount;
  const itemCounts = supportedCounts(item, language, level.counts);
  // The count variant (same food at several counts) only exists at quantity levels.
  const useCountVariant = level.counts.length > 1 && itemCounts.length > 1 && random() < 0.5;

  let target: ChoiceOption;
  let choices: ChoiceOption[];
  if (useCountVariant) {
    const targetCount = itemCounts[Math.min(itemCounts.length - 1, Math.floor(random() * itemCounts.length))] as 1 | 2 | 3;
    const otherCounts = shuffle(
      itemCounts.filter((c) => c !== targetCount),
      random,
    ).slice(0, n - 1) as (1 | 2 | 3)[];
    target = { item, count: targetCount };
    choices = [target, ...otherCounts.map((count) => ({ item, count }))];
    const extras = pickDistractors(item, items, n - choices.length, level.distractor, random);
    choices.push(...extras.map((extra) => ({ item: extra, count: 1 as const })));
  } else {
    target = { item, count: 1 };
    const others = pickDistractors(item, items, n - 1, level.distractor, random);
    choices = [target, ...others.map((d) => ({ item: d, count: 1 as const }))];
  }
  return simpleSpec(level, language, target, shuffle(choices, random));
}

function simpleSpec(level: ChoiceServeLevel, language: Lang, target: ChoiceOption, choices: ChoiceOption[]): RoundSpec {
  return {
    language,
    request: level.counts.length > 1 ? 'quantity' : 'noun',
    target,
    targets: [target],
    choices,
    promptText: promptFor(target.item, language, target.count),
    lineId: `food.${target.item.id}.${target.count}.${language}`,
    audioOnly: level.support === 'audio-only',
  };
}

/**
 * Attribute ("the red apple") and negation ("an apple, but not the red one") rounds. The two colour
 * variants of the item are always on the table, so the colour word decides the answer; the other
 * plates are distractors. Negation has one answer: the variant that is not the excluded colour.
 * Returns null when the item has no variants (the caller falls back to a plain round).
 */
function buildVariantRound(
  items: readonly RestaurantItem[],
  item: RestaurantItem,
  level: ChoiceServeLevel,
  language: Lang,
  kind: 'attribute' | 'negation',
  random: () => number,
): RoundSpec | null {
  const variants = item.variants;
  if (!variants) return null;
  const named = variants[Math.min(1, Math.floor(random() * 2))];
  const targetVariant = kind === 'attribute' ? named : variants.find((v) => v !== named)!;
  const options: ChoiceOption[] = variants.map((v) => ({ item, count: 1, color: v.color }));
  const target = options.find((o) => o.color === targetVariant.color)!;
  const others = pickDistractors(item, items, Math.max(0, level.choiceCount - options.length), level.distractor, random);
  const choices = shuffle([...options, ...others.map((d) => ({ item: d, count: 1 as const }))], random);
  return {
    language,
    request: kind,
    target,
    targets: [target],
    choices,
    promptText: kind === 'attribute' ? named[language].pick : named[language].not,
    lineId: `${kind === 'attribute' ? 'attr' : 'not'}.${item.id}.${named.color}.${language}`,
    audioOnly: level.support === 'audio-only',
  };
}

/**
 * Two-item request: both foods must be served, in either order. The plates are the two requested
 * foods plus (choiceCount - 2) distractors, so at least one plate is wrong.
 */
function buildTwoStepRound(
  items: readonly RestaurantItem[],
  first: RestaurantItem,
  level: ChoiceServeLevel,
  language: Lang,
  frames: TwoStepFrames,
  random: () => number,
): RoundSpec {
  const second = shuffle(
    items.filter((i) => i.id !== first.id),
    random,
  )[0];
  const pool = items.filter((i) => i.id !== second.id);
  const others = pickDistractors(first, pool, Math.max(0, level.choiceCount - 2), level.distractor, random);
  const targets: ChoiceOption[] = [
    { item: first, count: 1 },
    { item: second, count: 1 },
  ];
  const choices = shuffle([...targets, ...others.map((d) => ({ item: d, count: 1 as const }))], random);
  return {
    language,
    request: 'two-step',
    target: targets[0],
    targets,
    choices,
    promptText: frames[language].replace('{a}', first.phrase[language]).replace('{b}', second.phrase[language]),
    lineId: `pair.${first.id}.${second.id}.${language}`,
    audioOnly: level.support === 'audio-only',
  };
}

/**
 * Builds one round: either several different items (count 1 each), or the same
 * item at different counts, per the level's configuration. Choice count and
 * available counts come entirely from content/schema — no language grammar here.
 *
 * With `targetId` the caller (the adaptive engine) fixes the target item and the level's
 * `distractor` lever shapes the other plates. Without it the target is random.
 */
export function buildRound(
  items: readonly RestaurantItem[],
  level: ChoiceServeLevel,
  language: Lang,
  random: () => number = Math.random,
  targetId?: string,
  frames?: TwoStepFrames,
): RoundSpec {
  const n = level.choiceCount;
  let fixed = targetId === undefined ? undefined : items.find((i) => i.id === targetId);
  if (level.request !== undefined && NEW_REQUESTS.includes(level.request)) {
    // Without an engine-chosen target, pick a random one that suits the request.
    if (!fixed) {
      const ids = eligibleTargetIds(items, level);
      const pickedId = ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
      fixed = items.find((i) => i.id === pickedId);
    }
    if (fixed) {
      const special =
        level.request === 'two-step'
          ? frames && items.length >= 3
            ? buildTwoStepRound(items, fixed, level, language, frames, random)
            : null
          : buildVariantRound(items, fixed, level, language, level.request as 'attribute' | 'negation', random);
      // A target the request cannot use (no variants, no frames) falls back to a plain round.
      if (special) return special;
    }
  }
  if (fixed) return buildFixedTargetRound(items, fixed, level, language, random);
  const pool = shuffle(items, random);
  const anchor = pool[0];
  const anchorCounts = supportedCounts(anchor, language, level.counts);
  const useCountVariant = level.counts.length > 1 && anchorCounts.length > 1 && random() < 0.5;

  let choices: ChoiceOption[];
  if (useCountVariant) {
    const counts = shuffle(anchorCounts, random).slice(0, n) as (1 | 2 | 3)[];
    choices = counts.map((count) => ({ item: anchor, count }));
    let extraIndex = 1;
    while (choices.length < n && extraIndex < pool.length) {
      choices.push({ item: pool[extraIndex], count: 1 });
      extraIndex++;
    }
  } else {
    choices = pool.slice(0, n).map((item) => ({ item, count: 1 }));
  }

  const shuffled = shuffle(choices, random);
  // Pick the target independently of display order, so the right answer is not always
  // in the same slot (choices are rendered left-to-right in `shuffled` order).
  const target = shuffled[Math.min(shuffled.length - 1, Math.floor(random() * shuffled.length))];
  return simpleSpec(level, language, target, shuffled);
}

export function isCorrectChoice(choice: ChoiceOption, target: ChoiceOption): boolean {
  return choice.item.id === target.item.id && choice.count === target.count && choice.color === target.color;
}

/** True when `choice` is one of the plates the request asks for. */
export function isRequestedChoice(choice: ChoiceOption, targets: readonly ChoiceOption[]): boolean {
  return targets.some((t) => isCorrectChoice(choice, t));
}

/** Items the engine may pick as the primary target for a level's request type. */
export function eligibleTargetIds(items: readonly RestaurantItem[], level: ChoiceServeLevel): string[] {
  const needsVariants = level.request === 'attribute' || level.request === 'negation';
  return items.filter((i) => !needsVariants || i.variants).map((i) => i.id);
}
