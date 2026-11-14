import { describe, expect, it } from 'vitest';
import { loadTravelSuitcase } from '../../src/content/loadContent';
import { buildRequest, planForLevel } from '../../src/games/travelSuitcase/suitcaseRound';
import {
  SUITCASE_PHASES,
  createCase,
  nextRequest,
  pick,
  type SuitcaseChoice,
  type SuitcaseRequestInput,
  type SuitcaseState,
} from '../../src/games/travelSuitcase/suitcaseMachine';

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

const NOUN_CHOICES_1: SuitcaseChoice[] = [
  { id: 'hat', itemId: 'hat', color: null },
  { id: 'shoes', itemId: 'shoes', color: null },
];

const NOUN_CHOICES_2: SuitcaseChoice[] = [
  { id: 'ball', itemId: 'ball', color: null },
  { id: 'book', itemId: 'book', color: null },
];

const TWO_CHOICES: SuitcaseChoice[] = [
  { id: 'hat', itemId: 'hat', color: null },
  { id: 'shoes', itemId: 'shoes', color: null },
  { id: 'ball', itemId: 'ball', color: null },
  { id: 'book', itemId: 'book', color: null },
];

const COLOR_CHOICES: SuitcaseChoice[] = [
  { id: 'hat-red', itemId: 'hat', color: 'red' },
  { id: 'hat-yellow', itemId: 'hat', color: 'yellow' },
  { id: 'hat-blue', itemId: 'hat', color: 'blue' },
  { id: 'book', itemId: 'book', color: null },
];

describe('suitcaseMachine', () => {
  it('[AC-02] noun request packs the right item, emits other without penalty, and rejects unknown ids', () => {
    const start = createCase({
      choices: NOUN_CHOICES_1,
      request: { kind: 'noun', targets: ['hat'] },
      requestsPerCase: 3,
    });
    expect(start.phase).toBe('asking');
    expect(start.requestIndex).toBe(0);
    expect(start.packed).toEqual([]);
    expect(start.tries).toBe(0);

    const wrong = pick(start, 'shoes');
    expect(wrong.event).toEqual({ kind: 'other', choiceId: 'shoes' });
    expect(wrong.state.phase).toBe('asking');
    expect(wrong.state.packed).toEqual([]);
    expect(wrong.state.tries).toBe(1);

    const right = pick(wrong.state, 'hat');
    expect(right.event).toEqual({
      kind: 'packed',
      choiceId: 'hat',
      requestDone: true,
      caseDone: false,
    });
    expect(right.state.phase).toBe('asking');
    expect(right.state.packed).toEqual(['hat']);
    expect(right.state.request.packedForRequest).toEqual(['hat']);
    expect(right.state.tries).toBe(1);

    // Picking an already-packed item or picking before nextRequest returns 'busy'.
    expect(pick(right.state, 'hat').event).toEqual({ kind: 'busy' });
    expect(pick(right.state, 'shoes').event).toEqual({ kind: 'busy' });

    const req2 = nextRequest(right.state, {
      choices: NOUN_CHOICES_2,
      request: { kind: 'noun', targets: ['ball'] },
    });
    expect(req2.requestIndex).toBe(1);
    expect(req2.tries).toBe(0);
    expect(req2.packed).toEqual(['hat']);

    expect(() => pick(req2, 'nonexistent-item')).toThrow();
    expect(() =>
      nextRequest(req2, {
        choices: [
          { id: 'hat', itemId: 'hat', color: null },
          { id: 'coat', itemId: 'coat', color: null },
        ],
        request: { kind: 'noun', targets: ['coat'] },
      }),
    ).toThrow();
  });

  it('[AC-03] two-item request accepts targets in either order and ignores already-packed taps', () => {
    const start = createCase({
      choices: TWO_CHOICES,
      request: { kind: 'two', targets: ['hat', 'shoes'], needed: 2 },
      requestsPerCase: 2,
    });

    // Reverse order: shoes first, wrong pick in between, then hat.
    const first = pick(start, 'shoes');
    expect(first.event).toEqual({
      kind: 'packed',
      choiceId: 'shoes',
      requestDone: false,
      caseDone: false,
    });
    expect(first.state.phase).toBe('asking');
    expect(first.state.packed).toEqual(['shoes']);

    // Already-packed target returns busy without changing tries or packed.
    const repeat = pick(first.state, 'shoes');
    expect(repeat.event).toEqual({ kind: 'busy' });
    expect(repeat.state).toBe(first.state);

    // Distractor emits other without losing the first packed item.
    const wrong = pick(first.state, 'ball');
    expect(wrong.event).toEqual({ kind: 'other', choiceId: 'ball' });
    expect(wrong.state.packed).toEqual(['shoes']);
    expect(wrong.state.tries).toBe(1);

    const second = pick(wrong.state, 'hat');
    expect(second.event).toEqual({
      kind: 'packed',
      choiceId: 'hat',
      requestDone: true,
      caseDone: false,
    });
    expect(second.state.packed).toEqual(['shoes', 'hat']);

    // Forward order in request 2 finishes the case.
    const req2 = nextRequest(second.state, {
      choices: [
        { id: 'ball', itemId: 'ball', color: null },
        { id: 'book', itemId: 'book', color: null },
        { id: 'coat', itemId: 'coat', color: null },
        { id: 'bottle', itemId: 'bottle', color: null },
      ],
      request: { kind: 'two', targets: ['ball', 'book'] },
    });
    const r2First = pick(req2, 'ball');
    expect(r2First.event).toEqual({
      kind: 'packed',
      choiceId: 'ball',
      requestDone: false,
      caseDone: false,
    });
    const r2Second = pick(r2First.state, 'book');
    expect(r2Second.event).toEqual({
      kind: 'packed',
      choiceId: 'book',
      requestDone: true,
      caseDone: true,
    });
    expect(r2Second.state.phase).toBe('closing');
    expect(r2Second.state.packed).toEqual(['shoes', 'hat', 'ball', 'book']);
  });

  it('[AC-04] attribute asks for one specific colour while negation accepts either of the other two colours', () => {
    // Attribute: specifically hat-blue.
    const attrState = createCase({
      choices: COLOR_CHOICES,
      request: { kind: 'attribute', targets: ['hat-blue'], needed: 1 },
      requestsPerCase: 1,
    });
    expect(pick(attrState, 'hat-red').event).toEqual({ kind: 'other', choiceId: 'hat-red' });
    expect(pick(attrState, 'hat-yellow').event).toEqual({ kind: 'other', choiceId: 'hat-yellow' });
    expect(pick(attrState, 'book').event).toEqual({ kind: 'other', choiceId: 'book' });
    const attrDone = pick(attrState, 'hat-blue');
    expect(attrDone.event).toEqual({
      kind: 'packed',
      choiceId: 'hat-blue',
      requestDone: true,
      caseDone: true,
    });
    expect(attrDone.state.phase).toBe('closing');

    // Negation ("not the red one"): targets are hat-yellow and hat-blue, needed = 1.
    for (const acceptedId of ['hat-yellow', 'hat-blue']) {
      const negState = createCase({
        choices: COLOR_CHOICES,
        request: { kind: 'negation', targets: ['hat-yellow', 'hat-blue'], needed: 1 },
        requestsPerCase: 2,
      });
      expect(pick(negState, 'hat-red').event).toEqual({ kind: 'other', choiceId: 'hat-red' });
      expect(pick(negState, 'book').event).toEqual({ kind: 'other', choiceId: 'book' });
      const negPacked = pick(negState, acceptedId);
      expect(negPacked.event).toEqual({
        kind: 'packed',
        choiceId: acceptedId,
        requestDone: true,
        caseDone: false,
      });
      expect(negPacked.state.packed).toEqual([acceptedId]);
      // Once needed=1 is met, the other valid colour is busy until nextRequest.
      const otherValid = acceptedId === 'hat-yellow' ? 'hat-blue' : 'hat-yellow';
      expect(pick(negPacked.state, otherValid).event).toEqual({ kind: 'busy' });
    }
  });

  it('[AC-04] createCase and pick accept real buildRequest outputs for L4 attribute and L5 negation', () => {
    const content = loadTravelSuitcase();
    const attrPlan = planForLevel(content.adaptive.levels[3]);
    const negPlan = planForLevel(content.adaptive.levels[4]);

    for (const lang of ['en', 'fr'] as const) {
      for (const seed of [3, 19, 77]) {
        const attrBuilt = buildRequest(content, attrPlan, null, makeRng(seed), ['hat'], lang);
        const attrState = createCase({
          choices: attrBuilt.choices,
          request: {
            kind: attrBuilt.request.kind,
            targets: attrBuilt.request.targets,
            needed: attrBuilt.request.needed,
          },
          requestsPerCase: attrPlan.requestsPerCase,
        });
        expect(attrBuilt.request.targets).toHaveLength(1);
        const attrTarget = attrBuilt.request.targets[0];
        for (const c of attrState.choices) {
          if (c.id === attrTarget) {
            expect(pick(attrState, c.id).event).toEqual({
              kind: 'packed',
              choiceId: c.id,
              requestDone: true,
              caseDone: false,
            });
          } else {
            expect(pick(attrState, c.id).event).toEqual({ kind: 'other', choiceId: c.id });
          }
        }

        const negBuilt = buildRequest(content, negPlan, null, makeRng(seed), ['shoes'], lang);
        const negState = createCase({
          choices: negBuilt.choices,
          request: {
            kind: negBuilt.request.kind,
            targets: negBuilt.request.targets,
            needed: negBuilt.request.needed,
          },
          requestsPerCase: negPlan.requestsPerCase,
        });
        expect(negBuilt.request.targets).toHaveLength(2);
        const excludedId = negBuilt.request.key;
        expect(negState.choices.some((c) => c.id === excludedId)).toBe(true);
        expect(negBuilt.request.targets).not.toContain(excludedId);
        expect(pick(negState, excludedId).event).toEqual({ kind: 'other', choiceId: excludedId });
        for (const c of negState.choices) {
          if (negBuilt.request.targets.includes(c.id)) {
            expect(pick(negState, c.id).event).toEqual({
              kind: 'packed',
              choiceId: c.id,
              requestDone: true,
              caseDone: false,
            });
          } else {
            expect(pick(negState, c.id).event).toEqual({ kind: 'other', choiceId: c.id });
          }
        }
      }
    }
  });

  it('[AC-05] bounded exhaustive BFS over pick sequences preserves monotonicity, zero failure, and immutability', () => {
    const rounds: Array<{ choices: SuitcaseChoice[]; request: SuitcaseRequestInput }> = [
      {
        choices: [
          { id: 'hat', itemId: 'hat', color: null },
          { id: 'coat', itemId: 'coat', color: null },
          { id: 'bottle', itemId: 'bottle', color: null },
        ],
        request: { kind: 'noun', targets: ['hat'] },
      },
      {
        choices: [
          { id: 'shoes', itemId: 'shoes', color: null },
          { id: 'ball', itemId: 'ball', color: null },
          { id: 'book', itemId: 'book', color: null },
        ],
        request: { kind: 'two', targets: ['shoes', 'ball'], needed: 2 },
      },
      {
        choices: [
          { id: 'shirt-red', itemId: 'shirt', color: 'red' },
          { id: 'shirt-yellow', itemId: 'shirt', color: 'yellow' },
          { id: 'shirt-blue', itemId: 'shirt', color: 'blue' },
          { id: 'umbrella', itemId: 'umbrella', color: null },
        ],
        request: { kind: 'negation', targets: ['shirt-yellow', 'shirt-blue'], needed: 1 },
      },
    ];

    const initial = deepFreeze(
      createCase({
        choices: rounds[0].choices,
        request: rounds[0].request,
        requestsPerCase: rounds.length,
      }),
    );

    const queue: Array<{ state: SuitcaseState; depth: number }> = [{ state: initial, depth: 0 }];
    const visited = new Set<string>();
    let closingReached = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const s = deepFreeze(current.state);

      expect(SUITCASE_PHASES).toContain(s.phase);
      if (s.phase === 'closing') {
        closingReached++;
        expect(s.requestIndex).toBe(rounds.length - 1);
        expect(pick(s, s.packed[0]).event).toEqual({ kind: 'busy' });
        continue;
      }

      if (current.depth >= 9) continue;

      for (const c of s.choices) {
        const res = pick(s, c.id);
        expect(SUITCASE_PHASES).toContain(res.state.phase);
        // Packed list grows monotonically and never drops an already-packed id.
        expect(res.state.packed.length).toBeGreaterThanOrEqual(s.packed.length);
        expect(res.state.packed.slice(0, s.packed.length)).toEqual(s.packed);

        let nextState = res.state;
        if (
          res.event.kind === 'packed' &&
          res.event.requestDone &&
          !res.event.caseDone &&
          nextState.requestIndex + 1 < rounds.length
        ) {
          const r = rounds[nextState.requestIndex + 1];
          nextState = nextRequest(nextState, { choices: r.choices, request: r.request });
        }

        const key = `${nextState.phase}|${nextState.requestIndex}|${nextState.packed.join(',')}|${nextState.tries}`;
        if (!visited.has(key) && nextState.tries <= 2) {
          visited.add(key);
          queue.push({ state: nextState, depth: current.depth + 1 });
        }
      }
    }

    expect(closingReached).toBeGreaterThan(0);

    // Zero-failure guarantee: from the start state (and after wrong picks), solving the remaining
    // targets of each request always reaches 'closing'.
    let cursor = createCase({
      choices: rounds[0].choices,
      request: rounds[0].request,
      requestsPerCase: rounds.length,
    });
    cursor = pick(cursor, 'coat').state;
    for (let idx = 0; idx < rounds.length; idx++) {
      if (idx > 0) {
        cursor = nextRequest(cursor, { choices: rounds[idx].choices, request: rounds[idx].request });
      }
      for (const target of cursor.request.targets) {
        if (cursor.request.packedForRequest.length >= cursor.request.needed) break;
        cursor = pick(cursor, target).state;
      }
    }
    expect(cursor.phase).toBe('closing');
    expect(cursor.packed).toEqual(['hat', 'shoes', 'ball', 'shirt-yellow']);
  });
});
