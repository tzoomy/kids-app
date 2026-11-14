import { describe, expect, it } from 'vitest';
import { loadLetterMonster } from '@/content/loadContent';
import {
  MONSTER_PHASES,
  buildRound,
  createMonster,
  nextMonsterRound,
  sameRequest,
  tapFood,
  type MonsterRequest,
  type MonsterState,
} from '@/games/letterMonster/monsterMachine';

/** Deterministic seeded LCG (no Math.random). */
function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const content = loadLetterMonster();

describe('monsterMachine', () => {
  it('[AC-02] every round has exactly one matching food, non-matching distractors in the round language, and never repeats the previous request', () => {
    const rng = createLcg(20261114);
    const byId = new Map(content.foods.map((f) => [f.id, f]));

    for (const kind of ['color', 'letter'] as const) {
      for (const language of ['en', 'fr'] as const) {
        for (const choices of [2, 3] as const) {
          let prev: MonsterRequest | null = null;
          for (let i = 0; i < 40; i++) {
            const round = buildRound(content.foods, kind, language, choices, prev, rng);
            expect(round.request.kind).toBe(kind);
            if (prev !== null) {
              expect(sameRequest(round.request, prev)).toBe(false);
            }
            expect(round.offeredIds).toHaveLength(choices);
            expect(new Set(round.offeredIds).size).toBe(choices);
            expect(round.offeredIds).toContain(round.matchId);

            const matching = round.offeredIds.filter((id) => {
              const food = byId.get(id)!;
              return round.request.kind === 'color'
                ? food.color === round.request.color
                : food.initial[language].toUpperCase() === round.request.letter;
            });
            expect(matching).toEqual([round.matchId]);

            const distractors = round.offeredIds.filter((id) => id !== round.matchId);
            expect(distractors).toHaveLength(choices - 1);
            for (const distractorId of distractors) {
              const food = byId.get(distractorId)!;
              if (round.request.kind === 'color') {
                expect(food.color).not.toBe(round.request.color);
              } else {
                expect(food.initial[language].toUpperCase()).not.toBe(round.request.letter);
              }
            }

            prev = round.request;
          }
        }
      }
    }
  });

  it('[AC-03] has no failure phase: MONSTER_PHASES is only asking and eating; states are immutable and any tap sequence reaches fed', () => {
    expect(MONSTER_PHASES).toEqual(['asking', 'eating']);
    expect(MONSTER_PHASES).toHaveLength(2);

    const rng = createLcg(99);
    for (let trial = 0; trial < 30; trial++) {
      const kind = trial % 2 === 0 ? 'color' : 'letter';
      const lang = trial % 3 === 0 ? 'fr' : 'en';
      const round = buildRound(content.foods, kind, lang, 3, null, rng);
      const initial = createMonster(round);
      expect(initial.phase).toBe('asking');
      expect(initial.tries).toBe(0);

      // Tapping next before eating is a no-op busy event.
      const nextRound = buildRound(content.foods, kind, lang, 3, round.request, rng);
      expect(nextMonsterRound(initial, nextRound)).toEqual({ state: initial, event: { kind: 'busy' } });

      // Tap distractors several times first; state never leaves 'asking' and request never changes.
      const distractors = round.offeredIds.filter((id) => id !== round.matchId);
      let state: MonsterState = initial;
      const snapshotBefore = structuredClone(state);

      for (const wrongId of distractors) {
        const res = tapFood(state, wrongId);
        expect(res.event).toEqual({
          kind: 'not-this-one',
          foodId: wrongId,
          request: round.request,
          tries: state.tries + 1,
        });
        expect(res.state.phase).toBe('asking');
        expect(MONSTER_PHASES).toContain(res.state.phase);
        expect(sameRequest(res.state.request, round.request)).toBe(true);
        expect(res.state.tries).toBe(state.tries + 1);
        state = res.state;
      }
      // Original initial state stayed untouched.
      expect(initial).toEqual(snapshotBefore);

      // Tapping the match from any state always reaches 'fed' -> 'eating'.
      const fed = tapFood(state, round.matchId);
      expect(fed.event).toEqual({
        kind: 'fed',
        foodId: round.matchId,
        request: round.request,
        tries: distractors.length + 1,
      });
      expect(fed.state.phase).toBe('eating');

      // Tapping again while eating returns 'busy' without changing state.
      const whileEating = tapFood(fed.state, round.matchId);
      expect(whileEating.event).toEqual({ kind: 'busy' });
      expect(whileEating.state).toBe(fed.state);

      // Advancing to next round resets tries to 0 and enters asking.
      const advanced = nextMonsterRound(fed.state, nextRound);
      expect(advanced.event.kind).toBe('next');
      expect(advanced.state.phase).toBe('asking');
      expect(advanced.state.tries).toBe(0);
      expect(sameRequest(advanced.state.request, round.request)).toBe(false);
    }
  });
});
