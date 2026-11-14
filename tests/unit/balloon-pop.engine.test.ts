// Balloon Pop Pass 1 (docs/specs/balloon-pop.md): adaptive rules, start levels and track bounds, leisure (AC-04, AC-07, AC-08).
import { describe, expect, it } from 'vitest';
import { loadBalloonPop, loadWorlds } from '@/content/loadContent';
import { DEFAULT_RULES, SkillSession, buildMeta, skillKey } from '@/core/adaptive';
import { LearningSession } from '@/core/leisure';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { defaultProfileState, type LeisureSettings } from '@/core/storage/schema';
import type { StorageDriver } from '@/core/storage/store';
import { balloonLevel, eligibleItemIds } from '@/games/balloon/balloonRound';
import { isSafeToApplyUpdate } from '@/pwa/updatePolicy';

const content = loadBalloonPop();
const TODAY = '2026-11-13';
const meta = buildMeta({ levelCount: content.adaptive.levels.length, tracks: content.adaptive.tracks, rules: content.adaptive.rules });

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function newSession(track: 'age2' | 'age5', store = new AdaptiveStore(memoryDriver()), profileId = 'a'): SkillSession {
  return new SkillSession({ store, profileId, track, world: content.world, gameId: content.id, meta, today: () => TODAY, random: () => 0.5 });
}

const levelMode = (level: number) => balloonLevel(content.adaptive.levels[level - 1]).mode;

const settings: LeisureSettings = {
  learnMinutes: 10,
  leisureMinutes: 5,
  dailyEarnCapMinutes: 30,
  idleSeconds: 20,
  languages: 'both',
  timeEarning: { enabled: true },
};

describe('balloon-pop: adaptive rules (AC-04)', () => {
  it('[AC-04] uses the engine defaults (up after 3 clean, down after 2 misses in 3, 3 trials per round)', () => {
    expect(content.adaptive.rules).toBeUndefined();
    expect(meta.rules).toEqual(DEFAULT_RULES);
  });

  it('[AC-04] age 2 rises one level after a clean round and drops after 2 misses in 3, at the round boundary', () => {
    const s = newSession('age2');
    const ids = eligibleItemIds(content, balloonLevel(content.adaptive.levels[0]));
    expect(s.level('en')).toBe(1);
    for (let i = 0; i < 3; i++) s.record('en', { itemId: ids[i], firstTryCorrect: true, hinted: false });
    expect(s.level('en')).toBe(2);
    s.record('en', { itemId: ids[0], firstTryCorrect: false, hinted: false });
    s.record('en', { itemId: ids[1], firstTryCorrect: false, hinted: false });
    expect(s.level('en')).toBe(2); // age 2 changes only between rounds
    s.record('en', { itemId: ids[2], firstTryCorrect: true, hinted: false });
    expect(s.level('en')).toBe(1);
  });

  it('[AC-04] age 5 rises right after the third clean pop and drops after two misses', () => {
    const s = newSession('age5');
    expect(s.level('fr')).toBe(5);
    for (const n of [1, 2, 3]) s.record('fr', { itemId: `digit-${n}`, firstTryCorrect: true, hinted: false });
    expect(s.level('fr')).toBe(6);
    s.record('fr', { itemId: 'digit-4', firstTryCorrect: false, hinted: false });
    s.record('fr', { itemId: 'digit-5', firstTryCorrect: false, hinted: false });
    expect(s.level('fr')).toBe(5);
  });

  it('[AC-04] a hinted correct pop is not clean and does not count toward a rise', () => {
    const s = newSession('age2');
    for (let i = 0; i < 3; i++) s.record('en', { itemId: `color-${content.colors[i].id}`, firstTryCorrect: true, hinted: true });
    expect(s.level('en')).toBe(1);
  });
});

describe('balloon-pop: start levels and track bounds (AC-07)', () => {
  it('[AC-07] a new age-2 profile starts at L1 (colour) and a new age-5 profile at L5 (digit), per language', () => {
    for (const lang of ['en', 'fr']) {
      const a = newSession('age2');
      const b = newSession('age5');
      expect(a.level(lang)).toBe(1);
      expect(levelMode(a.level(lang))).toBe('color');
      expect(b.level(lang)).toBe(5);
      expect(levelMode(b.level(lang))).toBe('digit');
    }
  });

  it('[AC-07] age 2 is capped at the colour levels and age 5 floored at the digit levels', () => {
    const { age2, age5 } = content.adaptive.tracks;
    for (let l = age2.min; l <= age2.max; l++) expect(levelMode(l), `age2 L${l}`).toBe('color');
    for (let l = age5.min; l <= age5.max; l++) expect(levelMode(l), `age5 L${l}`).toBe('digit');

    const store = new AdaptiveStore(memoryDriver());
    const young = newSession('age2', store);
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 3; i++) young.record('en', { itemId: `color-${content.colors[(round + i) % 6].id}`, firstTryCorrect: true, hinted: false });
    }
    expect(young.level('en')).toBe(age2.max);

    const old = newSession('age5');
    for (let i = 0; i < 12; i++) old.record('en', { itemId: `digit-${i % 5 + 1}`, firstTryCorrect: false, hinted: false });
    expect(old.level('en')).toBe(age5.min);
  });

  it('[AC-07] a level stored outside the track (e.g. after an age-track change) is clamped on read', () => {
    const store = new AdaptiveStore(memoryDriver());
    store.setSkill('a', skillKey(content.world, content.id, 'en'), {
      level: 8, cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: TODAY, items: {},
    });
    expect(newSession('age2', store).level('en')).toBe(4);
  });
});

describe('balloon-pop: leisure (AC-08)', () => {
  it('[AC-08] the game and its world earn leisure, and its screen is unsafe for a mid-game PWA update', () => {
    expect(content.earnsLeisure).toBe(true);
    expect(loadWorlds().worlds.find((w) => w.id === content.world)).toMatchObject({ status: 'open', earnsLeisure: true });
    expect(isSafeToApplyUpdate('balloon')).toBe(false);
  });

  it('[AC-08] wrong taps count as participation and never reduce the balance or stars', () => {
    const state = defaultProfileState(TODAY);
    state.balanceSec = 50;
    state.stars = 3;
    let now = 0;
    const learning = new LearningSession(state, settings, () => now);
    learning.start();
    let previous = state.balanceSec;
    for (let i = 0; i < 30; i++) {
      now += 1000;
      learning.reportInteraction(); // every balloon tap counts, right or wrong
      learning.tick(1);
      expect(state.balanceSec).toBeGreaterThanOrEqual(previous);
      previous = state.balanceSec;
    }
    expect(state.balanceSec).toBeGreaterThan(50);
    expect(state.stars).toBe(3);
  });
});
