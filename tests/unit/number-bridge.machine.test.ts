import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PHASES,
  buildBridge,
  createBridge,
  nextBridge,
  tapChoice,
  tapPile,
  type BridgeSpec,
  type PreviousBridge,
} from '@/games/numberBridge/bridgeMachine';

function makeRng(seed = 1337): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function isConsecutiveAscending(seq: readonly number[]): boolean {
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] !== seq[i - 1] + 1) return false;
  }
  return true;
}

describe('Number Bridge: pure state machine and sequence generator', () => {
  it('[AC-02] buildBridge generates valid consecutive sequences, anchors index 0, includes a +-1 distractor, and avoids immediate repeats', () => {
    const rng = makeRng(42);
    const plans = [
      { mode: 'one-more' as const, stones: 3, gaps: 1, range: 5 },
      { mode: 'one-more' as const, stones: 4, gaps: 2, range: 5 },
      { mode: 'missing' as const, stones: 4, gaps: 1, range: 5 },
      { mode: 'missing' as const, stones: 5, gaps: 1, range: 10 },
    ];

    for (const plan of plans) {
      let prev: PreviousBridge | null = null;
      for (let i = 0; i < 30; i++) {
        const spec = buildBridge(plan, prev, rng);
        expect(spec.mode).toBe(plan.mode);
        expect(spec.sequence).toHaveLength(plan.stones);
        expect(isConsecutiveAscending(spec.sequence)).toBe(true);
        for (const n of spec.sequence) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(plan.range);
        }

        // Index 0 is always present so the child sees a starting anchor stone.
        expect(spec.gaps).toHaveLength(plan.gaps);
        for (const gapIdx of spec.gaps) {
          expect(gapIdx).toBeGreaterThanOrEqual(1);
          expect(gapIdx).toBeLessThan(plan.stones);
        }

        if (plan.mode === 'one-more') {
          expect(spec.answer).toBeNull();
          expect(spec.choices).toEqual([]);
          const expectedGaps = Array.from({ length: plan.gaps }, (_, idx) => plan.stones - plan.gaps + idx);
          expect(spec.gaps).toEqual(expectedGaps);
        } else {
          expect(spec.answer).toBe(spec.sequence[spec.gaps[0]]);
          expect(spec.choices).toHaveLength(3);
          expect(new Set(spec.choices).size).toBe(3);
          expect(spec.choices).toContain(spec.answer);
          for (const choice of spec.choices) {
            expect(choice).toBeGreaterThanOrEqual(1);
            expect(choice).toBeLessThanOrEqual(plan.range);
          }
          const ans = spec.answer!;
          const hasNeighbor = spec.choices.some((c) => c === ans - 1 || c === ans + 1);
          expect(hasNeighbor).toBe(true);
        }

        // One-more bridges always count from 1 by design; repeat-avoidance covers missing-number bridges.
        if (prev && plan.mode === 'missing') {
          const sameSeq =
            prev.sequence.length === spec.sequence.length &&
            prev.sequence.every((n, idx) => n === spec.sequence[idx]);
          const sameGaps =
            prev.gaps.length === spec.gaps.length &&
            prev.gaps.every((g, idx) => g === spec.gaps[idx]);
          expect(sameSeq && sameGaps).toBe(false);
        }
        prev = { sequence: spec.sequence, gaps: spec.gaps };
      }
    }
  });

  it('[AC-02] buildBridge rejects invalid stone counts, gap counts, or ranges', () => {
    expect(() => buildBridge({ mode: 'one-more', stones: 1, gaps: 1, range: 5 })).toThrow();
    expect(() => buildBridge({ mode: 'missing', stones: 4, gaps: 4, range: 5 })).toThrow();
    expect(() => buildBridge({ mode: 'missing', stones: 5, gaps: 1, range: 4 })).toThrow();
    expect(() => buildBridge({ mode: 'missing', stones: 4, gaps: 1, range: 2 })).toThrow();
  });

  it('[AC-03] machine phases stay strictly building or crossing across arbitrary taps and can always reach complete', () => {
    expect(BRIDGE_PHASES).toEqual(['building', 'crossing']);

    const rng = makeRng(2026);
    const modes = [
      { mode: 'one-more' as const, stones: 4, gaps: 2, range: 5 },
      { mode: 'missing' as const, stones: 5, gaps: 1, range: 10 },
    ];

    for (let round = 0; round < 30; round++) {
      const plan = modes[round % modes.length];
      let spec = buildBridge(plan, null, rng);
      let state = createBridge(spec);
      expect(BRIDGE_PHASES).toContain(state.phase);

      // Issue random taps (including pile taps, wrong choices, and busy taps during crossing).
      for (let step = 0; step < 6; step++) {
        const res =
          step % 2 === 0
            ? tapPile(state)
            : tapChoice(state, spec.choices.find((c) => c !== spec.answer) ?? 99);
        state = res.state;
        expect(BRIDGE_PHASES).toContain(state.phase);
        if (state.phase === 'crossing') {
          expect(tapPile(state).event.kind).toBe('busy');
          expect(tapChoice(state, spec.answer ?? 1).event.kind).toBe('busy');
        }
      }

      // From any remaining building state, finishing the right action always completes the bridge.
      while (state.phase === 'building') {
        if (state.mode === 'one-more') {
          state = tapPile(state).state;
        } else {
          const res = tapChoice(state, state.answer!);
          expect(res.event.kind).toBe('complete');
          state = res.state;
        }
      }
      expect(state.phase).toBe('crossing');
      expect(state.gaps).toEqual([]);

      spec = buildBridge(plan, { sequence: spec.sequence, gaps: spec.gaps }, rng);
      const next = nextBridge(state, spec);
      expect(next.event.kind).toBe('next');
      expect(next.state.phase).toBe('building');
    }
  });

  it('[AC-04] one-more mode places trailing stones one tap at a time until the bridge is complete', () => {
    const spec: BridgeSpec = {
      mode: 'one-more',
      sequence: [1, 2, 3, 4],
      gaps: [2, 3],
      answer: null,
      choices: [],
    };
    const s0 = createBridge(spec);
    Object.freeze(s0);

    // Choice taps are ignored in one-more mode.
    expect(tapChoice(s0, 3).event.kind).toBe('busy');

    const r1 = tapPile(s0);
    expect(r1.event).toEqual({
      kind: 'placed',
      gapIndex: 2,
      stoneNumber: 3,
      remainingGaps: 1,
    });
    expect(r1.state.phase).toBe('building');
    expect(r1.state.gaps).toEqual([3]);
    // Original state must remain unchanged.
    expect(s0.gaps).toEqual([2, 3]);

    const r2 = tapPile(r1.state);
    expect(r2.event).toEqual({
      kind: 'complete',
      gapIndex: 3,
      stoneNumber: 4,
      tries: 0,
    });
    expect(r2.state.phase).toBe('crossing');
    expect(r2.state.gaps).toEqual([]);
  });

  it('[AC-05] missing mode rejects wrong choices without clearing the gap and completes on the right choice', () => {
    const spec: BridgeSpec = {
      mode: 'missing',
      sequence: [2, 3, 4, 5],
      gaps: [2],
      answer: 4,
      choices: [3, 4, 5],
    };
    const s0 = createBridge(spec);
    Object.freeze(s0);

    // Pile taps are ignored in missing mode.
    expect(tapPile(s0).event.kind).toBe('busy');

    const miss1 = tapChoice(s0, 3);
    expect(miss1.event).toEqual({
      kind: 'not-this-one',
      picked: 3,
      answer: 4,
      tries: 1,
    });
    expect(miss1.state.phase).toBe('building');
    expect(miss1.state.gaps).toEqual([2]);
    expect(miss1.state.tries).toBe(1);

    const hit = tapChoice(miss1.state, 4);
    expect(hit.event).toEqual({
      kind: 'complete',
      gapIndex: 2,
      stoneNumber: 4,
      tries: 2,
    });
    expect(hit.state.phase).toBe('crossing');
    expect(hit.state.gaps).toEqual([]);
  });
});
