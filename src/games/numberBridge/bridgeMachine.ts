// Pure, immutable state machine and sequence generator for Number Bridge (docs/specs/number-bridge.md).
// No Phaser, no DOM, no failure phase: every bridge is always completed and crossed.

export type BridgePhase = 'building' | 'crossing';
export const BRIDGE_PHASES: readonly BridgePhase[] = ['building', 'crossing'] as const;

export type BridgeMode = 'one-more' | 'missing';

export interface BridgeSpec {
  readonly mode: BridgeMode;
  readonly sequence: readonly number[];
  readonly gaps: readonly number[];
  readonly answer: number | null;
  readonly choices: readonly number[];
}

export interface BridgeState {
  readonly phase: BridgePhase;
  readonly mode: BridgeMode;
  readonly sequence: readonly number[];
  readonly initialGaps: readonly number[];
  readonly gaps: readonly number[];
  readonly answer: number | null;
  readonly choices: readonly number[];
  readonly tries: number;
}

export type BridgeEvent =
  | { kind: 'placed'; gapIndex: number; stoneNumber: number; remainingGaps: number }
  | { kind: 'complete'; gapIndex: number; stoneNumber: number; tries: number }
  | { kind: 'not-this-one'; picked: number; answer: number; tries: number }
  | { kind: 'busy' }
  | { kind: 'next'; mode: BridgeMode; sequence: readonly number[]; gaps: readonly number[] };

export interface BridgePlanInput {
  readonly mode: BridgeMode;
  readonly stones: number;
  readonly gaps: number;
  readonly range: number;
}

export interface PreviousBridge {
  readonly sequence: readonly number[];
  readonly gaps: readonly number[];
}

function pickIndex(len: number, rng: () => number): number {
  const raw = Math.floor(Math.max(0, rng()) * len);
  return Math.min(len - 1, raw);
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1, rng);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function validateSpec(spec: BridgeSpec): void {
  if (spec.sequence.length < 2) {
    throw new Error('Bridge sequence must have at least 2 stones');
  }
  if (spec.gaps.length < 1) {
    throw new Error('Bridge must start with at least 1 gap');
  }
  const seen = new Set<number>();
  for (const idx of spec.gaps) {
    if (!Number.isInteger(idx) || idx < 1 || idx >= spec.sequence.length) {
      throw new Error(`Invalid gap index ${idx} (must be 1..${spec.sequence.length - 1})`);
    }
    if (seen.has(idx)) {
      throw new Error(`Duplicate gap index ${idx}`);
    }
    seen.add(idx);
  }
  if (spec.mode === 'one-more') {
    if (spec.answer !== null || spec.choices.length !== 0) {
      throw new Error('one-more bridge must have null answer and empty choices');
    }
  } else {
    if (spec.gaps.length !== 1) {
      throw new Error('missing bridge must have exactly 1 gap');
    }
    const expected = spec.sequence[spec.gaps[0]];
    if (spec.answer !== expected) {
      throw new Error(`missing bridge answer ${String(spec.answer)} does not match sequence gap ${expected}`);
    }
    if (spec.choices.length !== 3 || !spec.choices.includes(expected)) {
      throw new Error('missing bridge must have 3 choices including the answer');
    }
  }
}

/**
 * Generates a bridge sequence, gap indices, answer, and three choices per docs/specs/number-bridge.md:
 * consecutive ascending numbers inside 1..range, gap never first, at least one wrong choice adjacent
 * to the answer (answer ± 1), and never repeating the same sequence and gap twice in a row.
 */
export function buildBridge(
  plan: BridgePlanInput,
  previous?: PreviousBridge | null,
  rng: () => number = Math.random,
): BridgeSpec {
  const stones = Math.floor(plan.stones);
  const gapCount = Math.floor(plan.gaps);
  if (!Number.isInteger(stones) || stones < 2) {
    throw new Error(`bridge needs at least 2 stones (got ${plan.stones})`);
  }
  if (gapCount < 1 || gapCount > stones - 1) {
    throw new Error(`bridge gaps must be 1..${stones - 1} (got ${plan.gaps})`);
  }
  if (plan.mode === 'one-more') {
    // Age-2 bridges always count from 1 (deterministic by design; repeat-avoidance applies to missing-number bridges).
    const sequence = Array.from({ length: stones }, (_, i) => i + 1);
    const gaps = Array.from({ length: gapCount }, (_, i) => stones - gapCount + i);
    return { mode: 'one-more', sequence, gaps, answer: null, choices: [] };
  }

  const range = Math.floor(plan.range);
  if (gapCount !== 1) {
    throw new Error(`missing bridge has exactly 1 gap (got ${plan.gaps})`);
  }
  if (range < 5 || range < stones) {
    throw new Error(`missing bridge requires range >= max(5, stones) (got ${plan.range})`);
  }

  interface Candidate {
    sequence: number[];
    gapIndex: number;
  }
  const all: Candidate[] = [];
  for (let start = 1; start <= range - stones + 1; start++) {
    const sequence = Array.from({ length: stones }, (_, i) => start + i);
    for (let gapIndex = 1; gapIndex < stones; gapIndex++) {
      all.push({ sequence, gapIndex });
    }
  }

  const filtered = previous
    ? all.filter((c) => !(arraysEqual(c.sequence, previous.sequence) && arraysEqual([c.gapIndex], previous.gaps)))
    : all;
  const pool = filtered.length > 0 ? filtered : all;
  const chosen = pool[pickIndex(pool.length, rng)];

  const answer = chosen.sequence[chosen.gapIndex];
  const adjacentPool = [answer - 1, answer + 1].filter((n) => n >= 1 && n <= range);
  const adjacentWrong = adjacentPool[pickIndex(adjacentPool.length, rng)];
  const otherPool: number[] = [];
  for (let n = 1; n <= range; n++) {
    if (n !== answer && n !== adjacentWrong) otherPool.push(n);
  }
  const otherWrong = otherPool[pickIndex(otherPool.length, rng)];
  const choices = shuffleWithRng([answer, adjacentWrong, otherWrong], rng);

  return {
    mode: 'missing',
    sequence: chosen.sequence,
    gaps: [chosen.gapIndex],
    answer,
    choices,
  };
}

/** Creates an initial `building` state from a validated bridge spec. */
export function createBridge(spec: BridgeSpec): BridgeState {
  validateSpec(spec);
  const gaps = [...spec.gaps];
  return {
    phase: 'building',
    mode: spec.mode,
    sequence: [...spec.sequence],
    initialGaps: [...gaps],
    gaps,
    answer: spec.answer,
    choices: [...spec.choices],
    tries: 0,
  };
}

/** Handles a tap on the bank stone pile in `one-more` mode without mutating `state`. */
export function tapPile(state: BridgeState): { state: BridgeState; event: BridgeEvent } {
  if (state.phase === 'crossing') {
    return { state, event: { kind: 'busy' } };
  }
  if (state.mode !== 'one-more') {
    // The pile is not on screen in missing mode; treat a stray tap as a no-op.
    return { state, event: { kind: 'busy' } };
  }
  const gapIndex = state.gaps[0];
  const stoneNumber = state.sequence[gapIndex];
  const restGaps = state.gaps.slice(1);
  if (restGaps.length === 0) {
    return {
      state: { ...state, phase: 'crossing', gaps: [] },
      event: { kind: 'complete', gapIndex, stoneNumber, tries: state.tries },
    };
  }
  return {
    state: { ...state, phase: 'building', gaps: restGaps },
    event: { kind: 'placed', gapIndex, stoneNumber, remainingGaps: restGaps.length },
  };
}

/** Handles a tap on a numbered choice stone in `missing` mode without mutating `state`. */
export function tapChoice(state: BridgeState, picked: number): { state: BridgeState; event: BridgeEvent } {
  if (state.phase === 'crossing') {
    return { state, event: { kind: 'busy' } };
  }
  if (state.mode !== 'missing' || state.answer === null) {
    // Choice stones are not on screen in one-more mode; treat a stray tap as a no-op.
    return { state, event: { kind: 'busy' } };
  }
  const tries = state.tries + 1;
  if (picked === state.answer) {
    const gapIndex = state.gaps[0];
    return {
      state: { ...state, phase: 'crossing', gaps: [], tries },
      event: { kind: 'complete', gapIndex, stoneNumber: picked, tries },
    };
  }
  return {
    state: { ...state, phase: 'building', tries },
    event: { kind: 'not-this-one', picked, answer: state.answer, tries },
  };
}

/** Advances to the next bridge (`building` phase) without mutating the previous state. */
export function nextBridge(_state: BridgeState, spec: BridgeSpec): { state: BridgeState; event: BridgeEvent } {
  const nextState = createBridge(spec);
  return {
    state: nextState,
    event: { kind: 'next', mode: nextState.mode, sequence: nextState.sequence, gaps: nextState.gaps },
  };
}
