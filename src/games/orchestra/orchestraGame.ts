/**
 * Pure Kitchen Orchestra helpers (no Phaser). Sequence building, echo checking,
 * playback timing, and the instrument set for each choiceCount.
 */
import type { OrchestraInstrumentId, OrchestraSupport } from '../../content/schema';

export const ORCHESTRA_INSTRUMENT_ORDER: Record<number, OrchestraInstrumentId[]> = {
  3: ['pot', 'pan', 'glass-mid'],
  4: ['pot', 'pan', 'glass-low', 'glass-high'],
  5: ['pot', 'pan', 'glass-low', 'glass-mid', 'glass-high'],
};

/** Gap between notes, in ms, at speed 1. Speed 0.8 is slower; 1.2 is faster. */
export const BASE_NOTE_GAP_MS = 700;
/** How long a played note / glow is held at speed 1. */
export const BASE_NOTE_HOLD_MS = 320;

export interface OrchestraLevelLevers {
  sequenceLength: number;
  choiceCount: number;
  speed: number;
  support: OrchestraSupport;
  /** Age-5 reverse echo (`extra.order: "reverse"`): the child plays the pattern from the last note to the first. */
  reverse?: boolean;
}

export interface OrchestraTrial {
  instruments: OrchestraInstrumentId[];
  /** The pattern the chef plays, in playing order. */
  sequence: OrchestraInstrumentId[];
  /** The taps the child must make: `sequence`, or `sequence` reversed on a reverse level. */
  answer: OrchestraInstrumentId[];
  reverse: boolean;
  support: OrchestraSupport;
  speed: number;
}

/** True when the pattern reads the same backwards (a reverse trial would not test the rule). */
export function isPalindrome(sequence: readonly OrchestraInstrumentId[]): boolean {
  return sequence.every((id, i) => id === sequence[sequence.length - 1 - i]);
}

export function instrumentsForChoiceCount(choiceCount: number): OrchestraInstrumentId[] {
  const set = ORCHESTRA_INSTRUMENT_ORDER[choiceCount];
  if (!set) throw new Error(`No instrument set for choiceCount ${choiceCount}`);
  return [...set];
}

export function noteGapMs(speed: number): number {
  return Math.round(BASE_NOTE_GAP_MS / Math.max(0.25, speed));
}

export function noteHoldMs(speed: number): number {
  return Math.round(BASE_NOTE_HOLD_MS / Math.max(0.25, speed));
}

/** After a miss, replay 25% slower with lights on (research: free hint). */
export function replaySpeed(speed: number): number {
  return speed * 0.75;
}

export function buildSequence(
  instruments: readonly OrchestraInstrumentId[],
  length: number,
  random: () => number = Math.random,
): OrchestraInstrumentId[] {
  if (instruments.length === 0) throw new Error('no instruments');
  const sequence: OrchestraInstrumentId[] = [];
  for (let i = 0; i < length; i++) {
    let pick = instruments[Math.floor(random() * instruments.length)] ?? instruments[0];
    // Avoid immediate repeats when there is a choice, so a 2-year-old can hear two notes.
    if (length > 1 && instruments.length > 1 && pick === sequence[i - 1]) {
      pick = instruments[(instruments.indexOf(pick) + 1) % instruments.length] ?? pick;
    }
    sequence.push(pick);
  }
  return sequence;
}

export function buildTrial(level: OrchestraLevelLevers, random: () => number = Math.random): OrchestraTrial {
  const instruments = instrumentsForChoiceCount(level.choiceCount);
  const reverse = level.reverse === true && level.sequenceLength > 1;
  let sequence = buildSequence(instruments, level.sequenceLength, random);
  if (reverse && isPalindrome(sequence)) {
    // Backwards must differ from forwards: change the last note (never to its neighbour, so no repeat appears).
    const last = sequence.length - 1;
    const options = instruments.filter((id) => id !== sequence[last] && id !== sequence[last - 1]);
    sequence = [...sequence.slice(0, last), options[0] ?? sequence[last]];
  }
  return {
    instruments,
    sequence,
    answer: reverse ? [...sequence].reverse() : [...sequence],
    reverse,
    support: level.support,
    speed: level.speed,
  };
}

/** Reads the levers from a validated content level. */
export function orchestraLevers(level: {
  sequenceLength?: number;
  choiceCount?: number;
  speed?: number;
  support?: string;
  extra?: Record<string, string | number | boolean>;
}): OrchestraLevelLevers {
  return {
    sequenceLength: level.sequenceLength ?? 1,
    choiceCount: level.choiceCount ?? 3,
    speed: level.speed ?? 1,
    support: (level.support as OrchestraSupport | undefined) ?? 'lit',
    reverse: level.extra?.order === 'reverse',
  };
}

export type EchoStep = { kind: 'continue'; nextIndex: number } | { kind: 'complete' } | { kind: 'miss' };

/** Check one echo tap. `index` is the number of correct taps already accepted. */
export function checkEchoTap(
  sequence: readonly OrchestraInstrumentId[],
  index: number,
  tapped: OrchestraInstrumentId,
): EchoStep {
  if (index < 0 || index >= sequence.length) return { kind: 'miss' };
  if (tapped !== sequence[index]) return { kind: 'miss' };
  const nextIndex = index + 1;
  if (nextIndex >= sequence.length) return { kind: 'complete' };
  return { kind: 'continue', nextIndex };
}

export function showsVisualSupport(support: OrchestraSupport): boolean {
  return support !== 'audio-only';
}

export function keepsGlowLit(support: OrchestraSupport): boolean {
  return support === 'lit';
}
