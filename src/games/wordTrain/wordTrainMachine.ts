export type WordTrainMode = 'load' | 'spell';

export type WordTrainPhase = 'asking' | 'spelling' | 'departing';
export const WORD_TRAIN_PHASES: readonly WordTrainPhase[] = ['asking', 'spelling', 'departing'];

export interface WordTrainLoadState {
  readonly mode: 'load';
  readonly phase: 'asking' | 'departing';
  readonly choices: readonly string[];
  readonly target: string;
  readonly tries: number;
}

export interface WordTrainTile {
  readonly index: number;
  readonly letter: string;
  readonly placedAt: number | null;
}

export interface WordTrainSpellState {
  readonly mode: 'spell';
  readonly phase: 'spelling' | 'departing';
  readonly word: string;
  readonly slots: readonly (string | null)[];
  readonly tiles: readonly WordTrainTile[];
  readonly bounces: number;
}

export type WordTrainState = WordTrainLoadState | WordTrainSpellState;

export type WordTrainEvent =
  | { kind: 'loaded'; id: string; tries: number }
  | { kind: 'other'; id: string; target: string; tries: number }
  | { kind: 'placed'; tileIndex: number; slotIndex: number; letter: string }
  | { kind: 'bounced'; tileIndex: number; letter: string }
  | { kind: 'spelled'; word: string; bounces: number }
  | { kind: 'busy' };

export interface CreateLoadRoundOptions {
  readonly choices: readonly string[];
  readonly target: string;
}

export interface CreateSpellRoundOptions {
  readonly word: string;
  readonly letters: readonly string[];
}

export type ArriveNextOptions =
  | ({ readonly mode: 'load' } & CreateLoadRoundOptions)
  | ({ readonly mode: 'spell' } & CreateSpellRoundOptions);

/** Creates an initial load-mode round in `'asking'` phase. Never enters a failure phase. */
export function createLoadRound(opts: CreateLoadRoundOptions): WordTrainLoadState {
  if (opts.choices.length < 2) {
    throw new Error('Load round requires at least 2 choices');
  }
  const seen = new Set<string>();
  const choices = opts.choices.map((id) => {
    if (!id || seen.has(id)) {
      throw new Error(`Duplicate or empty load choice id: ${String(id)}`);
    }
    seen.add(id);
    return id;
  });
  if (!seen.has(opts.target)) {
    throw new Error(`Load round target "${String(opts.target)}" must be in choices`);
  }
  return {
    mode: 'load',
    phase: 'asking',
    choices,
    target: opts.target,
    tries: 0,
  };
}

/** Creates an initial spell-mode round in `'spelling'` phase. Validates that `letters` can spell `word`. */
export function createSpellRound(opts: CreateSpellRoundOptions): WordTrainSpellState {
  if (!/^[a-z]+$/.test(opts.word)) {
    throw new Error(`Spell round word must be lowercase a-z letters: ${String(opts.word)}`);
  }
  const available = new Map<string, number>();
  const tiles: WordTrainTile[] = opts.letters.map((letter, index) => {
    if (!/^[a-z]$/.test(letter)) {
      throw new Error(`Invalid tile letter at index ${index}: ${String(letter)}`);
    }
    available.set(letter, (available.get(letter) ?? 0) + 1);
    return { index, letter, placedAt: null };
  });
  for (const ch of opts.word) {
    const count = available.get(ch) ?? 0;
    if (count <= 0) {
      throw new Error(`Spell round letters lack "${ch}" needed for "${opts.word}"`);
    }
    available.set(ch, count - 1);
  }
  return {
    mode: 'spell',
    phase: 'spelling',
    word: opts.word,
    slots: Array.from({ length: opts.word.length }, () => null),
    tiles,
    bounces: 0,
  };
}

/** Handles tapping or dragging an object onto the wagon in load mode without mutating `state`. */
export function pickObject(state: WordTrainState, id: string): { state: WordTrainState; event: WordTrainEvent } {
  if (state.mode !== 'load') {
    return { state, event: { kind: 'busy' } };
  }
  if (!state.choices.includes(id)) {
    throw new Error(`Unknown word-train object id: ${String(id)}`);
  }
  if (state.phase !== 'asking') {
    return { state, event: { kind: 'busy' } };
  }
  const tries = state.tries + 1;
  if (id === state.target) {
    return {
      state: { ...state, phase: 'departing', tries },
      event: { kind: 'loaded', id, tries },
    };
  }
  return {
    state: { ...state, tries },
    event: { kind: 'other', id, target: state.target, tries },
  };
}

function assertValidTileIndex(state: WordTrainSpellState, tileIndex: number): void {
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= state.tiles.length) {
    throw new Error(`Unknown tile index: ${String(tileIndex)}`);
  }
}

function assertValidSlotIndex(state: WordTrainSpellState, slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.slots.length) {
    throw new Error(`Unknown slot index: ${String(slotIndex)}`);
  }
}

/** Handles dragging/placing a letter block onto a specific wagon slot without mutating `state`. */
export function placeTile(
  state: WordTrainState,
  tileIndex: number,
  slotIndex: number,
): { state: WordTrainState; event: WordTrainEvent } {
  if (state.mode !== 'spell') {
    return { state, event: { kind: 'busy' } };
  }
  assertValidTileIndex(state, tileIndex);
  assertValidSlotIndex(state, slotIndex);

  if (state.phase !== 'spelling') {
    return { state, event: { kind: 'busy' } };
  }
  const tile = state.tiles[tileIndex];
  if (tile.placedAt !== null) {
    return { state, event: { kind: 'busy' } };
  }

  if (state.slots[slotIndex] !== null || tile.letter !== state.word[slotIndex]) {
    return {
      state: { ...state, bounces: state.bounces + 1 },
      event: { kind: 'bounced', tileIndex, letter: tile.letter },
    };
  }

  const nextSlots = state.slots.map((s, i) => (i === slotIndex ? tile.letter : s));
  const nextTiles = state.tiles.map((t, i) => (i === tileIndex ? { ...t, placedAt: slotIndex } : t));
  const complete = nextSlots.every((s) => s !== null);

  if (complete) {
    return {
      state: {
        ...state,
        phase: 'departing',
        slots: nextSlots,
        tiles: nextTiles,
      },
      event: { kind: 'spelled', word: state.word, bounces: state.bounces },
    };
  }

  return {
    state: {
      ...state,
      slots: nextSlots,
      tiles: nextTiles,
    },
    event: { kind: 'placed', tileIndex, slotIndex, letter: tile.letter },
  };
}

/** Handles tapping a letter block in spell mode: targets the first empty wagon slot. */
export function tapTile(state: WordTrainState, tileIndex: number): { state: WordTrainState; event: WordTrainEvent } {
  if (state.mode !== 'spell') {
    return { state, event: { kind: 'busy' } };
  }
  assertValidTileIndex(state, tileIndex);

  if (state.phase !== 'spelling') {
    return { state, event: { kind: 'busy' } };
  }
  const tile = state.tiles[tileIndex];
  if (tile.placedAt !== null) {
    return { state, event: { kind: 'busy' } };
  }
  const firstEmpty = state.slots.findIndex((s) => s === null);
  if (firstEmpty < 0) {
    return { state, event: { kind: 'busy' } };
  }
  return placeTile(state, tileIndex, firstEmpty);
}

/** Starts the next load request when a fresh train arrives. */
export function arriveLoad(_state: WordTrainState, next: CreateLoadRoundOptions): WordTrainLoadState {
  return createLoadRound(next);
}

/** Starts the next spelling word when a fresh train arrives. */
export function arriveSpell(_state: WordTrainState, next: CreateSpellRoundOptions): WordTrainSpellState {
  return createSpellRound(next);
}

/** Starts the next request or word when a fresh train arrives. */
export function arrive(_state: WordTrainState, next: ArriveNextOptions): WordTrainState {
  return next.mode === 'load' ? createLoadRound(next) : createSpellRound(next);
}
