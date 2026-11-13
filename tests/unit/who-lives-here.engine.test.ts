// Who Lives Here? Pass 1: adaptive engine, leisure, update policy and picker contract
// (docs/specs/who-lives-here.md AC-04, AC-07, AC-08, AC-16 data model, AC-20).
import { describe, expect, it } from 'vitest';
import { loadWhoLivesHere } from '@/content/loadContent';
import { DEFAULT_RULES, SkillSession, buildMeta, skillKey } from '@/core/adaptive';
import { LearningSession } from '@/core/leisure';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { defaultProfileState, type LeisureSettings } from '@/core/storage/schema';
import { Store, type StorageDriver } from '@/core/storage/store';
import { seedAdaptiveLevel } from '@/games/sorting/seedLevel';
import { SortingTrialTracker } from '@/games/sorting/sortingLogic';
import { decidePwaUpdate, isSafeToApplyUpdate, type AppScreen } from '@/pwa/updatePolicy';
import { NATURE_LAB_PICKER_GAMES, PICKER_GAMES } from '@/ui/picker/pickerModel';
import { resolvePickerAsset } from '@/ui/picker/pickerAssets';
import he from '@/content/i18n/he.json';
import fs from 'node:fs';
import path from 'node:path';

const content = loadWhoLivesHere();
const TODAY = '2026-11-13';

function memoryDriver() {
  const map = new Map<string, string>();
  const driver: StorageDriver = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
  return { driver, map };
}

function meta() {
  const { adaptive } = content;
  return buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules });
}

function newSession(profileId: string, track: 'age2' | 'age5', store: AdaptiveStore): SkillSession {
  return new SkillSession({ store, profileId, track, world: content.world, gameId: content.id, meta: meta(), today: () => TODAY, random: () => 0.5 });
}

const clean = (itemId: string) => ({ itemId, firstTryCorrect: true, hinted: false });
const miss = (itemId: string) => ({ itemId, firstTryCorrect: false, hinted: false });

const settings: LeisureSettings = {
  learnMinutes: 10,
  leisureMinutes: 5,
  dailyEarnCapMinutes: 30,
  idleSeconds: 20,
  languages: 'both',
  timeEarning: { enabled: true },
};

describe('who-lives-here: adaptive rules (AC-04, AC-07)', () => {
  it('[AC-04] uses the engine defaults with no override', () => {
    expect(content.adaptive.rules).toBeUndefined();
    expect(meta().rules).toEqual(DEFAULT_RULES);
  });

  it('[AC-04] age 5: difficulty rises after 3 clean placements and a hinted one does not count', () => {
    const skills = newSession('b', 'age5', new AdaptiveStore(memoryDriver().driver));
    expect(skills.level('en')).toBe(5);
    skills.record('en', clean('frog'));
    skills.record('en', clean('bird'));
    expect(skills.level('en')).toBe(5);
    skills.record('en', clean('owl'));
    expect(skills.level('en')).toBe(6);

    const hinted = newSession('b2', 'age5', new AdaptiveStore(memoryDriver().driver));
    hinted.record('en', clean('frog'));
    hinted.record('en', clean('bird'));
    hinted.record('en', { itemId: 'owl', firstTryCorrect: true, hinted: true });
    expect(hinted.level('en')).toBe(5);
  });

  it('[AC-04] age 5: difficulty drops by 1 after 2 misses within 3 trials', () => {
    const skills = newSession('b', 'age5', new AdaptiveStore(memoryDriver().driver));
    skills.record('en', miss('frog'));
    skills.record('en', clean('bird'));
    expect(skills.level('en')).toBe(5);
    skills.record('en', miss('owl'));
    expect(skills.level('en')).toBe(4);
  });

  it('[AC-04] age 2: a rise or a drop shows only after the round (3rd trial), and it stops at level 4', () => {
    const rise = newSession('a', 'age2', new AdaptiveStore(memoryDriver().driver));
    rise.record('en', clean('frog'));
    rise.record('en', clean('bird'));
    expect(rise.level('en')).toBe(1);
    rise.record('en', clean('owl'));
    expect(rise.level('en')).toBe(2);

    const store = new AdaptiveStore(memoryDriver().driver);
    seedAdaptiveLevel(store, 'a3', content, 3, TODAY);
    const mid = newSession('a3', 'age2', store);
    mid.record('en', miss('frog'));
    mid.record('en', miss('bird'));
    expect(mid.level('en')).toBe(3); // still inside the round
    mid.record('en', clean('owl'));
    expect(mid.level('en')).toBe(2);

    const top = new AdaptiveStore(memoryDriver().driver);
    seedAdaptiveLevel(top, 'a4', content, 4, TODAY);
    const ceiling = newSession('a4', 'age2', top);
    for (const id of ['frog', 'bird', 'owl']) ceiling.record('en', clean(id));
    expect(ceiling.level('en')).toBe(4);
  });

  it('[AC-07] a new age-2 profile starts at level 1 and a new age-5 profile at level 5, in both languages', () => {
    const store = new AdaptiveStore(memoryDriver().driver);
    const age2 = newSession('a', 'age2', store);
    const age5 = newSession('b', 'age5', store);
    for (const lang of ['en', 'fr']) {
      expect(age2.level(lang)).toBe(1);
      expect(age5.level(lang)).toBe(5);
    }
  });

  it('[AC-07] the skill key is nature-lab.who-lives-here.<lang> and the seed helper writes it for every language', () => {
    expect(skillKey(content.world, content.id, 'en')).toBe('nature-lab.who-lives-here.en');
    const store = new AdaptiveStore(memoryDriver().driver);
    seedAdaptiveLevel(store, 'a', content, 3, TODAY);
    for (const lang of content.languages) expect(store.getSkill('a', skillKey(content.world, content.id, lang))?.level).toBe(3);
  });

  it('[AC-04] one tap per trial is recorded: the first tap wins, later taps and replays record nothing', () => {
    const tracker = new SortingTrialTracker('frog', 'en');
    expect(tracker.onBedTap(false)).toEqual({ itemId: 'frog', firstTryCorrect: false, hinted: false });
    expect(tracker.onBedTap(true)).toBeNull();
    const hinted = new SortingTrialTracker('bird', 'fr');
    hinted.onReplay();
    expect(hinted.isHinted).toBe(false);
    hinted.onHint();
    expect(hinted.onBedTap(true)).toEqual({ itemId: 'bird', firstTryCorrect: true, hinted: true });
  });
});

describe('who-lives-here: leisure (AC-08)', () => {
  it('[AC-08] leisure accrues while the child takes part', () => {
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
  });

  it('[AC-08] wrong taps count as participation and never reduce the balance or stars', () => {
    const state = defaultProfileState(TODAY);
    state.balanceSec = 50;
    state.stars = 2;
    let now = 0;
    const learning = new LearningSession(state, settings, () => now);
    learning.start();
    let previous = state.balanceSec;
    for (let i = 0; i < 30; i++) {
      now += 1000;
      learning.reportInteraction();
      learning.tick(1);
      expect(state.balanceSec).toBeGreaterThanOrEqual(previous);
      previous = state.balanceSec;
    }
    expect(state.stars).toBe(2);
  });

  it('[AC-08] balances never mix across profiles', () => {
    const NOW = new Date('2026-11-13T10:00:00');
    const store = new Store(memoryDriver().driver, NOW);
    const a = store.getProfileState('a', NOW);
    const b = store.getProfileState('b', NOW);
    b.balanceSec = 77;
    store.getState().settings.timeEarning = { enabled: true };
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

describe('who-lives-here: screen, update policy and picker (AC-20)', () => {
  it('[AC-20] habitat is an AppScreen and a waiting update is deferred while it is open', () => {
    const screen: AppScreen = 'habitat';
    expect(isSafeToApplyUpdate(screen)).toBe(false);
    expect(decidePwaUpdate({ updateAvailable: true, screen, startupGuardActive: false, applyInFlight: false })).toBe('defer');
  });

  it('[AC-20] the Nature Lab picker lists Who\'s Hiding? first, then Who Lives Here?, with their scenes and card ids', () => {
    expect(NATURE_LAB_PICKER_GAMES.map((g) => g.gameId)).toEqual(['who-is-hiding', 'who-lives-here']);
    expect(NATURE_LAB_PICKER_GAMES.map((g) => g.testId)).toEqual(['game-picker-who-is-hiding', 'game-picker-who-lives-here']);
    expect(NATURE_LAB_PICKER_GAMES.map((g) => g.sceneKey)).toEqual(['HidingScene', 'HabitatScene']);
  });

  it('[AC-20] the Language House picker is unchanged and has no Nature Lab game', () => {
    expect(PICKER_GAMES.map((g) => g.gameId)).toEqual(['animal-restaurant', 'kitchen-orchestra']);
  });

  it('[AC-20] picker cards have Hebrew labels, a Hebrew title, and placeholder art that exists on disk', () => {
    expect(he.gamePicker.natureLabTitle.length).toBeGreaterThan(0);
    for (const game of NATURE_LAB_PICKER_GAMES) {
      expect(he.gamePicker[game.labelKey].length).toBeGreaterThan(0);
      const asset = resolvePickerAsset(game.assetKey);
      if (asset.kind !== 'css') expect(fs.existsSync(path.join('public', asset.url)), game.assetKey).toBe(true);
    }
  });
});
