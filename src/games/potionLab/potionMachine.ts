export const PRIMARY_COLORS = ['red', 'yellow', 'blue'] as const;
export type PrimaryColor = (typeof PRIMARY_COLORS)[number];

export const SECONDARY_COLORS = ['orange', 'green', 'purple'] as const;
export type SecondaryColor = (typeof SECONDARY_COLORS)[number];

export const POTION_COLORS = ['red', 'yellow', 'blue', 'orange', 'green', 'purple'] as const;
export type PotionColor = (typeof POTION_COLORS)[number];

export type PotionPhase = 'pouring' | 'mixed';
export const POTION_PHASES: readonly PotionPhase[] = ['pouring', 'mixed'];

export interface PotionState {
  readonly phase: PotionPhase;
  readonly firstColor: PrimaryColor | null;
  readonly bowlColor: PotionColor | null;
  readonly request: SecondaryColor | null;
  readonly tries: number;
}

export interface CreatePotionOptions {
  request?: SecondaryColor | null;
}

export type PotionEvent =
  | { kind: 'poured'; color: PrimaryColor }
  | { kind: 'mixed'; result: PotionColor; first: PrimaryColor; second: PrimaryColor }
  | { kind: 'matched'; result: SecondaryColor; first: PrimaryColor; second: PrimaryColor; tries: number }
  | { kind: 'mixed-other'; result: PotionColor; first: PrimaryColor; second: PrimaryColor; target: SecondaryColor; tries: number }
  | { kind: 'busy' };

const MIX_PAIRS: Record<PrimaryColor, Record<PrimaryColor, PotionColor>> = {
  red: { red: 'red', yellow: 'orange', blue: 'purple' },
  yellow: { red: 'orange', yellow: 'yellow', blue: 'green' },
  blue: { red: 'purple', yellow: 'green', blue: 'blue' },
};

const TARGET_POTS: Record<SecondaryColor, readonly [PrimaryColor, PrimaryColor]> = {
  orange: ['red', 'yellow'],
  purple: ['red', 'blue'],
  green: ['yellow', 'blue'],
};

function assertPrimary(color: PrimaryColor): void {
  if (!(PRIMARY_COLORS as readonly string[]).includes(color)) {
    throw new Error(`Unknown primary color: ${String(color)}`);
  }
}

function assertSecondary(color: SecondaryColor): void {
  if (!(SECONDARY_COLORS as readonly string[]).includes(color)) {
    throw new Error(`Unknown secondary color: ${String(color)}`);
  }
}

/** Symmetric color mix table for the three primaries; same + same keeps its color. */
export function mixColors(a: PrimaryColor, b: PrimaryColor): PotionColor {
  assertPrimary(a);
  assertPrimary(b);
  return MIX_PAIRS[a][b];
}

/** Returns the two primary colors that mix into the given secondary target color. */
export function potsFor(target: SecondaryColor): readonly [PrimaryColor, PrimaryColor] {
  assertSecondary(target);
  return TARGET_POTS[target];
}

/** Creates an initial pouring state, optionally targeting a secondary color request. */
export function createPotion(opts?: CreatePotionOptions): PotionState {
  const request = opts?.request ?? null;
  if (request !== null) {
    assertSecondary(request);
  }
  return {
    phase: 'pouring',
    firstColor: null,
    bowlColor: null,
    request,
    tries: 0,
  };
}

/** Applies a pot tap without mutating the input state. Never enters a failure phase. */
export function tapPot(state: PotionState, color: PrimaryColor): { state: PotionState; event: PotionEvent } {
  assertPrimary(color);

  if (state.phase === 'mixed') {
    return { state, event: { kind: 'busy' } };
  }

  if (state.firstColor === null) {
    return {
      state: { ...state, phase: 'pouring', firstColor: color, bowlColor: color },
      event: { kind: 'poured', color },
    };
  }

  const first = state.firstColor;
  const result = mixColors(first, color);

  if (state.request === null) {
    return {
      state: { ...state, phase: 'mixed', bowlColor: result },
      event: { kind: 'mixed', result, first, second: color },
    };
  }

  const tries = state.tries + 1;
  const nextState: PotionState = { ...state, phase: 'mixed', bowlColor: result, tries };
  if (result === state.request) {
    return {
      state: nextState,
      event: { kind: 'matched', result, first, second: color, tries },
    };
  }

  return {
    state: nextState,
    event: { kind: 'mixed-other', result, first, second: color, target: state.request, tries },
  };
}

/**
 * Empties the bowl for the next mix.
 * Passing `nextRequest` sets a new request (or `null` for free mode) and resets `tries` to 0;
 * omitting it preserves the active request and try count for another attempt.
 */
export function resetBowl(state: PotionState, nextRequest?: SecondaryColor | null): PotionState {
  if (nextRequest !== undefined) {
    if (nextRequest !== null) {
      assertSecondary(nextRequest);
    }
    return {
      phase: 'pouring',
      firstColor: null,
      bowlColor: null,
      request: nextRequest,
      tries: 0,
    };
  }

  return {
    ...state,
    phase: 'pouring',
    firstColor: null,
    bowlColor: null,
  };
}
