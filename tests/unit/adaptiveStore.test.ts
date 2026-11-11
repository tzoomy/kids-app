import { describe, expect, it } from 'vitest';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { adaptiveKey, parseAdaptiveProfile } from '@/core/storage/adaptiveSchema';
import type { StorageDriver } from '@/core/storage/store';
import type { SkillState } from '@/core/adaptive';

function memoryDriver(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  let writes = 0;
  const driver: StorageDriver = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      writes++;
      map.set(k, v);
    },
  };
  return { driver, map, writes: () => writes };
}

const skill = (level = 2): SkillState => ({
  level,
  cleanStreak: 1,
  recent: ['clean', 'miss'],
  afterDrop: false,
  lastPlayedDay: '2026-11-12',
  items: { apple: { box: 3, seen: 4, clean: 3, lastSeenDay: '2026-11-12' } },
});

const KEY = 'language-house.animal-restaurant.en';

describe('AdaptiveStore', () => {
  it('uses defaults when the key is empty', () => {
    const { driver } = memoryDriver();
    const store = new AdaptiveStore(driver);
    expect(store.getProfile('a')).toEqual({ schemaVersion: 1, profileId: 'a', skills: {} });
    expect(store.getSkill('a', KEY)).toBeUndefined();
  });

  it('round-trips through the driver', () => {
    const { driver } = memoryDriver();
    const store = new AdaptiveStore(driver);
    store.setSkill('a', KEY, skill(3));
    store.persist('a');
    const reloaded = new AdaptiveStore(driver);
    expect(reloaded.getSkill('a', KEY)).toEqual(skill(3));
  });

  it('works without a driver (in memory only)', () => {
    const store = new AdaptiveStore(null);
    store.setSkill('a', KEY, skill());
    expect(() => store.persist('a')).not.toThrow();
    expect(store.getSkill('a', KEY)?.level).toBe(2);
  });

  it('falls back to defaults on corrupt JSON, and the next write replaces it', () => {
    const { driver, map } = memoryDriver({ [adaptiveKey('a')]: '{not json' });
    const store = new AdaptiveStore(driver);
    expect(store.getProfile('a').skills).toEqual({});
    store.setSkill('a', KEY, skill());
    store.persist('a');
    expect(JSON.parse(map.get(adaptiveKey('a'))!).skills[KEY].level).toBe(2);
  });

  it('uses defaults for a future schemaVersion and never writes', () => {
    const future = JSON.stringify({ schemaVersion: 2, profileId: 'a', skills: { [KEY]: skill(5) }, newField: true });
    const { driver, map, writes } = memoryDriver({ [adaptiveKey('a')]: future });
    const store = new AdaptiveStore(driver);
    expect(store.getProfile('a').skills).toEqual({});
    store.setSkill('a', KEY, skill(1));
    store.persist('a');
    expect(writes()).toBe(0);
    expect(map.get(adaptiveKey('a'))).toBe(future);
  });

  it('drops malformed skill entries one by one and malformed items inside a skill', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      profileId: 'a',
      skills: {
        good: skill(2),
        badLevel: { ...skill(), level: 0 },
        badRecent: { ...skill(), recent: ['clean', 'bogus'] },
        notObject: 7,
        mixedItems: { ...skill(), items: { ok: skill().items.apple, broken: { box: 9 } } },
      },
    });
    const { profile } = parseAdaptiveProfile(raw, 'a');
    expect(Object.keys(profile.skills).sort()).toEqual(['good', 'mixedItems']);
    expect(Object.keys(profile.skills.mixedItems.items)).toEqual(['ok']);
  });

  it('keeps profiles isolated under separate keys', () => {
    const { driver, map } = memoryDriver();
    const store = new AdaptiveStore(driver);
    store.setSkill('a', KEY, skill(2));
    store.persist('a');
    store.setSkill('b', KEY, skill(4));
    store.persist('b');
    expect([...map.keys()].sort()).toEqual(['kids-app-adaptive:a', 'kids-app-adaptive:b']);
    const fresh = new AdaptiveStore(driver);
    expect(fresh.getSkill('a', KEY)?.level).toBe(2);
    expect(fresh.getSkill('b', KEY)?.level).toBe(4);
  });

  it('survives a driver that throws', () => {
    const throwing: StorageDriver = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    const store = new AdaptiveStore(throwing);
    store.setSkill('a', KEY, skill());
    expect(() => store.persist('a')).not.toThrow();
  });
});

describe('stored day strings', () => {
  const payload = (s: unknown) => JSON.stringify({ schemaVersion: 1, profileId: 'a', skills: { [KEY]: s } });

  it('drops an item with a malformed lastSeenDay and keeps the rest', () => {
    const bad = { ...skill(), items: { ...skill().items, pear: { box: 2, seen: 1, clean: 0, lastSeenDay: 'yesterday' } } };
    const { profile } = parseAdaptiveProfile(payload(bad), 'a');
    expect(Object.keys(profile.skills[KEY].items)).toEqual(['apple']);
  });

  it('drops a skill with a malformed lastPlayedDay', () => {
    for (const day of ['', '2026-1-2', '2026-13-45', 'not-a-day']) {
      const { profile } = parseAdaptiveProfile(payload({ ...skill(), lastPlayedDay: day }), 'a');
      expect(profile.skills[KEY]).toBeUndefined();
    }
  });

  it('accepts a well-formed day', () => {
    expect(parseAdaptiveProfile(payload(skill()), 'a').profile.skills[KEY]).toBeDefined();
  });
});

describe('migrations', () => {
  it('invokes the chain for an older version (stub v0 fixture)', () => {
    const v0 = JSON.stringify({ schemaVersion: 0, levels: { [KEY]: 3 } });
    let calls = 0;
    const migrations = {
      0: (old: unknown) => {
        calls++;
        const o = old as { levels: Record<string, number> };
        const skills: Record<string, SkillState> = {};
        for (const [k, level] of Object.entries(o.levels)) skills[k] = skill(level);
        return { schemaVersion: 1, profileId: 'a', skills };
      },
    };
    const { profile, writable } = parseAdaptiveProfile(v0, 'a', migrations);
    expect(calls).toBe(1);
    expect(writable).toBe(true);
    expect(profile.skills[KEY].level).toBe(3);
  });

  it('uses defaults when a migration is missing or does not advance the version', () => {
    const v0 = JSON.stringify({ schemaVersion: 0 });
    expect(parseAdaptiveProfile(v0, 'a', {}).profile.skills).toEqual({});
    const stuck = { 0: (o: unknown) => o };
    expect(parseAdaptiveProfile(v0, 'a', stuck).profile.skills).toEqual({});
  });
});
