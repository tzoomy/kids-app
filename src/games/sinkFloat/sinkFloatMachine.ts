export const FLOAT_OBJECT_IDS = ['ball', 'leaf', 'apple', 'stone', 'key', 'spoon'] as const;
export type FloatObjectId = (typeof FLOAT_OBJECT_IDS)[number];

export type FloatOutcome = 'floats' | 'sinks';
export type SinkFloatMode = 'free' | 'predict';

export type SinkFloatPhase = 'choosing' | 'predicting' | 'watching';
export const SINK_FLOAT_PHASES: readonly SinkFloatPhase[] = ['choosing', 'predicting', 'watching'];

export interface SinkFloatObjectDef {
  readonly id: FloatObjectId;
  readonly floats: boolean;
}

export const OBJECT_FLOATS: Readonly<Record<FloatObjectId, boolean>> = {
  ball: true,
  leaf: true,
  apple: true,
  stone: false,
  key: false,
  spoon: false,
};

export const FLOAT_OBJECTS: readonly SinkFloatObjectDef[] = FLOAT_OBJECT_IDS.map((id) => ({
  id,
  floats: OBJECT_FLOATS[id],
}));

export interface SinkFloatState {
  readonly mode: SinkFloatMode;
  readonly phase: SinkFloatPhase;
  readonly offered: readonly [FloatObjectId, FloatObjectId, FloatObjectId];
  readonly selected: FloatObjectId | null;
  readonly lastOutcome: FloatOutcome | null;
  readonly lastCorrect: boolean | null;
}

export interface CreateSinkFloatOptions {
  mode: SinkFloatMode;
  offered: readonly [FloatObjectId, FloatObjectId, FloatObjectId];
}

export type SinkFloatEvent =
  | { kind: 'dropped'; objectId: FloatObjectId; outcome: FloatOutcome }
  | { kind: 'asked'; objectId: FloatObjectId }
  | { kind: 'revealed'; objectId: FloatObjectId; guess: FloatOutcome; outcome: FloatOutcome; correct: boolean }
  | { kind: 'settled'; offered: readonly [FloatObjectId, FloatObjectId, FloatObjectId] }
  | { kind: 'busy' };

function assertObjectId(id: FloatObjectId): void {
  if (!(FLOAT_OBJECT_IDS as readonly string[]).includes(id)) {
    throw new Error(`Unknown float object id: ${String(id)}`);
  }
}

function assertOutcome(outcome: FloatOutcome): void {
  if (outcome !== 'floats' && outcome !== 'sinks') {
    throw new Error(`Unknown float outcome: ${String(outcome)}`);
  }
}

function assertMode(mode: SinkFloatMode): void {
  if (mode !== 'free' && mode !== 'predict') {
    throw new Error(`Unknown sink-or-float mode: ${String(mode)}`);
  }
}

function assertOffered(offered: readonly FloatObjectId[]): void {
  if (offered.length !== 3) {
    throw new Error(`Expected 3 offered objects, got ${offered.length}`);
  }
  for (const id of offered) assertObjectId(id);
  if (new Set(offered).size !== 3) {
    throw new Error(`Offered objects must be distinct: ${offered.join(', ')}`);
  }
  const hasFloater = offered.some((id) => OBJECT_FLOATS[id]);
  const hasSinker = offered.some((id) => !OBJECT_FLOATS[id]);
  if (!hasFloater || !hasSinker) {
    throw new Error(`Offered objects must include at least one floater and one sinker: ${offered.join(', ')}`);
  }
}

/** Fixed outcome for each object id. */
export function outcomeFor(id: FloatObjectId): FloatOutcome {
  assertObjectId(id);
  return OBJECT_FLOATS[id] ? 'floats' : 'sinks';
}

function setKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/**
 * Picks 3 distinct object ids containing at least one floater and one sinker,
 * never returning the exact same 3-object set as `previousSet`.
 */
export function offerFor(
  objects: readonly SinkFloatObjectDef[],
  previousSet: readonly FloatObjectId[] | null = null,
  rng: () => number = Math.random,
): readonly [FloatObjectId, FloatObjectId, FloatObjectId] {
  if (objects.length < 3) {
    throw new Error(`offerFor requires at least 3 objects, got ${objects.length}`);
  }
  const candidates: Array<readonly [FloatObjectId, FloatObjectId, FloatObjectId]> = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      for (let k = j + 1; k < objects.length; k++) {
        const a = objects[i];
        const b = objects[j];
        const c = objects[k];
        const floatCount = (a.floats ? 1 : 0) + (b.floats ? 1 : 0) + (c.floats ? 1 : 0);
        if (floatCount >= 1 && floatCount <= 2) {
          candidates.push([a.id, b.id, c.id]);
        }
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error('offerFor requires at least one floater and one sinker');
  }

  const prevKey = previousSet && previousSet.length > 0 ? setKey(previousSet) : null;
  const filtered = prevKey ? candidates.filter((triple) => setKey(triple) !== prevKey) : candidates;
  if (filtered.length === 0) {
    throw new Error('No alternative 3-object set available');
  }

  const rawIndex = Math.floor(Math.max(0, rng()) * filtered.length);
  const picked = [...filtered[Math.min(filtered.length - 1, rawIndex)]];

  // Shuffle display order deterministically with the provided rng.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(Math.max(0, rng()) * (i + 1)));
    const tmp = picked[i];
    picked[i] = picked[j];
    picked[j] = tmp;
  }

  return [picked[0], picked[1], picked[2]];
}

/** Creates an initial Sink or Float machine state in the `choosing` phase. */
export function createSinkFloat(opts: CreateSinkFloatOptions): SinkFloatState {
  assertMode(opts.mode);
  assertOffered(opts.offered);
  return {
    mode: opts.mode,
    phase: 'choosing',
    offered: [...opts.offered] as [FloatObjectId, FloatObjectId, FloatObjectId],
    selected: null,
    lastOutcome: null,
    lastCorrect: null,
  };
}

/** Applies a tap on one of the offered objects without mutating `state`. */
export function tapObject(
  state: SinkFloatState,
  objectId: FloatObjectId,
): { state: SinkFloatState; event: SinkFloatEvent } {
  assertObjectId(objectId);
  if (state.phase !== 'choosing') {
    return { state, event: { kind: 'busy' } };
  }
  if (!state.offered.includes(objectId)) {
    throw new Error(`Object "${objectId}" is not in the current offered set`);
  }

  if (state.mode === 'free') {
    const outcome = outcomeFor(objectId);
    return {
      state: {
        ...state,
        phase: 'watching',
        selected: objectId,
        lastOutcome: outcome,
        lastCorrect: null,
      },
      event: { kind: 'dropped', objectId, outcome },
    };
  }

  return {
    state: {
      ...state,
      phase: 'predicting',
      selected: objectId,
    },
    event: { kind: 'asked', objectId },
  };
}

/** Applies a tap on the Float or Sink prediction button without mutating `state`. */
export function tapPrediction(
  state: SinkFloatState,
  guess: FloatOutcome,
): { state: SinkFloatState; event: SinkFloatEvent } {
  assertOutcome(guess);
  if (state.phase !== 'predicting' || state.selected === null) {
    return { state, event: { kind: 'busy' } };
  }

  const objectId = state.selected;
  const outcome = outcomeFor(objectId);
  const correct = guess === outcome;
  return {
    state: {
      ...state,
      phase: 'watching',
      lastOutcome: outcome,
      lastCorrect: correct,
    },
    event: { kind: 'revealed', objectId, guess, outcome, correct },
  };
}

/**
 * Settles the dropped object after watching and returns to `choosing` with the next offered set.
 * Optionally updates `mode` when an adaptive level transition crossed between free and predict.
 */
export function settle(
  state: SinkFloatState,
  nextOffered?: readonly [FloatObjectId, FloatObjectId, FloatObjectId],
  nextMode?: SinkFloatMode,
): { state: SinkFloatState; event: SinkFloatEvent } {
  if (state.phase !== 'watching') {
    return { state, event: { kind: 'busy' } };
  }
  if (nextOffered !== undefined) assertOffered(nextOffered);
  if (nextMode !== undefined) assertMode(nextMode);

  const offered = nextOffered
    ? ([...nextOffered] as [FloatObjectId, FloatObjectId, FloatObjectId])
    : state.offered;
  return {
    state: {
      mode: nextMode ?? state.mode,
      phase: 'choosing',
      offered,
      selected: null,
      lastOutcome: state.lastOutcome,
      lastCorrect: state.lastCorrect,
    },
    event: { kind: 'settled', offered },
  };
}
