// Workshop L20 break-point marker (v4 §1.5/§1.8): where the chain first stopped after a failed run. Pure TS, no Phaser, cosmetic.
// Spec: docs/specs/workshop-l20.md (AC-15).
import { COCO_BELL, DOMINO_Y, FIXED_DOMINOES, L20_SOCKETS, MORNING_BELL, R1, type L20Config } from './l20Level';
import type { L20Event, L20Reason } from './l20World';

export type BreakKind = 'ramp' | 'domino-gap' | 'coco-bell' | 'string' | 'morning-bell';
export interface BreakPoint {
  x: number;
  y: number;
  kind: BreakKind;
}

export interface BreakInput {
  reason: L20Reason;
  events: readonly L20Event[];
  config: L20Config;
}

const STRING_A = L20_SOCKETS.find((s) => s.id === 'string-A') as { x: number; y: number };

/**
 * Where the chain first stopped. The low machine comes first: no ramp in R1 (or a ramp pointing the wrong way) or no domino ever
 * tipped -> the R1 socket; a row that tipped and stopped -> the centre of the strip gap between the last fallen domino of the
 * leading run and the first one still standing. If Coco rang but the morning bell did not -> the string socket A (the scissors
 * are on B or missing). A win has none.
 */
export function chooseBreakPoint(input: BreakInput): BreakPoint | null {
  const { reason, events, config } = input;
  if (reason === 'both-bells') return null;
  if (reason === 'coco-only') {
    return config.scissors === 'A' ? { x: MORNING_BELL.x, y: MORNING_BELL.y, kind: 'morning-bell' } : { x: STRING_A.x, y: STRING_A.y, kind: 'string' };
  }
  const fallen = new Set(events.map((e) => /^domino:(\d+):fallen$/.exec(e.id)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1])));
  const row = [...FIXED_DOMINOES, ...config.slots].sort((a, b) => a - b);
  const firstStanding = row.findIndex((x) => !fallen.has(x));
  if (config.ramp !== 'down-right' || firstStanding === 0 || fallen.size === 0) return { x: R1.x, y: R1.y, kind: 'ramp' };
  if (firstStanding === -1) return { x: COCO_BELL.x, y: COCO_BELL.y, kind: 'coco-bell' };
  return { x: (row[firstStanding - 1] + row[firstStanding]) / 2, y: DOMINO_Y, kind: 'domino-gap' };
}
