import { describe, expect, it } from 'vitest';
import {
  PLANT_PHASES,
  SEED_STAGES,
  applyTool,
  createPlant,
  isBloomed,
  nextTool,
  parseOrderMode,
  parseStages,
  stageId,
  stepsToBloom,
  type OrderMode,
  type PlantState,
  type StageId,
  type Tool,
} from '@/games/seedFlower/seedFlowerMachine';

const TOOLS: readonly Tool[] = ['water', 'sun'];
const MODES: readonly OrderMode[] = ['free', 'water-then-sun'];
const THREE_STAGES: readonly StageId[] = ['seed', 'sprout', 'flower'];
const FOUR_STAGES: readonly StageId[] = [...SEED_STAGES];

/** Deterministic seeded LCG (no Math.random). */
function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stateKey(state: PlantState): string {
  return `${state.stageIndex}|${state.phase}|${state.watered}|${state.stepOutOfOrder}`;
}

function canReachBloom(start: PlantState): boolean {
  const visited = new Set<string>([stateKey(start)]);
  const queue: PlantState[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (isBloomed(current)) {
      return true;
    }
    for (const tool of TOOLS) {
      const { state: next } = applyTool(current, tool);
      const key = stateKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return false;
}

describe('seedFlowerMachine', () => {
  it('[AC-02] has no failure phase: PLANT_PHASES is exactly growing and bloomed', () => {
    expect(PLANT_PHASES).toEqual(['growing', 'bloomed']);
    expect(PLANT_PHASES).toHaveLength(2);
  });

  it('[AC-02] from every reachable state (exhaustive BFS over both tools, both modes, 3- and 4-stage plants) every tool leads to a state from which bloom is reachable, and the stage never decreases', () => {
    for (const stages of [THREE_STAGES, FOUR_STAGES]) {
      for (const mode of MODES) {
        const initial = createPlant(stages, mode);
        const reachable = new Map<string, PlantState>([[stateKey(initial), initial]]);
        const queue: PlantState[] = [initial];

        while (queue.length > 0) {
          const current = queue.shift()!;
          expect(PLANT_PHASES).toContain(current.phase);

          for (const tool of TOOLS) {
            const { state: next } = applyTool(current, tool);
            expect(next.stageIndex).toBeGreaterThanOrEqual(current.stageIndex);
            expect(PLANT_PHASES).toContain(next.phase);
            expect(canReachBloom(next)).toBe(true);

            const key = stateKey(next);
            if (!reachable.has(key)) {
              reachable.set(key, next);
              queue.push(next);
            }
          }
        }

        const bloomedStates = [...reachable.values()].filter((s) => isBloomed(s));
        expect(bloomedStates.length).toBeGreaterThan(0);
      }
    }
  });

  it('[AC-02] any random tap sequence of length 200 never throws and the plant blooms within the sequence when it contains water then sun enough times', () => {
    for (const stages of [THREE_STAGES, FOUR_STAGES]) {
      for (const mode of MODES) {
        for (let seed = 1; seed <= 25; seed++) {
          const rand = createLcg(seed * 97 + stages.length);
          let state = createPlant(stages, mode);
          let waitingForSun = false;
          let waterThenSunPairs = 0;

          for (let i = 0; i < 200; i++) {
            const tool: Tool = rand() < 0.5 ? 'water' : 'sun';
            if (tool === 'water') {
              waitingForSun = true;
            } else if (waitingForSun) {
              waterThenSunPairs++;
              waitingForSun = false;
            }

            const prevIndex = state.stageIndex;
            const res = applyTool(state, tool);
            state = res.state;
            expect(state.stageIndex).toBeGreaterThanOrEqual(prevIndex);
            expect(PLANT_PHASES).toContain(state.phase);
          }

          expect(waterThenSunPairs).toBeGreaterThanOrEqual(stages.length - 1);
          expect(isBloomed(state)).toBe(true);
          expect(stepsToBloom(state)).toBe(0);
        }
      }
    }
  });

  it('[AC-03] free mode: either tool grows one stage per tap, sun first included; 3 taps bloom a 4-stage plant', () => {
    const p0 = createPlant(FOUR_STAGES, 'free');
    expect(stageId(p0)).toBe('seed');
    expect(stepsToBloom(p0)).toBe(3);

    const r1 = applyTool(p0, 'sun');
    expect(r1.event).toEqual({
      kind: 'grew',
      from: 'seed',
      to: 'sprout',
      bloomed: false,
      stepOutOfOrder: false,
    });
    expect(r1.state.watered).toBe(false);
    expect(r1.state.stepOutOfOrder).toBe(false);
    expect(stageId(r1.state)).toBe('sprout');
    expect(stepsToBloom(r1.state)).toBe(2);

    const r2 = applyTool(r1.state, 'water');
    expect(r2.event).toEqual({
      kind: 'grew',
      from: 'sprout',
      to: 'bud',
      bloomed: false,
      stepOutOfOrder: false,
    });
    expect(r2.state.watered).toBe(false);
    expect(stageId(r2.state)).toBe('bud');
    expect(stepsToBloom(r2.state)).toBe(1);

    const r3 = applyTool(r2.state, 'sun');
    expect(r3.event).toEqual({
      kind: 'grew',
      from: 'bud',
      to: 'flower',
      bloomed: true,
      stepOutOfOrder: false,
    });
    expect(r3.state.phase).toBe('bloomed');
    expect(isBloomed(r3.state)).toBe(true);
    expect(stepsToBloom(r3.state)).toBe(0);
    expect(nextTool(r3.state)).toBeNull();
  });

  it('[AC-04] ordered mode: sun before water does not grow and returns needs-water and marks the step; water then sun grows and reports stepOutOfOrder; water twice returns needs-sun', () => {
    const start = createPlant(FOUR_STAGES, 'water-then-sun');

    // Sun before water: does not grow, returns needs-water, marks stepOutOfOrder
    const outOfOrderSun = applyTool(start, 'sun');
    expect(outOfOrderSun.event).toEqual({ kind: 'needs-water' });
    expect(outOfOrderSun.state.stageIndex).toBe(0);
    expect(outOfOrderSun.state.watered).toBe(false);
    expect(outOfOrderSun.state.stepOutOfOrder).toBe(true);

    // Water accepted, waiting for sun; preserves stepOutOfOrder
    const wateredAfterMiss = applyTool(outOfOrderSun.state, 'water');
    expect(wateredAfterMiss.event).toEqual({ kind: 'watered' });
    expect(wateredAfterMiss.state.watered).toBe(true);
    expect(wateredAfterMiss.state.stepOutOfOrder).toBe(true);

    // Water twice returns needs-sun and leaves state unchanged
    const secondWater = applyTool(wateredAfterMiss.state, 'water');
    expect(secondWater.event).toEqual({ kind: 'needs-sun' });
    expect(secondWater.state).toEqual(wateredAfterMiss.state);

    // Sun now grows and reports stepOutOfOrder: true, resetting flags for the next step
    const grewDirty = applyTool(secondWater.state, 'sun');
    expect(grewDirty.event).toEqual({
      kind: 'grew',
      from: 'seed',
      to: 'sprout',
      bloomed: false,
      stepOutOfOrder: true,
    });
    expect(grewDirty.state.stageIndex).toBe(1);
    expect(grewDirty.state.watered).toBe(false);
    expect(grewDirty.state.stepOutOfOrder).toBe(false);

    // Clean step: water then sun grows with stepOutOfOrder: false
    const cleanWater = applyTool(grewDirty.state, 'water');
    expect(cleanWater.event).toEqual({ kind: 'watered' });
    const cleanSun = applyTool(cleanWater.state, 'sun');
    expect(cleanSun.event).toEqual({
      kind: 'grew',
      from: 'sprout',
      to: 'bud',
      bloomed: false,
      stepOutOfOrder: false,
    });
  });

  it('[AC-04] nextTool hints water, then sun once watered, and null when bloomed', () => {
    const free = createPlant(THREE_STAGES, 'free');
    expect(nextTool(free)).toBe('water');
    const freeMid = applyTool(free, 'sun').state;
    expect(nextTool(freeMid)).toBe('water');
    const freeBloomed = applyTool(freeMid, 'water').state;
    expect(nextTool(freeBloomed)).toBeNull();

    const ordered = createPlant(THREE_STAGES, 'water-then-sun');
    expect(nextTool(ordered)).toBe('water');
    const orderedWatered = applyTool(ordered, 'water').state;
    expect(nextTool(orderedWatered)).toBe('sun');
    const orderedMid = applyTool(orderedWatered, 'sun').state;
    expect(nextTool(orderedMid)).toBe('water');
    const orderedBloomed = applyTool(applyTool(orderedMid, 'water').state, 'sun').state;
    expect(nextTool(orderedBloomed)).toBeNull();
  });

  it('[AC-02] any tool while bloomed returns resting and preserves state object values', () => {
    let state = createPlant(THREE_STAGES, 'free');
    state = applyTool(state, 'water').state;
    state = applyTool(state, 'sun').state;
    expect(isBloomed(state)).toBe(true);

    const snapshot = structuredClone(state);
    for (const tool of TOOLS) {
      const res = applyTool(state, tool);
      expect(res.event).toEqual({ kind: 'resting' });
      expect(res.state).toEqual(snapshot);
    }
  });

  it('[AC-02] applyTool never mutates the input state', () => {
    const initial = createPlant(FOUR_STAGES, 'water-then-sun');
    const initialSnapshot = structuredClone(initial);

    const r1 = applyTool(initial, 'sun');
    expect(initial).toEqual(initialSnapshot);

    const r1Snapshot = structuredClone(r1.state);
    const r2 = applyTool(r1.state, 'water');
    expect(r1.state).toEqual(r1Snapshot);

    const r2Snapshot = structuredClone(r2.state);
    applyTool(r2.state, 'sun');
    expect(r2.state).toEqual(r2Snapshot);
  });

  it('[AC-02] createPlant validates stage lists and throws on invalid inputs', () => {
    expect(() => createPlant(['seed'], 'free')).toThrow();
    expect(() => createPlant([], 'free')).toThrow();
    expect(() => createPlant(['sprout', 'flower'], 'free')).toThrow();
    expect(() => createPlant(['seed', 'sprout'], 'free')).toThrow();
    expect(() => createPlant(['seed', 'bud', 'sprout', 'flower'], 'free')).toThrow();
    expect(() => createPlant(['seed', 'sprout', 'sprout', 'flower'], 'free')).toThrow();
    expect(() => createPlant(['seed', 'tree' as StageId, 'flower'], 'free')).toThrow();

    expect(createPlant(['seed', 'flower'], 'free').stages).toEqual(['seed', 'flower']);
    expect(createPlant(['seed', 'bud', 'flower'], 'water-then-sun').stages).toEqual(['seed', 'bud', 'flower']);
  });

  it('[AC-02] parseOrderMode and parseStages return validated values or defaults', () => {
    expect(parseOrderMode('water-then-sun')).toBe('water-then-sun');
    expect(parseOrderMode('free')).toBe('free');
    expect(parseOrderMode('invalid')).toBe('free');
    expect(parseOrderMode(undefined)).toBe('free');
    expect(parseOrderMode(42)).toBe('free');

    expect(parseStages(['seed', 'sprout', 'flower'])).toEqual(['seed', 'sprout', 'flower']);
    expect(parseStages(['seed', 'flower'])).toEqual(['seed', 'flower']);
    expect(parseStages(['seed', 'sprout'])).toEqual([...SEED_STAGES]);
    expect(parseStages(['seed', 'bud', 'sprout', 'flower'])).toEqual([...SEED_STAGES]);
    expect(parseStages(['seed', 123])).toEqual([...SEED_STAGES]);
    expect(parseStages('seed,flower')).toEqual([...SEED_STAGES]);
    expect(parseStages(null)).toEqual([...SEED_STAGES]);
  });
});
