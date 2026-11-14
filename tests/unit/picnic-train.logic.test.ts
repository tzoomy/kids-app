// Picnic Train Pass 1, TDD step 1: pure game logic (ACs 02, 03, 04, 08, 09, 17, 18, 19, 20, 24, 26).
// Spec: docs/specs/picnic-train.md. Pure modules only: no Phaser, no DOM.
import { describe, expect, it } from 'vitest';
import { loadPicnicTrain } from '@/content/loadContent';
import { DEFAULT_RULES, SkillSession, buildMeta } from '@/core/adaptive';
import { LearningSession } from '@/core/leisure';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { defaultProfileState, type LeisureSettings } from '@/core/storage/schema';
import { Store, type StorageDriver } from '@/core/storage/store';
import {
  MAX_LOAD,
  PASSENGER_KINDS,
  PicnicTrialTracker,
  TrainRound,
  WRONG_TAP_LOCK_MS,
  askLine,
  buildTrain,
  isLocked,
  levelLevers,
  numberLine,
  parseTrainSize,
  trainSizeCandidates,
  type TrainPlan,
} from '@/games/picnic/picnicLogic';
import { PICNIC_LINE_TEXT, hebrewNumber } from '@/games/picnic/picnicVoice';

const content = loadPicnicTrain();
const TODAY = '2026-11-13';
const levers = (level: number) => levelLevers(content.adaptive.levels[level - 1]);

/** Deterministic random: cycles through a fixed sequence. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function plan(level: number, random: () => number = Math.random, size?: number): TrainPlan {
  const l = levers(level);
  return buildTrain({ levers: l, sizeId: `n${size ?? l.setSize}`, random });
}

function memoryDriver() {
  const map = new Map<string, string>();
  const driver: StorageDriver = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  return { driver, map };
}

function newSession(profileId: string, track: 'age2' | 'age5'): SkillSession {
  const { adaptive } = content;
  return new SkillSession({
    store: new AdaptiveStore(memoryDriver().driver),
    profileId,
    track,
    world: content.world,
    gameId: content.id,
    meta: buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
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
  timeEarning: { enabled: true },
};

describe('picnic-train: adaptive rules with one train per round (AC-04)', () => {
  it('[AC-04] DEFAULT_RULES apply except trialsPerRound, which is 1', () => {
    const { adaptive } = content;
    const meta = buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules });
    expect(meta.rules).toEqual({ ...DEFAULT_RULES, trialsPerRound: 1 });
    expect(meta.rules).toMatchObject({ upCleanStreak: 3, downMisses: 2, downWindow: 3 });
  });

  it('[AC-04] age 2: three clean trains in a row raise the level by 1, applied right after the third train', () => {
    const s = newSession('a', 'age2');
    expect(s.level('en')).toBe(2);
    s.record('en', { itemId: 'n3', firstTryCorrect: true, hinted: false });
    s.record('en', { itemId: 'n3', firstTryCorrect: true, hinted: false });
    expect(s.level('en')).toBe(2);
    s.record('en', { itemId: 'n3', firstTryCorrect: true, hinted: false });
    expect(s.level('en')).toBe(3);
  });

  it('[AC-04] an assisted train is not clean, so it does not count toward a rise', () => {
    const s = newSession('a', 'age2');
    s.record('en', { itemId: 'n3', firstTryCorrect: true, hinted: false });
    s.record('en', { itemId: 'n3', firstTryCorrect: true, hinted: false });
    s.record('en', { itemId: 'n3', firstTryCorrect: true, hinted: true });
    expect(s.level('en')).toBe(2);
  });

  it('[AC-04] age 2: two misses within three trains drop the level by 1, applied right after the second train', () => {
    const s = newSession('a', 'age2');
    s.record('en', { itemId: 'n3', firstTryCorrect: false, hinted: false });
    s.record('en', { itemId: 'n3', firstTryCorrect: false, hinted: false });
    expect(s.level('en')).toBe(1);
  });

  it('[AC-04] age 5: a rise and a drop are applied after the trial', () => {
    const up = newSession('b', 'age5');
    for (let i = 0; i < 3; i++) up.record('en', { itemId: 'n5', firstTryCorrect: true, hinted: false });
    expect(up.level('en')).toBe(6);
    const down = newSession('b', 'age5');
    down.record('en', { itemId: 'n5', firstTryCorrect: false, hinted: false });
    down.record('en', { itemId: 'n5', firstTryCorrect: false, hinted: false });
    expect(down.level('en')).toBe(4);
  });

  it('[AC-04] the engine chooses the train size among the candidate ids of the level', () => {
    const s = newSession('a', 'age2');
    const id = s.selectNextItem('en', trainSizeCandidates(levers(2).setSize));
    expect(['n2', 'n3']).toContain(id);
    expect(parseTrainSize(id, 3)).toBe(Number(id.slice(1)));
  });
});

describe('picnic-train: leisure (AC-08)', () => {
  it('[AC-08] leisure accrues while the child takes part, and every tap, right or wrong, counts as participation', () => {
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

  it('[AC-08] mistakes never reduce the balance or the stars, and a level change leaves the leisure state alone', () => {
    const NOW = new Date('2026-11-13T10:00:00');
    const { driver } = memoryDriver();
    const leisure = new Store(driver, NOW);
    const state = leisure.getProfileState('a', NOW);
    state.balanceSec = 120;
    state.stars = 3;
    state.earnedTodaySec = 40;
    const before = { ...state };
    const s = newSession('a', 'age2');
    s.record('en', { itemId: 'n3', firstTryCorrect: false, hinted: false });
    s.record('en', { itemId: 'n3', firstTryCorrect: false, hinted: false });
    expect({ ...state }).toEqual(before);
  });

  it('[AC-08] balances never mix across profiles', () => {
    const NOW = new Date('2026-11-13T10:00:00');
    const store = new Store(memoryDriver().driver, NOW);
    const a = store.getProfileState('a', NOW);
    const b = store.getProfileState('b', NOW);
    b.balanceSec = 77;
    let now = 0;
    const learning = new LearningSession(a, settings, () => now);
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

describe('picnic-train: voice lines and number words (AC-09)', () => {
  it('[AC-09] the instruction line depends on the task; load names the number', () => {
    expect(askLine(plan(2))).toEqual({ lineId: 'picnic.ask.one-each.he', lang: 'he' });
    expect(askLine(plan(5))).toEqual({ lineId: 'picnic.ask.load.5.he', lang: 'he' });
    expect(askLine(plan(7))).toEqual({ lineId: 'picnic.ask.missing.he', lang: 'he' });
  });

  it('[AC-09] counting tokens are requested in the round language with the spec line ids', () => {
    expect(numberLine(3, 'en')).toEqual({ lineId: 'picnic.number.3.en', lang: 'en' });
    expect(numberLine(10, 'fr')).toEqual({ lineId: 'picnic.number.10.fr', lang: 'fr' });
  });

  it('[AC-09] every line id has device-TTS text; English and French count 1..10; Hebrew load lines name 2..10', () => {
    const en = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const fr = ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
    for (let n = 1; n <= 10; n++) {
      expect(PICNIC_LINE_TEXT[`picnic.number.${n}.en`]).toBe(en[n - 1]);
      expect(PICNIC_LINE_TEXT[`picnic.number.${n}.fr`]).toBe(fr[n - 1]);
    }
    for (let n = 2; n <= 10; n++) {
      const text = PICNIC_LINE_TEXT[`picnic.ask.load.${n}.he`];
      expect(text).toContain(hebrewNumber(n));
      expect(text).toMatch(/[֐-׿]/);
    }
    for (const id of [
      'picnic.ask.one-each.he',
      'picnic.ask.missing.he',
      'picnic.missing.give.he',
      'picnic.wrong.given.he',
      'picnic.wrong.count.he',
      'picnic.ready.he',
      'picnic.help.he',
    ]) {
      expect(PICNIC_LINE_TEXT[id], id).toMatch(/[֐-׿]/);
    }
  });

  it('[AC-09] Hebrew number words are the masculine forms', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map(hebrewNumber)).toEqual([
      'שניים',
      'שלושה',
      'ארבעה',
      'חמישה',
      'שישה',
      'שבעה',
      'שמונה',
      'תשעה',
      'עשרה',
    ]);
  });
});

describe('picnic-train: round plan (AC-18)', () => {
  it('[AC-18] the candidate train sizes are setSize-1 and setSize, never below 2', () => {
    expect(trainSizeCandidates(2)).toEqual(['n2']);
    expect(trainSizeCandidates(3)).toEqual(['n2', 'n3']);
    expect(trainSizeCandidates(10)).toEqual(['n9', 'n10']);
    expect(parseTrainSize('n9', 10)).toBe(9);
    expect(parseTrainSize('garbage', 6)).toBe(6);
    expect(parseTrainSize('n99', 6)).toBe(6);
  });

  it('[AC-18] passengers are distinct animals from the approved kinds, numbered left to right', () => {
    for (let level = 1; level <= 8; level++) {
      const p = plan(level, Math.random);
      expect(p.passengers).toHaveLength(p.size);
      expect(new Set(p.passengers.map((x) => x.kind)).size).toBe(p.size);
      p.passengers.forEach((x, i) => {
        expect(PASSENGER_KINDS).toContain(x.kind);
        expect(x.id).toBe(`p-${i}`);
      });
      const seats = p.passengers.map((x) => x.seat);
      expect([...seats].sort((a, b) => a - b)).toEqual(seats);
      expect(new Set(seats).size).toBe(p.size);
    }
    expect(PASSENGER_KINDS.length).toBeGreaterThanOrEqual(10);
  });

  it('[AC-18] rows has exactly size seats; scattered has min(10, size + 2) seats with the passengers on a subset', () => {
    const rows = plan(3);
    expect(rows.seatCount).toBe(rows.size);
    expect(rows.passengers.map((p) => p.seat)).toEqual(rows.passengers.map((_, i) => i));
    const scattered = plan(5, seq(0.1, 0.9, 0.4, 0.7, 0.2, 0.6, 0.3, 0.8));
    expect(scattered.seatCount).toBe(Math.min(10, scattered.size + 2));
    expect(scattered.seatCount).toBeGreaterThan(scattered.size);
    const ten = plan(8, Math.random);
    expect(ten.size).toBe(10);
    expect(ten.seatCount).toBe(10);
  });

  it('[AC-18] scattered trains differ from run to run (random seat choice)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(plan(5).passengers.map((p) => p.seat).join(','));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('[AC-18] one-each and load serve nobody in advance; target is the train size', () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const p = plan(level);
      expect(p.served).toEqual([]);
      expect(p.target).toBe(p.size);
    }
  });

  it('[AC-18] missing serves k passengers (1 <= k < n) and the target is m = n - k', () => {
    for (let i = 0; i < 60; i++) {
      const p = plan(i % 2 === 0 ? 7 : 8);
      expect(p.task).toBe('missing');
      expect(p.served.length).toBeGreaterThanOrEqual(1);
      expect(p.served.length).toBeLessThan(p.size);
      expect(p.target).toBe(p.size - p.served.length);
      for (const id of p.served) expect(p.passengers.map((x) => x.id)).toContain(id);
    }
  });

  it('[AC-18] scaffold flags: outline shows ghost items, symbol shows a tally of the train size, none shows neither', () => {
    const outline = plan(2);
    expect(outline.scaffold).toEqual({ ghostItems: true, tally: null });
    const symbol = plan(4);
    expect(symbol.scaffold).toEqual({ ghostItems: false, tally: symbol.size });
    expect(plan(5).scaffold).toEqual({ ghostItems: false, tally: null });
    expect(plan(8).scaffold).toEqual({ ghostItems: false, tally: null });
  });
});

describe('picnic-train: one-each round (AC-02, AC-03, AC-17)', () => {
  it('[AC-02] a tap on a free passenger gives the item, counts aloud 1, 2, 3, and the last give finishes the train', () => {
    const round = new TrainRound(plan(2, Math.random, 3));
    expect(round.phase).toBe('give');
    expect(round.nextFreeId).toBe('p-0');
    expect(round.tapPassenger('p-0')).toEqual({ kind: 'given', count: 1, done: false });
    expect(round.nextFreeId).toBe('p-1');
    expect(round.tapPassenger('p-2')).toEqual({ kind: 'given', count: 2, done: false });
    expect(round.hasItem('p-2')).toBe(true);
    expect(round.nextFreeId).toBe('p-1');
    expect(round.tapPassenger('p-1')).toEqual({ kind: 'given', count: 3, done: true });
    expect(round.phase).toBe('depart');
    expect(round.nextFreeId).toBeNull();
  });

  it('[AC-03] a tap on a passenger who already has an item changes nothing and never ends the train', () => {
    const round = new TrainRound(plan(2, Math.random, 3));
    round.tapPassenger('p-0');
    expect(round.tapPassenger('p-0')).toEqual({ kind: 'already' });
    expect(round.hasItem('p-0')).toBe(true);
    expect(round.servedCount).toBe(1);
    expect(round.phase).toBe('give');
    expect(round.tapPassenger('unknown')).toEqual({ kind: 'ignored' });
  });

  it('[AC-17] once the train is ready, further taps are ignored', () => {
    const round = new TrainRound(plan(1, Math.random, 2));
    round.tapPassenger('p-0');
    round.tapPassenger('p-1');
    expect(round.phase).toBe('depart');
    expect(round.tapPassenger('p-0')).toEqual({ kind: 'ignored' });
    expect(round.load()).toEqual({ kind: 'ignored' });
    expect(round.go()).toEqual({ kind: 'ignored' });
  });
});

describe('picnic-train: load round (AC-19)', () => {
  it('[AC-19] loading counts up, unloading counts down, and the shelf holds at most 10', () => {
    const round = new TrainRound(plan(5, Math.random, 5));
    expect(round.phase).toBe('load');
    expect(round.load()).toEqual({ kind: 'loaded', count: 1 });
    expect(round.load()).toEqual({ kind: 'loaded', count: 2 });
    expect(round.unload()).toBe(1);
    expect(round.loaded).toBe(1);
    for (let i = 1; i < MAX_LOAD; i++) round.load();
    expect(round.loaded).toBe(MAX_LOAD);
    expect(round.load()).toEqual({ kind: 'full' });
    expect(round.loaded).toBe(MAX_LOAD);
  });

  it('[AC-19] unloading an empty shelf does nothing', () => {
    const round = new TrainRound(plan(5, Math.random, 5));
    expect(round.unload()).toBeNull();
  });

  it('[AC-19] go with exactly N loaded makes the train ready', () => {
    const round = new TrainRound(plan(5, Math.random, 5));
    for (let i = 0; i < 5; i++) round.load();
    expect(round.go()).toEqual({ kind: 'ready' });
    expect(round.phase).toBe('depart');
  });

  it('[AC-19] go with another count is wrong: it reports the count, empties the shelf and keeps the load phase', () => {
    const round = new TrainRound(plan(5, Math.random, 5));
    for (let i = 0; i < 4; i++) round.load();
    expect(round.go()).toEqual({ kind: 'wrong', count: 4 });
    expect(round.loaded).toBe(0);
    expect(round.phase).toBe('load');
    for (let i = 0; i < 7; i++) round.load();
    expect(round.go()).toEqual({ kind: 'wrong', count: 7 });
    for (let i = 0; i < 5; i++) round.load();
    expect(round.go()).toEqual({ kind: 'ready' });
  });

  it('[AC-19] go with an empty shelf is wrong too', () => {
    const round = new TrainRound(plan(5, Math.random, 5));
    expect(round.go()).toEqual({ kind: 'wrong', count: 0 });
  });
});

describe('picnic-train: missing round (AC-20)', () => {
  it('[AC-20] the round starts with the number question; the right card opens the give phase for the free passengers only', () => {
    const p = plan(7, Math.random, 8);
    const round = new TrainRound(p);
    expect(round.phase).toBe('answer');
    const m = p.target;
    expect(round.tapPassenger(round.nextFreeId ?? 'p-0')).toEqual({ kind: 'ignored' });
    expect(round.answer(m + 1)).toEqual({ kind: 'wrong' });
    expect(round.phase).toBe('answer');
    expect(round.answer(m)).toEqual({ kind: 'right', missing: m });
    expect(round.phase).toBe('give');
    expect(round.servedCount).toBe(p.size - m);
  });

  it('[AC-20] serving the free passengers finishes the train, counting on from the already served', () => {
    const p = plan(7, Math.random, 8);
    const round = new TrainRound(p);
    round.answer(p.target);
    let last: ReturnType<TrainRound['tapPassenger']> | null = null;
    let expectedCount = p.served.length;
    while (round.nextFreeId) {
      last = round.tapPassenger(round.nextFreeId);
      expectedCount++;
      expect(last).toMatchObject({ kind: 'given', count: expectedCount });
    }
    expect(last).toMatchObject({ done: true, count: p.size });
    expect(round.phase).toBe('depart');
  });

  it('[AC-20] the answer cards are 1 .. n-1 and a wrong card keeps the round in the answer phase', () => {
    const p = plan(8, Math.random, 10);
    const round = new TrainRound(p);
    expect(round.cardValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const wrong = p.target === 1 ? 2 : 1;
    expect(round.answer(wrong)).toEqual({ kind: 'wrong' });
    expect(round.phase).toBe('answer');
  });
});

describe('picnic-train: one miss per train (AC-24, AC-26)', () => {
  it('[AC-24] the first wrong tap records the miss at once; later wrong taps and the finish record nothing', () => {
    const t = new PicnicTrialTracker('n3', 'en');
    expect(t.onMistake()).toEqual({ itemId: 'n3', firstTryCorrect: false, hinted: false });
    expect(t.onMistake()).toBeNull();
    expect(t.onComplete()).toBeNull();
    expect(t.isRecorded).toBe(true);
  });

  it('[AC-24] a clean finish records one clean trial', () => {
    const t = new PicnicTrialTracker('n3', 'fr');
    expect(t.onComplete()).toEqual({ itemId: 'n3', firstTryCorrect: true, hinted: false });
    expect(t.onComplete()).toBeNull();
    expect(t.onMistake()).toBeNull();
  });

  it('[AC-24] an idle hint before the result makes a clean finish assisted; a hint after a miss changes nothing', () => {
    const hinted = new PicnicTrialTracker('n3', 'en');
    hinted.onHint();
    expect(hinted.isHinted).toBe(true);
    expect(hinted.onComplete()).toEqual({ itemId: 'n3', firstTryCorrect: true, hinted: true });

    const missed = new PicnicTrialTracker('n3', 'en');
    expect(missed.onMistake()).toEqual({ itemId: 'n3', firstTryCorrect: false, hinted: false });
    missed.onHint();
    expect(missed.isHinted).toBe(false);
  });

  it('[AC-24] a voluntary replay is never a hint', () => {
    const t = new PicnicTrialTracker('n3', 'en');
    t.onReplay();
    expect(t.isHinted).toBe(false);
    expect(t.onComplete()).toEqual({ itemId: 'n3', firstTryCorrect: true, hinted: false });
  });

  it('[AC-26] taps are ignored for 400 ms after a wrong tap', () => {
    expect(WRONG_TAP_LOCK_MS).toBe(400);
    const lockedUntil = 1000 + WRONG_TAP_LOCK_MS;
    expect(isLocked(1000, lockedUntil)).toBe(true);
    expect(isLocked(1399, lockedUntil)).toBe(true);
    expect(isLocked(1400, lockedUntil)).toBe(false);
    expect(isLocked(5, 0)).toBe(false);
  });
});
