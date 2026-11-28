// Workshop L20 break-point marker (v4 §1.5/§1.8): where the chain first stopped after a failed run. Pure TS, no Phaser, cosmetic.
// Spec: docs/specs/workshop-l20.md (AC-15).
import { DOMINO_Y, FIXED_DOMINOES, L20_SOCKETS, LEVER_PIVOT, MORNING_BELL, R1, type L20Config } from './l20Level';
import { leverGeometry } from './lever';
import type { L20Event, L20Reason } from './l20World';

export type BreakKind = 'ramp' | 'domino-gap' | 'coco-bell' | 'lever' | 'empty-hook' | 'wrong-string' | 'morning-bell';
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

const socket = (id: string): { x: number; y: number } => L20_SOCKETS.find((s) => s.id === id) as { x: number; y: number };
const STRING_A = socket('string-A');
const STRING_B = socket('string-B');

/**
 * Where the chain first stopped (v5.1). Lever not hit: the low machine comes first (no ramp, a ramp pointing the wrong way, or no domino
 * ever tipped -> the R1 socket; a row that tipped and stopped -> the centre of the strip gap between the last fallen domino of the
 * leading run and the first one still standing; the whole row fell but the lever did not trip -> the lever's left arm). The lever
 * tripped: no scissors -> the empty hook (string A); scissors on B -> the wrong string (string B, the lantern dropped); anything else
 * -> the morning bell. A win has none.
 */
export function chooseBreakPoint(input: BreakInput): BreakPoint | null {
  const { reason, events, config } = input;
  if (reason === 'goal') return null;
  if (reason === 'empty-hook') return { x: STRING_A.x, y: STRING_A.y, kind: 'empty-hook' };
  if (reason === 'wrong-string') return { x: STRING_B.x, y: STRING_B.y, kind: 'wrong-string' };
  if (reason === 'no-goal') return { x: MORNING_BELL.x, y: MORNING_BELL.y, kind: 'morning-bell' };
  const fallen = new Set(events.map((e) => /^domino:(\d+):fallen$/.exec(e.id)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1])));
  const row = [...FIXED_DOMINOES, ...config.slots].sort((a, b) => a - b);
  const firstStanding = row.findIndex((x) => !fallen.has(x));
  if (config.ramp !== 'down-right' || firstStanding === 0 || fallen.size === 0) return { x: R1.x, y: R1.y, kind: 'ramp' };
  if (firstStanding === -1) {
    const tip = leverGeometry(LEVER_PIVOT).leftTip;
    return { x: tip.x, y: tip.y, kind: 'lever' };
  }
  return { x: (row[firstStanding - 1] + row[firstStanding]) / 2, y: DOMINO_Y, kind: 'domino-gap' };
}
