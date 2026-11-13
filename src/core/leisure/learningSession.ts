import type { LeisureSettings, ProfileState } from '../storage/schema';
import { earnParticipation, dayKeyFromMs } from './engine';

/**
 * Tracks one learning-game session for one profile and feeds the leisure engine.
 * Games report lifecycle events here: start, interaction, listening, complete, exit.
 * No Phaser dependency, injectable clock for deterministic tests.
 */
export class LearningSession {
  private lastInteractionAt: number;
  private listening = false;
  private celebrating = false;
  private hidden = false;

  constructor(
    private readonly state: ProfileState,
    private readonly settings: LeisureSettings,
    private readonly nowMs: () => number,
  ) {
    this.lastInteractionAt = nowMs();
  }

  /** Call when the activity/round begins. */
  start(): void {
    this.lastInteractionAt = this.nowMs();
  }

  /** Call on every touch/tap/choice — including wrong choices. Mistakes never cost leisure. */
  reportInteraction(): void {
    this.lastInteractionAt = this.nowMs();
  }

  /** Call while a prompt, hint, or demonstration is audibly playing. Listening counts as participation. */
  reportListening(active: boolean): void {
    this.listening = active;
    if (active) this.lastInteractionAt = this.nowMs();
  }

  /** Read-only: whether the session is currently reporting listening. */
  isListening(): boolean {
    return this.listening;
  }

  /** Call while a success celebration/animation is playing. Watching counts as participation. */
  reportCelebrating(active: boolean): void {
    this.celebrating = active;
    if (active) this.lastInteractionAt = this.nowMs();
  }

  /** Call from document.visibilitychange. A hidden tab never earns. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  /** Whether the current moment qualifies as participation (not idle, not hidden). */
  isQualifying(): boolean {
    if (this.hidden) return false;
    const idleMs = this.nowMs() - this.lastInteractionAt;
    const withinIdleWindow = idleMs < this.settings.idleSeconds * 1000;
    return withinIdleWindow || this.listening || this.celebrating;
  }

  /** Call once per elapsed second (or pass a custom dtSec) while the activity screen is open. */
  tick(dtSec = 1): void {
    if (!this.isQualifying()) return;
    earnParticipation(this.state, this.settings, dayKeyFromMs(this.nowMs()), dtSec);
  }

  /** Call when a round completes successfully. */
  complete(): void {
    this.reportCelebrating(true);
  }

  /** Call when the player exits the activity. */
  exit(): void {
    this.listening = false;
    this.celebrating = false;
  }
}
