import { describe, expect, it } from 'vitest';
import { loadWorlds, loadAnimalRestaurant, loadAudioManifest } from '@/content/loadContent';
import { AnimalRestaurantContentSchema, WorldsFileSchema } from '@/content/schema';

describe('content schema validation', () => {
  it('worlds.json validates and includes an open Language House plus locked worlds', () => {
    const worlds = loadWorlds();
    const languageHouse = worlds.worlds.find((w) => w.id === 'language-house');
    expect(languageHouse?.status).toBe('open');
    expect(worlds.worlds.some((w) => w.status === 'locked')).toBe(true);
  });

  it('animal-restaurant.json validates and has at least 10 complete-sentence items', () => {
    const content = loadAnimalRestaurant();
    expect(content.items.length).toBeGreaterThanOrEqual(10);
    for (const item of content.items) {
      expect(item.prompts.en['1']).toBeTruthy();
      expect(item.prompts.fr['1']).toBeTruthy();
    }
  });

  it('the adaptive block: age2 starts at L4 (3 plates, quantities) with no ceiling; age5 starts at L5 (4 plates)', () => {
    const { adaptive } = loadAnimalRestaurant();
    expect(adaptive.levels).toHaveLength(9);
    const start2 = adaptive.levels[adaptive.tracks.age2.start - 1];
    expect(adaptive.tracks.age2.start).toBe(4);
    expect(start2.choiceCount).toBe(3);
    expect(start2.counts).toEqual([1, 2, 3]);
    expect(start2.request).toBe('quantity');
    expect(adaptive.tracks.age2.min).toBe(1);
    expect(adaptive.tracks.age2.max).toBe(adaptive.levels.length);
    expect(adaptive.tracks.age5.start).toBe(5);
    const start5 = adaptive.levels[adaptive.tracks.age5.start - 1];
    expect(start5.choiceCount).toBe(4);
    expect(start5.distractor).toBe('near');
    expect(start5.counts).toContain(2);
    expect(adaptive.tracks.age5.min).toBe(1);
  });

  it('rejects bad track bounds and levels without choiceCount', () => {
    const valid = JSON.parse(JSON.stringify(loadAnimalRestaurant())) as Record<string, any>;
    expect(AnimalRestaurantContentSchema.safeParse(valid).success).toBe(true);

    const badBounds = JSON.parse(JSON.stringify(valid));
    badBounds.adaptive.tracks.age5.start = 10;
    expect(AnimalRestaurantContentSchema.safeParse(badBounds).success).toBe(false);

    const unordered = JSON.parse(JSON.stringify(valid));
    unordered.adaptive.tracks.age2 = { start: 2, min: 3, max: 4 };
    expect(AnimalRestaurantContentSchema.safeParse(unordered).success).toBe(false);

    const noChoiceCount = JSON.parse(JSON.stringify(valid));
    delete noChoiceCount.adaptive.levels[0].choiceCount;
    expect(AnimalRestaurantContentSchema.safeParse(noChoiceCount).success).toBe(false);

    const onePlate = JSON.parse(JSON.stringify(valid));
    onePlate.adaptive.levels[0].choiceCount = 1;
    expect(AnimalRestaurantContentSchema.safeParse(onePlate).success).toBe(false);

    const tooManyPlates =JSON.parse(JSON.stringify(valid));
    tooManyPlates.adaptive.levels[0].choiceCount = valid.items.length + 1;
    expect(AnimalRestaurantContentSchema.safeParse(tooManyPlates).success).toBe(false);

    const unknownLever = JSON.parse(JSON.stringify(valid));
    unknownLever.adaptive.levels[0].bogus = 1;
    expect(AnimalRestaurantContentSchema.safeParse(unknownLever).success).toBe(false);
  });

  it('rejects content missing a required count "1" prompt', () => {
    const broken = {
      id: 'animal-restaurant',
      world: 'language-house',
      template: 'choice-serve',
      skill: 'listen-and-choose-food',
      languages: ['en'],
      earnsLeisure: true,
      ageTracks: {
        age2: { hintMode: 'demonstrate', hintDelayMs: 1000 },
        age5: { hintMode: 'repeat-then-demonstrate', hintDelayMs: 1000 },
      },
      thanks: { en: ['Thanks!'], fr: ['Merci!'] },
      helpTextHe: 'עזרה',
      items: [{ id: 'apple', he: 'תפוח', color: 'red', shape: 'apple', prompts: { en: {}, fr: { '1': 'x' } } }],
    };
    expect(() => AnimalRestaurantContentSchema.parse(broken)).toThrow();
  });

  it('the audio manifest loader strips internal comment keys', () => {
    const manifest = loadAudioManifest();
    expect(Object.keys(manifest)).not.toContain('_comment');
  });

  it('the audio manifest has a lineId per food, count, and language', () => {
    const manifest = loadAudioManifest();
    const restaurant = loadAnimalRestaurant();
    for (const item of restaurant.items) {
      for (const lang of ['en', 'fr'] as const) {
        for (const count of Object.keys(item.prompts[lang] ?? {})) {
          expect(manifest[`food.${item.id}.${count}.${lang}`]).toMatch(/\.mp3$/);
        }
      }
    }
    expect(manifest['thanks.en.0']).toBeTruthy();
    expect(manifest['thanks.fr.0']).toBeTruthy();
  });

  it('WorldsFileSchema rejects an empty world list', () => {
    expect(() => WorldsFileSchema.parse({ worlds: [] })).toThrow();
  });
});
