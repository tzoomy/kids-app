// Who Lives Here? Pass 1: round composition and layout (docs/specs/who-lives-here.md AC-17, AC-18).
import { describe, expect, it } from 'vitest';
import { loadWhoLivesHere } from '@/content/loadContent';
import { buildHabitatRound, chooseFirstAnimal, computeHabitatLayout, levelLevers, MIN_TAP } from '@/games/habitat';

const content = loadWhoLivesHere();
const familyOf = (homeId: string) => content.homes.find((h) => h.id === homeId)!.family;

/** Deterministic pseudo-random generator so the property loops are repeatable. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('who-lives-here: round building (AC-17)', () => {
  it('[AC-17] homes shown equal the level choiceCount, always include the first animal\'s home, and every animal\'s home is on screen', () => {
    content.adaptive.levels.forEach((level, i) => {
      const levers = levelLevers(level);
      for (let seed = 1; seed <= 40; seed++) {
        const first = content.animals[seed % content.animals.length].id;
        const plan = buildHabitatRound({ content, levers, trials: 3, random: seeded(seed), firstAnimalId: first });
        expect(plan.homeIds, `L${i + 1} homes`).toHaveLength(levers.choiceCount);
        expect(new Set(plan.homeIds).size).toBe(plan.homeIds.length);
        expect(plan.animals[0].id).toBe(first);
        for (const animal of plan.animals) {
          expect(plan.homeIds, `L${i + 1} ${animal.id} home on screen`).toContain(animal.homeId);
          expect(content.animals.find((a) => a.id === animal.id)!.home).toBe(animal.homeId);
        }
      }
    });
  });

  it('[AC-17] a round has exactly `trials` animals (the engine round length), at least two different target homes, and an animal repeats only when the homes on screen have fewer animals than trials', () => {
    for (const [i, level] of content.adaptive.levels.entries()) {
      const levers = levelLevers(level);
      for (let seed = 1; seed <= 40; seed++) {
        const plan = buildHabitatRound({ content, levers, trials: 3, random: seeded(seed * 7) });
        expect(plan.animals, `L${i + 1}`).toHaveLength(3);
        expect(new Set(plan.animals.map((a) => a.homeId)).size).toBeGreaterThanOrEqual(2);
        // One animal per home in the content: 2 homes -> the third animal is a repeat, 3 or 4 homes -> all distinct.
        const distinct = new Set(plan.animals.map((a) => a.id)).size;
        expect(distinct, `L${i + 1} distinct animals`).toBe(Math.min(3, levers.choiceCount));
        // Never the same animal twice in a row.
        for (let k = 1; k < plan.animals.length; k++) expect(plan.animals[k].id).not.toBe(plan.animals[k - 1].id);
      }
    }
  });

  it('[AC-17] far levels pick distractor homes of other families first, near levels pick the same family first', () => {
    const far = levelLevers(content.adaptive.levels[2]); // L3: 3 homes, far
    const near = levelLevers(content.adaptive.levels[3]); // L4: 3 homes, near
    for (let seed = 1; seed <= 40; seed++) {
      // First animal: owl (tree-hollow, family "tree", which has 2 siblings: nest and hive).
      const farPlan = buildHabitatRound({ content, levers: far, trials: 3, random: seeded(seed), firstAnimalId: 'owl' });
      const firstFamily = familyOf('tree-hollow');
      const farFamilies = farPlan.homeIds.filter((h) => h !== 'tree-hollow').map(familyOf);
      expect(farFamilies.every((f) => f !== firstFamily), `far L3 seed ${seed}`).toBe(true);

      const nearPlan = buildHabitatRound({ content, levers: near, trials: 3, random: seeded(seed), firstAnimalId: 'owl' });
      const nearFamilies = nearPlan.homeIds.filter((h) => h !== 'tree-hollow').map(familyOf);
      expect(nearFamilies.every((f) => f === firstFamily), `near L4 seed ${seed}`).toBe(true);
    }
  });

  it('[AC-17] near with no sibling homes falls back to other families instead of failing', () => {
    const near = levelLevers(content.adaptive.levels[5]); // L6: 4 homes, near
    const plan = buildHabitatRound({ content, levers: near, trials: 3, random: seeded(3), firstAnimalId: 'frog' }); // pond is alone in "water"
    expect(plan.homeIds).toHaveLength(4);
    expect(plan.homeIds).toContain('pond');
  });

  it('[AC-17] without a preferred first animal the round still starts with a valid animal', () => {
    const plan = buildHabitatRound({ content, levers: levelLevers(content.adaptive.levels[0]), trials: 3, random: seeded(11) });
    expect(content.animals.map((a) => a.id)).toContain(plan.animals[0].id);
  });

  it('[AC-17] the first animal comes from the engine over every animal id', () => {
    let seen: readonly string[] = [];
    const skills = {
      selectNextItem: (_lang: string, candidates: readonly string[]) => {
        seen = candidates;
        return candidates[2];
      },
    };
    const id = chooseFirstAnimal(skills, 'en', content);
    expect(seen).toEqual(content.animals.map((a) => a.id));
    expect(id).toBe(content.animals[2].id);
  });
});

describe('who-lives-here: layout (AC-18)', () => {
  const sizes = [
    { width: 1280, height: 800 },
    { width: 800, height: 1280 },
  ];
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const { width, height } of sizes) {
    for (const count of [2, 3, 4]) {
      it(`[AC-18] ${width}x${height} with ${count} homes: inside the canvas, no overlaps, tap targets at least ${MIN_TAP} px`, () => {
        const ids = content.homes.slice(0, count).map((h) => h.id);
        const layout = computeHabitatLayout(width, height, ids);
        expect(layout.homes).toHaveLength(count);
        for (const home of layout.homes) {
          for (const rect of [home.hit, home.art]) {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.5);
            expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.5);
          }
          expect(home.hit.width).toBeGreaterThanOrEqual(MIN_TAP);
          expect(home.hit.height).toBeGreaterThanOrEqual(MIN_TAP);
          // The art sits inside its tap rectangle.
          expect(home.art.x).toBeGreaterThanOrEqual(home.hit.x - 0.5);
          expect(home.art.x + home.art.width).toBeLessThanOrEqual(home.hit.x + home.hit.width + 0.5);
          expect(home.art.y + home.art.height).toBeLessThanOrEqual(home.hit.y + home.hit.height + 0.5);
          // The animal settles inside the art box.
          expect(home.settle.x).toBeGreaterThan(home.art.x);
          expect(home.settle.x).toBeLessThan(home.art.x + home.art.width);
          expect(home.settle.feetY).toBeGreaterThan(home.art.y);
          expect(home.settle.feetY).toBeLessThanOrEqual(home.art.y + home.art.height);
        }
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) expect(overlaps(layout.homes[i].hit, layout.homes[j].hit), `homes ${i}/${j}`).toBe(false);
        }
        const a = layout.animal;
        expect(a.hit.width).toBeGreaterThanOrEqual(MIN_TAP);
        expect(a.hit.height).toBeGreaterThanOrEqual(MIN_TAP);
        expect(a.hit.x).toBeGreaterThanOrEqual(0);
        expect(a.hit.x + a.hit.width).toBeLessThanOrEqual(width + 0.5);
        expect(a.hit.y + a.hit.height).toBeLessThanOrEqual(height + 0.5);
        for (const home of layout.homes) expect(overlaps(a.hit, home.hit), 'animal vs home').toBe(false);
      });
    }
  }

  it('[AC-18] landscape lays homes in one row; portrait stacks 3 and 4 homes in a grid', () => {
    const ids = content.homes.slice(0, 4).map((h) => h.id);
    const land = computeHabitatLayout(1280, 800, ids);
    expect(new Set(land.homes.map((h) => Math.round(h.hit.y))).size).toBe(1);
    const port = computeHabitatLayout(800, 1280, ids);
    expect(new Set(port.homes.map((h) => Math.round(h.hit.y))).size).toBe(2);
  });
});
