// Generic "choice/serve" game template logic: pick a round, decide correctness.
// No Phaser dependency — pure and unit-testable. Rendering lives in the game scene
// that uses this template (e.g. src/games/restaurant/RestaurantScene.ts).
import type { RestaurantItem } from '../../content/schema';

export type Lang = 'en' | 'fr';

/** The levers choice-serve reads from a content level descriptor. */
export interface ChoiceServeLevel {
  choiceCount: number;
  counts: readonly number[];
  distractor?: string;
}

export interface ChoiceOption {
  item: RestaurantItem;
  count: 1 | 2 | 3;
}

export interface RoundSpec {
  language: Lang;
  target: ChoiceOption;
  choices: ChoiceOption[];
  promptText: string;
}

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
  return { language, target, choices: shuffle(choices, random), promptText: promptFor(target.item, language, target.count) };
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
  ageConfig: ChoiceServeLevel,
  language: Lang,
  random: () => number = Math.random,
  targetId?: string,
): RoundSpec {
  const n = ageConfig.choiceCount;
  const fixed = targetId === undefined ? undefined : items.find((i) => i.id === targetId);
  if (fixed) return buildFixedTargetRound(items, fixed, ageConfig, language, random);
  const pool = shuffle(items, random);
  const anchor = pool[0];
  const anchorCounts = supportedCounts(anchor, language, ageConfig.counts);
  const useCountVariant = ageConfig.counts.length > 1 && anchorCounts.length > 1 && random() < 0.5;

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
  return { language, target, choices: shuffled, promptText: promptFor(target.item, language, target.count) };
}

export function isCorrectChoice(choice: ChoiceOption, target: ChoiceOption): boolean {
  return choice.item.id === target.item.id && choice.count === target.count;
}
