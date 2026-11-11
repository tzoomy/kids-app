// Pure per-trial bookkeeping for the restaurant scene, so the engine rules the scene relies on
// (record once, hint only from the idle auto-hint, language fixed per round) can be unit-tested.
import type { TrialResult } from '../../core/adaptive';
import { pickLanguage, type Lang } from '../templates/choiceServe';

export class TrialTracker {
  private hinted = false;
  private recorded = false;

  constructor(
    readonly itemId: string,
    readonly language: Lang,
  ) {}

  /**
   * The idle auto-hint fired. It only counts before the first plate tap; later hints follow a
   * recorded miss. A voluntary replay (tap on the animal or prompt bubble) must NOT call this.
   */
  onHint(): void {
    if (!this.recorded) this.hinted = true;
  }

  /** The first accepted plate tap yields the result to record; every later tap yields null. */
  onPlateTap(correct: boolean): TrialResult | null {
    if (this.recorded) return null;
    this.recorded = true;
    return { itemId: this.itemId, firstTryCorrect: correct, hinted: this.hinted };
  }
}

/**
 * One round = several animals in the same language. Keeps the current language until the round
 * boundary, and re-picks early if the parent disabled it mid-round.
 */
export function nextRoundLanguage(
  current: Lang | null,
  atBoundary: boolean,
  setting: 'both' | Lang,
  random: () => number = Math.random,
): Lang {
  if (current !== null && !atBoundary && (setting === 'both' || setting === current)) return current;
  return pickLanguage(setting, random);
}
