import type { Rect } from '../../testing/pageRect';
import type { WordTrainEvent, WordTrainMode, WordTrainPhase } from './wordTrainMachine';

export interface WordTrainObjectInfo {
  id: string;
  rect: Rect;
}

export interface WordTrainTileInfo {
  index: number;
  letter: string;
  placed: boolean;
  rect: Rect;
}

export interface WordTrainSlotInfo {
  index: number;
  /** Expected letter for this wagon slot. */
  letter: string;
  filled: boolean;
  rect: Rect;
}

/** Read-only state for the `getWordTrainInfo()` e2e hook. Rectangles are page CSS px. */
export interface WordTrainInfo {
  mode: WordTrainMode;
  phase: WordTrainPhase;
  level: number;
  skillKey: string;
  language: 'en';
  stars: number;
  ready: boolean;
  hinted: boolean;
  lastEvent: WordTrainEvent['kind'] | null;
  /** Object id in load mode; word id in spell mode. */
  target: string | null;
  word: string | null;
  objects: WordTrainObjectInfo[];
  wagonRect: Rect | null;
  tiles: WordTrainTileInfo[];
  slots: WordTrainSlotInfo[];
}
