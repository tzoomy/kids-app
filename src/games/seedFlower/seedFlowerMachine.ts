export const SEED_STAGES = ['seed', 'sprout', 'bud', 'flower'] as const;
export type StageId = (typeof SEED_STAGES)[number];
export type Tool = 'water' | 'sun';
export type OrderMode = 'free' | 'water-then-sun';
export type PlantPhase = 'growing' | 'bloomed';
export const PLANT_PHASES: readonly PlantPhase[] = ['growing', 'bloomed'];

export interface PlantState {
  readonly stages: readonly StageId[];
  readonly mode: OrderMode;
  readonly stageIndex: number;
  readonly phase: PlantPhase;
  readonly watered: boolean;
  readonly stepOutOfOrder: boolean;
}

export type PlantEvent =
  | { kind: 'grew'; from: StageId; to: StageId; bloomed: boolean; stepOutOfOrder: boolean }
  | { kind: 'watered' }
  | { kind: 'needs-water' }
  | { kind: 'needs-sun' }
  | { kind: 'resting' };

function validateStages(stages: readonly StageId[]): StageId[] {
  if (!Array.isArray(stages) || stages.length < 2) {
    throw new Error('Plant stages must have at least 2 entries.');
  }
  if (stages[0] !== 'seed') {
    throw new Error("Plant stages must start with 'seed'.");
  }
  if (stages[stages.length - 1] !== 'flower') {
    throw new Error("Plant stages must end with 'flower'.");
  }
  let prevOrder = -1;
  for (const stage of stages) {
    const order = SEED_STAGES.indexOf(stage);
    if (order === -1) {
      throw new Error(`Unknown stage id: ${String(stage)}`);
    }
    if (order <= prevOrder) {
      throw new Error('Plant stages must be strictly in SEED_STAGES order without duplicates.');
    }
    prevOrder = order;
  }
  return [...stages];
}

/** Creates the initial growing plant state for a validated stage list and order mode. */
export function createPlant(stages: readonly StageId[], mode: OrderMode): PlantState {
  return {
    stages: validateStages(stages),
    mode,
    stageIndex: 0,
    phase: 'growing',
    watered: false,
    stepOutOfOrder: false,
  };
}

function advanceStage(state: PlantState, stepOutOfOrder: boolean): { state: PlantState; event: PlantEvent } {
  const from = state.stages[state.stageIndex];
  const nextIndex = state.stageIndex + 1;
  const to = state.stages[nextIndex];
  const bloomed = nextIndex === state.stages.length - 1;
  return {
    state: {
      ...state,
      stageIndex: nextIndex,
      phase: bloomed ? 'bloomed' : 'growing',
      watered: false,
      stepOutOfOrder: false,
    },
    event: { kind: 'grew', from, to, bloomed, stepOutOfOrder },
  };
}

/** Applies a tool tap to the plant state without mutating the input state. */
export function applyTool(state: PlantState, tool: Tool): { state: PlantState; event: PlantEvent } {
  if (state.phase === 'bloomed') {
    return { state, event: { kind: 'resting' } };
  }

  if (state.mode === 'free') {
    return advanceStage(state, false);
  }

  if (tool === 'water') {
    if (state.watered) {
      return { state, event: { kind: 'needs-sun' } };
    }
    return {
      state: { ...state, watered: true },
      event: { kind: 'watered' },
    };
  }

  if (!state.watered) {
    return {
      state: state.stepOutOfOrder ? state : { ...state, stepOutOfOrder: true },
      event: { kind: 'needs-water' },
    };
  }

  return advanceStage(state, state.stepOutOfOrder);
}

/** Returns the tool to hint next, or null when the plant has already bloomed. */
export function nextTool(state: PlantState): Tool | null {
  if (state.phase === 'bloomed') {
    return null;
  }
  if (state.mode === 'free') {
    return 'water';
  }
  return state.watered ? 'sun' : 'water';
}

/** Returns the active stage id for the given plant state. */
export function stageId(state: PlantState): StageId {
  return state.stages[state.stageIndex];
}

/** Returns true when the plant has reached its final bloomed stage. */
export function isBloomed(state: PlantState): boolean {
  return state.phase === 'bloomed';
}

/** Returns the number of growth steps remaining until the plant blooms. */
export function stepsToBloom(state: PlantState): number {
  return state.stages.length - 1 - state.stageIndex;
}

/** Parses an arbitrary value into an OrderMode, defaulting to 'free'. */
export function parseOrderMode(value: unknown): OrderMode {
  return value === 'water-then-sun' ? 'water-then-sun' : 'free';
}

/** Parses an arbitrary value into a validated StageId array, defaulting to SEED_STAGES. */
export function parseStages(value: unknown): StageId[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    return [...SEED_STAGES];
  }
  try {
    return validateStages(value as StageId[]);
  } catch {
    return [...SEED_STAGES];
  }
}
