import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LearningSession } from '@/core/leisure';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { adaptiveKey } from '@/core/storage/adaptiveSchema';
import { STORAGE_KEY } from '@/core/storage/schema';
import { Store, type StorageDriver } from '@/core/storage/store';

const SRC = resolve(process.cwd(), 'src/core');

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

function memoryDriver() {
  const map = new Map<string, string>();
  const driver: StorageDriver = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
  return { driver, map };
}

describe('leisure / adaptive separation', () => {
  it('has no cross imports between src/core/leisure and src/core/adaptive', () => {
    const leisure = filesUnder(join(SRC, 'leisure'));
    const adaptive = filesUnder(join(SRC, 'adaptive'));
    expect(leisure.length).toBeGreaterThan(0);
    expect(adaptive.length).toBeGreaterThan(0);
    for (const file of leisure) {
      expect(importSpecifiers(file).filter((s) => /adaptive/i.test(s)), file).toEqual([]);
    }
    for (const file of adaptive) {
      expect(importSpecifiers(file).filter((s) => /leisure/i.test(s)), file).toEqual([]);
    }
  });

  it('keeps Phaser and the DOM out of src/core/adaptive', () => {
    for (const file of filesUnder(join(SRC, 'adaptive'))) {
      expect(importSpecifiers(file).filter((s) => /phaser/i.test(s)), file).toEqual([]);
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(document|window)\.|\blocalStorage\b/);
    }
  });

  it('leisure results do not depend on the adaptive outcomes (all-miss vs all-clean)', () => {
    const NOW = new Date('2026-11-12T10:00:00');
    const { driver, map } = memoryDriver();
    const leisureStore = new Store(driver, NOW);
    const adaptive = new AdaptiveStore(driver);
    const meta = buildMeta({ levelCount: 5, tracks: { age2: { start: 1, max: 5 }, age5: { start: 4, max: 5 } } });

    leisureStore.getState().settings.timeEarning = { enabled: true };

    function timeline(profileId: string, firstTryCorrect: boolean) {
      const state = leisureStore.getProfileState(profileId, NOW);
      let t = 0;
      const learning = new LearningSession(state, leisureStore.getState().settings, () => t);
      const skills = new SkillSession({
        store: adaptive,
        profileId,
        track: 'age5',
        world: 'language-house',
        gameId: 'animal-restaurant',
        meta,
        today: () => '2026-11-12',
        random: () => 0.5,
      });
      learning.start();
      for (let i = 0; i < 30; i++) {
        t += 1000;
        learning.reportInteraction(); // every tap counts, right or wrong
        skills.record('en', { itemId: `item${i % 6}`, firstTryCorrect, hinted: false });
        learning.tick(1);
      }
      skills.endVisit();
      return { ...state };
    }

    const misses = timeline('a', false);
    const cleans = timeline('b', true);
    expect(misses.balanceSec).toBe(cleans.balanceSec);
    expect(misses.earnedTodaySec).toBe(cleans.earnedTodaySec);
    expect(misses.activeSec).toBe(cleans.activeSec);
    expect(misses.balanceSec).toBeGreaterThan(0);

    // The adaptive state really did diverge, so the comparison above is meaningful.
    expect(adaptive.getSkill('a', 'language-house.animal-restaurant.en')?.level).toBe(1);
    expect(adaptive.getSkill('b', 'language-house.animal-restaurant.en')?.level).toBe(5);
    expect(map.has(adaptiveKey('a'))).toBe(true);
  });
});

describe('adaptive store isolation', () => {
  it('saving an adaptive profile leaves the kids-app-state-v2 value byte-identical', () => {
    const { driver, map } = memoryDriver();
    const leisureStore = new Store(driver, new Date('2026-11-12T10:00:00'));
    leisureStore.getProfileState('a', new Date('2026-11-12T10:00:00')).balanceSec = 123;
    leisureStore.persist();
    const before = map.get(STORAGE_KEY);
    expect(before).toBeDefined();

    const adaptive = new AdaptiveStore(driver);
    adaptive.setSkill('a', 'k', {
      level: 3, cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: '2026-11-12', items: {},
    });
    adaptive.persist('a');

    expect(map.get(STORAGE_KEY)).toBe(before);
    expect(map.has(adaptiveKey('a'))).toBe(true);
  });

  it('the adaptive store never reads the leisure key', () => {
    const reads: string[] = [];
    const driver: StorageDriver = {
      getItem: (k) => (reads.push(k), null),
      setItem: () => undefined,
    };
    const store = new AdaptiveStore(driver);
    store.getProfile('a');
    store.persist('a');
    expect(reads).toEqual([adaptiveKey('a')]);
  });
});
