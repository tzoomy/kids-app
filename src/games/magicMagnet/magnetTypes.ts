import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { MagnetEvent, MagnetMode, MagnetPhase } from './magnetMachine';

export interface MagnetObjectInfo {
  id: string;
  metal: boolean;
  stuck: boolean;
  /** Page CSS px of the object's resting hit box, or of its current box when stuck. */
  rect: Rect;
}

/** Read-only state for the `getMagnetInfo()` e2e hook. Rectangles are page CSS px. */
export interface MagnetInfo {
  phase: MagnetPhase;
  mode: MagnetMode;
  level: number;
  skillKey: string;
  language: Lang;
  audioOnly: boolean;
  stars: number;
  ready: boolean;
  hinted: boolean;
  lastEvent: MagnetEvent['kind'] | null;
  target: string | null;
  prediction: boolean | null;
  objects: MagnetObjectInfo[];
  magnet: Rect;
  /** Page px of the point between the two pole tips. */
  tips: { x: number; y: number };
  buttons: { sticks: Rect; notSticks: Rect } | null;
}
