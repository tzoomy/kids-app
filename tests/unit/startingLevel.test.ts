import { describe, expect, it } from 'vitest';
import {
  CHALLENGING_LEVEL_OFFSET,
  START_FRENCH_HIGHER_OFFSET,
  buildMeta,
  initialSkill,
  startingLevel,
} from '@/core/adaptive';

// Mirrors letter-monster (age5 start 3, max 4) and a roomy game (age5 start 3, max 8).
const letterMonster = buildMeta({
  levelCount: 4,
  tracks: { age2: { start: 1, min: 1, max: 2 }, age5: { start: 3, min: 2, max: 4 } },
});
const roomy = buildMeta({
  levelCount: 8,
  tracks: { age2: { start: 2, min: 1, max: 8 }, age5: { start: 3, min: 1, max: 8 } },
});
const allOn = { startFrenchHigher: true, difficulty: 'challenging' as const };

describe('startingLevel', () => {
  it('exports the pending-decision offsets', () => {
    expect(START_FRENCH_HIGHER_OFFSET).toBe(1);
    expect(CHALLENGING_LEVEL_OFFSET).toBe(2);
  });

  it('returns the track start with no prefs or default prefs', () => {
    expect(startingLevel(roomy, 'age5', 'fr')).toBe(3);
    expect(startingLevel(roomy, 'age5', 'fr', {})).toBe(3);
    expect(startingLevel(roomy, 'age5', 'fr', { startFrenchHigher: false, difficulty: 'regular' })).toBe(3);
  });

  it('never shifts age2, even when the flags are on', () => {
    expect(startingLevel(roomy, 'age2', 'fr', allOn)).toBe(2);
    expect(startingLevel(roomy, 'age2', 'en', allOn)).toBe(2);
    expect(startingLevel(letterMonster, 'age2', 'fr', allOn)).toBe(1);
  });

  it('age5 challenging adds the challenging offset for both languages', () => {
    expect(startingLevel(roomy, 'age5', 'en', { difficulty: 'challenging' })).toBe(3 + CHALLENGING_LEVEL_OFFSET);
    expect(startingLevel(roomy, 'age5', 'fr', { difficulty: 'challenging' })).toBe(3 + CHALLENGING_LEVEL_OFFSET);
  });

  it('age5 French-higher adds its offset for fr only, never for en', () => {
    expect(startingLevel(roomy, 'age5', 'fr', { startFrenchHigher: true })).toBe(3 + START_FRENCH_HIGHER_OFFSET);
    expect(startingLevel(roomy, 'age5', 'en', { startFrenchHigher: true })).toBe(3);
  });

  it('the two offsets stack on fr; en gets only the challenging offset', () => {
    expect(startingLevel(roomy, 'age5', 'fr', allOn)).toBe(3 + CHALLENGING_LEVEL_OFFSET + START_FRENCH_HIGHER_OFFSET);
    expect(startingLevel(roomy, 'age5', 'en', allOn)).toBe(3 + CHALLENGING_LEVEL_OFFSET);
  });

  it('clamps to the track max (letter-monster age5 start 3, max 4)', () => {
    expect(startingLevel(letterMonster, 'age5', 'fr', { startFrenchHigher: true })).toBe(4);
    expect(startingLevel(letterMonster, 'age5', 'fr', allOn)).toBe(4);
    expect(startingLevel(letterMonster, 'age5', 'en', { difficulty: 'challenging' })).toBe(4);
  });

  it('clamps to the track min', () => {
    const low = buildMeta({ levelCount: 5, tracks: { age2: { start: 1, max: 2 }, age5: { start: 1, min: 3, max: 5 } } });
    expect(startingLevel(low, 'age5', 'en')).toBe(3);
  });

  it('does not touch the stored bounds (max never rises)', () => {
    startingLevel(letterMonster, 'age5', 'fr', allOn);
    expect(letterMonster.tracks.age5.max).toBe(4);
    expect(letterMonster.tracks.age2.max).toBe(2);
  });
});

describe('initialSkill with a start level', () => {
  it('stays backward compatible: omitted level means the track start', () => {
    expect(initialSkill(roomy, 'age5', '2026-11-23').level).toBe(3);
  });

  it('uses the given start level', () => {
    expect(initialSkill(roomy, 'age5', '2026-11-23', 5).level).toBe(5);
  });
});
