// Generic "choice/serve" game template logic: pick a round, decide correctness.
// No Phaser dependency — pure and unit-testable. Rendering lives in the game scene
// that uses this template (e.g. src/games/restaurant/RestaurantScene.ts).
import type { RestaurantItem, AgeTrackConfig } from '../../content/schema';

export type Lang = 'en' | 'fr';

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
 * Builds one round: either several different items (count 1 each), or the same
 * item at different counts, per the age track's configuration. Choice count and
 * available counts come entirely from content/schema — no language grammar here.
 */
export function buildRound(
  items: readonly RestaurantItem[],
  ageConfig: AgeTrackConfig,
  language: Lang,
  random: () => number = Math.random,
): RoundSpec {
  const n = ageConfig.choiceCount;
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
