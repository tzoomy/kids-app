import { describe, expect, it } from 'vitest';
import {
  MAGNET_PHASES,
  createMagnetRound,
  predict,
  touch,
  type MagnetState,
} from '@/games/magicMagnet/magnetMachine';

/** Deterministic seeded LCG (no Math.random). */
function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SAMPLE_OBJECTS = [
  { id: 'paperclip', metal: true },
  { id: 'ball', metal: false },
  { id: 'nail', metal: true },
  { id: 'leaf', metal: false },
] as const;

function stateKey(s: MagnetState): string {
  const stuck = s.objects.map((o) => (o.stuck ? '1' : '0')).join('');
  return `${s.mode}|${s.phase}|${stuck}|${s.targetIndex ?? 'none'}|${s.prediction ?? 'none'}|${s.results.length}`;
}

function canReachDone(start: MagnetState): boolean {
  if (start.phase === 'done') return true;
  const visited = new Set<string>([stateKey(start)]);
  const queue: MagnetState[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const candidates: MagnetState[] = [
      predict(cur, true).state,
      predict(cur, false).state,
      ...cur.objects.map((o) => touch(cur, o.id).state),
    ];
    for (const next of candidates) {
      if (next.phase === 'done') return true;
      const key = stateKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}

describe('magnetMachine', () => {
  it('[AC-02] free mode: metal sticks once, non-metal wiggles and never sticks, done only when every metal is stuck', () => {
    const s0 = createMagnetRound({ mode: 'free', objects: SAMPLE_OBJECTS });
    expect(s0.phase).toBe('exploring');
    expect(s0.targetIndex).toBeNull();
    expect(s0.prediction).toBeNull();
    expect(s0.objects.every((o) => !o.stuck)).toBe(true);

    // Non-metal object wiggles and never sticks.
    const w1 = touch(s0, 'ball');
    expect(w1.event).toEqual({ kind: 'wiggled', id: 'ball' });
    expect(w1.state).toEqual(s0);

    // First metal object sticks; round is not done yet (nail still unstuck).
    const m1 = touch(w1.state, 'paperclip');
    expect(m1.event).toEqual({ kind: 'stuck', id: 'paperclip', roundComplete: false });
    expect(m1.state.phase).toBe('exploring');
    expect(m1.state.objects.find((o) => o.id === 'paperclip')?.stuck).toBe(true);

    // Touching an already-stuck object returns busy and changes nothing.
    const busy = touch(m1.state, 'paperclip');
    expect(busy.event).toEqual({ kind: 'busy' });
    expect(busy.state).toEqual(m1.state);

    // Touching second non-metal object wiggles.
    const w2 = touch(m1.state, 'leaf');
    expect(w2.event).toEqual({ kind: 'wiggled', id: 'leaf' });
    expect(w2.state).toEqual(m1.state);

    // Touching final metal object completes the round.
    const m2 = touch(w2.state, 'nail');
    expect(m2.event).toEqual({ kind: 'stuck', id: 'nail', roundComplete: true });
    expect(m2.state.phase).toBe('done');
    expect(m2.state.objects.filter((o) => o.metal).every((o) => o.stuck)).toBe(true);
    expect(m2.state.objects.filter((o) => !o.metal).every((o) => !o.stuck)).toBe(true);

    // Further touches after done return busy.
    expect(touch(m2.state, 'ball').event).toEqual({ kind: 'busy' });
  });

  it('[AC-03] has no failure phase: MAGNET_PHASES is exactly exploring, predicting, testing and done', () => {
    expect(MAGNET_PHASES).toEqual(['exploring', 'predicting', 'testing', 'done']);
    expect(MAGNET_PHASES).toHaveLength(4);
  });

  it('[AC-03] exhaustive bounded BFS across all reachable states keeps done reachable and never unsticks an object', () => {
    for (const mode of ['free', 'predict'] as const) {
      const initial = createMagnetRound({ mode, objects: SAMPLE_OBJECTS });
      const visited = new Map<string, MagnetState>([[stateKey(initial), initial]]);
      const queue: MagnetState[] = [initial];
      const MAX_STATES = 2000;

      while (queue.length > 0 && visited.size < MAX_STATES) {
        const cur = queue.shift()!;
        expect(MAGNET_PHASES).toContain(cur.phase);
        expect(canReachDone(cur)).toBe(true);

        const transitions = [
          predict(cur, true),
          predict(cur, false),
          ...cur.objects.map((o) => touch(cur, o.id)),
        ];
        for (const { state: next } of transitions) {
          expect(MAGNET_PHASES).toContain(next.phase);
          // Monotonicity: once an object is stuck, no transition ever removes its stuck status.
          for (let i = 0; i < cur.objects.length; i++) {
            if (cur.objects[i].stuck) expect(next.objects[i].stuck).toBe(true);
          }
          expect(next.results.length).toBeGreaterThanOrEqual(cur.results.length);
          const key = stateKey(next);
          if (!visited.has(key)) {
            visited.set(key, next);
            queue.push(next);
          }
        }
      }

      expect(queue.length).toBe(0);
      expect(visited.size).toBeGreaterThan(2);
    }
  });

  it('[AC-03] random predict and touch sequences never throw or leave MAGNET_PHASES', () => {
    for (const mode of ['free', 'predict'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const rand = createLcg(seed * 97);
        let state = createMagnetRound({ mode, objects: SAMPLE_OBJECTS });

        for (let step = 0; step < 80; step++) {
          const action = rand();
          const prevStuckCount = state.objects.filter((o) => o.stuck).length;
          if (action < 0.35) {
            state = predict(state, rand() < 0.5).state;
          } else {
            const obj = SAMPLE_OBJECTS[Math.floor(rand() * SAMPLE_OBJECTS.length)];
            state = touch(state, obj.id).state;
          }
          expect(MAGNET_PHASES).toContain(state.phase);
          expect(state.objects.filter((o) => o.stuck).length).toBeGreaterThanOrEqual(prevStuckCount);
        }
      }
    }
  });

  it('[AC-05] predict mode: walks objects in order, busy outside phase or on wrong object, right and wrong predictions both advance cleanly', () => {
    let state = createMagnetRound({ mode: 'predict', objects: SAMPLE_OBJECTS });
    expect(state.phase).toBe('predicting');
    expect(state.targetIndex).toBe(0);

    // Touching before predicting returns busy.
    expect(touch(state, 'paperclip').event).toEqual({ kind: 'busy' });

    // Predict sticks=true for paperclip (metal=true) -> correct.
    const p0 = predict(state, true);
    expect(p0.event).toEqual({ kind: 'predicted', id: 'paperclip', sticks: true });
    expect(p0.state.phase).toBe('testing');
    expect(p0.state.prediction).toBe(true);
    state = p0.state;

    // Predict while testing returns busy.
    expect(predict(state, false).event).toEqual({ kind: 'busy' });

    // Touching a non-target object while testing returns busy and does not advance.
    const wrongTarget = touch(state, 'ball');
    expect(wrongTarget.event).toEqual({ kind: 'busy' });
    expect(wrongTarget.state).toEqual(state);

    // Touching target paperclip reveals sticks=true, correct=true.
    const r0 = touch(state, 'paperclip');
    expect(r0.event).toEqual({
      kind: 'revealed',
      id: 'paperclip',
      sticks: true,
      correct: true,
      roundComplete: false,
    });
    expect(r0.state.phase).toBe('predicting');
    expect(r0.state.targetIndex).toBe(1);
    expect(r0.state.prediction).toBeNull();
    state = r0.state;

    // Predict sticks=true for ball (metal=false) -> wrong prediction, still advances without failure.
    state = predict(state, true).state;
    const r1 = touch(state, 'ball');
    expect(r1.event).toEqual({
      kind: 'revealed',
      id: 'ball',
      sticks: false,
      correct: false,
      roundComplete: false,
    });
    expect(r1.state.phase).toBe('predicting');
    expect(r1.state.targetIndex).toBe(2);
    state = r1.state;

    // Finish remaining two objects (nail, leaf).
    state = predict(state, false).state;
    const r2 = touch(state, 'nail');
    expect(r2.event).toEqual({
      kind: 'revealed',
      id: 'nail',
      sticks: true,
      correct: false,
      roundComplete: false,
    });
    state = r2.state;

    state = predict(state, false).state;
    const r3 = touch(state, 'leaf');
    expect(r3.event).toEqual({
      kind: 'revealed',
      id: 'leaf',
      sticks: false,
      correct: true,
      roundComplete: true,
    });
    expect(r3.state.phase).toBe('done');
    expect(r3.state.targetIndex).toBeNull();
    expect(r3.state.results).toHaveLength(4);

    // No further predict or touch changes state once done.
    expect(predict(r3.state, true).event).toEqual({ kind: 'busy' });
    expect(touch(r3.state, 'leaf').event).toEqual({ kind: 'busy' });
  });

  it('[AC-02] touch and predict never mutate input and unknown ids or invalid rounds throw', () => {
    const initial = createMagnetRound({ mode: 'predict', objects: SAMPLE_OBJECTS });
    const snap0 = structuredClone(initial);
    const p = predict(initial, true);
    expect(initial).toEqual(snap0);

    const snap1 = structuredClone(p.state);
    touch(p.state, 'paperclip');
    expect(p.state).toEqual(snap1);

    expect(() => touch(initial, 'unknown-item')).toThrow();
    expect(() => createMagnetRound({ mode: 'free', objects: [{ id: 'a', metal: true }] })).toThrow();
    expect(() =>
      createMagnetRound({
        mode: 'free',
        objects: [
          { id: 'a', metal: true },
          { id: 'b', metal: true },
        ],
      }),
    ).toThrow();
    expect(() =>
      createMagnetRound({
        mode: 'free',
        objects: [
          { id: 'a', metal: false },
          { id: 'b', metal: false },
        ],
      }),
    ).toThrow();
    expect(() =>
      createMagnetRound({
        mode: 'free',
        objects: [
          { id: 'a', metal: true },
          { id: 'a', metal: false },
        ],
      }),
    ).toThrow();
  });
});
