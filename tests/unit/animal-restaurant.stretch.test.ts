// Animal Restaurant age-5 stretch (docs/specs/animal-restaurant.md, L10-L12, AC-44 to AC-48).
import { describe, expect, it } from 'vitest';
import {
  buildRound,
  eligibleTargetIds,
  isCorrectChoice,
  isNextRequestedChoice,
  isRequestedChoice,
  type ChoiceServeLevel,
  type StretchFrames,
} from '@/games/templates/choiceServe';
import { loadAnimalRestaurant } from '@/content/loadContent';
import { AnimalRestaurantContentSchema } from '@/content/schema';
import { restaurantStretchVoiceLines } from '@/games/restaurant/restaurantVoice';
import { computeRestaurantLayout, iconSizeFor } from '@/games/restaurant/restaurantLayout';
import { enumerateGameVoiceLines } from '../helpers/gameVoiceLines';

const restaurant = loadAnimalRestaurant();
const levels = restaurant.adaptive.levels as ChoiceServeLevel[];
const [L10, L11, L12] = levels.slice(9);
const items = restaurant.items;
const extras: StretchFrames = {
  sequenceFrames: restaurant.sequenceFrames,
  countAttributeFrames: restaurant.countAttributeFrames,
  countWords: restaurant.countWords,
};

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// The nine levels shipped before the stretch, verbatim (origin/main 3b9b160). Age 2 never sees anything else.
const L1_TO_L9 = [
  { choiceCount: 2, counts: [1], distractor: 'far', request: 'noun' },
  { choiceCount: 3, counts: [1], distractor: 'far', request: 'noun' },
  { choiceCount: 3, counts: [1], distractor: 'near', request: 'noun' },
  { choiceCount: 3, counts: [1, 2, 3], distractor: 'near', request: 'quantity' },
  { choiceCount: 4, counts: [1, 2, 3], distractor: 'near', request: 'quantity' },
  { choiceCount: 4, counts: [1], distractor: 'near', request: 'attribute' },
  { choiceCount: 4, counts: [1], distractor: 'near', request: 'two-step' },
  { choiceCount: 4, counts: [1], distractor: 'near', request: 'negation' },
  { choiceCount: 4, counts: [1], distractor: 'near', request: 'negation', support: 'audio-only' },
];

const voice = new Map(restaurantStretchVoiceLines(restaurant).map((l) => [l.lineId, l]));

describe('[AC-44] the age-5 stretch keeps the age-2 ladder untouched', () => {
  it('[AC-44] L1-L9 are unchanged, L10-L12 are appended, age2 stays { start 4, min 1, max 9 } and age5 reaches L12', () => {
    expect(levels.slice(0, 9)).toEqual(L1_TO_L9);
    expect(levels).toHaveLength(12);
    expect(restaurant.adaptive.tracks.age2).toEqual({ start: 4, min: 1, max: 9 });
    expect(restaurant.adaptive.tracks.age5).toEqual({ start: 5, min: 1, max: 12 });
    expect(L10).toEqual({ choiceCount: 4, counts: [2, 3], distractor: 'near', request: 'count-attribute' });
    expect(L11).toEqual({ choiceCount: 4, counts: [1], distractor: 'near', request: 'sequence' });
    expect(L12).toEqual({ choiceCount: 4, counts: [2, 3], distractor: 'same-item-variant', request: 'count-attribute', support: 'audio-only' });
  });

  it('[AC-44] the schema rejects a count-attribute level without frames or with a single count, and a sequence level without frames', () => {
    const clone = () => JSON.parse(JSON.stringify(restaurant)) as Record<string, any>;
    expect(AnimalRestaurantContentSchema.safeParse(clone()).success).toBe(true);
    const noFrames = clone();
    delete noFrames.countAttributeFrames;
    expect(AnimalRestaurantContentSchema.safeParse(noFrames).success).toBe(false);
    const oneCount = clone();
    oneCount.adaptive.levels[9].counts = [2];
    expect(AnimalRestaurantContentSchema.safeParse(oneCount).success).toBe(false);
    const noSeq = clone();
    delete noSeq.sequenceFrames;
    expect(AnimalRestaurantContentSchema.safeParse(noSeq).success).toBe(false);
    const threePlates = clone();
    threePlates.adaptive.levels[9].choiceCount = 3;
    expect(AnimalRestaurantContentSchema.safeParse(threePlates).success).toBe(false);
  });
});

describe('[AC-45] L10 and L12: colour + count requests ("I want two green apples, please!")', () => {
  const eligible = eligibleTargetIds(items, L10);

  it('[AC-45] only foods with two plural colour variants and counted prompts are eligible (apple, banana, pear)', () => {
    expect(eligible.sort()).toEqual(['apple', 'banana', 'pear']);
    expect(eligibleTargetIds(items, L12).sort()).toEqual(['apple', 'banana', 'pear']);
  });

  for (const [name, level] of [['L10', L10], ['L12', L12]] as const) {
    it(`[AC-45] ${name}: one answer; the colour look-alike and the count look-alike are always on the table`, () => {
      for (const id of eligible)
        for (const lang of ['en', 'fr'] as const)
          for (let seed = 1; seed <= 25; seed++) {
            const r = buildRound(items, level, lang, seeded(seed), id, restaurant.twoStepFrames, [], extras);
            expect(r.request).toBe('count-attribute');
            expect(r.choices).toHaveLength(4);
            expect([2, 3]).toContain(r.target.count);
            expect(r.target.item.id).toBe(id);
            expect(r.target.color).toBeDefined();
            expect(r.choices.filter((c) => isCorrectChoice(c, r.target))).toHaveLength(1);
            // Colour look-alike: same food and count, other colour. Count look-alike: same food and colour, other count.
            expect(r.choices.some((c) => c.item.id === id && c.count === r.target.count && c.color !== r.target.color)).toBe(true);
            expect(r.choices.some((c) => c.item.id === id && c.color === r.target.color && c.count !== r.target.count)).toBe(true);
            if (name === 'L12') {
              // The whole table is the same food: both colours x both counts.
              expect(r.choices.every((c) => c.item.id === id)).toBe(true);
              expect(new Set(r.choices.map((c) => `${c.color}.${c.count}`)).size).toBe(4);
              expect(r.audioOnly).toBe(true);
            } else {
              expect(r.choices.filter((c) => c.item.id !== id)).toHaveLength(1);
              expect(r.audioOnly).toBe(false);
            }
            // The spoken line is registered with the same text.
            expect(r.lineId).toBe(`countattr.${id}.${r.target.color}.${r.target.count}.${lang}`);
            expect(voice.get(r.lineId)?.text).toBe(r.promptText);
          }
    });
  }

  it('[AC-45] request texts name the count and the coloured plural in both languages', () => {
    const apple = items.find((i) => i.id === 'apple')!;
    const green = apple.variants!.find((v) => v.color === 'green')!;
    expect(green.plural).toEqual({ en: 'green apples', fr: 'pommes vertes' });
    expect(voice.get('countattr.apple.green.2.en')?.text).toBe('I want two green apples, please!');
    expect(voice.get('countattr.apple.green.3.fr')?.text).toBe("Je voudrais trois pommes vertes, s'il te plaît !");
    expect(voice.get('countattr.banana.yellow.2.fr')?.text).toBe("Je voudrais deux bananes jaunes, s'il te plaît !");
  });
});

describe('[AC-46] L11: ordered two-item requests ("First an apple, then a banana, please!")', () => {
  it('[AC-46] two requested foods + two distractors; only the first food is servable first, then only the second', () => {
    for (const id of items.map((i) => i.id))
      for (const lang of ['en', 'fr'] as const)
        for (let seed = 1; seed <= 10; seed++) {
          const r = buildRound(items, L11, lang, seeded(seed), id, restaurant.twoStepFrames, [], extras);
          expect(r.request).toBe('sequence');
          expect(r.ordered).toBe(true);
          expect(r.targets).toHaveLength(2);
          expect(r.targets[0].item.id).toBe(id);
          expect(r.choices).toHaveLength(4);
          const [first, second] = r.targets;
          const firstPlate = r.choices.find((c) => isCorrectChoice(c, first))!;
          const secondPlate = r.choices.find((c) => isCorrectChoice(c, second))!;
          expect(isNextRequestedChoice(firstPlate, r, 0)).toBe(true);
          // The second food tapped first is out of order: a miss, even though it is requested.
          expect(isRequestedChoice(secondPlate, r.targets)).toBe(true);
          expect(isNextRequestedChoice(secondPlate, r, 0)).toBe(false);
          expect(isNextRequestedChoice(secondPlate, r, 1)).toBe(true);
          expect(r.choices.filter((c) => isNextRequestedChoice(c, r, 0))).toHaveLength(1);
          expect(r.lineId).toBe(`seq.${first.item.id}.${second.item.id}.${lang}`);
          expect(voice.get(r.lineId)?.text).toBe(r.promptText);
        }
  });

  it('[AC-46] the frames read naturally with articles and partitives', () => {
    expect(voice.get('seq.apple.banana.en')?.text).toBe('First an apple, then a banana, please!');
    expect(voice.get('seq.grapes.egg.fr')?.text).toBe("D'abord du raisin, puis un œuf, s'il te plaît !");
  });

  it('[AC-46] unordered requests (L7) still accept either food first', () => {
    const r = buildRound(items, levels[6], 'en', seeded(3), 'apple', restaurant.twoStepFrames, [], extras);
    expect(r.ordered).toBeUndefined();
    for (const t of r.targets) expect(isNextRequestedChoice(r.choices.find((c) => isCorrectChoice(c, t))!, r, 0)).toBe(true);
  });
});

describe('[AC-47] stretch voice lines and layout', () => {
  it('[AC-47] every stretch line is registered once in the TTS render list (no conflicts), and no L1-L9 id changes', () => {
    const { lines, conflicts } = enumerateGameVoiceLines();
    expect(conflicts).toEqual({});
    const ids = new Map(lines.map((l) => [l.id, l]));
    for (const l of voice.values()) {
      expect(ids.get(l.lineId)?.text).toBe(l.text);
      expect(l.text).not.toMatch(/[{}]/);
    }
    const n = items.length;
    expect([...voice.keys()].filter((id) => id.startsWith('seq.'))).toHaveLength(n * (n - 1) * 2);
    expect([...voice.keys()].filter((id) => id.startsWith('countattr.'))).toHaveLength(3 * 2 * 2 * 2);
  });

  it('[AC-47] four plates of up to three coloured foods stay >= 64 CSS px wide on a 360x800 phone, 800x360 phone and 1024x768 tablet', () => {
    const viewports = [
      { w: 360, h: 800 },
      { w: 800, h: 360 },
      { w: 1024, h: 768 },
      { w: 768, h: 1024 },
    ];
    for (const v of viewports) {
      const game = v.w >= v.h ? { width: 1280, height: 800 } : { width: 800, height: 1280 };
      const scale = Math.min(v.w / game.width, v.h / game.height);
      const layout = computeRestaurantLayout(game.width, game.height, 4);
      for (const hit of layout.plates.hits) {
        expect((hit.right - hit.left) * scale).toBeGreaterThanOrEqual(64);
        expect((hit.bottom - hit.top) * scale).toBeGreaterThanOrEqual(64);
        expect(hit.left).toBeGreaterThanOrEqual(0);
        expect(hit.right).toBeLessThanOrEqual(game.width);
      }
      // Three pieces still get a readable icon.
      expect(iconSizeFor(layout.plates.spacing, 3)).toBeGreaterThanOrEqual(56);
    }
  });
});
