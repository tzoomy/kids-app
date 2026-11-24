import { describe, expect, it } from 'vitest';
import { buildMeta, skillKey, type SkillState } from '@/core/adaptive';
import { buildSkillMetaIndex, liftProfileSkills, liftScopeFor, liftStartedSkills } from '@/core/adaptive/startFloor';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';

// Roomy game (age5 start 5, max 12 like Animal Restaurant) and a tight one (age5 start 3, max 8 like Letter Monster).
const roomy = buildMeta({ levelCount: 12, tracks: { age2: { start: 4, min: 1, max: 9 }, age5: { start: 5, min: 1, max: 12 } } });
const tight = buildMeta({ levelCount: 8, tracks: { age2: { start: 1, min: 1, max: 2 }, age5: { start: 3, min: 2, max: 8 } } });
const index = buildSkillMetaIndex([
  { world: 'language-house', gameId: 'roomy', languages: ['en', 'fr'], meta: roomy },
  { world: 'language-house', gameId: 'tight', languages: ['en', 'fr'], meta: tight },
]);
const k = (game: string, lang: string): string => skillKey('language-house', game, lang);

function skill(level: number): SkillState {
  return {
    level,
    cleanStreak: 2,
    recent: ['clean', 'miss'],
    afterDrop: true,
    lastPlayedDay: '2026-11-20',
    items: { apple: { box: 3, seen: 4, clean: 3, lastSeenDay: '2026-11-20' } },
  };
}
const levels = (skills: Record<string, SkillState>): Record<string, number> =>
  Object.fromEntries(Object.entries(skills).map(([key, s]) => [key, s.level]));

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, v) => void map.set(key, v) };
}

describe('liftScopeFor', () => {
  it('[AC-03] difficulty regular -> challenging lifts every language; [AC-04] French-higher off -> on lifts fr only', () => {
    expect(liftScopeFor('age5', { difficulty: 'regular', startFrenchHigher: false }, { difficulty: 'challenging', startFrenchHigher: false })).toBe('all');
    expect(liftScopeFor('age5', { difficulty: 'regular', startFrenchHigher: false }, { difficulty: 'regular', startFrenchHigher: true })).toBe('fr');
    expect(liftScopeFor('age5', { difficulty: 'regular', startFrenchHigher: false }, { difficulty: 'challenging', startFrenchHigher: true })).toBe('all');
  });

  it('[AC-07] turning an option off, or changing nothing, never lifts', () => {
    expect(liftScopeFor('age5', { difficulty: 'challenging', startFrenchHigher: true }, { difficulty: 'regular', startFrenchHigher: true })).toBeNull();
    expect(liftScopeFor('age5', { difficulty: 'regular', startFrenchHigher: true }, { difficulty: 'regular', startFrenchHigher: false })).toBeNull();
    expect(liftScopeFor('age5', { difficulty: 'challenging', startFrenchHigher: false }, { difficulty: 'challenging', startFrenchHigher: false })).toBeNull();
  });

  it('[AC-06] age2 never lifts, even when the flags change', () => {
    expect(liftScopeFor('age2', { difficulty: 'regular', startFrenchHigher: false }, { difficulty: 'challenging', startFrenchHigher: true })).toBeNull();
  });
});

describe('liftStartedSkills', () => {
  it('[AC-03] challenging lifts every started skill below the new floor (+2), keeps history, never lowers, clamps to age5 max', () => {
    const skills = {
      [k('roomy', 'en')]: skill(5), // floor 7 -> 7
      [k('roomy', 'fr')]: skill(9), // above floor, untouched
      [k('tight', 'en')]: skill(3), // floor 5 -> 5
      [k('tight', 'fr')]: skill(8), // at ceiling, untouched
    };
    const { skills: next, lifted } = liftStartedSkills(skills, index, 'age5', { difficulty: 'challenging' }, 'all');
    expect(levels(next)).toEqual({ [k('roomy', 'en')]: 7, [k('roomy', 'fr')]: 9, [k('tight', 'en')]: 5, [k('tight', 'fr')]: 8 });
    expect([...lifted].sort()).toEqual([k('roomy', 'en'), k('tight', 'en')].sort());
    expect(next[k('roomy', 'en')]).toEqual({ ...skills[k('roomy', 'en')], level: 7 });
    expect(skills[k('roomy', 'en')].level).toBe(5); // input not mutated
  });

  it('[AC-03] clamps the lifted level to the game age5 ceiling', () => {
    const tightCeiling = buildMeta({ levelCount: 8, tracks: { age2: { start: 1, min: 1, max: 2 }, age5: { start: 6, min: 2, max: 7 } } });
    const idx = buildSkillMetaIndex([{ world: 'w', gameId: 'g', languages: ['en'], meta: tightCeiling }]);
    const { skills } = liftStartedSkills({ 'w.g.en': skill(6) }, idx, 'age5', { difficulty: 'challenging' }, 'all');
    expect(skills['w.g.en'].level).toBe(7);
  });

  it('[AC-04] French-higher lifts started fr skills (+1) and never en skills', () => {
    const skills = { [k('roomy', 'en')]: skill(5), [k('roomy', 'fr')]: skill(5), [k('tight', 'fr')]: skill(3), [k('tight', 'en')]: skill(3) };
    const { skills: next, lifted } = liftStartedSkills(skills, index, 'age5', { startFrenchHigher: true }, 'fr');
    expect(levels(next)).toEqual({ [k('roomy', 'en')]: 5, [k('roomy', 'fr')]: 6, [k('tight', 'fr')]: 4, [k('tight', 'en')]: 3 });
    expect(lifted).toHaveLength(2);
  });

  it('[AC-04] a French-higher lift leaves an en skill alone even when challenging is already on and it sits below that floor', () => {
    const { skills } = liftStartedSkills({ [k('roomy', 'en')]: skill(5) }, index, 'age5', { difficulty: 'challenging', startFrenchHigher: true }, 'fr');
    expect(skills[k('roomy', 'en')].level).toBe(5);
  });

  it('[AC-05] both options stack: all langs +2, fr +3, then clamp', () => {
    const skills = { [k('roomy', 'en')]: skill(5), [k('roomy', 'fr')]: skill(5), [k('tight', 'en')]: skill(3), [k('tight', 'fr')]: skill(3) };
    const { skills: next } = liftStartedSkills(skills, index, 'age5', { difficulty: 'challenging', startFrenchHigher: true }, 'all');
    expect(levels(next)).toEqual({ [k('roomy', 'en')]: 7, [k('roomy', 'fr')]: 8, [k('tight', 'en')]: 5, [k('tight', 'fr')]: 6 });
    const capped = buildMeta({ levelCount: 8, tracks: { age2: { start: 1, min: 1, max: 2 }, age5: { start: 6, min: 2, max: 7 } } });
    const idx = buildSkillMetaIndex([{ world: 'w', gameId: 'g', languages: ['fr'], meta: capped }]);
    expect(liftStartedSkills({ 'w.g.fr': skill(6) }, idx, 'age5', { difficulty: 'challenging', startFrenchHigher: true }, 'all').skills['w.g.fr'].level).toBe(7);
  });

  it('[AC-06] age2 skills are never rewritten, even with the flags on', () => {
    const skills = { [k('roomy', 'en')]: skill(2), [k('roomy', 'fr')]: skill(2) };
    for (const scope of ['all', 'fr'] as const) {
      const out = liftStartedSkills(skills, index, 'age2', { difficulty: 'challenging', startFrenchHigher: true }, scope);
      expect(out.skills).toBe(skills);
      expect(out.lifted).toEqual([]);
    }
  });

  it('[AC-07] never lowers a skill and never creates keys for unstarted games; unknown keys are left alone', () => {
    const skills = { [k('roomy', 'en')]: skill(11), 'legacy.unknown.en': skill(1), [k('roomy', 'de')]: skill(1) };
    const out = liftStartedSkills(skills, index, 'age5', { difficulty: 'challenging', startFrenchHigher: true }, 'all');
    expect(levels(out.skills)).toEqual({ [k('roomy', 'en')]: 11, 'legacy.unknown.en': 1, [k('roomy', 'de')]: 1 });
    expect(Object.keys(out.skills).sort()).toEqual(Object.keys(skills).sort());
    expect(out.lifted).toEqual([]);
    expect(liftStartedSkills({}, index, 'age5', { difficulty: 'challenging' }, 'all').skills).toEqual({});
  });

  it('[AC-07] regular prefs with scope "all" are a no-op (the floor is the age5 start, no skill is below it)', () => {
    const skills = { [k('roomy', 'en')]: skill(5), [k('tight', 'en')]: skill(3) };
    expect(liftStartedSkills(skills, index, 'age5', { difficulty: 'regular' }, 'all').lifted).toEqual([]);
  });
});

describe('liftProfileSkills (store wiring)', () => {
  function seeded(): AdaptiveStore {
    const store = new AdaptiveStore(memoryDriver());
    store.setSkill('a', k('roomy', 'en'), skill(2));
    store.setSkill('a', k('roomy', 'fr'), skill(2));
    store.setSkill('b', k('roomy', 'en'), skill(5));
    store.setSkill('b', k('roomy', 'fr'), skill(5));
    return store;
  }

  it('[AC-03] lifts only the named profile, persists immediately, creates no keys', () => {
    const driver = memoryDriver();
    const store = new AdaptiveStore(driver);
    store.setSkill('a', k('roomy', 'en'), skill(2));
    store.setSkill('b', k('roomy', 'en'), skill(5));
    const count = liftProfileSkills(store, 'b', index, 'age5', { difficulty: 'challenging' }, 'all');
    expect(count).toBe(1);
    expect(store.getSkill('b', k('roomy', 'en'))?.level).toBe(7);
    expect(store.getSkill('b', k('roomy', 'fr'))).toBeUndefined();
    expect(JSON.parse(driver.getItem('kids-app-adaptive:b')!).skills[k('roomy', 'en')].level).toBe(7);
    expect(store.getSkill('a', k('roomy', 'en'))?.level).toBe(2);
    expect(driver.getItem('kids-app-adaptive:a')).toBeNull();
  });

  it('[AC-06] a lift on profile b never touches profile a (age2), and an age2 call on a is a no-op', () => {
    const store = seeded();
    liftProfileSkills(store, 'b', index, 'age5', { difficulty: 'challenging', startFrenchHigher: true }, 'all');
    expect(levels(store.getProfile('a').skills)).toEqual({ [k('roomy', 'en')]: 2, [k('roomy', 'fr')]: 2 });
    expect(liftProfileSkills(store, 'a', index, 'age2', { difficulty: 'challenging', startFrenchHigher: true }, 'all')).toBe(0);
    expect(levels(store.getProfile('a').skills)).toEqual({ [k('roomy', 'en')]: 2, [k('roomy', 'fr')]: 2 });
  });

  it('[AC-07] does not persist anything when nothing was lifted', () => {
    const driver = memoryDriver();
    const store = new AdaptiveStore(driver);
    store.setSkill('b', k('roomy', 'en'), skill(11));
    expect(liftProfileSkills(store, 'b', index, 'age5', { difficulty: 'challenging' }, 'all')).toBe(0);
    expect(driver.getItem('kids-app-adaptive:b')).toBeNull();
  });
});

describe('AdaptiveStore.clearSkills', () => {
  it('[AC-08] empties one profile (persisted on persist()), and leaves other profiles alone', () => {
    const driver = memoryDriver();
    const store = new AdaptiveStore(driver);
    store.setSkill('a', k('roomy', 'en'), skill(2));
    store.setSkill('b', k('roomy', 'en'), skill(5));
    store.persist('a');
    store.persist('b');
    store.clearSkills('b');
    store.persist('b');
    expect(store.getProfile('b').skills).toEqual({});
    expect(JSON.parse(driver.getItem('kids-app-adaptive:b')!).skills).toEqual({});
    expect(store.getSkill('a', k('roomy', 'en'))?.level).toBe(2);
    expect(JSON.parse(driver.getItem('kids-app-adaptive:a')!).skills[k('roomy', 'en')].level).toBe(2);
    expect(new AdaptiveStore(driver).getProfile('b').skills).toEqual({});
  });
});
