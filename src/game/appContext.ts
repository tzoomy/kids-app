import { Store, type StorageDriver } from '../core/storage/store';
import { AdaptiveStore } from '../core/storage/adaptiveStore';
import { localDayKey } from '../core/storage/dayKey';
import type { AgeTrack } from '../core/storage/schema';
import { SkillSession, type GameLevelsMeta } from '../core/adaptive';
import type { AudioManager, SfxPlayer } from '../core/audio';
import { LearningSession, LeisureSession } from '../core/leisure';
import type { AppShell } from '../ui/shell';
import type { WorldsFile, AnimalRestaurantContent, KitchenOrchestraContent, SortingBedsContent } from '../content/schema';
import heStrings from '../content/i18n/he.json';

export interface ContentBundle {
  worlds: WorldsFile;
  restaurant: AnimalRestaurantContent;
  orchestra: KitchenOrchestraContent;
  sorting: SortingBedsContent;
  he: typeof heStrings;
}

/**
 * Shared, Phaser-reachable handle on storage/leisure/audio/shell/content.
 * Stored in the Phaser registry so every scene can reach it without prop drilling.
 */
export class AppContext {
  currentProfileId: string | null = null;
  /** Set by main.ts; lets Phaser scenes ask the DOM shell to open the parent gate. */
  onRequestParent: (() => void) | null = null;
  /** Set by main.ts; lets Phaser scenes return to the profile-select screen. */
  onExitToProfileSelect: (() => void) | null = null;

  /** Adaptive-difficulty state, on its own storage key (never mixed with the leisure state). */
  readonly adaptive: AdaptiveStore;

  constructor(
    public readonly store: Store,
    public readonly audio: AudioManager,
    public readonly sfx: SfxPlayer,
    public readonly content: ContentBundle,
    public readonly shell: AppShell,
    public readonly nowMs: () => number = () => Date.now(),
    adaptiveDriver?: StorageDriver | null,
  ) {
    // `undefined` keeps the browser default; tests may pass an in-memory driver.
    this.adaptive = adaptiveDriver === undefined ? new AdaptiveStore() : new AdaptiveStore(adaptiveDriver);
  }

  /** Age track of the current profile (defaults to age5 like the rest of the app). */
  currentAgeTrack(): AgeTrack {
    const id = this.requireProfileId();
    return this.store.getState().profiles.find((p) => p.id === id)?.ageTrack ?? 'age5';
  }

  /** Skill session for one game, bound to the current profile, its age track and the app clock. */
  createSkillSession(world: string, gameId: string, meta: GameLevelsMeta): SkillSession {
    return new SkillSession({
      store: this.adaptive,
      profileId: this.requireProfileId(),
      track: this.currentAgeTrack(),
      world,
      gameId,
      meta,
      today: () => localDayKey(new Date(this.nowMs())),
    });
  }

  requireProfileId(): string {
    if (!this.currentProfileId) throw new Error('No profile selected');
    return this.currentProfileId;
  }

  createLearningSession(): LearningSession {
    const state = this.store.getProfileState(this.requireProfileId(), new Date(this.nowMs()));
    return new LearningSession(state, this.store.getState().settings, this.nowMs);
  }

  createLeisureSession(): LeisureSession {
    const state = this.store.getProfileState(this.requireProfileId(), new Date(this.nowMs()));
    return new LeisureSession(state);
  }
}
