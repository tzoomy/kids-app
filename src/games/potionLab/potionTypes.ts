import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { PotionColor, PotionEvent, PotionPhase, PrimaryColor, SecondaryColor } from './potionMachine';
import type { PotionMode } from './potionRound';

/** Read-only state for the `getPotionInfo()` e2e hook. Rectangles are page CSS px. */
export interface PotionInfo {
  phase: PotionPhase;
  bowlColor: PotionColor | null;
  request: SecondaryColor | null;
  level: number;
  skillKey: string;
  language: Lang;
  mode: PotionMode;
  audioOnly: boolean;
  stars: number;
  /** True while pot taps are accepted (bowl is ready, not pouring/mixing, help card closed). */
  ready: boolean;
  /** The idle hint fired during the current round/request. */
  hinted: boolean;
  lastEvent: PotionEvent['kind'] | null;
  pots: Record<PrimaryColor, Rect>;
  bowl: Rect;
}
