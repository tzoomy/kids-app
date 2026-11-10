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

  it('age2 track uses 2 choices and count 1 only; age5 allows up to 3 counts', () => {
    const content = loadAnimalRestaurant();
    expect(content.ageTracks.age2.choiceCount).toBe(2);
    expect(content.ageTracks.age2.counts).toEqual([1]);
    expect(content.ageTracks.age5.choiceCount).toBeGreaterThanOrEqual(3);
    expect(content.ageTracks.age5.counts).toContain(2);
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
        age2: { choiceCount: 2, counts: [1], hintMode: 'demonstrate', hintDelayMs: 1000 },
        age5: { choiceCount: 3, counts: [1, 2], hintMode: 'repeat-then-demonstrate', hintDelayMs: 1000 },
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

  it('WorldsFileSchema rejects an empty world list', () => {
    expect(() => WorldsFileSchema.parse({ worlds: [] })).toThrow();
  });
});
