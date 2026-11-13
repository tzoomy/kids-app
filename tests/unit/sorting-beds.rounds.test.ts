// Sorting Beds Pass 1, TDD step 1: rule per round (AC-21) and round composition (AC-32).
// These run against the STUB logic in src/games/sorting/sortingLogic.ts and are expected to fail until step 2.
import { describe, expect, it } from 'vitest';
import { loadSortingBeds } from '@/content/loadContent';
import {
  ATTRIBUTE_VALUES,
  buildRound,
  conjunctionBeds,
  levelLevers,
  pickConjunctionColors,
  ruleForRound,
  visitAttribute,
  type BedAccepts,
  type FlowerSpec,
  type LevelLevers,
  type RoundPlan,
} from '@/games/sorting/sortingLogic';
import type { FlowerColor, SortAttribute, SortRule } from '@/games/sorting/types';

const levels = loadSortingBeds().adaptive.levels;
const leversOf = (level: number): LevelLevers => levelLevers(levels[level - 1]);

/** Small deterministic RNG so every failure is reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function matches(accepts: BedAccepts, flower: FlowerSpec): boolean {
  return (
    (accepts.color === undefined || accepts.color === flower.color) &&
    (accepts.shape === undefined || accepts.shape === flower.shape) &&
    (accepts.size === undefined || accepts.size === flower.size)
  );
}

describe('sorting-beds: rule per round (AC-21)', () => {
  it('[AC-21] at one attribute the visit attribute cycles colour, shape, size across visits at 2 beds', () => {
    expect([0, 1, 2, 3, 4, 5].map((visit) => visitAttribute(visit, 2))).toEqual([
      'color', 'shape', 'size', 'color', 'shape', 'size',
    ]);
  });

  it('[AC-21] size is never the visit attribute at 3 beds; colour and shape both come up', () => {
    const picked = Array.from({ length: 9 }, (_, visit) => visitAttribute(visit, 3));
    expect(picked).not.toContain('size');
    expect(picked[0]).toBe('color');
    expect(picked[1]).toBe('shape');
    expect(new Set(picked)).toEqual(new Set<SortAttribute>(['color', 'shape']));
  });

  it('[AC-21] L1-L4: one attribute defines the beds of every round of the visit', () => {
    const expectations: Array<{ level: number; attr: SortAttribute; beds: number }> = [
      { level: 1, attr: 'color', beds: 2 },
      { level: 1, attr: 'size', beds: 2 },
      { level: 2, attr: 'shape', beds: 2 },
      { level: 3, attr: 'color', beds: 3 },
      { level: 4, attr: 'shape', beds: 3 },
    ];
    for (const { level, attr, beds } of expectations) {
      for (let round = 0; round < 5; round++) {
        expect(ruleForRound(leversOf(level), round, attr), `L${level} ${attr} round ${round}`).toEqual({ rule: attr, bedCount: beds });
      }
    }
  });

  it('[AC-21] L5 alternates colour and size between rounds; the bed count is clamped to the values (2 on size rounds)', () => {
    const rounds = [0, 1, 2, 3].map((round) => ruleForRound(leversOf(5), round, 'color'));
    expect(rounds).toEqual([
      { rule: 'color', bedCount: 3 },
      { rule: 'size', bedCount: 2 },
      { rule: 'color', bedCount: 3 },
      { rule: 'size', bedCount: 2 },
    ]);
    // beds = min(choiceCount, values(attribute))
    expect(Math.min(leversOf(5).choiceCount, ATTRIBUTE_VALUES.size.length)).toBe(2);
  });

  it('[AC-21] L6-L8: 4 size x colour conjunction beds in every round', () => {
    for (const level of [6, 7, 8]) {
      for (let round = 0; round < 3; round++) {
        expect(ruleForRound(leversOf(level), round, 'color'), `L${level} round ${round}`).toEqual({ rule: 'size+color', bedCount: 4 });
      }
    }
  });

  it('[AC-21] a conjunction round uses 2 distinct colours of the 3', () => {
    const all = new Set<FlowerColor>(ATTRIBUTE_VALUES.color);
    for (let seed = 1; seed <= 30; seed++) {
      const [first, second] = pickConjunctionColors(seeded(seed));
      expect(all.has(first)).toBe(true);
      expect(all.has(second)).toBe(true);
      expect(first).not.toBe(second);
    }
  });

  it('[AC-21] the 4 conjunction beds are small and large of each of the 2 colours', () => {
    const beds = conjunctionBeds(['red', 'yellow']);
    expect(beds).toHaveLength(4);
    const keys = beds.map((b) => `${b.size}-${b.color}`).sort();
    expect(keys).toEqual(['large-red', 'large-yellow', 'small-red', 'small-yellow']);
    for (const bed of beds) expect(Object.keys(bed).sort()).toEqual(['color', 'size']);
  });
});

const ATTRS_OF_RULE: Record<SortRule, SortAttribute[]> = {
  color: ['color'],
  shape: ['shape'],
  size: ['size'],
  'size+color': ['size', 'color'],
  'size+shape': ['size', 'shape'],
};

function expectedRule(level: number, round: number): SortRule {
  if (level <= 4) return 'color';
  if (level === 5) return round % 2 === 0 ? 'color' : 'size';
  return 'size+color';
}

function expectedBeds(level: number, round: number): number {
  if (level >= 6) return 4;
  if (level === 5) return round % 2 === 0 ? 3 : 2;
  return Math.min(leversOf(level).choiceCount, ATTRIBUTE_VALUES.color.length);
}

function plansFor(level: number, round = 0): RoundPlan[] {
  return Array.from({ length: 30 }, (_, i) =>
    buildRound({ levers: leversOf(level), roundIndex: round, visitAttribute: 'color', flowerCount: 3, random: seeded(i + 1) }),
  );
}

describe('sorting-beds: round composition (AC-32)', () => {
  it('[AC-32] a round has the level beds, 3 flowers, and the rule of the level', () => {
    for (let level = 1; level <= 8; level++) {
      for (const round of level === 5 ? [0, 1] : [0]) {
        for (const plan of plansFor(level, round)) {
          expect(plan.beds, `L${level} round ${round}`).toHaveLength(expectedBeds(level, round));
          expect(plan.flowers).toHaveLength(3);
          expect(plan.rule).toBe(expectedRule(level, round));
          const keys = ATTRS_OF_RULE[plan.rule].slice().sort();
          for (const bed of plan.beds) expect(Object.keys(bed.accepts).sort()).toEqual(keys);
        }
      }
    }
  });

  it('[AC-32] every flower matches exactly one bed under the rule in force, and that bed is its target', () => {
    for (let level = 1; level <= 8; level++) {
      for (const plan of plansFor(level)) {
        expect(plan.beds.length).toBeGreaterThan(0);
        plan.flowers.forEach((flower, index) => {
          const switched = plan.switchAfter !== null && index >= plan.switchAfter;
          const matching = plan.beds.filter((bed) => matches(switched ? (bed.acceptsAfterSwitch ?? {}) : bed.accepts, flower));
          expect(matching, `L${level} flower ${index} ${flower.id}`).toHaveLength(1);
          expect(matching[0].id).toBe(flower.targetBedId);
        });
      }
    }
  });

  it('[AC-32] each round targets at least 2 beds, and a bed capacity is the flowers that belong to it', () => {
    for (let level = 1; level <= 8; level++) {
      for (const plan of plansFor(level)) {
        expect(plan.flowers).toHaveLength(3);
        const targets = new Set(plan.flowers.map((f) => f.targetBedId));
        expect(targets.size, `L${level}`).toBeGreaterThanOrEqual(2);
        for (const bed of plan.beds) {
          expect(bed.capacity).toBe(plan.flowers.filter((f) => f.targetBedId === bed.id).length);
        }
        expect(plan.beds.reduce((sum, bed) => sum + bed.capacity, 0)).toBe(3);
      }
    }
  });

  it('[AC-32] with 4 beds and 3 flowers at least one bed stays empty', () => {
    for (const level of [6, 7, 8]) {
      for (const plan of plansFor(level)) {
        expect(plan.beds).toHaveLength(4);
        expect(plan.beds.some((bed) => bed.capacity === 0)).toBe(true);
      }
    }
  });

  it('[AC-32] non-rule attributes vary per extra.vary (L1-L7); vary 0 holds them constant', () => {
    for (let level = 1; level <= 7; level++) {
      const levers = leversOf(level);
      let widest = 0;
      for (const plan of plansFor(level)) {
        expect(plan.flowers).toHaveLength(3);
        const nonRule = (['color', 'shape', 'size'] as const).filter((a) => !ATTRS_OF_RULE[plan.rule].includes(a));
        const varying = nonRule.filter((a) => new Set(plan.flowers.map((f) => f[a])).size > 1).length;
        const cap = Math.min(levers.vary, nonRule.length);
        expect(varying, `L${level}`).toBeLessThanOrEqual(cap);
        widest = Math.max(widest, varying);
      }
      // Colour rounds leave 2 non-rule attributes (shape, size); conjunction rounds (L6-L7) leave only shape.
      expect(widest, `L${level} reaches its vary cap over 30 rounds`).toBe(Math.min(levers.vary, level >= 6 ? 1 : 2));
    }
  });

  it('[AC-32] L7-L8 beds hold one example flower that does not count toward capacity; L1-L6 hold none', () => {
    for (let level = 1; level <= 8; level++) {
      for (const plan of plansFor(level)) {
        expect(plan.beds.length).toBeGreaterThan(0);
        for (const bed of plan.beds) {
          if (level >= 7) {
            expect(bed.example, `L${level}`).not.toBeNull();
            expect(matches(bed.accepts, bed.example as FlowerSpec)).toBe(true);
          } else {
            expect(bed.example).toBeNull();
          }
        }
        expect(plan.beds.reduce((sum, bed) => sum + bed.capacity, 0)).toBe(plan.flowers.length);
      }
    }
  });

  it('[AC-32] the four L8 examples are distinct under both the size x colour and the size x shape rule', () => {
    for (const plan of plansFor(8)) {
      expect(plan.beds).toHaveLength(4);
      const examples = plan.beds.map((bed) => bed.example);
      expect(examples.every((e) => e !== null)).toBe(true);
      for (const [index, bed] of plan.beds.entries()) {
        const own = examples[index] as FlowerSpec;
        // Under the first rule only its own bed accepts the example ...
        expect(plan.beds.filter((b) => matches(b.accepts, own)).map((b) => b.id)).toEqual([bed.id]);
        // ... and so after the switch.
        expect(plan.beds.filter((b) => matches(b.acceptsAfterSwitch ?? {}, own)).map((b) => b.id)).toEqual([bed.id]);
      }
    }
  });

  it('[AC-32] the L8 switch comes after the first placement and replaces colour by shape', () => {
    for (const plan of plansFor(8)) {
      expect(plan.rule).toBe('size+color');
      expect(plan.ruleAfterSwitch).toBe('size+shape');
      expect(plan.switchAfter).toBe(1);
      for (const bed of plan.beds) expect(Object.keys(bed.acceptsAfterSwitch ?? {}).sort()).toEqual(['shape', 'size']);
    }
    for (let level = 1; level <= 7; level++) {
      for (const plan of plansFor(level)) {
        expect(plan.beds.length).toBeGreaterThan(0);
        expect(plan.switchAfter).toBeNull();
        expect(plan.ruleAfterSwitch).toBeNull();
      }
    }
  });
});
