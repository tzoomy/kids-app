import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { loadShadowMatch, loadWhosHiding } from '@/content/loadContent';
import { LearningSession } from '@/core/leisure';
import { defaultProfileState, type LeisureSettings } from '@/core/storage/schema';
import { isSafeToApplyUpdate } from '@/pwa/updatePolicy';
import type { StorageDriver } from '@/core/storage/store';

const shadow = loadShadowMatch();
const IDS = loadWhosHiding().animals.map((a) => a.id);
const meta = buildMeta({
  levelCount: shadow.adaptive.levels.length,
  tracks: shadow.adaptive.tracks,
  rules: shadow.adaptive.rules,
});

function make(track: 'age2' | 'age5') {
  const map = new Map<string, string>();
  const driver: StorageDriver = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  return new SkillSession({
    store: new AdaptiveStore(driver),
    profileId: 'a',
    track,
    world: shadow.world,
    gameId: shadow.id,
    meta,
    today: () => '2026-11-13',
    random: () => 0.3,
  });
}

const clean = (i: number) => ({ itemId: IDS[i % IDS.length], firstTryCorrect: true, hinted: false });
const miss = (i: number) => ({ itemId: IDS[i % IDS.length], firstTryCorrect: false, hinted: false });

describe('shadow-match: adaptive engine (AC-04, AC-07)', () => {
  it('[AC-07] new profiles start at the track start levels (age 2 L1, age 5 L5)', () => {
    expect(make('age2').level('en')).toBe(1);
    expect(make('age5').level('fr')).toBe(5);
  });

  it('[AC-04] age 2 rises after a clean round of 3 and never above L4', () => {
    const s = make('age2');
    for (let i = 0; i < 3; i++) s.record('en', clean(i));
    expect(s.level('en')).toBe(2);
    for (let i = 0; i < 30; i++) s.record('en', clean(i));
    expect(s.level('en')).toBe(4);
  });

  it('[AC-04] age 5 drops after 2 misses in 3 and never below L4', () => {
    const s = make('age5');
    s.record('en', miss(0));
    s.record('en', miss(1));
    expect(s.level('en')).toBe(4);
    for (let i = 0; i < 12; i++) s.record('en', miss(i));
    expect(s.level('en')).toBe(4);
  });

  it('[AC-04] age 5 rises after 3 clean answers in a row, up to L8', () => {
    const s = make('age5');
    for (let i = 0; i < 3; i++) s.record('fr', clean(i));
    expect(s.level('fr')).toBe(6);
    for (let i = 0; i < 30; i++) s.record('fr', clean(i));
    expect(s.level('fr')).toBe(8);
  });
});

describe('shadow-match: leisure (AC-08)', () => {
  const settings: LeisureSettings = {
    learnMinutes: 10,
    leisureMinutes: 5,
    dailyEarnCapMinutes: 30,
    idleSeconds: 20,
    languages: 'both',
    timeEarning: { enabled: true },
  };

  it('[AC-08] the game earns leisure and wrong taps (interactions) never reduce the balance', () => {
    expect(shadow.earnsLeisure).toBe(true);
    const state = defaultProfileState('2026-11-13');
    let now = 0;
    const session = new LearningSession(state, settings, () => now);
    session.start();
    let last = state.balanceSec;
    for (let i = 0; i < 20; i++) {
      now += 1000;
      session.reportInteraction(); // a wrong tap is reported the same way as a right one
      session.tick(1);
      expect(state.balanceSec).toBeGreaterThanOrEqual(last);
      last = state.balanceSec;
    }
    expect(state.balanceSec).toBeGreaterThan(0);
  });

  it('[AC-08] the Shadow Match screen is unsafe for a mid-game PWA update', () => {
    expect(isSafeToApplyUpdate('shadow')).toBe(false);
  });
});
