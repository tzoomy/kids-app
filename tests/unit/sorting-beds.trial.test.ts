// Sorting Beds Pass 1, TDD step 1: one result per flower (AC-24) and idle-hint recording (AC-27).
// Run against the STUB SortingTrialTracker, so they are expected to fail until step 2.
import { describe, expect, it } from 'vitest';
import { loadSortingBeds } from '@/content/loadContent';
import { SkillSession, buildMeta, classify, type TrialResult } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { SortingTrialTracker } from '@/games/sorting/sortingLogic';

const content = loadSortingBeds();
const ITEM = 'tulip-red-small';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function newSkills(): { skills: SkillSession; store: AdaptiveStore } {
  const { adaptive } = content;
  const store = new AdaptiveStore(memoryDriver());
  const skills = new SkillSession({
    store,
    profileId: 'b',
    track: 'age5',
    world: content.world,
    gameId: content.id,
    meta: buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    today: () => '2026-11-13',
    random: () => 0.5,
  });
  return { skills, store };
}

describe('sorting-beds: one miss per item (AC-24)', () => {
  it('[AC-24] the first wrong tap records the miss at once; later wrong taps and the final correct placement record nothing', () => {
    const tracker = new SortingTrialTracker(ITEM, 'en');
    expect(tracker.onBedTap(false)).toEqual({ itemId: ITEM, firstTryCorrect: false, hinted: false });
    expect(tracker.onBedTap(false)).toBeNull();
    expect(tracker.onBedTap(false)).toBeNull();
    expect(tracker.onBedTap(true)).toBeNull();
  });

  it('[AC-24] a correct first tap records a clean first try, and nothing after it', () => {
    const tracker = new SortingTrialTracker(ITEM, 'fr');
    const result = tracker.onBedTap(true);
    expect(result).toEqual({ itemId: ITEM, firstTryCorrect: true, hinted: false });
    expect(classify(result as TrialResult)).toBe('clean');
    expect(tracker.onBedTap(true)).toBeNull();
  });

  it('[AC-24] miss, miss, then the right bed leaves exactly one miss in the adaptive history', () => {
    const { skills, store } = newSkills();
    const tracker = new SortingTrialTracker(ITEM, 'en');
    for (const correct of [false, false, true]) {
      const result = tracker.onBedTap(correct);
      if (result) skills.record('en', result);
    }
    // Exactly one trial was recorded, and it is the miss.
    const stored = store.getSkill('b', 'number-garden.sorting-beds.en');
    expect(stored?.recent).toEqual(['miss']);
    expect(Object.keys(stored?.items ?? {})).toEqual([ITEM]);
    expect(skills.level('en')).toBe(5);
  });
});

describe('sorting-beds: idle hint and replay recording (AC-27)', () => {
  it('[AC-27] an idle hint before the trial is recorded makes the correct placement assisted, not clean', () => {
    const tracker = new SortingTrialTracker(ITEM, 'en');
    tracker.onHint();
    const result = tracker.onBedTap(true);
    expect(result).toEqual({ itemId: ITEM, firstTryCorrect: true, hinted: true });
    expect(classify(result as TrialResult)).toBe('assisted');
  });

  it('[AC-27] a hint after a recorded miss changes nothing', () => {
    const tracker = new SortingTrialTracker(ITEM, 'en');
    const miss = tracker.onBedTap(false);
    expect(miss).toEqual({ itemId: ITEM, firstTryCorrect: false, hinted: false });
    tracker.onHint();
    expect(tracker.onBedTap(true)).toBeNull();
    expect(classify(miss as TrialResult)).toBe('miss');
  });

  it('[AC-27] a hint after the placement was recorded changes nothing', () => {
    const tracker = new SortingTrialTracker(ITEM, 'en');
    expect(tracker.onBedTap(true)).toEqual({ itemId: ITEM, firstTryCorrect: true, hinted: false });
    tracker.onHint();
    expect(tracker.onBedTap(true)).toBeNull();
  });

  it('[AC-27] tapping the basket flower to replay the rule is not a hint', () => {
    const tracker = new SortingTrialTracker(ITEM, 'fr');
    tracker.onReplay();
    tracker.onReplay();
    const result = tracker.onBedTap(true);
    expect(result).toEqual({ itemId: ITEM, firstTryCorrect: true, hinted: false });
    expect(classify(result as TrialResult)).toBe('clean');
  });
});
