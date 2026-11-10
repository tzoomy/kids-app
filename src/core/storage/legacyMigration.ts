import type { AppState, AgeTrack, LanguageSetting } from './schema';
import { SCHEMA_VERSION, defaultProfileState } from './schema';
import { localDayKey } from './dayKey';

/** Shape of the prototype's `ar_state` localStorage key (app.js at the repo root). */
interface LegacyState {
  settings?: {
    learnMin?: number;
    leisureMin?: number;
    dailyEarnCapMin?: number;
    idleSec?: number;
    langs?: LanguageSetting;
  };
  profiles?: { id: string; name: string; avatar: string; mode: 'little' | 'big' }[];
  data?: Record<
    string,
    { activeSec?: number; balanceSec?: number; earnedTodaySec?: number; day?: string; stars?: number; carry?: number }
  >;
}

export const LEGACY_STORAGE_KEY = 'ar_state';

/**
 * One-way migration from the prototype's `ar_state` key into the v2 schema.
 * Only runs when v2 storage is empty, so it never overwrites real progress.
 */
export function migrateLegacyState(raw: string, now: Date): AppState | null {
  let legacy: LegacyState;
  try {
    legacy = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!legacy || !Array.isArray(legacy.profiles)) return null;

  const day = localDayKey(now);
  const modeToAge = (mode: 'little' | 'big'): AgeTrack => (mode === 'little' ? 'age2' : 'age5');

  const state: AppState = {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      learnMinutes: legacy.settings?.learnMin ?? 10,
      leisureMinutes: legacy.settings?.leisureMin ?? 5,
      dailyEarnCapMinutes: legacy.settings?.dailyEarnCapMin ?? 30,
      idleSeconds: legacy.settings?.idleSec ?? 20,
      languages: legacy.settings?.langs ?? 'both',
    },
    profiles: legacy.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      ageTrack: modeToAge(p.mode),
    })),
    data: {},
  };

  for (const p of legacy.profiles) {
    const d = legacy.data?.[p.id];
    state.data[p.id] = {
      activeSec: d?.activeSec ?? 0,
      balanceSec: d?.balanceSec ?? 0,
      earnedTodaySec: d?.day === day ? d?.earnedTodaySec ?? 0 : 0,
      carry: d?.carry ?? 0,
      day,
      stars: d?.stars ?? 0,
    };
  }

  return state;
}

export function ensureProfileState(state: AppState, profileId: string, now: Date): void {
  const day = localDayKey(now);
  if (!state.data[profileId]) {
    state.data[profileId] = defaultProfileState(day);
  }
}
