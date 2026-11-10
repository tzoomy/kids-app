import { Store } from '../core/storage/store';
import type { AudioManager, SfxPlayer } from '../core/audio';
import { LearningSession, LeisureSession } from '../core/leisure';
import type { AppShell } from '../ui/shell';
import type { WorldsFile, AnimalRestaurantContent } from '../content/schema';
import heStrings from '../content/i18n/he.json';

export interface ContentBundle {
  worlds: WorldsFile;
  restaurant: AnimalRestaurantContent;
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

  constructor(
    public readonly store: Store,
    public readonly audio: AudioManager,
    public readonly sfx: SfxPlayer,
    public readonly content: ContentBundle,
    public readonly shell: AppShell,
    public readonly nowMs: () => number = () => Date.now(),
  ) {}

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
