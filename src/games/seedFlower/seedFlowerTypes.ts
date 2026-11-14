import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { OrderMode, PlantEvent, StageId } from './seedFlowerMachine';
import type { NamingMode } from './seedFlowerRound';

/** Read-only state for the `getSeedFlowerInfo()` e2e hook. Rectangles are page CSS px. */
export interface SeedFlowerInfo {
  level: number;
  skillKey: string;
  language: Lang;
  mode: OrderMode;
  naming: NamingMode;
  audioOnly: boolean;
  stages: StageId[];
  stage: StageId;
  stageIndex: number;
  watered: boolean;
  bloomed: boolean;
  /** True while tool taps are accepted (the plant has popped in and is not celebrating). */
  ready: boolean;
  /** The idle hint fired during the current growth step. */
  hinted: boolean;
  /** Plants grown to a flower in this visit. */
  plantsBloomed: number;
  lastEvent: PlantEvent['kind'] | null;
  water: Rect;
  sun: Rect;
  plant: Rect;
}
