import { describe, expect, it } from 'vitest';
import { AdaptiveStore } from '../../src/core/storage/adaptiveStore';
import { adaptiveKey } from '../../src/core/storage/adaptiveSchema';
import type { StorageDriver } from '../../src/core/storage/store';
import type { SkillState } from '../../src/core/adaptive';

const OLD_EN = 'art-studio.kitchen-orchestra.en';
const OLD_FR = 'art-studio.kitchen-orchestra.fr';
const NEW_EN = 'language-house.kitchen-orchestra.en';
const NEW_FR = 'language-house.kitchen-orchestra.fr';
const RESTAURANT_EN = 'language-house.animal-restaurant.en';

const skill = (level: number): SkillState => ({
  level,
  cleanStreak: 1,
  recent: ['clean', 'miss'],
  afterDrop: false,
  lastPlayedDay: '2026-11-12',
  items: { 'pot+pan': { box: 3, seen: 4, clean: 3, lastSeenDay: '2026-11-12' } },
});

function memoryDriver(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const driver: StorageDriver = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
  return { driver, map };
}

const payload = (skills: Record<string, SkillState>) => JSON.stringify({ schemaVersion: 1, profileId: 'a', skills });
const stored = (map: Map<string, string>) => JSON.parse(map.get(adaptiveKey('a')) as string).skills as Record<string, SkillState>;

describe('adaptive skill-key migration art-studio -> language-house (kitchen-orchestra)', () => {
  it('serves stored art-studio progress under the language-house key without losing it', () => {
    const { driver } = memoryDriver({ [adaptiveKey('a')]: payload({ [OLD_EN]: skill(5), [OLD_FR]: skill(3) }) });
    const store = new AdaptiveStore(driver);
    expect(store.getSkill('a', NEW_EN)).toEqual(skill(5));
    expect(store.getSkill('a', NEW_FR)).toEqual(skill(3));
    expect(store.getSkill('a', OLD_EN)).toBeUndefined();
  });

  it('writes only the new keys on the next persist and is idempotent across reloads', () => {
    const { driver, map } = memoryDriver({ [adaptiveKey('a')]: payload({ [OLD_EN]: skill(5) }) });
    new AdaptiveStore(driver).persist('a');
    const first = map.get(adaptiveKey('a'));
    expect(Object.keys(stored(map))).toEqual([NEW_EN]);
    expect(stored(map)[NEW_EN]).toEqual(skill(5));

    const again = new AdaptiveStore(driver);
    expect(again.getSkill('a', NEW_EN)).toEqual(skill(5));
    again.persist('a');
    expect(map.get(adaptiveKey('a'))).toBe(first);
  });

  it('never overwrites progress already stored under the new key', () => {
    const { driver } = memoryDriver({ [adaptiveKey('a')]: payload({ [OLD_EN]: skill(2), [NEW_EN]: skill(6) }) });
    const store = new AdaptiveStore(driver);
    expect(store.getSkill('a', NEW_EN)).toEqual(skill(6));
    expect(store.getSkill('a', OLD_EN)).toBeUndefined();
  });

  it('leaves other skill keys (the restaurant) untouched', () => {
    const { driver } = memoryDriver({ [adaptiveKey('a')]: payload({ [RESTAURANT_EN]: skill(4), [OLD_EN]: skill(5) }) });
    const store = new AdaptiveStore(driver);
    expect(store.getSkill('a', RESTAURANT_EN)).toEqual(skill(4));
  });

  it('migrates each profile independently', () => {
    const { driver } = memoryDriver({
      [adaptiveKey('a')]: payload({ [OLD_EN]: skill(5) }),
      [adaptiveKey('b')]: JSON.stringify({ schemaVersion: 1, profileId: 'b', skills: { [OLD_EN]: skill(2) } }),
    });
    const store = new AdaptiveStore(driver);
    expect(store.getSkill('a', NEW_EN)).toEqual(skill(5));
    expect(store.getSkill('b', NEW_EN)).toEqual(skill(2));
  });

  it('does nothing for an empty or corrupt store', () => {
    expect(new AdaptiveStore(memoryDriver().driver).getSkill('a', NEW_EN)).toBeUndefined();
    const { driver } = memoryDriver({ [adaptiveKey('a')]: '{not json' });
    expect(new AdaptiveStore(driver).getSkill('a', NEW_EN)).toBeUndefined();
  });
});
