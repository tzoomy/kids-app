import { describe, expect, it } from 'vitest';
import { buildRound, isCorrectChoice, pickDistractors, pickLanguage, shuffle, type ChoiceServeLevel } from '@/games/templates/choiceServe';
import { loadAnimalRestaurant } from '@/content/loadContent';

const restaurant = loadAnimalRestaurant();
// Start levels per track, read from the adaptive block (age 2 -> L1, age 5 -> L4).
const content = {
  items: restaurant.items,
  ageTracks: {
    age2: restaurant.adaptive.levels[restaurant.adaptive.tracks.age2.start - 1] as ChoiceServeLevel,
    age5: restaurant.adaptive.levels[restaurant.adaptive.tracks.age5.start - 1] as ChoiceServeLevel,
  },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('pickLanguage', () => {
  it('returns the forced language when setting is not "both"', () => {
    expect(pickLanguage('en')).toBe('en');
    expect(pickLanguage('fr')).toBe('fr');
  });

  it('picks between en/fr when set to "both"', () => {
    expect(pickLanguage('both', () => 0)).toBe('en');
    expect(pickLanguage('both', () => 0.99)).toBe('fr');
  });
});

describe('buildRound — age2 track', () => {
  const ageConfig = content.ageTracks.age2;

  it('offers exactly 2 choices, all at count 1', () => {
    const round = buildRound(content.items, ageConfig, 'en', seededRandom(1));
    expect(round.choices).toHaveLength(2);
    expect(round.choices.every((c) => c.count === 1)).toBe(true);
  });

  it('the target is one of the offered choices, and the prompt matches the target', () => {
    const round = buildRound(content.items, ageConfig, 'en', seededRandom(7));
    expect(round.choices.some((c) => isCorrectChoice(c, round.target))).toBe(true);
    expect(round.promptText).toBe(round.target.item.prompts.en['1']);
  });
});

describe('buildRound — age5 track', () => {
  const ageConfig = content.ageTracks.age5;

  it('offers at least 3 choices', () => {
    const round = buildRound(content.items, ageConfig, 'en', seededRandom(3));
    expect(round.choices.length).toBeGreaterThanOrEqual(3);
  });

  it('every choice count used is one the item actually has a complete sentence for', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = buildRound(content.items, ageConfig, 'fr', seededRandom(seed));
      for (const choice of round.choices) {
        const key = String(choice.count) as '1' | '2' | '3';
        expect(choice.item.prompts.fr[key]).toBeTruthy();
      }
    }
  });

  it('exactly one choice is correct per round', () => {
    const round = buildRound(content.items, ageConfig, 'en', seededRandom(11));
    const correctCount = round.choices.filter((c) => isCorrectChoice(c, round.target)).length;
    expect(correctCount).toBe(1);
  });
});

describe('shuffle', () => {
  it('is deterministic for a given random function and preserves all elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, seededRandom(42));
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual(input);
  });
});

describe('buildRound target position', () => {
  it('puts the correct answer in every slot over many rounds (not always the first)', () => {
    const random = seededRandom(7);
    const items = content.items;
    const config = content.ageTracks.age5;
    const slots = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const round = buildRound(items, config, 'en', random);
      slots.add(round.choices.findIndex((c) => isCorrectChoice(c, round.target)));
    }
    expect([...slots].sort()).toEqual([0, 1, 2]);
  });
});

describe('buildRound with targetId', () => {
  const levels = restaurant.adaptive.levels as ChoiceServeLevel[];
  const [L1, , L3, L4, L5] = levels; // L1: 2 far; L3: 3 near, count 1; L4: 3 near, counts 1..3; L5: 4 plates
  const byId = (id: string) => restaurant.items.find((i) => i.id === id)!;

  it('always uses the requested item as the target', () => {
    for (const item of restaurant.items) {
      for (let seed = 1; seed <= 5; seed++) {
        const round = buildRound(restaurant.items, L4, 'fr', seededRandom(seed), item.id);
        expect(round.target.item.id).toBe(item.id);
        expect(round.choices.filter((c) => isCorrectChoice(c, round.target))).toHaveLength(1);
      }
    }
  });

  it('keeps the plate count of the level, with unique choices', () => {
    for (const level of levels) {
      const round = buildRound(restaurant.items, level, 'en', seededRandom(4), 'apple');
      expect(round.choices).toHaveLength(level.choiceCount);
      const keys = round.choices.map((c) => `${c.item.id}:${c.count}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('uses count 1 only at levels that request nouns', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const level of [L1, L3]) {
        const round = buildRound(restaurant.items, level, 'en', seededRandom(seed), 'banana');
        expect(round.choices.every((c) => c.count === 1)).toBe(true);
        expect(round.target.count).toBe(1);
      }
    }
  });

  it('produces the count variant at quantity levels, and only there', () => {
    const variant = (level: ChoiceServeLevel) => {
      let seen = false;
      for (let seed = 1; seed <= 60; seed++) {
        const round = buildRound(restaurant.items, level, 'en', seededRandom(seed), 'apple');
        if (round.choices.some((c) => c.count > 1)) {
          seen = true;
          expect(round.choices.filter((c) => c.item.id === 'apple').length).toBeGreaterThan(1);
          expect(round.promptText).toBe(round.target.item.prompts.en[String(round.target.count) as '1' | '2' | '3']);
        }
      }
      return seen;
    };
    expect(variant(L4)).toBe(true);
    expect(variant(L5)).toBe(true);
    expect(variant(L3)).toBe(false);
  });

  it('far distractors differ in color from the target and from each other when possible', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const round = buildRound(restaurant.items, { ...L5, counts: [1], distractor: 'far' }, 'en', seededRandom(seed), 'apple');
      const colors = round.choices.map((c) => c.item.color);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it('near distractors include an item with the target color when one exists', () => {
    let checked = 0;
    for (const item of restaurant.items) {
      if (!restaurant.items.some((i) => i.id !== item.id && i.color === byId(item.id).color)) continue;
      checked++;
      for (let seed = 1; seed <= 10; seed++) {
        const round = buildRound(restaurant.items, { ...L3, counts: [1], distractor: 'near' }, 'en', seededRandom(seed), item.id);
        expect(round.choices.some((c) => c.item.id !== item.id && c.item.color === item.color)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('falls back to a random target when the id is unknown, and is unchanged when omitted', () => {
    const round = buildRound(restaurant.items, L1, 'en', seededRandom(3), 'no-such-item');
    expect(round.choices).toHaveLength(2);
    expect(buildRound(restaurant.items, L1, 'en', seededRandom(3))).toEqual(round);
  });

  it('target slot varies across rounds (not always first)', () => {
    const random = seededRandom(9);
    const slots = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const round = buildRound(restaurant.items, L3, 'en', random, 'pear');
      slots.add(round.choices.findIndex((c) => isCorrectChoice(c, round.target)));
    }
    expect(slots.size).toBe(3);
  });
});

describe('pickDistractors', () => {
  it('never returns the target and never more than k', () => {
    const target = restaurant.items[0];
    const picked = pickDistractors(target, restaurant.items, 3, 'near', seededRandom(2));
    expect(picked).toHaveLength(3);
    expect(picked.some((p) => p.id === target.id)).toBe(false);
    expect(pickDistractors(target, restaurant.items, 0, 'far', seededRandom(2))).toEqual([]);
  });
});
