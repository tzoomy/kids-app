import { describe, expect, it } from 'vitest';
import { loadWhosHiding, loadWorlds, loadAnimalRestaurant } from '@/content/loadContent';
import { WhosHidingContentSchema } from '@/content/schema';
import { skillKey } from '@/core/adaptive';
import { revealPart, hidingLevel } from '@/games/hiding/hidingRound';
import rawHiding from '@/content/games/who-is-hiding.json';

const content = loadWhosHiding();

function withLevel(index: number, patch: Record<string, unknown>) {
  const copy = JSON.parse(JSON.stringify(rawHiding));
  copy.adaptive.levels[index] = { ...copy.adaptive.levels[index], ...patch };
  return WhosHidingContentSchema.safeParse(copy);
}

describe("Who's Hiding? content schema", () => {
  it('validates and every animal has EN/FR name, sound, short sound and clue', () => {
    expect(content.animals.length).toBeGreaterThanOrEqual(6);
    for (const a of content.animals) {
      for (const lang of ['en', 'fr'] as const) {
        expect(a.name[lang]).toBeTruthy();
        expect(a.sound[lang]).toBeTruthy();
        expect(a.soundShort[lang]).toBeTruthy();
        expect(a.clue[lang]).toBeTruthy();
      }
    }
  });

  it('has 8 levels; age 2 starts at L2 and age 5 at L5, both with min 1 and max = levels.length (no age-2 ceiling)', () => {
    const { adaptive } = content;
    expect(adaptive.levels).toHaveLength(8);
    expect(adaptive.tracks.age2).toEqual({ start: 2, min: 1, max: 8 });
    expect(adaptive.tracks.age5).toEqual({ start: 5, min: 1, max: 8 });
  });

  it('the age-5 start is meaningfully harder than the age-2 start', () => {
    const a2 = hidingLevel(content.adaptive.levels[content.adaptive.tracks.age2.start - 1]);
    const a5 = hidingLevel(content.adaptive.levels[content.adaptive.tracks.age5.start - 1]);
    expect(a5.choiceCount).toBeGreaterThan(a2.choiceCount);
    expect(a5.reveal).toBeLessThan(a2.reveal);
    expect(a2.distractor).toBe('far');
    expect(a5.distractor).toBe('same-category');
    expect(a2.speak).toBe('name-sound');
    expect(a5.speak).toBe('name');
  });

  it('the level curve never gets easier: bushes up, reveal down, speech thinner', () => {
    const levels = content.adaptive.levels.map(hidingLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].choiceCount).toBeGreaterThanOrEqual(levels[i - 1].choiceCount);
      expect(levels[i].reveal).toBeLessThanOrEqual(levels[i - 1].reveal);
    }
    expect(levels[0].choiceCount).toBe(2);
    expect(levels[7].choiceCount).toBe(6);
    expect(levels.slice(0, 6).every((l) => !l.audioOnly)).toBe(true);
    expect(levels[6].audioOnly).toBe(true);
    expect(levels[7].audioOnly).toBe(true);
    expect(levels[7].shortSound).toBe(true);
    expect(levels[6].shortSound).toBe(false);
  });

  it('the reveal fraction maps to the visible part of the animal', () => {
    expect(revealPart(0.9)).toBe('whole');
    expect(revealPart(0.8)).toBe('body');
    expect(revealPart(0.6)).toBe('head');
    expect(revealPart(0.5)).toBe('head');
    expect(revealPart(0.3)).toBe('ears');
  });

  it('the skill key is distinct from the restaurant skill keys', () => {
    const restaurant = loadAnimalRestaurant();
    for (const lang of ['en', 'fr'] as const) {
      const hiding = skillKey(content.world, content.id, lang);
      expect(hiding).toBe(`nature-lab.who-is-hiding.${lang}`);
      expect(hiding).not.toBe(skillKey(restaurant.world, restaurant.id, lang));
    }
  });

  it('Nature Lab is open on the map and its entry game is Who\'s Hiding?', () => {
    const nature = loadWorlds().worlds.find((w) => w.id === 'nature-lab');
    expect(nature?.status).toBe('open');
    expect(nature?.entryGameId).toBe(content.id);
    expect(nature?.id).toBe(content.world);
  });

  it('rejects bad track bounds, missing levers and unsupported values', () => {
    const badBounds = JSON.parse(JSON.stringify(rawHiding));
    badBounds.adaptive.tracks.age2.max = 9;
    expect(WhosHidingContentSchema.safeParse(badBounds).success).toBe(false);
    expect(withLevel(0, { choiceCount: 1 }).success).toBe(false);
    expect(withLevel(0, { choiceCount: 7 }).success).toBe(false);
    expect(withLevel(0, { extra: { speak: 'name-sound' } }).success).toBe(false);
    expect(withLevel(0, { extra: { reveal: 1.5, speak: 'name' } }).success).toBe(false);
    expect(withLevel(0, { extra: { reveal: 0.5, speak: 'riddle' } }).success).toBe(false);
    expect(withLevel(0, { support: 'clue' }).success).toBe(false);
    expect(withLevel(0, { distractor: 'near' }).success).toBe(false);
    expect(withLevel(6, { extra: { reveal: 0.3, speak: 'name' } }).success).toBe(false); // audio-only must be sound-only
    expect(withLevel(0, { extra: { reveal: 0.9, speak: 'name-sound', soundMs: -1 } }).success).toBe(false);
    expect(withLevel(0, { bogus: 1 }).success).toBe(false);
  });

  it('rejects bad frames, duplicate animal ids and same-category without a look-alike group', () => {
    const badFrame = JSON.parse(JSON.stringify(rawHiding));
    badFrame.promptFrames.name.en = 'Where is it?';
    expect(WhosHidingContentSchema.safeParse(badFrame).success).toBe(false);

    const dup = JSON.parse(JSON.stringify(rawHiding));
    dup.animals[1].id = dup.animals[0].id;
    expect(WhosHidingContentSchema.safeParse(dup).success).toBe(false);

    const noPair = JSON.parse(JSON.stringify(rawHiding));
    noPair.animals.forEach((a: { group: string }, i: number) => (a.group = `g${i}`));
    expect(WhosHidingContentSchema.safeParse(noPair).success).toBe(false);
  });
});
