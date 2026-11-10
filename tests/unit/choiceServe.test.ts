import { describe, expect, it } from 'vitest';
import { buildRound, isCorrectChoice, pickLanguage, shuffle } from '@/games/templates/choiceServe';
import { loadAnimalRestaurant } from '@/content/loadContent';

const content = loadAnimalRestaurant();

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
