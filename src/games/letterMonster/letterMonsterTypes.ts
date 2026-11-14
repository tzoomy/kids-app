import type { Rect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import type { MonsterEvent, MonsterPhase, MonsterRequest, MonsterRequestKind } from './monsterMachine';

/** Read-only state for the `getLetterMonsterInfo()` e2e hook. Rectangles are page CSS px. */
export interface LetterMonsterInfo {
  phase: MonsterPhase;
  request: MonsterRequest;
  level: number;
  skillKey: string;
  language: Lang;
  mode: MonsterRequestKind;
  audioOnly: boolean;
  offeredIds: string[];
  matchId: string;
  tries: number;
  stars: number;
  /** True while food/monster taps are accepted (foods finished popping in, not eating, help closed). */
  ready: boolean;
  /** True when the idle hint fired during the current request. */
  hinted: boolean;
  lastEvent: MonsterEvent['kind'] | null;
  signVisible: boolean;
  /** Page CSS-px hit rectangles of each offered food by food id. */
  foods: Record<string, Rect>;
  /** Page CSS-px hit rectangle of the monster. */
  monster: Rect;
}
