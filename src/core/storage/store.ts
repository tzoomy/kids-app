import type { AppState, ProfileState } from './schema';
import { STORAGE_KEY, SCHEMA_VERSION, defaultAppState } from './schema';
import { LEGACY_STORAGE_KEY, migrateLegacyState, ensureProfileState } from './legacyMigration';
import { localDayKey } from './dayKey';

export interface StorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageDriver | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Loads v2 state, migrating once from the prototype's `ar_state` key if v2 is empty. */
export function loadAppState(now: Date = new Date(), driver: StorageDriver | null = browserStorage()): AppState {
  if (!driver) return defaultAppState();

  const rawV2 = driver.getItem(STORAGE_KEY);
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2) as AppState;
      if (parsed && parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.profiles)) {
        for (const p of parsed.profiles) ensureProfileState(parsed, p.id, now);
        return parsed;
      }
    } catch {
      // fall through to defaults below
    }
  }

  const rawLegacy = driver.getItem(LEGACY_STORAGE_KEY);
  if (rawLegacy) {
    const migrated = migrateLegacyState(rawLegacy, now);
    if (migrated) {
      saveAppState(migrated, driver);
      return migrated;
    }
  }

  return defaultAppState();
}

export function saveAppState(state: AppState, driver: StorageDriver | null = browserStorage()): void {
  if (!driver) return;
  driver.setItem(STORAGE_KEY, JSON.stringify(state));
}

export class Store {
  private state: AppState;
  private readonly driver: StorageDriver | null;

  constructor(driver: StorageDriver | null = browserStorage(), now: Date = new Date()) {
    this.driver = driver;
    this.state = loadAppState(now, driver);
  }

  getState(): AppState {
    return this.state;
  }

  getProfileState(profileId: string, now: Date = new Date()): ProfileState {
    ensureProfileState(this.state, profileId, now);
    const day = localDayKey(now);
    const data = this.state.data[profileId];
    if (data.day !== day) {
      data.day = day;
      data.earnedTodaySec = 0;
    }
    return data;
  }

  persist(): void {
    saveAppState(this.state, this.driver);
  }
}
