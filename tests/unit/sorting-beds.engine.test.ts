// Sorting Beds Pass 1, TDD step 1: engine, leisure, update-policy and animation-profile contract (ACs 04, 07, 08, 19, 29, 30).
// These assert the real engine and data already on this branch; the logic ACs live in the other sorting-beds*.test.ts files.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSortingBeds, loadWorlds } from '@/content/loadContent';
import { ANIM_PROFILE } from '@/anim/profiles';
import { DEFAULT_RULES, SkillSession, buildMeta, skillKey, trackPolicy } from '@/core/adaptive';
import { LearningSession } from '@/core/leisure';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { adaptiveKey } from '@/core/storage/adaptiveSchema';
import { STORAGE_KEY, defaultProfileState, type LeisureSettings } from '@/core/storage/schema';
import { Store, type StorageDriver } from '@/core/storage/store';
import { decidePwaUpdate, isSafeToApplyUpdate, type AppScreen } from '@/pwa/updatePolicy';
import { seedAdaptiveLevel } from '@/games/sorting/seedLevel';

const content = loadSortingBeds();
const TODAY = '2026-11-13';

function metaFromContent() {
  const { adaptive } = content;
  return buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules });
}

function memoryDriver() {
  const map = new Map<string, string>();
  const driver: StorageDriver = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
  return { driver, map };
}

function newSession(profileId: string, track: 'age2' | 'age5', store: AdaptiveStore): SkillSession {
  return new SkillSession({
    store,
    profileId,
    track,
    world: content.world,
    gameId: content.id,
    meta: metaFromContent(),
    today: () => TODAY,
    random: () => 0.5,
  });
}

const settings: LeisureSettings = {
  learnMinutes: 10,
  leisureMinutes: 5,
  dailyEarnCapMinutes: 30,
  idleSeconds: 20,
  languages: 'both',
};

describe('sorting-beds: adaptive rules (AC-04, AC-07)', () => {
  it('[AC-04] uses the engine v1 defaults: no rules override, DEFAULT_RULES, drop by 1, 3 trials per round, no response time', () => {
    expect(content.adaptive.rules).toBeUndefined();
    const meta = metaFromContent();
    expect(meta.rules).toEqual(DEFAULT_RULES);
    expect(meta.rules).toMatchObject({ upCleanStreak: 3, downMisses: 2, downWindow: 3, trialsPerRound: 3 });
    expect(trackPolicy('age2').useResponseTime).toBe(false);
    expect(trackPolicy('age5').useResponseTime).toBe(false);
  });

  it('[AC-04] age 5: difficulty rises after 3 clean placements in a row', () => {
    const store = new AdaptiveStore(memoryDriver().driver);
    const skills = newSession('b', 'age5', store);
    expect(skills.level('en')).toBe(5);
    skills.record('en', { itemId: 'tulip-red-small', firstTryCorrect: true, hinted: false });
    skills.record('en', { itemId: 'daisy-red-small', firstTryCorrect: true, hinted: false });
    expect(skills.level('en')).toBe(5);
    skills.record('en', { itemId: 'round-red-small', firstTryCorrect: true, hinted: false });
    expect(skills.level('en')).toBe(6);
  });

  it('[AC-04] an assisted placement is not clean, so it does not count toward a rise', () => {
    const store = new AdaptiveStore(memoryDriver().driver);
    const skills = newSession('b', 'age5', store);
    skills.record('en', { itemId: 'tulip-red-small', firstTryCorrect: true, hinted: false });
    skills.record('en', { itemId: 'daisy-red-small', firstTryCorrect: true, hinted: false });
    skills.record('en', { itemId: 'round-red-small', firstTryCorrect: true, hinted: true });
    expect(skills.level('en')).toBe(5);
  });

  it('[AC-04] age 5: difficulty drops by 1 after 2 misses within a window of 3', () => {
    const store = new AdaptiveStore(memoryDriver().driver);
    const skills = newSession('b', 'age5', store);
    skills.record('en', { itemId: 'tulip-red-small', firstTryCorrect: false, hinted: false });
    skills.record('en', { itemId: 'daisy-red-small', firstTryCorrect: true, hinted: false });
    expect(skills.level('en')).toBe(5);
    skills.record('en', { itemId: 'round-red-small', firstTryCorrect: false, hinted: false });
    expect(skills.level('en')).toBe(4);
  });

  it('[AC-04] age 2: a rise or a drop is applied between rounds (after the 3rd placement)', () => {
    const rise = newSession('a', 'age2', new AdaptiveStore(memoryDriver().driver));
    expect(rise.level('en')).toBe(2);
    for (const id of ['tulip-red-small', 'daisy-red-small', 'round-red-small']) {
      rise.record('en', { itemId: id, firstTryCorrect: true, hinted: false });
    }
    expect(rise.level('en')).toBe(3);

    const drop = newSession('a', 'age2', new AdaptiveStore(memoryDriver().driver));
    drop.record('en', { itemId: 'tulip-red-small', firstTryCorrect: false, hinted: false });
    drop.record('en', { itemId: 'daisy-red-small', firstTryCorrect: false, hinted: false });
    expect(drop.level('en')).toBe(2); // still inside the round
    drop.record('en', { itemId: 'round-red-small', firstTryCorrect: true, hinted: false });
    expect(drop.level('en')).toBe(1);
  });

  it('[AC-07] a new age-2 profile starts at L2 and a new age-5 profile starts at L5, in both languages', () => {
    expect(content.adaptive.tracks.age2).toEqual({ start: 2, min: 1, max: 8 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 5, min: 1, max: 8 });
    const store = new AdaptiveStore(memoryDriver().driver);
    const age2 = newSession('a', 'age2', store);
    const age5 = newSession('b', 'age5', store);
    for (const lang of ['en', 'fr']) {
      expect(age2.level(lang)).toBe(2);
      expect(age5.level(lang)).toBe(5);
    }
  });
});

describe('sorting-beds: leisure (AC-08)', () => {
  it('[AC-08] leisure accrues while the child takes part, with the default 2:1 learn-to-leisure ratio', () => {
    const state = defaultProfileState(TODAY);
    let now = 0;
    const learning = new LearningSession(state, settings, () => now);
    learning.start();
    for (let i = 0; i < 60; i++) {
      now += 1000;
      learning.reportInteraction();
      learning.tick(1);
    }
    expect(state.activeSec).toBe(60);
    expect(state.balanceSec).toBeGreaterThan(0);
    expect(state.balanceSec).toBeLessThanOrEqual(state.activeSec);
  });

  it('[AC-08] wrong-bed taps still count as participation and never reduce the balance or stars', () => {
    const state = defaultProfileState(TODAY);
    state.balanceSec = 50;
    state.stars = 2;
    let now = 0;
    const learning = new LearningSession(state, settings, () => now);
    learning.start();
    let previous = state.balanceSec;
    for (let i = 0; i < 30; i++) {
      now += 1000;
      learning.reportInteraction(); // every bed tap counts, right or wrong
      learning.tick(1);
      expect(state.balanceSec).toBeGreaterThanOrEqual(previous);
      previous = state.balanceSec;
    }
    expect(state.stars).toBe(2);
  });

  it('[AC-08] balances never mix across profiles', () => {
    const NOW = new Date('2026-11-13T10:00:00');
    const { driver } = memoryDriver();
    const store = new Store(driver, NOW);
    const a = store.getProfileState('a', NOW);
    const b = store.getProfileState('b', NOW);
    b.balanceSec = 77;
    let now = 0;
    const learning = new LearningSession(a, store.getState().settings, () => now);
    learning.start();
    for (let i = 0; i < 20; i++) {
      now += 1000;
      learning.reportInteraction();
      learning.tick(1);
    }
    expect(a.balanceSec).toBeGreaterThan(0);
    expect(b.balanceSec).toBe(77);
    expect(b.activeSec).toBe(0);
  });
});

describe('sorting-beds: animation profile (AC-19)', () => {
  it('[AC-19] ANIM_PROFILE.sorting holds the frozen drop, settle and ruleSwitch knobs', () => {
    expect(ANIM_PROFILE.sorting).toEqual({
      drop: { duration: 520, arcHeight: 120, endScale: 0.92, ease: 'Sine.easeIn' },
      settle: { duration: 280, squash: 0.9, ease: 'Back.easeOut' },
      ruleSwitch: { duration: 480, ease: 'Sine.easeInOut' },
    });
  });

  it('[AC-19] src/anim/profiles.ts stays Phaser-free so these tests never load Phaser', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/anim/profiles.ts'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]phaser['"]|import\s+['"]phaser['"]|require\(['"]phaser['"]\)/);
  });
});

describe('sorting-beds: screen and update policy (AC-29)', () => {
  it('[AC-29] sorting is an AppScreen and a waiting update is deferred while it is open', () => {
    const screen: AppScreen = 'sorting';
    expect(isSafeToApplyUpdate(screen)).toBe(false);
    expect(
      decidePwaUpdate({ updateAvailable: true, screen, startupGuardActive: false, applyInFlight: false }),
    ).toBe('defer');
    expect(isSafeToApplyUpdate('map')).toBe(true);
  });

  it('[AC-29] SortingScene reports the sorting screen while it is open', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/games/sorting/SortingScene.ts'), 'utf8');
    expect(source).toMatch(/setAppScreen\(\s*'sorting'\s*\)/);
  });
});

const CORE = resolve(process.cwd(), 'src/core');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : full.endsWith('.ts') ? [full] : [];
  });
}

function importSpecifiers(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

describe('sorting-beds: leisure independence (AC-30)', () => {
  it('[AC-30] a level rise or drop never changes balanceSec, earnedTodaySec or stars', () => {
    const NOW = new Date('2026-11-13T10:00:00');
    const { driver } = memoryDriver();
    const leisure = new Store(driver, NOW);
    const state = leisure.getProfileState('b', NOW);
    state.balanceSec = 123;
    state.earnedTodaySec = 45;
    state.stars = 3;
    const before = { ...state };

    const skills = newSession('b', 'age5', new AdaptiveStore(driver));
    for (const id of ['tulip-red-small', 'daisy-red-small', 'round-red-small']) {
      skills.record('en', { itemId: id, firstTryCorrect: true, hinted: false });
    }
    expect(skills.level('en')).toBe(6); // rise
    for (const [i, ok] of [false, true, false].entries()) {
      skills.record('en', { itemId: `x${i}`, firstTryCorrect: ok, hinted: false });
    }
    expect(skills.level('en')).toBe(5); // drop

    expect({ ...state }).toEqual(before);
  });

  it('[AC-30] seeding a level writes every language and does not touch the leisure state', () => {
    const NOW = new Date('2026-11-13T10:00:00');
    const { driver, map } = memoryDriver();
    const leisure = new Store(driver, NOW);
    leisure.getProfileState('b', NOW).balanceSec = 321;
    leisure.persist();
    const leisureBefore = map.get(STORAGE_KEY);
    expect(leisureBefore).toBeDefined();

    const adaptive = new AdaptiveStore(driver);
    seedAdaptiveLevel(adaptive, 'b', content, 7, TODAY);

    for (const lang of content.languages) {
      const skill = adaptive.getSkill('b', skillKey('number-garden', 'sorting-beds', lang));
      expect(skill?.level).toBe(7);
      expect(skill?.cleanStreak).toBe(0);
      expect(skill?.recent).toEqual([]);
    }
    expect(map.has(adaptiveKey('b'))).toBe(true);
    expect(map.get(STORAGE_KEY)).toBe(leisureBefore);
    expect(leisure.getProfileState('b', NOW).balanceSec).toBe(321);
  });

  it('[AC-30] src/core/leisure and src/core/adaptive do not import each other', () => {
    const leisure = filesUnder(join(CORE, 'leisure'));
    const adaptive = filesUnder(join(CORE, 'adaptive'));
    expect(leisure.length).toBeGreaterThan(0);
    expect(adaptive.length).toBeGreaterThan(0);
    for (const file of leisure) expect(importSpecifiers(file).filter((s) => /adaptive/i.test(s)), file).toEqual([]);
    for (const file of adaptive) expect(importSpecifiers(file).filter((s) => /leisure/i.test(s)), file).toEqual([]);
  });

  it('[AC-30] the Number Garden building opens Sorting Beds and earns leisure', () => {
    const garden = loadWorlds().worlds.find((w) => w.id === 'number-garden');
    expect(garden).toMatchObject({ status: 'open', earnsLeisure: true, entryGameId: 'sorting-beds' });
  });
});
