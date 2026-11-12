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
}

export interface OrchestraTrial {
  instruments: OrchestraInstrumentId[];
  sequence: OrchestraInstrumentId[];
  support: OrchestraSupport;
  speed: number;
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
  return {
    instruments,
    sequence: buildSequence(instruments, level.sequenceLength, random),
    support: level.support,
    speed: level.speed,
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
