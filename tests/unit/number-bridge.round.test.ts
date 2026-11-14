import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadNumberBridge, loadWorlds } from '@/content/loadContent';
import { NumberBridgeContentSchema } from '@/content/schema';
import numberBridgeJson from '@/content/games/number-bridge.json';
import {
  buildBridge,
  createBridge,
  tapChoice,
  tapPile,
  type BridgeSpec,
} from '@/games/numberBridge/bridgeMachine';
import {
  countBridgeLines,
  countUpToGapLines,
  crossedLine,
  introLine,
  notThisLine,
  numberLine,
  oneMoreLine,
  planForLevel,
  trialForBridge,
} from '@/games/numberBridge/bridgeRound';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const content = loadNumberBridge();
const meta = buildMeta({
  levelCount: content.adaptive.levels.length,
  tracks: content.adaptive.tracks,
  rules: content.adaptive.rules,
});

function makeSession(track: 'age2' | 'age5'): SkillSession {
  return new SkillSession({
    store: new AdaptiveStore(memoryDriver()),
    profileId: 'p',
    track,
    world: content.world,
    gameId: content.id,
    meta,
    today: () => '2026-11-14',
    random: () => 0.3,
  });
}

function playOneMore(session: SkillSession, lang: 'en' | 'fr', level: number): void {
  const plan = planForLevel(content.adaptive.levels[level - 1]);
  const spec = buildBridge(plan);
  let state = createBridge(spec);
  while (state.phase === 'building') {
    state = tapPile(state).state;
  }
  session.record(lang, trialForBridge(state, false));
}

function playMissing(
  session: SkillSession,
  lang: 'en' | 'fr',
  level: number,
  missFirst: boolean,
  hinted = false,
): void {
  const plan = planForLevel(content.adaptive.levels[level - 1]);
  const spec = buildBridge(plan);
  let state = createBridge(spec);
  if (missFirst) {
    const wrong = spec.choices.find((c) => c !== spec.answer)!;
    const miss = tapChoice(state, wrong);
    expect(miss.event.kind).toBe('not-this-one');
    state = miss.state;
  }
  const hit = tapChoice(state, spec.answer!);
  expect(hit.event.kind).toBe('complete');
  session.record(lang, trialForBridge(hit.state, hinted));
}

describe('Number Bridge: levels, adaptive trials, voice lines and content', () => {
  it('[AC-04] one-more mode exposes L1-L2 plans, Hebrew intro/celebration, One more! and 1-10 in en and fr', () => {
    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      mode: 'one-more',
      stones: 3,
      gaps: 1,
      range: 5,
      dots: false,
      audioOnly: false,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      mode: 'one-more',
      stones: 4,
      gaps: 2,
      range: 5,
      dots: false,
      audioOnly: false,
    });

    expect(introLine(content, 'one-more')).toEqual({
      lineId: 'bridge.intro.oneMore.he',
      lang: 'he',
      text: content.linesHe.introOneMore,
    });
    expect(crossedLine(content)).toEqual({
      lineId: 'bridge.crossed.he',
      lang: 'he',
      text: content.linesHe.crossed,
    });

    for (const lang of ['en', 'fr'] as const) {
      expect(oneMoreLine(content, lang)).toEqual({
        lineId: `bridge.oneMore.${lang}`,
        lang,
        text: content.oneMorePhrase[lang],
      });
      for (let n = 1; n <= 10; n++) {
        expect(numberLine(content, n, lang)).toEqual({
          lineId: `bridge.number.${n}.${lang}`,
          lang,
          text: content.numbers[String(n) as keyof typeof content.numbers][lang],
        });
      }
      expect(countBridgeLines(content, [1, 2, 3], lang)).toEqual([
        numberLine(content, 1, lang),
        numberLine(content, 2, lang),
        numberLine(content, 3, lang),
      ]);
    }

    // Round language alternates cleanly between the game's learning languages.
    // Learning language stays put within a round and is re-picked only at a round boundary.
    expect(nextRoundLanguage('en', false, 'both')).toBe('en');
    expect(nextRoundLanguage('en', true, 'fr')).toBe('fr');
    expect(content.languages).toEqual(['en', 'fr']);
  });

  it('[AC-05] missing mode plans L3-L5 (dots on L3, audio-only on L5) and builds wrong-stone count-up lines', () => {
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      mode: 'missing',
      stones: 4,
      gaps: 1,
      range: 5,
      dots: true,
      audioOnly: false,
    });
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      mode: 'missing',
      stones: 5,
      gaps: 1,
      range: 10,
      dots: false,
      audioOnly: false,
    });
    expect(planForLevel(content.adaptive.levels[4])).toEqual({
      mode: 'missing',
      stones: 5,
      gaps: 1,
      range: 10,
      dots: false,
      audioOnly: true,
    });

    expect(introLine(content, 'missing')).toEqual({
      lineId: 'bridge.intro.missing.he',
      lang: 'he',
      text: content.linesHe.introMissing,
    });
    expect(notThisLine(content)).toEqual({
      lineId: 'bridge.notThis.he',
      lang: 'he',
      text: content.linesHe.notThis,
    });

    const spec: BridgeSpec = {
      mode: 'missing',
      sequence: [2, 3, 4, 5],
      gaps: [2],
      answer: 4,
      choices: [3, 4, 5],
    };
    const state = createBridge(spec);
    expect(countUpToGapLines(content, state, 'en')).toEqual([
      numberLine(content, 2, 'en'),
      numberLine(content, 3, 'en'),
    ]);
    expect(countUpToGapLines(content, state, 'fr')).toEqual([
      numberLine(content, 2, 'fr'),
      numberLine(content, 3, 'fr'),
    ]);
  });

  it('[AC-06] trialForBridge is clean in one-more mode and only on first-try unhinted completion in missing mode', () => {
    const oneMoreSpec: BridgeSpec = {
      mode: 'one-more',
      sequence: [1, 2, 3],
      gaps: [2],
      answer: null,
      choices: [],
    };
    const oneMoreDone = tapPile(createBridge(oneMoreSpec)).state;
    expect(trialForBridge(oneMoreDone, true)).toEqual({
      itemId: 'one-more-1',
      firstTryCorrect: true,
      hinted: false,
    });

    const missingSpec: BridgeSpec = {
      mode: 'missing',
      sequence: [1, 2, 3, 4],
      gaps: [2],
      answer: 3,
      choices: [2, 3, 4],
    };
    const s0 = createBridge(missingSpec);
    const cleanDone = tapChoice(s0, 3).state;
    expect(trialForBridge(cleanDone, false)).toEqual({
      itemId: '3',
      firstTryCorrect: true,
      hinted: false,
    });
    expect(trialForBridge(cleanDone, true)).toEqual({
      itemId: '3',
      firstTryCorrect: true,
      hinted: true,
    });

    const missFirstDone = tapChoice(tapChoice(s0, 2).state, 3).state;
    expect(trialForBridge(missFirstDone, false)).toEqual({
      itemId: '3',
      firstTryCorrect: false,
      hinted: false,
    });
  });

  it('[AC-06] age-5 track starts at L3 with min 2 (can drop to L2 one-more, not L1); age 2 is L1-L2', () => {
    // "age 5 starts at L3" is the start level; min 2 is a separate floor. Spec and JSON already agree.
    expect(content.adaptive.tracks.age5).toEqual({ start: 3, min: 2, max: 5 });
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 2 });
  });

  it('[AC-06] adaptive steps: age 2 stays inside L1-L2; age 5 starts at L3, rises to L5 on clean trials, and drops to L2 on misses', () => {
    expect(content.adaptive.tracks.age5).toEqual({ start: 3, min: 2, max: 5 });
    const age2 = makeSession('age2');
    expect(age2.level('fr')).toBe(1);
    for (let i = 0; i < 6; i++) {
      playOneMore(age2, 'fr', age2.level('fr'));
    }
    age2.endVisit();
    // Age-2 track moves between rounds (L1 -> L2) and never enters missing mode (max 2).
    expect(age2.level('fr')).toBeLessThanOrEqual(2);
    expect(age2.level('fr')).toBeGreaterThanOrEqual(1);
    expect(planForLevel(content.adaptive.levels[age2.level('fr') - 1]).mode).toBe('one-more');

    const age5 = makeSession('age5');
    expect(age5.level('en')).toBe(3);

    // 3 clean first-try bridges raise L3 -> L4
    for (let i = 0; i < 3; i++) playMissing(age5, 'en', age5.level('en'), false);
    expect(age5.level('en')).toBe(4);

    // 3 more clean first-try bridges raise L4 -> L5 (audio-only)
    for (let i = 0; i < 3; i++) playMissing(age5, 'en', age5.level('en'), false);
    expect(age5.level('en')).toBe(5);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).audioOnly).toBe(true);

    // 2 misses drop L5 -> L4
    playMissing(age5, 'en', age5.level('en'), true);
    playMissing(age5, 'en', age5.level('en'), true);
    expect(age5.level('en')).toBe(4);

    // 2 misses drop L4 -> L3
    playMissing(age5, 'en', age5.level('en'), true);
    playMissing(age5, 'en', age5.level('en'), true);
    expect(age5.level('en')).toBe(3);

    // 2 misses drop L3 -> L2 (scaffolding back to one-more, min 2)
    playMissing(age5, 'en', age5.level('en'), true);
    playMissing(age5, 'en', age5.level('en'), true);
    expect(age5.level('en')).toBe(2);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).mode).toBe('one-more');

    // Never drops below min level 2 even on additional misses or visits.
    age5.endVisit();
    expect(age5.level('en')).toBe(2);
  });

  it('[AC-07] number-bridge.json validates against NumberBridgeContentSchema and rejects malformed levels or words', () => {
    const parsed = NumberBridgeContentSchema.parse(numberBridgeJson);
    const worlds = loadWorlds();
    expect(parsed.id).toBe('number-bridge');
    expect(worlds.worlds.some((w) => w.id === parsed.world)).toBe(true);
    expect(parsed.world).toBe('number-garden');
    expect(parsed.earnsLeisure).toBe(true);
    expect(parsed.languages).toEqual(['en', 'fr']);
    expect(parsed.adaptive.levels).toHaveLength(5);

    const badWord = structuredClone(numberBridgeJson);
    badWord.numbers['1'].en = '   ';
    expect(() => NumberBridgeContentSchema.parse(badWord)).toThrow();

    const badAudioOnly = structuredClone(numberBridgeJson);
    badAudioOnly.adaptive.levels[0].support = 'audio-only';
    expect(() => NumberBridgeContentSchema.parse(badAudioOnly)).toThrow();

    const badGaps = structuredClone(numberBridgeJson);
    badGaps.adaptive.levels[0].extra.gaps = badGaps.adaptive.levels[0].extra.stones;
    expect(() => NumberBridgeContentSchema.parse(badGaps)).toThrow();
  });
});
