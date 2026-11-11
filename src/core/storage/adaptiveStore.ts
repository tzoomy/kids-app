import type { AdaptiveProfile, SkillKey, SkillState } from '../adaptive/types';
import { adaptiveKey, parseAdaptiveProfile, type Migration, MIGRATIONS } from './adaptiveSchema';
import { browserStorage, type StorageDriver } from './store';

interface Entry {
  profile: AdaptiveProfile;
  writable: boolean;
}

/** Per-profile adaptive state. Reads and writes only `kids-app-adaptive:<profileId>`. */
export class AdaptiveStore {
  private readonly cache = new Map<string, Entry>();

  constructor(
    private readonly driver: StorageDriver | null = browserStorage(),
    private readonly migrations: Record<number, Migration> = MIGRATIONS,
  ) {}

  private entry(profileId: string): Entry {
    let e = this.cache.get(profileId);
    if (!e) {
      let raw: string | null = null;
      try {
        raw = this.driver?.getItem(adaptiveKey(profileId)) ?? null;
      } catch {
        raw = null;
      }
      e = parseAdaptiveProfile(raw, profileId, this.migrations);
      this.cache.set(profileId, e);
    }
    return e;
  }

  getProfile(profileId: string): AdaptiveProfile {
    return this.entry(profileId).profile;
  }

  getSkill(profileId: string, key: SkillKey): SkillState | undefined {
    return this.entry(profileId).profile.skills[key];
  }

  setSkill(profileId: string, key: SkillKey, skill: SkillState): void {
    const e = this.entry(profileId);
    e.profile = { ...e.profile, skills: { ...e.profile.skills, [key]: skill } };
  }

  /** Writes the profile. A no-op for payloads written by a newer build, or without a driver. */
  persist(profileId: string): void {
    const e = this.entry(profileId);
    if (!this.driver || !e.writable) return;
    try {
      this.driver.setItem(adaptiveKey(profileId), JSON.stringify(e.profile));
    } catch {
      // Storage full or blocked: keep playing from memory.
    }
  }
}
