// Pure immutable state machine and round builder for Letter Monster (docs/specs/letter-monster.md).
// No Phaser, no DOM, so unit tests import this module directly.
import type { LetterMonsterColorId, LetterMonsterFood } from '../../content/schema';
import type { Lang } from '../templates/choiceServe';

export type MonsterPhase = 'asking' | 'eating';
export const MONSTER_PHASES: readonly MonsterPhase[] = ['asking', 'eating'];

export type MonsterRequestKind = 'color' | 'letter';

export type MonsterRequest =
  | { readonly kind: 'color'; readonly color: LetterMonsterColorId }
  | { readonly kind: 'letter'; readonly letter: string };

export interface MonsterRound {
  readonly request: MonsterRequest;
  readonly offeredIds: readonly string[];
  readonly matchId: string;
}

export interface MonsterState {
  readonly phase: MonsterPhase;
  readonly request: MonsterRequest;
  readonly offeredIds: readonly string[];
  readonly matchId: string;
  readonly tries: number;
}

export type MonsterEvent =
  | { kind: 'fed'; foodId: string; request: MonsterRequest; tries: number }
  | { kind: 'not-this-one'; foodId: string; request: MonsterRequest; tries: number }
  | { kind: 'busy' }
  | { kind: 'next'; request: MonsterRequest; offeredIds: readonly string[]; matchId: string };

function pickIndex(length: number, rng: () => number): number {
  const raw = Math.floor(Math.max(0, rng()) * length);
  return Math.min(length - 1, raw);
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(Math.max(0, rng()) * (i + 1)));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sameRequest(a: MonsterRequest | null, b: MonsterRequest | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === 'color' ? a.color === (b as Extract<MonsterRequest, { kind: 'color' }>).color : a.letter === (b as Extract<MonsterRequest, { kind: 'letter' }>).letter;
}

/**
 * Builds one Letter Monster round with `choices` offered foods, exactly one match for the request,
 * distractors that never match in `language`, and never the same request as `previousRequest`.
 */
export function buildRound(
  foods: readonly LetterMonsterFood[],
  requestKind: MonsterRequestKind,
  language: Lang,
  choices: number,
  previousRequest: MonsterRequest | null = null,
  rng: () => number = Math.random,
): MonsterRound {
  if (!Number.isInteger(choices) || choices < 2) {
    throw new Error(`buildRound requires at least 2 choices, got ${choices}`);
  }
  if (foods.length < choices) {
    throw new Error(`Not enough foods (${foods.length}) for ${choices} choices`);
  }

  if (requestKind === 'color') {
    const byColor = new Map<LetterMonsterColorId, LetterMonsterFood[]>();
    for (const food of foods) {
      const list = byColor.get(food.color) ?? [];
      list.push(food);
      byColor.set(food.color, list);
    }
    const eligible = [...byColor.entries()].filter(
      ([, matching]) => matching.length >= 1 && foods.length - matching.length >= choices - 1,
    );
    if (eligible.length === 0) {
      throw new Error(`No color can supply 1 match and ${choices - 1} distractors`);
    }
    const filtered =
      previousRequest?.kind === 'color' && eligible.length > 1
        ? eligible.filter(([color]) => color !== previousRequest.color)
        : eligible;
    const [targetColor, matching] = filtered[pickIndex(filtered.length, rng)];
    const match = matching[pickIndex(matching.length, rng)];
    const distractors = shuffleWithRng(
      foods.filter((f) => f.color !== targetColor),
      rng,
    ).slice(0, choices - 1);
    const offeredIds = shuffleWithRng([match.id, ...distractors.map((d) => d.id)], rng);
    return { request: { kind: 'color', color: targetColor }, offeredIds, matchId: match.id };
  }

  const byLetter = new Map<string, LetterMonsterFood[]>();
  for (const food of foods) {
    const letter = food.initial[language].toUpperCase();
    const list = byLetter.get(letter) ?? [];
    list.push(food);
    byLetter.set(letter, list);
  }
  const eligible = [...byLetter.entries()].filter(
    ([, matching]) => matching.length >= 1 && foods.length - matching.length >= choices - 1,
  );
  if (eligible.length === 0) {
    throw new Error(`No letter in ${language} can supply 1 match and ${choices - 1} distractors`);
  }
  const filtered =
    previousRequest?.kind === 'letter' && eligible.length > 1
      ? eligible.filter(([letter]) => letter !== previousRequest.letter)
      : eligible;
  const [targetLetter, matching] = filtered[pickIndex(filtered.length, rng)];
  const match = matching[pickIndex(matching.length, rng)];
  const distractors = shuffleWithRng(
    foods.filter((f) => f.initial[language].toUpperCase() !== targetLetter),
    rng,
  ).slice(0, choices - 1);
  const offeredIds = shuffleWithRng([match.id, ...distractors.map((d) => d.id)], rng);
  return { request: { kind: 'letter', letter: targetLetter }, offeredIds, matchId: match.id };
}

function assertValidRound(round: MonsterRound): void {
  if (round.offeredIds.length < 2) {
    throw new Error(`Round must offer at least 2 foods, got ${round.offeredIds.length}`);
  }
  if (!round.offeredIds.includes(round.matchId)) {
    throw new Error(`matchId "${round.matchId}" is not in offeredIds`);
  }
}

/** Creates an initial asking state for a round. */
export function createMonster(round: MonsterRound): MonsterState {
  assertValidRound(round);
  return {
    phase: 'asking',
    request: round.request,
    offeredIds: [...round.offeredIds],
    matchId: round.matchId,
    tries: 0,
  };
}

/** Applies a food tap without mutating the input state. Never enters a failure phase. */
export function tapFood(state: MonsterState, foodId: string): { state: MonsterState; event: MonsterEvent } {
  if (state.phase === 'eating') {
    return { state, event: { kind: 'busy' } };
  }
  if (!state.offeredIds.includes(foodId)) {
    throw new Error(`Food "${foodId}" is not among offered foods`);
  }
  const tries = state.tries + 1;
  if (foodId === state.matchId) {
    return {
      state: { ...state, phase: 'eating', tries },
      event: { kind: 'fed', foodId, request: state.request, tries },
    };
  }
  return {
    state: { ...state, phase: 'asking', tries },
    event: { kind: 'not-this-one', foodId, request: state.request, tries },
  };
}

/** Advances from `eating` into the next `asking` round. Returns `busy` if still `asking`. */
export function nextMonsterRound(state: MonsterState, round: MonsterRound): { state: MonsterState; event: MonsterEvent } {
  assertValidRound(round);
  if (state.phase !== 'eating') {
    return { state, event: { kind: 'busy' } };
  }
  return {
    state: createMonster(round),
    event: {
      kind: 'next',
      request: round.request,
      offeredIds: [...round.offeredIds],
      matchId: round.matchId,
    },
  };
}
