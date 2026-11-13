import { describe, expect, it } from 'vitest';
import { Store, loadAppState, type StorageDriver } from '@/core/storage/store';
import { STORAGE_KEY } from '@/core/storage/schema';
import { LEGACY_STORAGE_KEY } from '@/core/storage/legacyMigration';
import { visitAttribute } from '@/games/sorting/sortingLogic';

function memoryDriver(initial: Record<string, string> = {}): StorageDriver {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
}

describe('Store', () => {
  it('starts from defaults when nothing is persisted', () => {
    const store = new Store(memoryDriver(), new Date('2026-11-10T10:00:00'));
    expect(store.getState().profiles).toHaveLength(2);
    expect(store.getState().data).toEqual({});
  });

  it('keeps per-profile balances isolated — no transfer between profiles', () => {
    const store = new Store(memoryDriver(), new Date('2026-11-10T10:00:00'));
    const a = store.getProfileState('a', new Date('2026-11-10T10:00:00'));
    const b = store.getProfileState('b', new Date('2026-11-10T10:00:00'));
    a.balanceSec = 500;
    expect(b.balanceSec).toBe(0);
  });

  it('rolls over earnedTodaySec on local day change without clearing the balance', () => {
    const store = new Store(memoryDriver(), new Date('2026-11-10T10:00:00'));
    const a = store.getProfileState('a', new Date('2026-11-10T10:00:00'));
    a.earnedTodaySec = 600;
    a.balanceSec = 900;
    const next = store.getProfileState('a', new Date('2026-11-11T00:05:00'));
    expect(next.day).toBe('2026-11-11');
    expect(next.earnedTodaySec).toBe(0);
    expect(next.balanceSec).toBe(900);
  });

  it('persists and reloads state through the driver', () => {
    const driver = memoryDriver();
    const store = new Store(driver, new Date('2026-11-10T10:00:00'));
    store.getProfileState('a', new Date('2026-11-10T10:00:00')).balanceSec = 123;
    store.persist();

    const reloaded = loadAppState(new Date('2026-11-10T10:00:00'), driver);
    expect(reloaded.data.a.balanceSec).toBe(123);
  });
});

describe('legacy migration from prototype ar_state', () => {
  it('migrates balances, stars, and settings once when v2 storage is empty', () => {
    const legacy = {
      settings: { learnMin: 10, leisureMin: 5, dailyEarnCapMin: 30, idleSec: 20, langs: 'both' },
      profiles: [
        { id: 'a', name: 'הקטנה', avatar: '🦄', mode: 'little' },
        { id: 'b', name: 'הגדולה', avatar: '🦋', mode: 'big' },
      ],
      data: {
        a: { activeSec: 120, balanceSec: 60, earnedTodaySec: 60, day: '2026-11-10', stars: 3, carry: 0.2 },
        b: { activeSec: 300, balanceSec: 150, earnedTodaySec: 150, day: '2026-11-10', stars: 7, carry: 0 },
      },
    };
    const driver = memoryDriver({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) });
    const state = loadAppState(new Date('2026-11-10T10:00:00'), driver);

    expect(state.data.a.balanceSec).toBe(60);
    expect(state.data.a.stars).toBe(3);
    expect(state.profiles.find((p) => p.id === 'a')?.ageTrack).toBe('age2');
    expect(state.profiles.find((p) => p.id === 'b')?.ageTrack).toBe('age5');
    expect(driver.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('does not run again once v2 storage already has state', () => {
    const driver = memoryDriver({ [LEGACY_STORAGE_KEY]: JSON.stringify({ profiles: [{ id: 'a', name: 'x', avatar: 'y', mode: 'little' }] }) });
    const first = loadAppState(new Date('2026-11-10T10:00:00'), driver);
    first.data.a.balanceSec = 999;
    driver.setItem(STORAGE_KEY, JSON.stringify(first));

    const second = loadAppState(new Date('2026-11-10T10:00:00'), driver);
    expect(second.data.a.balanceSec).toBe(999);
  });
});

describe('v2 profile state without gameVisits', () => {
  it('loads a persisted blob that lacks gameVisits, keeps stars, and starts the sorting visit cycle from its default so it can be saved', () => {
    const blob = {
      schemaVersion: 2,
      settings: { learnMinutes: 10, leisureMinutes: 5, dailyEarnCapMinutes: 30, idleSeconds: 20, languages: 'both' },
      profiles: [
        { id: 'a', name: 'הקטנה', avatar: 'bunny', ageTrack: 'age2' },
        { id: 'b', name: 'הגדולה', avatar: 'butterfly', ageTrack: 'age5' },
      ],
      data: {
        a: { activeSec: 120, balanceSec: 60, earnedTodaySec: 60, carry: 0.2, day: '2026-11-10', stars: 5 },
      },
    };
    expect(blob.data.a).not.toHaveProperty('gameVisits');

    const driver = memoryDriver({ [STORAGE_KEY]: JSON.stringify(blob) });
    const store = new Store(driver, new Date('2026-11-10T10:00:00'));
    const profile = store.getProfileState('a', new Date('2026-11-10T10:00:00'));

    expect(profile.stars).toBe(5);
    expect(profile.balanceSec).toBe(60);
    expect(profile.activeSec).toBe(120);
    expect(profile.earnedTodaySec).toBe(60);
    expect(profile.carry).toBe(0.2);
    expect(profile.gameVisits).toBeUndefined();

    // Same read as SortingScene: absent gameVisits is treated as 0, so the cycle starts at colour.
    const gameId = 'sorting-beds';
    const visits = profile.gameVisits ?? {};
    const visit = Number.isInteger(visits[gameId]) && visits[gameId] >= 0 ? visits[gameId] : 0;
    expect(visit).toBe(0);
    expect(visitAttribute(visit, 2)).toBe('color');

    profile.gameVisits = { ...visits, [gameId]: visit + 1 };
    store.persist();

    const reloaded = loadAppState(new Date('2026-11-10T10:00:00'), driver);
    expect(reloaded.data.a.stars).toBe(5);
    expect(reloaded.data.a.gameVisits).toEqual({ 'sorting-beds': 1 });
  });
});
