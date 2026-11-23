import { describe, expect, it } from 'vitest';
import { loadAppState, type StorageDriver } from '@/core/storage/store';
import { LEGACY_STORAGE_KEY } from '@/core/storage/legacyMigration';
import {
  DEFAULT_PROFILES,
  STORAGE_KEY,
  defaultAppState,
  normalizeAppState,
  normalizeSettings,
  profileLanguageSetting,
  profileStartPrefs,
  seedProfileLanguage,
  type AppState,
} from '@/core/storage/schema';

function memoryDriver(seed: Record<string, string> = {}): StorageDriver {
  const map = new Map(Object.entries(seed));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const NOW = new Date('2026-11-23T10:00:00');

function v2Blob(overrides: { languages?: unknown; profiles?: unknown[] } = {}): string {
  return JSON.stringify({
    schemaVersion: 2,
    settings: { learnMinutes: 10, leisureMinutes: 5, dailyEarnCapMinutes: 30, idleSeconds: 20, languages: overrides.languages ?? 'both' },
    profiles: overrides.profiles ?? [
      { id: 'a', name: 'הקטנה', avatar: 'bunny', ageTrack: 'age2' },
      { id: 'b', name: 'הגדולה', avatar: 'butterfly', ageTrack: 'age5' },
    ],
    data: {},
  });
}

describe('per-profile language defaults', () => {
  it('DEFAULT_PROFILES and a fresh state give every profile languages both, startFrenchHigher off, regular difficulty', () => {
    for (const p of [...DEFAULT_PROFILES, ...defaultAppState().profiles]) {
      expect(p.languages).toBe('both');
      expect(p.startFrenchHigher).toBe(false);
      expect(p.difficulty).toBe('regular');
    }
  });
});

describe('normalizeAppState', () => {
  it('copies a valid legacy global settings.languages onto profiles that lack a language', () => {
    const state = JSON.parse(v2Blob({ languages: 'fr' })) as AppState;
    normalizeAppState(state);
    expect(state.profiles.map((p) => p.languages)).toEqual(['fr', 'fr']);
  });

  it('falls back to both when the profile and the global language are both absent or invalid', () => {
    const state = JSON.parse(v2Blob({ languages: 'klingon' })) as AppState;
    normalizeAppState(state);
    expect(state.profiles.map((p) => p.languages)).toEqual(['both', 'both']);
    const noGlobal = JSON.parse(v2Blob()) as AppState;
    delete (noGlobal.settings as { languages?: unknown }).languages;
    normalizeAppState(noGlobal);
    expect(noGlobal.profiles.map((p) => p.languages)).toEqual(['both', 'both']);
  });

  it('never overwrites a profile that already has a valid language, and replaces an invalid one', () => {
    const state = JSON.parse(
      v2Blob({
        languages: 'fr',
        profiles: [
          { id: 'a', name: 'x', avatar: 'bunny', ageTrack: 'age2', languages: 'en' },
          { id: 'b', name: 'y', avatar: 'butterfly', ageTrack: 'age5', languages: 'nope' },
        ],
      }),
    ) as AppState;
    normalizeAppState(state);
    expect(state.profiles[0].languages).toBe('en');
    expect(state.profiles[1].languages).toBe('fr');
  });

  it('defaults startFrenchHigher and difficulty, keeps valid values, and repairs invalid ones', () => {
    const state = JSON.parse(
      v2Blob({
        profiles: [
          { id: 'a', name: 'x', avatar: 'bunny', ageTrack: 'age2' },
          { id: 'b', name: 'y', avatar: 'butterfly', ageTrack: 'age5', startFrenchHigher: true, difficulty: 'challenging' },
          { id: 'c', name: 'z', avatar: 'butterfly', ageTrack: 'age5', startFrenchHigher: 'yes', difficulty: 'insane' },
        ],
      }),
    ) as AppState;
    normalizeAppState(state);
    expect(state.profiles.map((p) => [p.startFrenchHigher, p.difficulty])).toEqual([
      [false, 'regular'],
      [true, 'challenging'],
      [false, 'regular'],
    ]);
  });

  it('keeps the deprecated global settings.languages as is', () => {
    const state = JSON.parse(v2Blob({ languages: 'en' })) as AppState;
    normalizeAppState(state);
    expect(state.settings.languages).toBe('en');
    expect(normalizeSettings(state.settings).languages).toBe('en');
  });
});

describe('loadAppState', () => {
  it('an old v2 blob without per-profile fields loads and gains the defaults, copying the global language', () => {
    const state = loadAppState(NOW, memoryDriver({ [STORAGE_KEY]: v2Blob({ languages: 'en' }) }));
    expect(state.profiles.map((p) => [p.languages, p.startFrenchHigher, p.difficulty])).toEqual([
      ['en', false, 'regular'],
      ['en', false, 'regular'],
    ]);
  });

  it('a saved per-profile language survives a reload (profile a en, profile b fr)', () => {
    const blob = v2Blob({
      languages: 'both',
      profiles: [
        { id: 'a', name: 'x', avatar: 'bunny', ageTrack: 'age2', languages: 'en' },
        { id: 'b', name: 'y', avatar: 'butterfly', ageTrack: 'age5', languages: 'fr' },
      ],
    });
    const state = loadAppState(NOW, memoryDriver({ [STORAGE_KEY]: blob }));
    expect(profileLanguageSetting(state, 'a')).toBe('en');
    expect(profileLanguageSetting(state, 'b')).toBe('fr');
  });

  it('legacy ar_state settings.langs lands on every migrated profile', () => {
    const legacy = {
      settings: { langs: 'fr' },
      profiles: [
        { id: 'a', name: 'x', avatar: 'y', mode: 'little' },
        { id: 'b', name: 'z', avatar: 'w', mode: 'big' },
      ],
    };
    const state = loadAppState(NOW, memoryDriver({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) }));
    expect(state.profiles.map((p) => p.languages)).toEqual(['fr', 'fr']);
    expect(state.profiles.map((p) => p.difficulty)).toEqual(['regular', 'regular']);
  });

  it('legacy ar_state without langs defaults both', () => {
    const legacy = { profiles: [{ id: 'a', name: 'x', avatar: 'y', mode: 'little' }] };
    const state = loadAppState(NOW, memoryDriver({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) }));
    expect(state.profiles[0].languages).toBe('both');
  });
});

describe('profileLanguageSetting', () => {
  const base = (): AppState => defaultAppState();

  it('reads the profile value first', () => {
    const s = base();
    s.settings.languages = 'en';
    s.profiles[1].languages = 'fr';
    expect(profileLanguageSetting(s, 'b')).toBe('fr');
  });

  it('falls back to the deprecated global value when the profile has none', () => {
    const s = base();
    delete s.profiles[0].languages;
    s.settings.languages = 'en';
    expect(profileLanguageSetting(s, 'a')).toBe('en');
  });

  it('falls back to both for an unknown profile or no usable value', () => {
    const s = base();
    delete s.profiles[0].languages;
    (s.settings as { languages?: unknown }).languages = undefined;
    expect(profileLanguageSetting(s, 'a')).toBe('both');
    expect(profileLanguageSetting(s, 'zzz')).toBe('both');
  });
});

describe('profileStartPrefs', () => {
  it('reads the profile flags with safe defaults', () => {
    const s = defaultAppState();
    expect(profileStartPrefs(s, 'b')).toEqual({ difficulty: 'regular', startFrenchHigher: false });
    s.profiles[1].startFrenchHigher = true;
    s.profiles[1].difficulty = 'challenging';
    expect(profileStartPrefs(s, 'b')).toEqual({ difficulty: 'challenging', startFrenchHigher: true });
    expect(profileStartPrefs(s, 'missing')).toEqual({ difficulty: 'regular', startFrenchHigher: false });
  });
});

describe('seedProfileLanguage', () => {
  it('sets the active profile language and the deprecated global value, leaving the other profile alone', () => {
    const s = defaultAppState();
    seedProfileLanguage(s, 'b', 'fr');
    expect(profileLanguageSetting(s, 'b')).toBe('fr');
    expect(profileLanguageSetting(s, 'a')).toBe('both');
    expect(s.settings.languages).toBe('fr');
  });

  it('with no profile selected, sets only the global fallback', () => {
    const s = defaultAppState();
    seedProfileLanguage(s, null, 'en');
    expect(s.settings.languages).toBe('en');
    expect(s.profiles.map((p) => p.languages)).toEqual(['both', 'both']);
  });
});
