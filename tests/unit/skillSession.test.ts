import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta, skillKey, type AgeTrack } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { adaptiveKey } from '@/core/storage/adaptiveSchema';
import { loadAnimalRestaurant } from '@/content/loadContent';
import type { StorageDriver } from '@/core/storage/store';

function memoryDriver() {
  const map = new Map<string, string>();
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

const restaurant = loadAnimalRestaurant();
const meta = buildMeta({
  levelCount: restaurant.adaptive.levels.length,
  tracks: restaurant.adaptive.tracks,
  rules: restaurant.adaptive.rules,
});
const IDS = restaurant.items.map((i) => i.id);

function make(driver: StorageDriver, track: AgeTrack, profileId = 'a') {
  const store = new AdaptiveStore(driver);
  const session = new SkillSession({
    store,
    profileId,
    track,
    world: 'language-house',
    gameId: 'animal-restaurant',
    meta,
    today: () => '2026-11-12',
    random: () => 0.3,
  });
  return { store, session };
}

describe('SkillSession', () => {
  it('starts at the track start level: age2 -> L1, age5 -> L4', () => {
    const { driver } = memoryDriver();
    expect(make(driver, 'age2').session.level('en')).toBe(1);
    expect(make(driver, 'age5').session.level('en')).toBe(4);
  });

  it('age2 has no ceiling: max equals the level count', () => {
    expect(meta.tracks.age2.max).toBe(meta.levelCount);
    expect(meta.tracks.age5.max).toBe(meta.levelCount);
  });

  it('persists after every recorded trial under its own key', () => {
    const { driver, map, writes } = memoryDriver();
    const { session } = make(driver, 'age5');
    session.record('en', { itemId: 'apple', firstTryCorrect: true, hinted: false });
    expect(writes()).toBe(1);
    session.record('en', { itemId: 'banana', firstTryCorrect: false, hinted: false });
    expect(writes()).toBe(2);
    expect([...map.keys()]).toEqual([adaptiveKey('a')]);
    const saved = JSON.parse(map.get(adaptiveKey('a'))!);
    expect(saved.skills[skillKey('language-house', 'animal-restaurant', 'en')].items.banana.box).toBe(1);
  });

  it('keeps languages as separate skills', () => {
    const { driver } = memoryDriver();
    const { session } = make(driver, 'age5');
    for (let i = 0; i < 3; i++) session.record('fr', { itemId: IDS[i], firstTryCorrect: true, hinted: false });
    expect(session.level('fr')).toBe(5);
    expect(session.level('en')).toBe(4);
  });

  it('endVisit closes a partial round (age2 change lands at round end) and persists', () => {
    const { driver, writes } = memoryDriver();
    const { session } = make(driver, 'age2');
    session.record('en', { itemId: IDS[0], firstTryCorrect: true, hinted: false });
    session.record('en', { itemId: IDS[1], firstTryCorrect: true, hinted: false });
    expect(session.atRoundBoundary('en')).toBe(false);
    const before = writes();
    session.endVisit();
    expect(session.atRoundBoundary('en')).toBe(true);
    expect(writes()).toBe(before + 1);
  });

  it('endVisit is idempotent: a second call changes nothing', () => {
    const { driver } = memoryDriver();
    const { session, store } = make(driver, 'age2');
    session.record('en', { itemId: IDS[0], firstTryCorrect: true, hinted: false });
    session.record('en', { itemId: IDS[1], firstTryCorrect: true, hinted: false });
    session.endVisit();
    const after = JSON.stringify(store.getProfile('a'));
    session.endVisit();
    expect(JSON.stringify(store.getProfile('a'))).toBe(after);
    expect(session.level('en')).toBe(1);
  });

  it('age2 climbs after a clean round of 3 and the level survives a reload', () => {
    const { driver } = memoryDriver();
    const first = make(driver, 'age2');
    for (let i = 0; i < 3; i++) first.session.record('en', { itemId: IDS[i], firstTryCorrect: true, hinted: false });
    expect(first.session.level('en')).toBe(2);
    expect(make(driver, 'age2').session.level('en')).toBe(2);
  });

  it('selectNextItem returns one of the candidates and consumes afterDrop', () => {
    const { driver } = memoryDriver();
    const { session, store } = make(driver, 'age5');
    expect(IDS).toContain(session.selectNextItem('en', IDS));
    // Two misses at age5 drop a level and arm afterDrop; the next pick prefers a known item.
    session.record('en', { itemId: IDS[0], firstTryCorrect: true, hinted: false });
    session.record('en', { itemId: IDS[1], firstTryCorrect: false, hinted: false });
    session.record('en', { itemId: IDS[2], firstTryCorrect: false, hinted: false });
    const key = session.key('en');
    expect(store.getSkill('a', key)?.afterDrop).toBe(true);
    session.selectNextItem('en', IDS);
    expect(store.getSkill('a', key)?.afterDrop).toBe(false);
  });

  it('re-clamps a stored level to the current track', () => {
    const { driver } = memoryDriver();
    const small = buildMeta({ levelCount: 5, tracks: { age2: { start: 1, max: 2 }, age5: { start: 4, max: 5 } } });
    const store = new AdaptiveStore(driver);
    store.setSkill('a', 'language-house.animal-restaurant.en', {
      level: 5, cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: '2026-11-12', items: {},
    });
    const session = new SkillSession({ store, profileId: 'a', track: 'age2', world: 'language-house', gameId: 'animal-restaurant', meta: small });
    expect(session.level('en')).toBe(2);
  });
});
