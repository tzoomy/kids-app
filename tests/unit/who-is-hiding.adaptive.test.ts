import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta, skillKey } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { loadWhosHiding } from '@/content/loadContent';
import type { StorageDriver } from '@/core/storage/store';

function memoryDriver() {
  const map = new Map<string, string>();
  const driver: StorageDriver = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
  return { driver, map };
}

const hiding = loadWhosHiding();
const meta = buildMeta({
  levelCount: hiding.adaptive.levels.length,
  tracks: hiding.adaptive.tracks,
  rules: hiding.adaptive.rules,
});
const IDS = hiding.animals.map((a) => a.id);

function make(driver: StorageDriver, track: 'age2' | 'age5', profileId = 'a') {
  const store = new AdaptiveStore(driver);
  const session = new SkillSession({
    store,
    profileId,
    track,
    world: hiding.world,
    gameId: hiding.id,
    meta,
    today: () => '2026-11-12',
    random: () => 0.3,
  });
  return { store, session };
}

describe("Who's Hiding? adaptive engine (Pass 1)", () => {
  it('[AC-04] age-2 starts at L2, climbs after a clean round of 3, and drops after 2-of-3 misses only at the round boundary', () => {
    const { driver } = memoryDriver();
    const { session } = make(driver, 'age2');
    expect(session.level('en')).toBe(2);
    for (let i = 0; i < 3; i++) session.record('en', { itemId: IDS[i], firstTryCorrect: true, hinted: false });
    expect(session.level('en')).toBe(3);
    expect(session.atRoundBoundary('en')).toBe(true);

    session.record('en', { itemId: IDS[0], firstTryCorrect: false, hinted: false });
    session.record('en', { itemId: IDS[1], firstTryCorrect: false, hinted: false });
    // Two misses in the window: age-2 still holds the level until the round closes.
    expect(session.level('en')).toBe(3);
    expect(session.atRoundBoundary('en')).toBe(false);
    session.record('en', { itemId: IDS[2], firstTryCorrect: true, hinted: false });
    expect(session.level('en')).toBe(2);
    expect(session.atRoundBoundary('en')).toBe(true);
  });

  it('[AC-04] age-2 level is unchanged mid-round after three clean trials have not yet completed', () => {
    const { driver } = memoryDriver();
    const { session } = make(driver, 'age2');
    session.record('en', { itemId: IDS[0], firstTryCorrect: true, hinted: false });
    session.record('en', { itemId: IDS[1], firstTryCorrect: true, hinted: false });
    expect(session.level('en')).toBe(2);
    expect(session.atRoundBoundary('en')).toBe(false);
  });

  it('[AC-24] after a drop the next pick is a known animal and not an immediate repeat of the last target', () => {
    const { driver } = memoryDriver();
    const { session, store } = make(driver, 'age5');
    const key = skillKey(hiding.world, hiding.id, 'en');
    store.setSkill('a', key, {
      level: 4,
      cleanStreak: 0,
      recent: [],
      afterDrop: true,
      lastPlayedDay: '2026-11-12',
      items: {
        cat: { box: 1, seen: 2, clean: 0, lastSeenDay: '2026-11-12' },
        lion: { box: 3, seen: 4, clean: 3, lastSeenDay: '2026-11-12' },
        bear: { box: 1, seen: 1, clean: 0, lastSeenDay: '2026-11-12' },
      },
    });
    expect(session.familiarItemIds('en')).toEqual(['lion']);
    const lastTargetId = 'lion';
    // The scene excludes the previous target from candidates (HidingScene.startRound).
    const candidates = IDS.filter((id) => id !== lastTargetId);
    // With only lion mastered, afterDrop still has to pick a seen animal from the remaining candidates.
    const picked = session.selectNextItem('en', candidates);
    expect(candidates).toContain(picked);
    expect(picked).not.toBe(lastTargetId);
    expect(['cat', 'bear']).toContain(picked);
  });
});
