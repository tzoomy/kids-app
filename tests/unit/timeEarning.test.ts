import { describe, expect, it } from 'vitest';
import { LearningSession, LeisureSession, earnParticipation } from '@/core/leisure';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  defaultAppState,
  defaultProfileState,
  isTimeEarningEnabled,
  type LeisureSettings,
} from '@/core/storage/schema';
import { Store, loadAppState, type StorageDriver } from '@/core/storage/store';

function memoryDriver(initial: Record<string, string> = {}): StorageDriver {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

function settingsWith(enabled: boolean): LeisureSettings {
  return {
    learnMinutes: 10,
    leisureMinutes: 5,
    dailyEarnCapMinutes: 30,
    idleSeconds: 20,
    languages: 'both',
    timeEarning: { enabled },
  };
}

describe('time-earning flag: defaults', () => {
  it('is off in DEFAULT_SETTINGS and defaultAppState()', () => {
    expect(DEFAULT_SETTINGS.timeEarning).toEqual({ enabled: false });
    expect(defaultAppState().settings.timeEarning).toEqual({ enabled: false });
  });

  it('isTimeEarningEnabled is false for a missing field and true only when enabled', () => {
    const legacy: Partial<LeisureSettings> = { ...settingsWith(true) };
    delete legacy.timeEarning;
    expect(isTimeEarningEnabled(legacy as LeisureSettings)).toBe(false);
    expect(isTimeEarningEnabled(settingsWith(false))).toBe(false);
    expect(isTimeEarningEnabled(settingsWith(true))).toBe(true);
  });
});

describe('time-earning flag: persistence', () => {
  const blob = {
    schemaVersion: 2,
    settings: { learnMinutes: 10, leisureMinutes: 5, dailyEarnCapMinutes: 30, idleSeconds: 20, languages: 'both' },
    profiles: [{ id: 'a', name: 'x', avatar: 'bunny', ageTrack: 'age2' }],
    data: {},
  };
  const now = new Date('2026-11-10T10:00:00');

  it('normalizes an old v2 blob lacking timeEarning to { enabled: false }', () => {
    const state = loadAppState(now, memoryDriver({ [STORAGE_KEY]: JSON.stringify(blob) }));
    expect(state.settings.timeEarning).toEqual({ enabled: false });
    expect(state.settings.learnMinutes).toBe(10);
  });

  it('normalizes a malformed timeEarning value', () => {
    const bad = { ...blob, settings: { ...blob.settings, timeEarning: 'yes' } };
    const state = loadAppState(now, memoryDriver({ [STORAGE_KEY]: JSON.stringify(bad) }));
    expect(state.settings.timeEarning).toEqual({ enabled: false });
  });

  it('keeps an explicit enabled: true through save and reload', () => {
    const driver = memoryDriver({ [STORAGE_KEY]: JSON.stringify(blob) });
    const store = new Store(driver, now);
    store.getState().settings.timeEarning = { enabled: true };
    store.persist();
    expect(loadAppState(now, driver).settings.timeEarning).toEqual({ enabled: true });
  });
});

describe('time-earning flag: earning gate', () => {
  it('earnParticipation is a no-op when off', () => {
    const state = defaultProfileState('2026-11-10');
    earnParticipation(state, settingsWith(false), '2026-11-10', 60);
    expect(state).toEqual(defaultProfileState('2026-11-10'));
  });

  it('earnParticipation still earns when on', () => {
    const state = defaultProfileState('2026-11-10');
    earnParticipation(state, settingsWith(true), '2026-11-10', 60);
    expect(state.balanceSec).toBe(30);
    expect(state.activeSec).toBe(60);
  });

  it('LearningSession.tick does not earn when off and earns when on', () => {
    for (const [enabled, expectEarned] of [[false, false], [true, true]] as const) {
      const state = defaultProfileState('2026-11-10');
      let now = 0;
      const session = new LearningSession(state, settingsWith(enabled), () => now);
      session.start();
      for (let i = 0; i < 10; i++) {
        now += 1000;
        session.tick(1);
      }
      expect(state.balanceSec > 0).toBe(expectEarned);
    }
  });
});

describe('time-earning flag: spending gate', () => {
  it('LeisureSession does not spend balance or end when off', () => {
    const state = defaultProfileState('2026-11-10');
    state.balanceSec = 1;
    const session = new LeisureSession(state, 2, false);
    for (let i = 0; i < 10; i++) {
      expect(session.tick(1)).toEqual({ endedNow: false, inGrace: false });
    }
    expect(state.balanceSec).toBe(1);
    expect(session.isInGrace).toBe(false);
  });

  it('LeisureSession still spends and ends when on', () => {
    const state = defaultProfileState('2026-11-10');
    state.balanceSec = 1;
    const session = new LeisureSession(state, 2, true);
    session.tick(1);
    expect(state.balanceSec).toBe(0);
    session.tick(1);
    expect(session.tick(1).endedNow).toBe(true);
  });
});
