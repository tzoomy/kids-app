// Workshop L20 failure feedback and hint ladder (v4 §1.8). Pure TS, no Phaser. Spec: docs/specs/workshop-l20.md (AC-07, AC-09).
// No buzzer, no "wrong" sound, ever: a failed run is told through the yawn, the capybara mime and Bip's hint voice.
import type { L20Config, SleeperId } from './l20Level';
import type { L20Reason } from './l20World';

/** The robot's ear button: the goal hint (never the solution), any time. */
export const EAR_LINE = 'vo-he-ws-l20-goal';

/** Which friends each bell wakes (cosmetic: they twitch mid-run and, on a one-bell failure, fall asleep again). */
export const BELL_FRIENDS: Record<'coco' | 'morning', readonly SleeperId[]> = {
  coco: ['moustache', 'bruno', 'cocopom'],
  morning: ['pip', 'grandpere', 'plume'],
};

export interface FailInput {
  /** Failed runs so far, counting this one (1 = the first failure). */
  failedRuns: number;
  /** One-bell failures so far, counting this one (0 when this failure is not one). */
  oneBellFails: number;
  reason: L20Reason;
  /** The domino row stopped: dominoes tipped but the chain never reached Coco's bell. */
  dominoRowStopped: boolean;
  config: L20Config;
}

export interface FailFeedback {
  kind: 'one-bell' | 'no-bell';
  sleepersFallAsleep: SleeperId[];
  capybara: 'ring' | 'facepalm';
  sfx: 'sfx-ws-yawn' | null;
  voice: 'vo-fr-ws-l20-one-bell' | 'vo-fr-presque' | null;
}

export interface Hint {
  lineId: string;
  /** Socket that glows (rung 3), or null. */
  glow: string | null;
}

export interface FailPlan {
  feedback: FailFeedback;
  hint: Hint | null;
  /** After 3 failed runs Bip says to breathe (once, on the 3rd). */
  breathe: boolean;
  /** Voice lines to play in this order (one at a time; the next Play cuts them). */
  voices: string[];
}

/** The first thing missing from a solution, as a glowing socket with its hint line; null when the setup is a valid one. */
function glowTarget(config: L20Config): Hint | null {
  if (config.ramp !== 'down-right') return { lineId: 'vo-he-robot-help-2', glow: 'R1' };
  if (config.scissors !== 'A') return { lineId: 'vo-he-ws-scissors-which', glow: 'string-A' };
  const has = (x: number): boolean => config.slots.includes(x);
  if (!has(460) && !has(500)) return { lineId: 'vo-he-ws-dominoes-gap', glow: 'slot-460' };
  if (!has(620)) return { lineId: 'vo-he-ws-dominoes-gap', glow: 'slot-620' };
  return null;
}

const GOAL: Hint = { lineId: EAR_LINE, glow: null };

function pickHint(n: number, input: FailInput): Hint | null {
  const morningMissed = input.reason === 'coco-only' || input.reason === 'no-bell';
  if (n >= 3) return glowTarget(input.config) ?? GOAL;
  if (n === 2) return GOAL;
  if (morningMissed) return { lineId: 'vo-he-ws-scissors-which', glow: null };
  if (input.dominoRowStopped) return { lineId: 'vo-he-ws-dominoes-gap', glow: null };
  return null;
}

/** Everything a failed run shows and says. */
export function planFailure(input: FailInput): FailPlan {
  const oneBell = input.reason === 'coco-only' || input.reason === 'morning-only';
  const feedback: FailFeedback = oneBell
    ? {
        kind: 'one-bell',
        sleepersFallAsleep: [...BELL_FRIENDS[input.reason === 'coco-only' ? 'coco' : 'morning']],
        capybara: 'ring',
        sfx: 'sfx-ws-yawn',
        voice: input.oneBellFails % 2 === 1 ? 'vo-fr-ws-l20-one-bell' : 'vo-fr-presque',
      }
    : { kind: 'no-bell', sleepersFallAsleep: [], capybara: 'facepalm', sfx: null, voice: null };
  const hint = pickHint(input.failedRuns, input);
  const breathe = input.failedRuns === 3;
  const voices: string[] = [];
  const push = (id: string | null | undefined): void => {
    if (id && !voices.includes(id)) voices.push(id);
  };
  push(feedback.voice);
  if (breathe) push('vo-he-robot-breathe');
  push(hint?.lineId);
  return { feedback, hint, breathe, voices };
}
