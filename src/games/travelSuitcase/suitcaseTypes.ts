import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { SuitcaseEvent, SuitcasePhase, SuitcaseRequestKind } from './suitcaseMachine';

export interface SuitcaseChoiceInfo {
  id: string;
  itemId: string;
  color: string | null;
  packed: boolean;
  rect: Rect;
}

/** Read-only state for the `getSuitcaseInfo()` e2e hook. Rectangles are page CSS px. */
export interface SuitcaseInfo {
  phase: SuitcasePhase;
  request: SuitcaseRequestKind;
  level: number;
  skillKey: string;
  language: Lang;
  stars: number;
  ready: boolean;
  hinted: boolean;
  lastEvent: SuitcaseEvent['kind'] | null;
  /** Choice ids that are right for the current request and not yet packed. */
  rightIds: string[];
  packedCount: number;
  requestIndex: number;
  requestsPerCase: number;
  /** Choices on the floor (`packed: false`) plus items already inside the case (`packed: true`). */
  choices: SuitcaseChoiceInfo[];
  caseRect: Rect | null;
}
