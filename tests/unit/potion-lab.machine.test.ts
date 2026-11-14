import { describe, expect, it } from 'vitest';
import {
  POTION_COLORS,
  POTION_PHASES,
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  createPotion,
  mixColors,
  potsFor,
  resetBowl,
  tapPot,
  type PotionState,
  type PrimaryColor,
  type SecondaryColor,
} from '@/games/potionLab/potionMachine';

/** Deterministic seeded LCG (no Math.random). */
function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stateKey(state: PotionState): string {
  return `${state.phase}|${state.firstColor ?? 'none'}|${state.bowlColor ?? 'none'}|${state.request ?? 'free'}`;
}

function canReachMatched(start: PotionState, target: SecondaryColor): boolean {
  const visited = new Set<string>([stateKey(start)]);
  const queue: PotionState[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const color of PRIMARY_COLORS) {
      const { state: next, event } = tapPot(current, color);
      if (event.kind === 'matched' && event.result === target) {
        return true;
      }
      const key = stateKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }

    const emptied = resetBowl(current);
    const emptiedKey = stateKey(emptied);
    if (!visited.has(emptiedKey)) {
      visited.add(emptiedKey);
      queue.push(emptied);
    }
  }

  return false;
}

describe('potionMachine', () => {
  it('[AC-02] mixColors is symmetric and complete for all primary pairs; same pot twice keeps its color', () => {
    expect(PRIMARY_COLORS).toEqual(['red', 'yellow', 'blue']);
    expect(SECONDARY_COLORS).toEqual(['orange', 'green', 'purple']);
    expect(POTION_COLORS).toEqual(['red', 'yellow', 'blue', 'orange', 'green', 'purple']);

    expect(mixColors('red', 'yellow')).toBe('orange');
    expect(mixColors('red', 'blue')).toBe('purple');
    expect(mixColors('yellow', 'blue')).toBe('green');

    for (const a of PRIMARY_COLORS) {
      expect(mixColors(a, a)).toBe(a);
      for (const b of PRIMARY_COLORS) {
        expect(mixColors(a, b)).toBe(mixColors(b, a));
        expect(POTION_COLORS).toContain(mixColors(a, b));
      }
    }

    for (const target of SECONDARY_COLORS) {
      const [p1, p2] = potsFor(target);
      expect(p1).not.toBe(p2);
      expect(mixColors(p1, p2)).toBe(target);
      expect(mixColors(p2, p1)).toBe(target);
    }
  });

  it('[AC-03] has no failure phase: POTION_PHASES is exactly pouring and mixed', () => {
    expect(POTION_PHASES).toEqual(['pouring', 'mixed']);
    expect(POTION_PHASES).toHaveLength(2);
  });

  it('[AC-03] exhaustive BFS across all reachable states keeps every request reachable', () => {
    for (const target of SECONDARY_COLORS) {
      const initial = createPotion({ request: target });
      const reachable = new Map<string, PotionState>([[stateKey(initial), initial]]);
      const queue: PotionState[] = [initial];

      while (queue.length > 0) {
        const current = queue.shift()!;
        expect(POTION_PHASES).toContain(current.phase);
        expect(current.request).toBe(target);
        expect(canReachMatched(current, target)).toBe(true);

        for (const color of PRIMARY_COLORS) {
          const { state: next } = tapPot(current, color);
          expect(POTION_PHASES).toContain(next.phase);
          const key = stateKey(next);
          if (!reachable.has(key)) {
            reachable.set(key, next);
            queue.push(next);
          }
        }

        const emptied = resetBowl(current);
        const emptiedKey = stateKey(emptied);
        if (!reachable.has(emptiedKey)) {
          reachable.set(emptiedKey, emptied);
          queue.push(emptied);
        }
      }

      expect(reachable.size).toBeGreaterThan(1);
    }
  });

  it('[AC-03] random tap and reset sequences never throw and never leave pouring or mixed', () => {
    const requests: readonly (SecondaryColor | null)[] = [null, ...SECONDARY_COLORS];
    for (const request of requests) {
      for (let seed = 1; seed <= 10; seed++) {
        const rand = createLcg(seed * 31);
        let state = createPotion({ request });

        for (let step = 0; step < 120; step++) {
          const color = PRIMARY_COLORS[Math.floor(rand() * PRIMARY_COLORS.length)];
          const { state: next, event } = tapPot(state, color);
          state = next;
          expect(POTION_PHASES).toContain(state.phase);

          if (event.kind === 'matched' && request !== null) {
            state = resetBowl(state, SECONDARY_COLORS[Math.floor(rand() * SECONDARY_COLORS.length)]);
          } else if (state.phase === 'mixed' && rand() < 0.7) {
            state = resetBowl(state);
          }
        }
      }
    }
  });

  it('[AC-04] free mode: pouring two pots mixes into mixed, ignores taps while mixed, and resetBowl empties the bowl', () => {
    const s0 = createPotion();
    expect(s0).toEqual({
      phase: 'pouring',
      firstColor: null,
      bowlColor: null,
      request: null,
      tries: 0,
    });

    const r1 = tapPot(s0, 'red');
    expect(r1.event).toEqual({ kind: 'poured', color: 'red' });
    expect(r1.state).toEqual({
      phase: 'pouring',
      firstColor: 'red',
      bowlColor: 'red',
      request: null,
      tries: 0,
    });

    const r2 = tapPot(r1.state, 'yellow');
    expect(r2.event).toEqual({ kind: 'mixed', result: 'orange', first: 'red', second: 'yellow' });
    expect(r2.state).toEqual({
      phase: 'mixed',
      firstColor: 'red',
      bowlColor: 'orange',
      request: null,
      tries: 0,
    });

    const busy = tapPot(r2.state, 'blue');
    expect(busy.event).toEqual({ kind: 'busy' });
    expect(busy.state).toEqual(r2.state);

    const s3 = resetBowl(r2.state);
    expect(s3).toEqual({
      phase: 'pouring',
      firstColor: null,
      bowlColor: null,
      request: null,
      tries: 0,
    });
  });

  it('[AC-05] request mode: mixed-other preserves the request and counts tries; matched succeeds; resetBowl can keep or replace request', () => {
    const s0 = createPotion({ request: 'green' });

    const p1 = tapPot(s0, 'red');
    expect(p1.event).toEqual({ kind: 'poured', color: 'red' });

    const wrong = tapPot(p1.state, 'yellow');
    expect(wrong.event).toEqual({
      kind: 'mixed-other',
      result: 'orange',
      first: 'red',
      second: 'yellow',
      target: 'green',
      tries: 1,
    });
    expect(wrong.state.request).toBe('green');
    expect(wrong.state.tries).toBe(1);

    const retry = resetBowl(wrong.state);
    expect(retry).toEqual({
      phase: 'pouring',
      firstColor: null,
      bowlColor: null,
      request: 'green',
      tries: 1,
    });

    const p2 = tapPot(retry, 'blue');
    const right = tapPot(p2.state, 'yellow');
    expect(right.event).toEqual({
      kind: 'matched',
      result: 'green',
      first: 'blue',
      second: 'yellow',
      tries: 2,
    });
    expect(right.state.tries).toBe(2);

    const nextRound = resetBowl(right.state, 'purple');
    expect(nextRound).toEqual({
      phase: 'pouring',
      firstColor: null,
      bowlColor: null,
      request: 'purple',
      tries: 0,
    });

    const firstTry = tapPot(tapPot(nextRound, 'red').state, 'blue');
    expect(firstTry.event).toEqual({
      kind: 'matched',
      result: 'purple',
      first: 'red',
      second: 'blue',
      tries: 1,
    });
  });

  it('[AC-02] tapPot and resetBowl are immutable and helpers validate color inputs', () => {
    const initial = createPotion({ request: 'orange' });
    const initialSnap = structuredClone(initial);

    const r1 = tapPot(initial, 'red');
    expect(initial).toEqual(initialSnap);

    const r1Snap = structuredClone(r1.state);
    const r2 = tapPot(r1.state, 'yellow');
    expect(r1.state).toEqual(r1Snap);

    const r2Snap = structuredClone(r2.state);
    resetBowl(r2.state, 'green');
    expect(r2.state).toEqual(r2Snap);

    expect(() => mixColors('green' as PrimaryColor, 'red')).toThrow();
    expect(() => mixColors('red', 'pink' as PrimaryColor)).toThrow();
    expect(() => potsFor('red' as SecondaryColor)).toThrow();
    expect(() => createPotion({ request: 'blue' as SecondaryColor })).toThrow();
    expect(() => tapPot(initial, 'orange' as PrimaryColor)).toThrow();
    expect(() => resetBowl(r2.state, 'yellow' as SecondaryColor)).toThrow();
  });
});
