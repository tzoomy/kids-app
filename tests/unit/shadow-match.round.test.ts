import { describe, expect, it } from 'vitest';
import { loadShadowMatch, loadWhosHiding } from '@/content/loadContent';
import { ShadowMatchContentSchema } from '@/content/schema';
import { buildShadowRound, isCorrectShadow, promptFor, revealFor, shadowLevel } from '@/games/hiding/shadowRound';
import { skillKey } from '@/core/adaptive';
import rawShadow from '@/content/games/shadow-match.json';
import rawHiding from '@/content/games/who-is-hiding.json';

const shadow = loadShadowMatch();
const hiding = loadWhosHiding();
const animals = hiding.animals;
const levels = shadow.adaptive.levels;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('shadow-match: content (AC-09, AC-17)', () => {
  it('[AC-09] every Who\'s Hiding? animal has a Hebrew name and the content parses', () => {
    for (const a of animals) expect(shadow.namesHe[a.id]).toBeTruthy();
    expect(ShadowMatchContentSchema.safeParse(rawShadow).success).toBe(true);
  });

  it('[AC-09] the schema rejects a level with more silhouettes than allowed and a frame without its placeholder', () => {
    const bad = structuredClone(rawShadow) as typeof rawShadow;
    bad.adaptive.levels[0].choiceCount = 7;
    expect(ShadowMatchContentSchema.safeParse(bad).success).toBe(false);
    const badFrame = structuredClone(rawShadow) as typeof rawShadow;
    badFrame.promptFrames.sound.en = 'Who is it?';
    expect(ShadowMatchContentSchema.safeParse(badFrame).success).toBe(false);
  });

  it('[AC-17] Shadow Match reuses the Who\'s Hiding? animals with its own skill key, and Who\'s Hiding? is unchanged', () => {
    expect(shadow.animalsFrom).toBe('who-is-hiding');
    expect(shadow.world).toBe(hiding.world);
    expect(skillKey(shadow.world, shadow.id, 'en')).toBe('nature-lab.shadow-match.en');
    expect(skillKey(hiding.world, hiding.id, 'en')).toBe('nature-lab.who-is-hiding.en');
    expect(hiding.adaptive.levels).toHaveLength(8);
    expect(hiding.adaptive.tracks).toEqual(rawHiding.adaptive.tracks);
  });
});

describe('shadow-match: levels and cues (AC-07, AC-09)', () => {
  it('[AC-07] age 2 starts at L1 with two silhouettes and only ever gets the sound cue', () => {
    const { age2 } = shadow.adaptive.tracks;
    expect(age2.start).toBe(1);
    expect(shadowLevel(levels[age2.start - 1]).choiceCount).toBe(2);
    for (let l = age2.min; l <= age2.max; l++) expect(shadowLevel(levels[l - 1]).speak).toBe('sound');
  });

  it('[AC-07] age 5 starts at L5 with a name-only cue and reaches six silhouettes with a short sound', () => {
    const { age5 } = shadow.adaptive.tracks;
    expect(age5.start).toBe(5);
    expect(shadowLevel(levels[4]).speak).toBe('name');
    const top = shadowLevel(levels[age5.max - 1]);
    expect(top.choiceCount).toBe(6);
    expect(top.shortSound).toBe(true);
    const cues = new Set(levels.slice(age5.min - 1, age5.max).map((d) => shadowLevel(d).speak));
    expect(cues).toEqual(new Set(['sound', 'name']));
  });

  it('[AC-09] silhouette counts never fall as the level rises', () => {
    const counts = levels.map((d) => shadowLevel(d).choiceCount);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
  });
});

describe('shadow-match: buildShadowRound (AC-09)', () => {
  it('[AC-09] the target is among distinct silhouettes and the count follows the level, on every level and target', () => {
    for (let l = 1; l <= levels.length; l++) {
      for (const target of animals) {
        const r = buildShadowRound(shadow, animals, levels[l - 1], 'en', target.id, seeded(l * 31 + target.id.length));
        const ids = r.choices.map((c) => c.id);
        expect(ids).toContain(target.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(shadowLevel(levels[l - 1]).choiceCount);
        expect(r.target.id).toBe(target.id);
      }
    }
  });

  it('[AC-09] same-category levels put the look-alike next to the target; far levels avoid it at two silhouettes', () => {
    const cat = animals.find((a) => a.id === 'cat')!;
    const sameLevel = levels.findIndex((d) => d.distractor === 'same-category');
    const r = buildShadowRound(shadow, animals, levels[sameLevel], 'en', 'cat', seeded(7));
    expect(r.choices.some((c) => c.id !== 'cat' && c.group === cat.group)).toBe(true);
    for (let s = 1; s < 20; s++) {
      const far = buildShadowRound(shadow, animals, levels[0], 'fr', 'cat', seeded(s));
      expect(far.choices.find((c) => c.id !== 'cat')!.group).not.toBe(cat.group);
    }
  });

  it('[AC-09] sound and name cues read in English and French with stable line ids', () => {
    const cat = animals.find((a) => a.id === 'cat')!;
    const soundRound = buildShadowRound(shadow, animals, levels[0], 'en', 'cat', seeded(3));
    expect(soundRound.promptText).toBe(`${cat.sound.en} Who is it?`);
    expect(soundRound.lineId).toBe('shadow.cat.sound.en');
    const nameRound = buildShadowRound(shadow, animals, levels[4], 'fr', 'cat', seeded(3));
    expect(nameRound.promptText).toBe(`Trouve ${cat.name.fr} !`);
    expect(nameRound.lineId).toBe('shadow.cat.name.fr');
    const shortRound = buildShadowRound(shadow, animals, levels[7], 'en', 'cat', seeded(3));
    expect(shortRound.promptText).toBe(promptFor(shadow, cat, 'en', shadowLevel(levels[7])));
    expect(shortRound.promptText).toContain(cat.soundShort.en);
    expect(shortRound.lineId).toBe('shadow.cat.sound-short.en');
  });

  it('[AC-09] the reveal names the animal in the learning language, then in Hebrew', () => {
    const cat = animals.find((a) => a.id === 'cat')!;
    expect(revealFor(shadow, cat, 'en')).toEqual({ text: `It's ${cat.name.en}!`, textHe: 'זה חתול!' });
    const r = buildShadowRound(shadow, animals, levels[1], 'fr', 'cat', seeded(5));
    expect(r.revealText).toBe(`C'est ${cat.name.fr} !`);
    expect(r.revealLineId).toBe('shadow.cat.reveal.fr');
    expect(r.revealLineIdHe).toBe('he.shadow.cat');
    for (const a of animals) expect(revealFor(shadow, a, 'en').text).not.toContain('{');
  });

  it('[AC-09] only the requested animal is correct', () => {
    expect(isCorrectShadow('cat', 'cat')).toBe(true);
    expect(isCorrectShadow('lion', 'cat')).toBe(false);
  });
});
