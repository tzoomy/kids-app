import { Store, browserStorage, type StorageDriver } from '../core/storage/store';
import { recordRoundAndSave } from '../core/wardrobe/store';
import { AdaptiveStore } from '../core/storage/adaptiveStore';
import { localDayKey } from '../core/storage/dayKey';
import { isTimeEarningEnabled, type AgeTrack } from '../core/storage/schema';
import { SkillSession, type GameLevelsMeta } from '../core/adaptive';
import type { AudioManager, SfxPlayer } from '../core/audio';
import { LearningSession, LeisureSession } from '../core/leisure';
import type { AppShell } from '../ui/shell';
import type {
  WorldsFile,
  AnimalRestaurantContent,
  KitchenOrchestraContent,
  SortingBedsContent,
  WhosHidingContent,
  LeisureColouringContent,
  StickerBoardContent,
  BalloonPopContent,
  LetterMonsterContent,
  TravelSuitcaseContent,
  SeedToFlowerContent,
  PotionLabContent,
  SinkOrFloatContent,
  MagicMagnetContent,
} from '../content/schema';
import heStrings from '../content/i18n/he.json';

/**
 * Every game's content. The station trail (`collectTrailGames`) reads the `id` and `world` of each game object here,
 * so a game must be in this bundle for its station to appear.
 */
export interface ContentBundle {
  worlds: WorldsFile;
  restaurant: AnimalRestaurantContent;
  orchestra: KitchenOrchestraContent;
  letterMonster: LetterMonsterContent;
  suitcase: TravelSuitcaseContent;
  sorting: SortingBedsContent;
  balloon: BalloonPopContent;
  hiding: WhosHidingContent;
  seedToFlower: SeedToFlowerContent;
  potionLab: PotionLabContent;
  sinkOrFloat: SinkOrFloatContent;
  magicMagnet: MagicMagnetContent;
  colouring: LeisureColouringContent;
  stickers: StickerBoardContent;
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
  /** Set by main.ts; a 3-second hold of the map's parent button opens the parent settings directly. */
  onRequestParentSettings: (() => void) | null = null;
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

  private activeLearningSession: LearningSession | null = null;

  createLearningSession(): LearningSession {
    const state = this.store.getProfileState(this.requireProfileId(), new Date(this.nowMs()));
    const session = new LearningSession(state, this.store.getState().settings, this.nowMs);
    this.activeLearningSession = session;
    return session;
  }

  /** Read-only listening flag of the current learning session, if any. */
  isListening(): boolean {
    return this.activeLearningSession?.isListening() ?? false;
  }

  /** Wardrobe items unlocked by the latest recorded round in this page session (read by the e2e hook). */
  lastWardrobeUnlock: string[] = [];

  /**
   * Called next to `LearningSession.complete()` when a round completes successfully in a game.
   * Records it for the current profile and age track, saves, celebrates a new unlock (yay + toast)
   * and returns the newly unlocked item ids. Wardrobe state lives on its own localStorage key.
   */
  recordCompletedRound(worldId: string, gameId: string): string[] {
    const profileId = this.requireProfileId();
    const storage = browserStorage();
    const newlyUnlocked = storage
      ? recordRoundAndSave(storage, profileId, this.currentAgeTrack(), { worldId, gameId }).newlyUnlocked
      : [];
    this.lastWardrobeUnlock = newlyUnlocked;
    if (newlyUnlocked.length > 0) {
      this.sfx.yay();
      this.shell.showWardrobeUnlockToast(newlyUnlocked);
    }
    return newlyUnlocked;
  }

  /** Whether the time-earning mechanic (earn, spend, balance UI) is active. Off by default. */
  isTimeEarningEnabled(): boolean {
    return isTimeEarningEnabled(this.store.getState().settings);
  }

  createLeisureSession(): LeisureSession {
    const state = this.store.getProfileState(this.requireProfileId(), new Date(this.nowMs()));
    return new LeisureSession(state, 5, this.isTimeEarningEnabled());
  }
}
