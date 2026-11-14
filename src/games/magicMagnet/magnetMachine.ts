export type MagnetMode = 'free' | 'predict';

export type MagnetPhase = 'exploring' | 'predicting' | 'testing' | 'done';
export const MAGNET_PHASES: readonly MagnetPhase[] = ['exploring', 'predicting', 'testing', 'done'];

export interface MagnetRoundObject {
  readonly id: string;
  readonly metal: boolean;
  readonly stuck: boolean;
}

export interface MagnetPredictResult {
  readonly id: string;
  readonly metal: boolean;
  readonly predicted: boolean;
  readonly correct: boolean;
}

export interface MagnetState {
  readonly mode: MagnetMode;
  readonly phase: MagnetPhase;
  readonly objects: readonly MagnetRoundObject[];
  readonly targetIndex: number | null;
  readonly prediction: boolean | null;
  readonly results: readonly MagnetPredictResult[];
}

export interface CreateMagnetRoundOptions {
  mode: MagnetMode;
  objects: readonly { id: string; metal: boolean }[];
}

export type MagnetEvent =
  | { kind: 'stuck'; id: string; roundComplete: boolean }
  | { kind: 'wiggled'; id: string }
  | { kind: 'predicted'; id: string; sticks: boolean }
  | { kind: 'revealed'; id: string; sticks: boolean; correct: boolean; roundComplete: boolean }
  | { kind: 'busy' };

function findObjectIndex(state: MagnetState, id: string): number {
  const idx = state.objects.findIndex((o) => o.id === id);
  if (idx < 0) {
    throw new Error(`Unknown magnet object id: ${String(id)}`);
  }
  return idx;
}

/** Creates an initial round state in free ('exploring') or predict ('predicting') mode. Never enters a failure phase. */
export function createMagnetRound(opts: CreateMagnetRoundOptions): MagnetState {
  if (opts.mode !== 'free' && opts.mode !== 'predict') {
    throw new Error(`Unknown magnet mode: ${String(opts.mode)}`);
  }
  if (opts.objects.length < 2) {
    throw new Error('Magnet round requires at least 2 objects');
  }
  const seen = new Set<string>();
  let hasMetal = false;
  let hasNonMetal = false;
  const objects: MagnetRoundObject[] = opts.objects.map((o) => {
    if (!o.id || seen.has(o.id)) {
      throw new Error(`Duplicate or empty object id: ${String(o.id)}`);
    }
    seen.add(o.id);
    if (o.metal) hasMetal = true;
    else hasNonMetal = true;
    return { id: o.id, metal: o.metal, stuck: false };
  });
  if (!hasMetal || !hasNonMetal) {
    throw new Error('Magnet round requires at least one metal and one non-metal object');
  }

  return {
    mode: opts.mode,
    phase: opts.mode === 'free' ? 'exploring' : 'predicting',
    objects,
    targetIndex: opts.mode === 'free' ? null : 0,
    prediction: null,
    results: [],
  };
}

/** Applies an object touch (drag into reach or tap-glide) without mutating the input state. */
export function touch(state: MagnetState, id: string): { state: MagnetState; event: MagnetEvent } {
  const idx = findObjectIndex(state, id);

  if (state.phase === 'exploring') {
    const obj = state.objects[idx];
    if (!obj.metal) {
      return { state, event: { kind: 'wiggled', id } };
    }
    if (obj.stuck) {
      return { state, event: { kind: 'busy' } };
    }
    const nextObjects = state.objects.map((o, i) => (i === idx ? { ...o, stuck: true } : o));
    const roundComplete = nextObjects.every((o) => !o.metal || o.stuck);
    return {
      state: {
        ...state,
        phase: roundComplete ? 'done' : 'exploring',
        objects: nextObjects,
      },
      event: { kind: 'stuck', id, roundComplete },
    };
  }

  if (state.phase === 'testing') {
    const targetIdx = state.targetIndex;
    if (targetIdx === null || state.prediction === null) {
      return { state, event: { kind: 'busy' } };
    }
    const target = state.objects[targetIdx];
    if (!target || target.id !== id) {
      return { state, event: { kind: 'busy' } };
    }
    const sticks = target.metal;
    const correct = state.prediction === sticks;
    const nextObjects = sticks
      ? state.objects.map((o, i) => (i === targetIdx ? { ...o, stuck: true } : o))
      : state.objects;
    const nextIndex = targetIdx + 1;
    const roundComplete = nextIndex >= state.objects.length;
    const nextResults: readonly MagnetPredictResult[] = [
      ...state.results,
      { id, metal: sticks, predicted: state.prediction, correct },
    ];
    return {
      state: {
        ...state,
        phase: roundComplete ? 'done' : 'predicting',
        objects: nextObjects,
        targetIndex: roundComplete ? null : nextIndex,
        prediction: null,
        results: nextResults,
      },
      event: { kind: 'revealed', id, sticks, correct, roundComplete },
    };
  }

  return { state, event: { kind: 'busy' } };
}

/** Records a prediction ("sticks" or "doesn't stick") for the current target object. */
export function predict(state: MagnetState, sticks: boolean): { state: MagnetState; event: MagnetEvent } {
  if (state.phase !== 'predicting' || state.targetIndex === null) {
    return { state, event: { kind: 'busy' } };
  }
  const target = state.objects[state.targetIndex];
  if (!target) {
    return { state, event: { kind: 'busy' } };
  }
  return {
    state: {
      ...state,
      phase: 'testing',
      prediction: sticks,
    },
    event: { kind: 'predicted', id: target.id, sticks },
  };
}
