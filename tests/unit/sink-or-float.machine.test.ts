import { describe, expect, it } from 'vitest';
import {
  FLOAT_OBJECTS,
  FLOAT_OBJECT_IDS,
  OBJECT_FLOATS,
  SINK_FLOAT_PHASES,
  createSinkFloat,
  offerFor,
  outcomeFor,
  settle,
  tapObject,
  tapPrediction,
  type FloatObjectId,
  type FloatOutcome,
  type SinkFloatState,
} from '@/games/sinkFloat/sinkFloatMachine';

/** Deterministic seeded LCG (no Math.random). */
function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function setKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

function canReturnToChoosing(state: SinkFloatState): boolean {
  if (state.phase === 'choosing') return true;
  if (state.phase === 'predicting') {
    const { state: watched } = tapPrediction(state, 'floats');
    const { state: settled } = settle(watched);
    return settled.phase === 'choosing';
  }
  const { state: settled } = settle(state);
  return settled.phase === 'choosing';
}

describe('sinkFloatMachine', () => {
  it('[AC-02] every object has a fixed outcome and offerFor returns 3 objects with at least one floater and one sinker, never repeating the previous set', () => {
    expect(FLOAT_OBJECT_IDS).toEqual(['ball', 'leaf', 'apple', 'stone', 'key', 'spoon']);
    expect(outcomeFor('ball')).toBe('floats');
    expect(outcomeFor('leaf')).toBe('floats');
    expect(outcomeFor('apple')).toBe('floats');
    expect(outcomeFor('stone')).toBe('sinks');
    expect(outcomeFor('key')).toBe('sinks');
    expect(outcomeFor('spoon')).toBe('sinks');

    let prev: readonly FloatObjectId[] | null = null;
    const rng = createLcg(42);
    for (let round = 0; round < 30; round++) {
      const offered = offerFor(FLOAT_OBJECTS, prev, rng);
      expect(offered).toHaveLength(3);
      expect(new Set(offered).size).toBe(3);
      expect(offered.some((id) => OBJECT_FLOATS[id])).toBe(true);
      expect(offered.some((id) => !OBJECT_FLOATS[id])).toBe(true);
      if (prev !== null) {
        expect(setKey(offered)).not.toBe(setKey(prev));
      }
      prev = offered;
    }

    // Even with constant rng outputs, offerFor never loops and never repeats previousSet.
    const fixedPrev: readonly FloatObjectId[] = ['ball', 'leaf', 'stone'];
    for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
      const offered = offerFor(FLOAT_OBJECTS, fixedPrev, () => r);
      expect(setKey(offered)).not.toBe(setKey(fixedPrev));
      expect(offered.some((id) => OBJECT_FLOATS[id])).toBe(true);
      expect(offered.some((id) => !OBJECT_FLOATS[id])).toBe(true);
    }
  });

  it('[AC-03] has no failure state: phases are strictly choosing, predicting and watching, and every tap sequence returns to choosing', () => {
    expect(SINK_FLOAT_PHASES).toEqual(['choosing', 'predicting', 'watching']);
    expect(SINK_FLOAT_PHASES).toHaveLength(3);

    const outcomes: readonly FloatOutcome[] = ['floats', 'sinks'];
    for (const mode of ['free', 'predict'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const rand = createLcg(seed * 97);
        let offered = offerFor(FLOAT_OBJECTS, null, rand);
        let state = createSinkFloat({ mode, offered });

        for (let step = 0; step < 80; step++) {
          const action = rand();
          if (action < 0.45) {
            const pick = state.offered[Math.floor(rand() * state.offered.length)];
            state = tapObject(state, pick).state;
          } else if (action < 0.8) {
            const guess = outcomes[Math.floor(rand() * outcomes.length)];
            state = tapPrediction(state, guess).state;
          } else {
            const nextOffered = offerFor(FLOAT_OBJECTS, state.offered, rand);
            state = settle(state, nextOffered).state;
          }
          expect(SINK_FLOAT_PHASES).toContain(state.phase);
          expect(canReturnToChoosing(state)).toBe(true);
        }

        // Regardless of where the sequence stopped, finishing remaining steps reaches choosing.
        if (state.phase === 'predicting') {
          state = tapPrediction(state, 'sinks').state;
        }
        if (state.phase === 'watching') {
          offered = offerFor(FLOAT_OBJECTS, state.offered, rand);
          state = settle(state, offered).state;
        }
        expect(state.phase).toBe('choosing');
      }
    }
  });

  it('[AC-04] free mode: tapping an object drops it into watching, ignores busy taps, and settles back to choosing', () => {
    const offered: readonly [FloatObjectId, FloatObjectId, FloatObjectId] = ['ball', 'stone', 'apple'];
    const s0 = createSinkFloat({ mode: 'free', offered });
    expect(s0).toEqual({
      mode: 'free',
      phase: 'choosing',
      offered,
      selected: null,
      lastOutcome: null,
      lastCorrect: null,
    });

    const predIgnored = tapPrediction(s0, 'floats');
    expect(predIgnored.event).toEqual({ kind: 'busy' });
    expect(predIgnored.state).toEqual(s0);

    const drop = tapObject(s0, 'stone');
    expect(drop.event).toEqual({ kind: 'dropped', objectId: 'stone', outcome: 'sinks' });
    expect(drop.state).toEqual({
      mode: 'free',
      phase: 'watching',
      offered,
      selected: 'stone',
      lastOutcome: 'sinks',
      lastCorrect: null,
    });

    const busyObj = tapObject(drop.state, 'ball');
    expect(busyObj.event).toEqual({ kind: 'busy' });
    expect(busyObj.state).toEqual(drop.state);

    const nextOffered: readonly [FloatObjectId, FloatObjectId, FloatObjectId] = ['leaf', 'key', 'spoon'];
    const settled = settle(drop.state, nextOffered);
    expect(settled.event).toEqual({ kind: 'settled', offered: nextOffered });
    expect(settled.state).toEqual({
      mode: 'free',
      phase: 'choosing',
      offered: nextOffered,
      selected: null,
      lastOutcome: 'sinks',
      lastCorrect: null,
    });
  });

  it('[AC-05] predict mode: tapObject asks, right and wrong predictions both reveal the real outcome, and settle returns to choosing', () => {
    const offered: readonly [FloatObjectId, FloatObjectId, FloatObjectId] = ['apple', 'key', 'leaf'];
    const s0 = createSinkFloat({ mode: 'predict', offered });

    const ask1 = tapObject(s0, 'apple');
    expect(ask1.event).toEqual({ kind: 'asked', objectId: 'apple' });
    expect(ask1.state.phase).toBe('predicting');
    expect(ask1.state.selected).toBe('apple');

    // Tapping another object while predicting is ignored as busy.
    expect(tapObject(ask1.state, 'key').event).toEqual({ kind: 'busy' });

    // Wrong guess ("sinks" for apple) still reveals the real outcome ("floats").
    const wrong = tapPrediction(ask1.state, 'sinks');
    expect(wrong.event).toEqual({
      kind: 'revealed',
      objectId: 'apple',
      guess: 'sinks',
      outcome: 'floats',
      correct: false,
    });
    expect(wrong.state.phase).toBe('watching');
    expect(wrong.state.lastOutcome).toBe('floats');
    expect(wrong.state.lastCorrect).toBe(false);

    const nextOffered: readonly [FloatObjectId, FloatObjectId, FloatObjectId] = ['stone', 'ball', 'spoon'];
    const round2 = settle(wrong.state, nextOffered).state;
    expect(round2.phase).toBe('choosing');
    expect(round2.selected).toBeNull();

    // Right guess ("sinks" for stone).
    const ask2 = tapObject(round2, 'stone').state;
    const right = tapPrediction(ask2, 'sinks');
    expect(right.event).toEqual({
      kind: 'revealed',
      objectId: 'stone',
      guess: 'sinks',
      outcome: 'sinks',
      correct: true,
    });
    expect(right.state.lastCorrect).toBe(true);
  });

  it('[AC-02] machine functions are immutable and validate inputs', () => {
    const offered: readonly [FloatObjectId, FloatObjectId, FloatObjectId] = ['ball', 'stone', 'leaf'];
    const s0 = createSinkFloat({ mode: 'predict', offered });
    const s0Snap = structuredClone(s0);

    const s1 = tapObject(s0, 'ball').state;
    expect(s0).toEqual(s0Snap);
    const s1Snap = structuredClone(s1);

    const s2 = tapPrediction(s1, 'floats').state;
    expect(s1).toEqual(s1Snap);
    const s2Snap = structuredClone(s2);

    settle(s2, ['apple', 'key', 'spoon']);
    expect(s2).toEqual(s2Snap);

    expect(() => outcomeFor('brick' as FloatObjectId)).toThrow();
    expect(() => createSinkFloat({ mode: 'free', offered: ['ball', 'leaf', 'apple'] })).toThrow();
    expect(() => createSinkFloat({ mode: 'free', offered: ['stone', 'key', 'spoon'] })).toThrow();
    expect(() => createSinkFloat({ mode: 'free', offered: ['ball', 'ball', 'stone'] })).toThrow();
    expect(() => tapObject(s0, 'spoon')).toThrow();
    expect(() => tapPrediction(s1, 'maybe' as FloatOutcome)).toThrow();
  });
});
