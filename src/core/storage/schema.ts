// Storage schema v2. No Phaser dependency. localStorage only, device-local.
export const STORAGE_KEY = 'kids-app-state-v2';
export const SCHEMA_VERSION = 2;

export type AgeTrack = 'age2' | 'age5';
export type LanguageSetting = 'both' | 'en' | 'fr';

export interface ProfileSettings {
  id: string;
  /** Display name only — never store the child's real name if the parent prefers a nickname. */
  name: string;
  avatar: string;
  ageTrack: AgeTrack;
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
  languages: LanguageSetting;
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
};

export const DEFAULT_PROFILES: ProfileSettings[] = [
  { id: 'a', name: 'הקטנה', avatar: 'bunny', ageTrack: 'age2' },
  { id: 'b', name: 'הגדולה', avatar: 'butterfly', ageTrack: 'age5' },
];

export function defaultAppState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    profiles: DEFAULT_PROFILES.map((p) => ({ ...p })),
    data: {},
  };
}

export function defaultProfileState(day: string): ProfileState {
  return { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day, stars: 0 };
}
