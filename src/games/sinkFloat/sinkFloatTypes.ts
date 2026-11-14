import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { FloatObjectId, FloatOutcome, SinkFloatMode, SinkFloatPhase } from './sinkFloatMachine';

/** Read-only state for the `getSinkFloatInfo()` e2e hook. Rectangles are page CSS px. */
export interface SinkFloatInfo {
  phase: SinkFloatPhase;
  mode: SinkFloatMode;
  level: number;
  skillKey: string;
  language: Lang;
  audioOnly: boolean;
  offered: readonly FloatObjectId[];
  selected: FloatObjectId | null;
  lastOutcome: FloatOutcome | null;
  lastCorrect: boolean | null;
  stars: number;
  /** True while taps for the current phase are accepted (not watching/animating, help card closed). */
  ready: boolean;
  /** True if the idle hint fired during the current round. */
  hinted: boolean;
  objects: Partial<Record<FloatObjectId, Rect>>;
  tank: Rect;
  buttons: {
    floats: Rect;
    sinks: Rect;
  };
}
