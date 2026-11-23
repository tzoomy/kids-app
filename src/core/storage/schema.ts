// Storage schema v2. No Phaser dependency. localStorage only, device-local.
export const STORAGE_KEY = 'kids-app-state-v2';
export const SCHEMA_VERSION = 2;

export type AgeTrack = 'age2' | 'age5';
export type LanguageSetting = 'both' | 'en' | 'fr';
export type DifficultyPreference = 'regular' | 'challenging';

export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['both', 'en', 'fr'];
export const DIFFICULTY_PREFERENCES: readonly DifficultyPreference[] = ['regular', 'challenging'];

export function isLanguageSetting(v: unknown): v is LanguageSetting {
  return typeof v === 'string' && (LANGUAGE_SETTINGS as readonly string[]).includes(v);
}

export function isDifficultyPreference(v: unknown): v is DifficultyPreference {
  return typeof v === 'string' && (DIFFICULTY_PREFERENCES as readonly string[]).includes(v);
}

export interface ProfileSettings {
  id: string;
  /** Display name only — never store the child's real name if the parent prefers a nickname. */
  name: string;
  avatar: string;
  ageTrack: AgeTrack;
  /** Learning language of this child. Missing in older payloads: `normalizeAppState` fills it on load. */
  languages?: LanguageSetting;
  /** age5 only: new French skills start `START_FRENCH_HIGHER_OFFSET` levels higher. Default false. */
  startFrenchHigher?: boolean;
  /** age5 only: 'challenging' raises the start level of new skills by `CHALLENGING_LEVEL_OFFSET`. Default 'regular'. */
  difficulty?: DifficultyPreference;
}

export interface LeisureSettings {
  /** PLACEHOLDER policy, pending owner decision. */
  learnMinutes: number;
  /** PLACEHOLDER policy, pending owner decision. */
  leisureMinutes: number;
  /** PLACEHOLDER policy, pending owner decision. */
  dailyEarnCapMinutes: number;
  /** PLACEHOLDER policy, pending owner decision. */
  idleSeconds: number;
  /** Deprecated: the learning language now lives on each profile. Kept as a fallback for older payloads. */
  languages: LanguageSetting;
  /** Master switch for the time-earning mechanic (earn, spend, balance UI). Off by default. */
  timeEarning: { enabled: boolean };
}

export interface ProfileState {
  /** Total seconds of qualifying active participation, lifetime. */
  activeSec: number;
  /** Current redeemable leisure balance, in seconds. */
  balanceSec: number;
  /** Leisure seconds earned so far on `day`. Resets on local day rollover. */
  earnedTodaySec: number;
  /** Fractional leisure-second carry, so partial earning isn't lost to rounding. */
  carry: number;
  /** Local calendar day (YYYY-MM-DD) that earnedTodaySec applies to. */
  day: string;
  stars: number;
  /**
   * Visits started per game id (optional; absent in older payloads, read as 0). Sorting Beds uses it to cycle
   * colour, shape, size across visits (AC-21) so the cycle survives an app restart.
   */
  gameVisits?: Record<string, number>;
}

export interface AppState {
  schemaVersion: typeof SCHEMA_VERSION;
  settings: LeisureSettings;
  profiles: ProfileSettings[];
  data: Record<string, ProfileState>;
}

export const DEFAULT_SETTINGS: LeisureSettings = {
  learnMinutes: 10,
  leisureMinutes: 5,
  dailyEarnCapMinutes: 30,
  idleSeconds: 20,
  languages: 'both',
  timeEarning: { enabled: false },
};

export const DEFAULT_PROFILES: ProfileSettings[] = [
  { id: 'a', name: 'הקטנה', avatar: 'bunny', ageTrack: 'age2', languages: 'both', startFrenchHigher: false, difficulty: 'regular' },
  { id: 'b', name: 'הגדולה', avatar: 'butterfly', ageTrack: 'age5', languages: 'both', startFrenchHigher: false, difficulty: 'regular' },
];

export function defaultAppState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, timeEarning: { ...DEFAULT_SETTINGS.timeEarning } },
    profiles: DEFAULT_PROFILES.map((p) => ({ ...p })),
    data: {},
  };
}

/** True only when time earning is explicitly enabled; a missing or malformed field reads as off. */
export function isTimeEarningEnabled(settings: Pick<LeisureSettings, 'timeEarning'> | null | undefined): boolean {
  return settings?.timeEarning?.enabled === true;
}

/** Coerces settings read from storage so `timeEarning.enabled` always exists. */
export function normalizeSettings(settings: LeisureSettings): LeisureSettings {
  return { ...settings, timeEarning: { enabled: isTimeEarningEnabled(settings) } };
}

export function defaultProfileState(day: string): ProfileState {
  return { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day, stars: 0 };
}

/**
 * Fills the per-profile fields of a state read from storage, in place: `languages` (the profile's own value, else the
 * deprecated global `settings.languages`, else 'both'), `startFrenchHigher` (false) and `difficulty` ('regular').
 * A valid existing value is never overwritten.
 */
export function normalizeAppState(state: AppState): AppState {
  const legacy = isLanguageSetting(state.settings?.languages) ? state.settings.languages : 'both';
  for (const p of state.profiles) {
    if (!isLanguageSetting(p.languages)) p.languages = legacy;
    if (typeof p.startFrenchHigher !== 'boolean') p.startFrenchHigher = false;
    if (!isDifficultyPreference(p.difficulty)) p.difficulty = 'regular';
  }
  return state;
}

/** The learning language of a profile: its own value, else the deprecated global one, else 'both'. */
export function profileLanguageSetting(
  state: Pick<AppState, 'profiles' | 'settings'>,
  profileId: string | null | undefined,
): LanguageSetting {
  const own = state.profiles.find((p) => p.id === profileId)?.languages;
  if (isLanguageSetting(own)) return own;
  return isLanguageSetting(state.settings?.languages) ? state.settings.languages : 'both';
}

/** Start-level preferences of a profile, with safe defaults. */
export function profileStartPrefs(
  state: Pick<AppState, 'profiles'>,
  profileId: string | null | undefined,
): { difficulty: DifficultyPreference; startFrenchHigher: boolean } {
  const p = state.profiles.find((pr) => pr.id === profileId);
  return {
    difficulty: isDifficultyPreference(p?.difficulty) ? p.difficulty : 'regular',
    startFrenchHigher: p?.startFrenchHigher === true,
  };
}

/** E2E seed: sets the profile's language and also the deprecated global value (any leftover reader). Without a profile, only the global one. */
export function seedProfileLanguage(state: AppState, profileId: string | null | undefined, lang: LanguageSetting): void {
  const p = state.profiles.find((pr) => pr.id === profileId);
  if (p) p.languages = lang;
  state.settings.languages = lang;
}
