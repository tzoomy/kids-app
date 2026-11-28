// Workshop L20 failure feedback and hint ladder (v4 §1.8). Pure TS, no Phaser. Spec: docs/specs/workshop-l20.md (AC-07, AC-09).
// No buzzer, no "wrong" sound, ever: a failed run is told through the yawn, the capybara mime and Bip's hint voice.
import { DOMINO_SLOTS, type L20Config, type L20PartKind, type SleeperId } from './l20Level';
import type { L20Reason } from './l20World';

/** The robot's ear button: the goal hint (never the solution), any time. */
export const EAR_LINE = 'vo-he-ws-l20-goal';

/** Which friends each bell wakes (cosmetic). Only Coco's small bell rings mid-chain: its friends stir and, if the chain then fails, fall back asleep. */
export const BELL_FRIENDS: Record<'coco' | 'morning', readonly SleeperId[]> = {
  coco: ['moustache', 'bruno', 'cocopom'],
  morning: ['pip', 'grandpere', 'plume'],
};

export interface FailInput {
  /** Failed runs so far, counting this one (1 = the first failure). */
  failedRuns: number;
  /** Failures so far where the small bell had stirred its friends, counting this one (0 when this failure is not one). */
  oneBellFails: number;
  /** Coco's small bell rang (by a domino) before the failure: the friends stirred and must fall back asleep. */
  cocoRang: boolean;
  reason: L20Reason;
  /** The domino row stopped: dominoes tipped but the chain never reached Coco's bell. */
  dominoRowStopped: boolean;
  config: L20Config;
  /** Where every tray part is right now (the ghost and Bip need it); defaults to the parts the config implies. */
  parts?: readonly PartState[];
}

/** One tray part as the ladder sees it: its id, kind, the socket that holds it (null = in the tray), the ramp's direction. */
export interface PartState {
  id: string;
  kind: L20PartKind;
  socketId: string | null;
  flipped: boolean;
}

/** The next part that is wrong or missing: where it should go, how it should sit, and where it is now (null = the tray). */
export interface NextNeeded {
  partId: string;
  kind: L20PartKind;
  socketId: string;
  orientation: 'down-right' | 'upright';
  fromSocketId: string | null;
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
  /** The ladder step reached: the failed-run count, up to 6 (3 glow, 4 trajectory, 5 ghost, 6 Bip places one part). */
  rung: number;
  /** From the 4th failure on: the dotted trajectory of the current setup is on (it stays on with the ghost and Bip). */
  trajectory: boolean;
  /** The 4th failure speaks no new line: a beep marks the new dots (the "Regarde ici !" line is kept for the ghost, never twice in a row). */
  trajectorySfx: 'sfx-robot-beep-1' | null;
  /** Step 5: a ghost of the next needed part, pulsing in its socket until it is placed. */
  ghost: NextNeeded | null;
  /** Step 6: the ONE part Bip places itself (the next needed one). */
  bip: NextNeeded | null;
  bipSfx: 'sfx-robot-beep-1' | null;
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
  // The lever tripped but there is no goal: the cord pulled an empty hook or the wrong string -> "which string".
  const leverTripped = input.reason === 'empty-hook' || input.reason === 'wrong-string' || input.reason === 'no-goal';
  if (n >= 3) return glowTarget(input.config) ?? GOAL;
  if (n === 2) return GOAL;
  if (leverTripped) return { lineId: 'vo-he-ws-scissors-which', glow: null };
  if (input.dominoRowStopped) return { lineId: 'vo-he-ws-dominoes-gap', glow: null };
  return null;
}

/** Everything a failed run shows and says. */
export function planFailure(input: FailInput): FailPlan {
  const feedback: FailFeedback = input.cocoRang
    ? {
        kind: 'one-bell',
        sleepersFallAsleep: [...BELL_FRIENDS.coco],
        capybara: 'ring',
        sfx: 'sfx-ws-yawn',
        voice: input.oneBellFails % 2 === 1 ? 'vo-fr-ws-l20-one-bell' : 'vo-fr-presque',
      }
    : { kind: 'no-bell', sleepersFallAsleep: [], capybara: 'facepalm', sfx: null, voice: null };
  const hint = pickHint(input.failedRuns, input);
  const breathe = input.failedRuns === 3;
  const rung = rungFor(input.failedRuns);
  const needed = rung >= RUNG_GHOST ? nextNeeded(input.parts ?? partsFromConfig(input.config)) : null;
  const ghost = rung === RUNG_GHOST ? needed : null;
  const bip = rung >= RUNG_BIP ? needed : null;
  const trajectory = rung >= RUNG_TRAJECTORY;
  const voices: string[] = [];
  const push = (id: string | null | undefined): void => {
    if (id && !voices.includes(id)) voices.push(id);
  };
  push(feedback.voice);
  if (breathe) push('vo-he-robot-breathe');
  // The ghost and Bip speak their own line; the trajectory step only beeps; the glowing-socket line is spoken on the 3rd failure
  // only (the glow itself stays on until the part is placed).
  if (rung >= RUNG_TRAJECTORY) push(ghost ? RUNG_GHOST_LINE : bip ? RUNG_BIP_LINE : null);
  else push(hint?.lineId);
  return {
    feedback,
    hint,
    breathe,
    rung,
    trajectory,
    trajectorySfx: rung === RUNG_TRAJECTORY ? 'sfx-robot-beep-1' : null,
    ghost,
    bip,
    bipSfx: bip ? 'sfx-robot-beep-1' : null,
    voices,
  };
}

export const RUNG_GHOST_LINE = 'vo-fr-robot-regarde';
export const RUNG_BIP_LINE = 'vo-fr-robot-aide';

/** Ladder steps (the failed-run count that reaches them). v4 §1.8 numbers the trajectory "rung 2"; the team lead moved it after the glow. */
export const RUNG_TRAJECTORY = 4;
export const RUNG_GHOST = 5;
export const RUNG_BIP = 6;

/** The ladder step a failure count reaches: 3 glowing socket, 4 trajectory, 5 ghost part, 6 Bip places one part (the hook's `hintRung`). */
export function rungFor(failedRuns: number): number {
  return Math.max(0, Math.min(RUNG_BIP, Math.floor(failedRuns)));
}

const TRAY_IDS: Record<L20PartKind, readonly string[]> = { ramp: ['ramp'], domino: ['domino1', 'domino2'], scissors: ['scissors'] };

/** The parts a config implies (ids as in the scene; spare dominoes stay in the tray). For callers that only know the config. */
export function partsFromConfig(config: L20Config): PartState[] {
  const slots = [...config.slots];
  return [
    { id: 'ramp', kind: 'ramp', socketId: config.ramp === 'none' ? null : 'R1', flipped: config.ramp === 'down-left' },
    ...TRAY_IDS.domino.map((id, i): PartState => ({ id, kind: 'domino', socketId: slots[i] !== undefined ? `slot-${slots[i]}` : null, flipped: false })),
    { id: 'scissors', kind: 'scissors', socketId: config.scissors === 'A' ? 'string-A' : config.scissors === 'B' ? 'string-B' : null, flipped: false },
  ];
}

const VALID_DOMINO_SETS: readonly (readonly number[])[] = [
  [460, 620],
  [500, 620],
];

/**
 * The next socket that is still wrong or empty, in the order of rung 3: the ramp down-right in R1, then the scissors on string
 * A, then a domino slot that completes {460,620} or {500,620} given what is already placed. A part from the tray is used before
 * one that has to be lifted from a wrong socket. null when the setup is already a valid one (the ghost and Bip then do nothing).
 */
export function nextNeeded(parts: readonly PartState[]): NextNeeded | null {
  const ramp = parts.find((p) => p.kind === 'ramp');
  if (ramp && !(ramp.socketId === 'R1' && !ramp.flipped)) {
    return { partId: ramp.id, kind: 'ramp', socketId: 'R1', orientation: 'down-right', fromSocketId: ramp.socketId };
  }
  const scissors = parts.find((p) => p.kind === 'scissors');
  if (scissors && scissors.socketId !== 'string-A') {
    return { partId: scissors.id, kind: 'scissors', socketId: 'string-A', orientation: 'upright', fromSocketId: scissors.socketId };
  }
  const dominoes = parts.filter((p) => p.kind === 'domino');
  const slotOf = (p: PartState): number | null => {
    const m = p.socketId ? /^slot-(\d+)$/.exec(p.socketId) : null;
    return m ? Number(m[1]) : null;
  };
  const placed = new Set(dominoes.map(slotOf).filter((x): x is number => x !== null && (DOMINO_SLOTS as readonly number[]).includes(x)));
  // The valid set the placements are closest to (ties go to {460,620}).
  const target = VALID_DOMINO_SETS.reduce((best, s) => (s.filter((x) => placed.has(x)).length > best.filter((x) => placed.has(x)).length ? s : best));
  const missing = target.filter((x) => !placed.has(x)).sort((a, b) => (a === 620 ? 1 : 0) - (b === 620 ? 1 : 0) || a - b);
  if (missing.length === 0) return null;
  const free = dominoes.find((p) => p.socketId === null);
  const wrong = dominoes.find((p) => {
    const x = slotOf(p);
    return x !== null && !target.includes(x);
  });
  const mover = free ?? wrong;
  if (!mover) return null;
  return { partId: mover.id, kind: 'domino', socketId: `slot-${missing[0]}`, orientation: 'upright', fromSocketId: mover.socketId };
}
