// Pure state machine for Travel Suitcase (docs/specs/travel-suitcase.md).
// No Phaser, no DOM, no mutation of inputs. Never enters a failure phase.

export type SuitcasePhase = 'asking' | 'closing';
export const SUITCASE_PHASES: readonly SuitcasePhase[] = ['asking', 'closing'];

export type SuitcaseRequestKind = 'noun' | 'two' | 'attribute' | 'negation';

export interface SuitcaseChoice {
  readonly id: string;
  readonly itemId: string;
  readonly color: string | null;
}

export interface SuitcaseRequest {
  readonly kind: SuitcaseRequestKind;
  readonly targets: readonly string[];
  readonly needed: number;
  readonly packedForRequest: readonly string[];
}

export interface SuitcaseState {
  readonly phase: SuitcasePhase;
  readonly choices: readonly SuitcaseChoice[];
  readonly request: SuitcaseRequest;
  readonly packed: readonly string[];
  readonly requestIndex: number;
  readonly requestsPerCase: number;
  readonly tries: number;
}

export type SuitcaseEvent =
  | { readonly kind: 'packed'; readonly choiceId: string; readonly requestDone: boolean; readonly caseDone: boolean }
  | { readonly kind: 'other'; readonly choiceId: string }
  | { readonly kind: 'busy' };

export interface SuitcaseRequestInput {
  readonly kind: SuitcaseRequestKind;
  readonly targets: readonly string[];
  readonly needed?: number;
}

export interface CreateCaseOptions {
  readonly choices: readonly SuitcaseChoice[];
  readonly request: SuitcaseRequestInput;
  readonly requestsPerCase: number;
}

export interface NextRequestOptions {
  readonly choices: readonly SuitcaseChoice[];
  readonly request: SuitcaseRequestInput;
}

function validateChoices(choices: readonly SuitcaseChoice[], alreadyPacked: ReadonlySet<string>): SuitcaseChoice[] {
  if (choices.length < 2) {
    throw new Error('Suitcase request requires at least 2 choices');
  }
  const seen = new Set<string>();
  return choices.map((c) => {
    if (!c.id || !c.itemId) {
      throw new Error(`Invalid suitcase choice: ${JSON.stringify(c)}`);
    }
    if (seen.has(c.id)) {
      throw new Error(`Duplicate suitcase choice id: ${c.id}`);
    }
    if (alreadyPacked.has(c.id)) {
      throw new Error(`Suitcase choice "${c.id}" is already packed in this case`);
    }
    seen.add(c.id);
    return { id: c.id, itemId: c.itemId, color: c.color };
  });
}

function validateRequest(request: SuitcaseRequestInput, choiceIds: ReadonlySet<string>): SuitcaseRequest {
  const needed = request.needed ?? (request.kind === 'two' ? 2 : 1);
  if (!Number.isInteger(needed) || needed < 1) {
    throw new Error(`Invalid suitcase needed count: ${String(needed)}`);
  }
  const seenTargets = new Set<string>();
  const targets = request.targets.map((id) => {
    if (!choiceIds.has(id)) {
      throw new Error(`Suitcase target "${String(id)}" is not in choices`);
    }
    if (seenTargets.has(id)) {
      throw new Error(`Duplicate suitcase target "${id}"`);
    }
    seenTargets.add(id);
    return id;
  });

  if (request.kind === 'two') {
    if (needed !== 2 || targets.length !== 2) {
      throw new Error('Two-item suitcase request requires exactly 2 targets and needed = 2');
    }
  } else if (request.kind === 'negation') {
    if (needed !== 1 || targets.length !== 2) {
      throw new Error('Negation suitcase request requires 2 right colour targets and needed = 1');
    }
  } else if (needed !== 1 || targets.length !== 1) {
    throw new Error(`${request.kind} suitcase request requires 1 target and needed = 1`);
  }

  return {
    kind: request.kind,
    targets,
    needed,
    packedForRequest: [],
  };
}

/** Creates an initial open-suitcase case in `'asking'` phase. Never enters a failure phase. */
export function createCase(opts: CreateCaseOptions): SuitcaseState {
  if (!Number.isInteger(opts.requestsPerCase) || opts.requestsPerCase < 1) {
    throw new Error(`Invalid requestsPerCase: ${String(opts.requestsPerCase)}`);
  }
  const choices = validateChoices(opts.choices, new Set());
  const choiceIds = new Set(choices.map((c) => c.id));
  const request = validateRequest(opts.request, choiceIds);

  return {
    phase: 'asking',
    choices,
    request,
    packed: [],
    requestIndex: 0,
    requestsPerCase: opts.requestsPerCase,
    tries: 0,
  };
}

/** Starts the next request inside the same open suitcase without mutating `state`. */
export function nextRequest(state: SuitcaseState, next: NextRequestOptions): SuitcaseState {
  if (state.phase === 'closing' || state.requestIndex + 1 >= state.requestsPerCase) {
    throw new Error('Cannot start nextRequest: suitcase is already complete');
  }
  if (state.request.packedForRequest.length < state.request.needed) {
    throw new Error('Cannot start nextRequest before current request is complete');
  }
  const packedSet = new Set(state.packed);
  const choices = validateChoices(next.choices, packedSet);
  const choiceIds = new Set(choices.map((c) => c.id));
  const request = validateRequest(next.request, choiceIds);

  return {
    phase: 'asking',
    choices,
    request,
    packed: [...state.packed],
    requestIndex: state.requestIndex + 1,
    requestsPerCase: state.requestsPerCase,
    tries: 0,
  };
}

/** Handles tapping or dropping a choice onto the suitcase without mutating `state`. */
export function pick(state: SuitcaseState, choiceId: string): { state: SuitcaseState; event: SuitcaseEvent } {
  const knownOnFloor = state.choices.some((c) => c.id === choiceId);
  const alreadyPacked = state.packed.includes(choiceId);
  if (!knownOnFloor && !alreadyPacked) {
    throw new Error(`Unknown suitcase choice id: ${String(choiceId)}`);
  }

  if (
    state.phase !== 'asking' ||
    alreadyPacked ||
    state.request.packedForRequest.length >= state.request.needed
  ) {
    return { state, event: { kind: 'busy' } };
  }

  if (!state.request.targets.includes(choiceId)) {
    return {
      state: { ...state, tries: state.tries + 1 },
      event: { kind: 'other', choiceId },
    };
  }

  const packedForRequest = [...state.request.packedForRequest, choiceId];
  const packed = [...state.packed, choiceId];
  const requestDone = packedForRequest.length >= state.request.needed;
  const caseDone = requestDone && state.requestIndex + 1 >= state.requestsPerCase;

  return {
    state: {
      ...state,
      phase: caseDone ? 'closing' : 'asking',
      request: {
        ...state.request,
        packedForRequest,
      },
      packed,
      tries: state.tries,
    },
    event: {
      kind: 'packed',
      choiceId,
      requestDone,
      caseDone,
    },
  };
}
