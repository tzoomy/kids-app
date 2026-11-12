// Pure per-trial bookkeeping for the restaurant scene, so the engine rules the scene relies on
// (record once, hint only from the idle auto-hint, language fixed per round) can be unit-tested.
import type { TrialResult } from '../../core/adaptive';
import { pickLanguage, type Lang } from '../templates/choiceServe';

export class TrialTracker {
  private hinted = false;
  private recorded = false;
  private tapped = false;

  constructor(
    readonly itemId: string,
    readonly language: Lang,
  ) {}

  /**
   * The idle auto-hint fired. It only counts before the first plate tap; later hints follow a
   * recorded miss. A voluntary replay (tap on the animal or prompt bubble) must NOT call this.
   */
  onHint(): void {
    if (!this.tapped) this.hinted = true;
  }

  /**
   * Yields the result to record at most once per trial.
   * - A wrong tap records a miss at once (a two-item request included).
   * - A correct tap records a clean first try only when it completes the request
   *   (`remaining` = requested plates still to serve after this tap, 0 for a one-plate request).
   *   A correct first plate of a two-item request records nothing yet.
   * Every later tap yields null.
   */
  onPlateTap(correct: boolean, remaining = 0): TrialResult | null {
    if (this.recorded) return null;
    this.tapped = true;
    if (correct && remaining > 0) return null;
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
