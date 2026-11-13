// Sorting Beds Pass 1 review fix: engine wiring of the first flower of a round (known item after a level drop).
import { describe, expect, it } from 'vitest';
import { loadSortingBeds } from '@/content/loadContent';
import { SkillSession, buildMeta, skillKey, type SkillState } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import {
  ATTRIBUTE_VALUES,
  buildRound,
  chooseFirstFlower,
  flowerMatches,
  levelLevers,
  visitAttribute,
} from '@/games/sorting/sortingLogic';

const content = loadSortingBeds();
const TODAY = '2026-11-13';
const ALL_IDS = ATTRIBUTE_VALUES.shape.flatMap((shape) =>
  ATTRIBUTE_VALUES.color.flatMap((color) => ATTRIBUTE_VALUES.size.map((size) => `${shape}-${color}-${size}`)),
);

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

function setup() {
  const map = new Map<string, string>();
  const driver: StorageDriver = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  const store = new AdaptiveStore(driver);
  const { adaptive } = content;
  const skills = new SkillSession({
    store,
    profileId: 'p',
    track: 'age5',
    world: content.world,
    gameId: content.id,
    meta: buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    today: () => TODAY,
    random: seeded(7),
  });
  return { store, skills };
}

describe('sorting-beds wiring: first flower of a round', () => {
  it('[AC-04] after a level drop the first flower is a known (mastered) item and afterDrop is cleared', () => {
    const { store, skills } = setup();
    const key = skillKey(content.world, content.id, 'en');
    const dropped: SkillState = {
      level: 4,
      cleanStreak: 0,
      recent: [],
      afterDrop: true,
      lastPlayedDay: TODAY,
      items: {
        'tulip-red-small': { box: 4, seen: 6, clean: 6, lastSeenDay: TODAY },
        'daisy-blue-large': { box: 1, seen: 2, clean: 0, lastSeenDay: TODAY },
        'round-yellow-small': { box: 1, seen: 1, clean: 0, lastSeenDay: TODAY },
      },
    };
    for (let i = 0; i < 5; i++) {
      store.setSkill('p', key, { ...dropped, items: { ...dropped.items } });
      expect(chooseFirstFlower(skills, 'en')).toBe('tulip-red-small');
      expect(store.getSkill('p', key)?.afterDrop).toBe(false);
    }
  });

  it('[AC-04] without a drop the choice is any of the 18 flowers and afterDrop stays false', () => {
    const { store, skills } = setup();
    const id = chooseFirstFlower(skills, 'fr');
    expect(ALL_IDS).toContain(id);
    expect(store.getSkill('p', skillKey(content.world, content.id, 'fr'))?.afterDrop ?? false).toBe(false);
  });

  it('[AC-32] buildRound starts with the preferred flower at every level, which still matches exactly one bed', () => {
    for (let level = 1; level <= 8; level++) {
      const levers = levelLevers(content.adaptive.levels[level - 1]);
      for (const id of ALL_IDS) {
        for (const seed of [1, 2, 3]) {
          const plan = buildRound({
            levers,
            roundIndex: seed % 2,
            visitAttribute: visitAttribute(seed, levers.choiceCount),
            flowerCount: 3,
            random: seeded(seed * 101 + level),
            preferredFirst: id,
          });
          expect(plan.flowers).toHaveLength(3);
          const first = plan.flowers[0];
          expect(first.id).toBe(id);
          const owners = plan.beds.filter((b) => flowerMatches(b.accepts, first));
          expect(owners.map((b) => b.id)).toEqual([first.targetBedId]);
          expect(new Set(plan.flowers.map((f) => f.targetBedId)).size).toBeGreaterThanOrEqual(2);
          for (const bed of plan.beds) {
            expect(bed.capacity).toBe(plan.flowers.filter((f) => f.targetBedId === bed.id).length);
          }
        }
      }
    }
  });

  it('[AC-32] buildRound without a preference is unchanged (backward compatible)', () => {
    const levers = levelLevers(content.adaptive.levels[0]);
    const base = { levers, roundIndex: 0, visitAttribute: 'color' as const, flowerCount: 3 };
    expect(buildRound({ ...base, random: seeded(5) })).toEqual(
      buildRound({ ...base, random: seeded(5), preferredFirst: undefined }),
    );
  });
});
