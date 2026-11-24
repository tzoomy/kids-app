import { beforeEach, describe, expect, it } from 'vitest';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { buildSkillMetaIndex, skillKey, type SkillState } from '@/core/adaptive';
import { defaultAppState, type AppState } from '@/core/storage/schema';
import type { StorageDriver } from '@/core/storage/store';
import { collectParentLevelGames } from '@/ui/parentLevels';
import { commitProfileEdit, resetProfileProgress } from '@/ui/parentProfileEdits';
import type { ParentProfileEdit } from '@/ui/parent';
import { loadAnimalRestaurant, loadLetterMonster, loadLeisureColouring, loadStickerBoard, loadTravelSuitcase, loadWordTrain, loadWorlds } from '@/content/loadContent';

// Real content: Animal Restaurant age5 5..12, Letter Monster age5 start 3, max 8 (tight ceiling).
const bundle = {
  worlds: loadWorlds(),
  restaurant: loadAnimalRestaurant(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  wordTrain: loadWordTrain(),
  colouring: loadLeisureColouring(),
  stickers: loadStickerBoard(),
};
const games = collectParentLevelGames(bundle as unknown as Record<string, unknown>);
const index = buildSkillMetaIndex(games);

const REST = (lang: string): string => skillKey('language-house', 'animal-restaurant', lang);
const LM = (lang: string): string => skillKey('language-house', 'letter-monster', lang);

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}
function skill(level: number): SkillState {
  return { level, cleanStreak: 1, recent: ['clean'], afterDrop: false, lastPlayedDay: '2026-11-20', items: { apple: { box: 2, seen: 2, clean: 2, lastSeenDay: '2026-11-20' } } };
}

let state: AppState;
let driver: StorageDriver;
let adaptive: AdaptiveStore;

const profile = (id: string): AppState['profiles'][number] => state.profiles.find((p) => p.id === id)!;
function editOf(id: string, change: Partial<ParentProfileEdit> = {}): ParentProfileEdit {
  const p = profile(id);
  return {
    id,
    name: p.name,
    ageTrack: p.ageTrack,
    languages: p.languages ?? 'both',
    startFrenchHigher: p.startFrenchHigher === true,
    difficulty: p.difficulty ?? 'regular',
    ...change,
  };
}
const commit = (edit: ParentProfileEdit): number => commitProfileEdit(state, edit, adaptive, index);
const lv = (id: string, key: string): number | undefined => adaptive.getSkill(id, key)?.level;

beforeEach(() => {
  state = defaultAppState();
  driver = memoryDriver();
  adaptive = new AdaptiveStore(driver);
  // a = age2 (Shai), b = age5 (Elli)
  for (const id of ['a', 'b']) {
    adaptive.setSkill(id, REST('en'), skill(3));
    adaptive.setSkill(id, REST('fr'), skill(3));
    adaptive.setSkill(id, LM('en'), skill(2));
    adaptive.setSkill(id, LM('fr'), skill(2));
  }
});

describe('skill index of the content bundle', () => {
  it('[AC-07] covers every adaptive game once per language and skips leisure-only games', () => {
    expect(index.has(LM('en')) && index.has(LM('fr')) && index.has(REST('en')) && index.has(REST('fr'))).toBe(true);
    expect(index.has(skillKey('language-house', 'word-train', 'en'))).toBe(true);
    expect([...index.keys()].some((k) => k.includes('colouring') || k.includes('sticker-board'))).toBe(false);
  });
});

describe('commitProfileEdit: lifting started skills', () => {
  it('[AC-03] age5 regular -> challenging raises every started skill below the floor, clamped to the game ceiling, and persists at once', () => {
    adaptive.setSkill('b', REST('fr'), skill(11));
    adaptive.setSkill('b', LM('fr'), skill(8));
    commit(editOf('b', { difficulty: 'challenging' }));
    expect(profile('b').difficulty).toBe('challenging');
    expect(lv('b', REST('en'))).toBe(7);
    expect(lv('b', LM('en'))).toBe(5);
    expect(lv('b', REST('fr'))).toBe(11);
    expect(lv('b', LM('fr'))).toBe(8);
    expect(JSON.parse(driver.getItem('kids-app-adaptive:b')!).skills[REST('en')].level).toBe(7);
    expect(adaptive.getSkill('b', REST('en'))?.items).toEqual(skill(3).items);
  });

  it('[AC-04] turning French-higher on raises started fr skills only (restaurant 5 -> 6, letter-monster 3 -> 4)', () => {
    commit(editOf('b', { startFrenchHigher: true }));
    expect(lv('b', REST('fr'))).toBe(5 + 1);
    expect(lv('b', LM('fr'))).toBe(3 + 1);
    expect(lv('b', REST('en'))).toBe(3);
    expect(lv('b', LM('en'))).toBe(2);
  });

  it('[AC-05] both options stack: en +2, fr +3, clamped to the age5 ceiling', () => {
    commit(editOf('b', { startFrenchHigher: true }));
    commit(editOf('b', { startFrenchHigher: true, difficulty: 'challenging' }));
    expect(lv('b', REST('en'))).toBe(7);
    expect(lv('b', REST('fr'))).toBe(8);
    expect(lv('b', LM('en'))).toBe(5);
    expect(lv('b', LM('fr'))).toBe(6);
    adaptive.setSkill('b', LM('fr'), skill(7));
    commit(editOf('b', { startFrenchHigher: false }));
    commit(editOf('b', { startFrenchHigher: true }));
    expect(lv('b', LM('fr'))).toBe(7);
  });

  it('[AC-06] an age2 profile is never rewritten, even with the flags toggled on', () => {
    commit(editOf('a', { difficulty: 'challenging', startFrenchHigher: true }));
    expect(profile('a').difficulty).toBe('challenging');
    expect([lv('a', REST('en')), lv('a', REST('fr')), lv('a', LM('en')), lv('a', LM('fr'))]).toEqual([3, 3, 2, 2]);
  });

  it('[AC-06] lifting profile b never touches profile a, in memory or in storage', () => {
    commit(editOf('b', { difficulty: 'challenging', startFrenchHigher: true }));
    expect([lv('a', REST('en')), lv('a', REST('fr')), lv('a', LM('en')), lv('a', LM('fr'))]).toEqual([3, 3, 2, 2]);
    expect(driver.getItem('kids-app-adaptive:a')).toBeNull();
  });

  it('[AC-06] switching the age track age2 -> age5 with the flags already set rewrites nothing', () => {
    profile('a').difficulty = 'challenging';
    profile('a').startFrenchHigher = true;
    commit(editOf('a', { ageTrack: 'age5' }));
    expect(profile('a').ageTrack).toBe('age5');
    expect([lv('a', REST('en')), lv('a', REST('fr')), lv('a', LM('en')), lv('a', LM('fr'))]).toEqual([3, 3, 2, 2]);
  });

  it('[AC-07] toggling back (challenging -> regular, French-higher off) never lowers a stored level', () => {
    commit(editOf('b', { difficulty: 'challenging', startFrenchHigher: true }));
    const before = [lv('b', REST('en')), lv('b', REST('fr')), lv('b', LM('en')), lv('b', LM('fr'))];
    commit(editOf('b', { difficulty: 'regular', startFrenchHigher: true }));
    commit(editOf('b', { difficulty: 'regular', startFrenchHigher: false }));
    expect([lv('b', REST('en')), lv('b', REST('fr')), lv('b', LM('en')), lv('b', LM('fr'))]).toEqual(before);
  });

  it('[AC-07] a lift never starts a game: no new skill keys appear for unstarted games', () => {
    const fresh = new AdaptiveStore(memoryDriver());
    fresh.setSkill('b', REST('en'), skill(5));
    commitProfileEdit(state, editOf('b', { difficulty: 'challenging', startFrenchHigher: true }), fresh, index);
    expect(Object.keys(fresh.getProfile('b').skills)).toEqual([REST('en')]);
  });

  it('[AC-07] name and language changes rewrite no skills and do not persist adaptive data', () => {
    commit(editOf('b', { name: 'Elli2', languages: 'fr' }));
    expect(profile('b').name).toBe('Elli2');
    expect([lv('b', REST('en')), lv('b', REST('fr')), lv('b', LM('en')), lv('b', LM('fr'))]).toEqual([3, 3, 2, 2]);
    expect(driver.getItem('kids-app-adaptive:b')).toBeNull();
  });

  it('[AC-07] a no-change commit (the same options again) does not lift again', () => {
    commit(editOf('b', { difficulty: 'challenging' }));
    adaptive.setSkill('b', REST('en'), skill(4));
    commit(editOf('b', { difficulty: 'challenging' }));
    expect(lv('b', REST('en'))).toBe(4);
  });
});

describe('resetProfileProgress', () => {
  it('[AC-09] empties this child\'s skills in memory and storage and keeps profile settings, leisure balance and stars', () => {
    commit(editOf('b', { difficulty: 'challenging', startFrenchHigher: true, languages: 'fr' }));
    state.data.b = { activeSec: 900, balanceSec: 300, earnedTodaySec: 120, carry: 0.5, day: '2026-11-24', stars: 7, gameVisits: { 'sorting-beds': 3 } };
    const dataBefore = JSON.stringify(state.data.b);
    const settingsBefore = JSON.stringify(profile('b'));
    adaptive.persist('b');
    resetProfileProgress(adaptive, 'b');
    expect(adaptive.getProfile('b').skills).toEqual({});
    expect(JSON.parse(driver.getItem('kids-app-adaptive:b')!).skills).toEqual({});
    expect(new AdaptiveStore(driver).getProfile('b').skills).toEqual({});
    expect(JSON.stringify(state.data.b)).toBe(dataBefore);
    expect(JSON.stringify(profile('b'))).toBe(settingsBefore);
  });

  it('[AC-09] never touches the other child\'s skills, settings or global settings', () => {
    adaptive.persist('a');
    const settingsBefore = JSON.stringify(state.settings);
    const aBefore = JSON.stringify(profile('a'));
    resetProfileProgress(adaptive, 'b');
    expect(Object.keys(adaptive.getProfile('a').skills).sort()).toEqual([LM('en'), LM('fr'), REST('en'), REST('fr')].sort());
    expect(JSON.parse(driver.getItem('kids-app-adaptive:a')!).skills[REST('en')].level).toBe(3);
    expect(JSON.stringify(state.settings)).toBe(settingsBefore);
    expect(JSON.stringify(profile('a'))).toBe(aBefore);
  });

  it('[AC-09] a game started after the reset begins from the (kept) start floor again', () => {
    commit(editOf('b', { difficulty: 'challenging' }));
    resetProfileProgress(adaptive, 'b');
    expect(adaptive.getSkill('b', REST('en'))).toBeUndefined();
    expect(profile('b').difficulty).toBe('challenging');
  });
});
