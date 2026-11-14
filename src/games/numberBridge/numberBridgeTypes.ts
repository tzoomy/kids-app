import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { BridgeEvent, BridgeMode, BridgePhase } from './bridgeMachine';

/** Read-only state for the `getNumberBridgeInfo()` e2e hook. Rectangles are page CSS px. */
export interface NumberBridgeInfo {
  phase: BridgePhase;
  mode: BridgeMode;
  level: number;
  skillKey: string;
  language: Lang;
  sequence: number[];
  /** Remaining unfilled gap indices in `sequence`. */
  gaps: number[];
  answer: number | null;
  choices: number[];
  tries: number;
  stars: number;
  /** True while taps are accepted (stones finished popping in, not crossing/animating, help card closed). */
  ready: boolean;
  /** Whether the idle hint fired on the current bridge. */
  hinted: boolean;
  lastEvent: BridgeEvent['kind'] | null;
  /** Page CSS px rectangle of the stone pile (`null` in missing mode). */
  pile: Rect | null;
  /** Page CSS px rectangles of each choice stone keyed by its number string (empty in one-more mode). */
  choiceRects: Record<string, Rect>;
  /** Page CSS px rectangles of each currently unfilled gap in `gaps`. */
  gapRects: Rect[];
}
