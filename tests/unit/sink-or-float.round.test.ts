import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadSinkOrFloat, loadWorlds } from '@/content/loadContent';
import { SinkOrFloatContentSchema } from '@/content/schema';
import sinkFloatJson from '@/content/games/sink-or-float.json';
import {
  FLOAT_OBJECT_IDS,
  OBJECT_FLOATS,
  createSinkFloat,
  tapObject,
  tapPrediction,
  type FloatObjectId,
} from '@/games/sinkFloat/sinkFloatMachine';
import {
  askLine,
  introLine,
  letsSeeLine,
  namingLines,
  planForLevel,
  resultHeLine,
  resultLearningLine,
  trialForDrop,
  trialForPrediction,
  visitStartLines,
} from '@/games/sinkFloat/sinkFloatRound';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const content = loadSinkOrFloat();
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

function playFreeDrop(session: SkillSession, lang: 'en' | 'fr', objectId: FloatObjectId = 'ball'): void {
  const state = createSinkFloat({ mode: 'free', offered: ['ball', 'stone', 'leaf'] });
  const { event } = tapObject(state, objectId);
  if (event.kind !== 'dropped') throw new Error('Expected dropped event');
  session.record(lang, trialForDrop(event));
}

function playPrediction(
  session: SkillSession,
  lang: 'en' | 'fr',
  objectId: FloatObjectId,
  correct: boolean,
  hinted = false,
): void {
  const state = createSinkFloat({ mode: 'predict', offered: [objectId, objectId === 'stone' ? 'ball' : 'stone', 'key'] as [FloatObjectId, FloatObjectId, FloatObjectId] });
  const asked = tapObject(state, objectId).state;
  const realOutcome = OBJECT_FLOATS[objectId] ? 'floats' : 'sinks';
  const guess = correct ? realOutcome : realOutcome === 'floats' ? 'sinks' : 'floats';
  const { event } = tapPrediction(asked, guess);
  if (event.kind !== 'revealed') throw new Error('Expected revealed event');
  session.record(lang, trialForPrediction(event, hinted));
}

describe('Sink or Float: levels, adaptive trials, voice lines and content', () => {
  it('[AC-04] free mode naming produces Hebrew then the active learning language (en or fr) for every object', () => {
    expect(introLine(content, 'free')).toEqual({
      lineId: 'sinkFloat.intro.free.he',
      lang: 'he',
      text: content.linesHe.introFree,
    });
    expect(visitStartLines(content, { includeIntro: true, mode: 'free' })).toEqual([introLine(content, 'free')]);
    expect(visitStartLines(content, { includeIntro: false, mode: 'free' })).toEqual([]);

    for (const id of FLOAT_OBJECT_IDS) {
      const outcome = OBJECT_FLOATS[id] ? 'floats' : 'sinks';
      const heReq = resultHeLine(content, id);
      expect(heReq.lineId).toBe(`sinkFloat.result.${id}.he`);
      expect(heReq.lang).toBe('he');
      expect(heReq.text.trim().length).toBeGreaterThan(0);

      for (const lang of ['en', 'fr'] as const) {
        const learnReq = resultLearningLine(content, outcome, lang);
        expect(learnReq).toEqual({
          lineId: `sinkFloat.result.${outcome}.${lang}`,
          lang,
          text: content.outcomes[outcome][lang],
        });
        expect(namingLines(content, id, lang)).toEqual([heReq, learnReq]);
      }
    }

    expect(nextRoundLanguage(null, true, 'fr')).toBe('fr');
    expect(nextRoundLanguage(null, true, 'en')).toBe('en');
    expect(['en', 'fr']).toContain(nextRoundLanguage(null, true, 'both', () => 0.8));
  });

  it('[AC-05] predict mode helpers: intro, ask, letsSee lines and L1..L3 level plans match the spec', () => {
    expect(introLine(content, 'predict')).toEqual({
      lineId: 'sinkFloat.intro.predict.he',
      lang: 'he',
      text: content.linesHe.introPredict,
    });
    expect(visitStartLines(content, { includeIntro: true, mode: 'predict' })).toEqual([introLine(content, 'predict')]);
    expect(visitStartLines(content, { includeIntro: false, mode: 'predict' })).toEqual([]);
    expect(askLine(content)).toEqual({
      lineId: 'sinkFloat.ask.he',
      lang: 'he',
      text: content.linesHe.ask,
    });
    expect(letsSeeLine(content)).toEqual({
      lineId: 'sinkFloat.letsSee.he',
      lang: 'he',
      text: content.linesHe.letsSee,
    });

    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      mode: 'free',
      dropsPerStar: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      mode: 'predict',
      dropsPerStar: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      mode: 'predict',
      dropsPerStar: 3,
      audioOnly: true,
      hintPulse: false,
    });
  });

  it('[AC-06] trialForDrop is always clean; trialForPrediction is clean only on a right unhinted prediction', () => {
    expect(trialForDrop({ kind: 'dropped', objectId: 'apple', outcome: 'floats' })).toEqual({
      itemId: 'apple',
      firstTryCorrect: true,
      hinted: false,
    });

    expect(
      trialForPrediction(
        { kind: 'revealed', objectId: 'stone', guess: 'sinks', outcome: 'sinks', correct: true },
        false,
      ),
    ).toEqual({
      itemId: 'stone',
      firstTryCorrect: true,
      hinted: false,
    });

    expect(
      trialForPrediction(
        { kind: 'revealed', objectId: 'stone', guess: 'sinks', outcome: 'sinks', correct: true },
        true,
      ),
    ).toEqual({
      itemId: 'stone',
      firstTryCorrect: true,
      hinted: true,
    });

    expect(
      trialForPrediction(
        { kind: 'revealed', objectId: 'apple', guess: 'sinks', outcome: 'floats', correct: false },
        false,
      ),
    ).toEqual({
      itemId: 'apple',
      firstTryCorrect: false,
      hinted: false,
    });
  });

  it('[AC-06] adaptive steps: age 2 stays at L1; age 5 starts at L2, rises after clean predictions, and drops after wrong ones', () => {
    const age2 = makeSession('age2');
    expect(age2.level('fr')).toBe(1);
    for (let i = 0; i < 6; i++) playFreeDrop(age2, 'fr');
    expect(age2.level('fr')).toBe(1);
    expect(planForLevel(content.adaptive.levels[age2.level('fr') - 1]).mode).toBe('free');

    const age5 = makeSession('age5');
    expect(age5.level('en')).toBe(2);

    // 3 clean right predictions raise L2 -> L3 (audio-only)
    playPrediction(age5, 'en', 'ball', true);
    playPrediction(age5, 'en', 'leaf', true);
    playPrediction(age5, 'en', 'apple', true);
    expect(age5.level('en')).toBe(3);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).audioOnly).toBe(true);

    // 2 wrong predictions drop L3 -> L2
    playPrediction(age5, 'en', 'ball', false);
    playPrediction(age5, 'en', 'leaf', false);
    expect(age5.level('en')).toBe(2);

    // 2 more wrong predictions drop L2 -> L1 (free)
    playPrediction(age5, 'en', 'apple', false);
    playPrediction(age5, 'en', 'stone', false);
    expect(age5.level('en')).toBe(1);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).mode).toBe('free');
  });

  it('[AC-07] content validates; every object has non-empty he, en, fr names and expected floats flag; rejects invalid content', () => {
    expect(() => SinkOrFloatContentSchema.parse(sinkFloatJson)).not.toThrow();
    expect(content.id).toBe('sink-or-float');
    expect(content.world).toBe('science-world');
    expect(content.earnsLeisure).toBe(true);
    expect(content.languages).toEqual(['en', 'fr']);
    expect(loadWorlds().worlds.find((w) => w.id === 'science-world')?.status).toBe('open');

    for (const id of FLOAT_OBJECT_IDS) {
      const obj = content.objects.find((o) => o.id === id);
      expect(obj).toBeDefined();
      expect(obj!.floats).toBe(OBJECT_FLOATS[id]);
      expect(obj!.he.trim().length).toBeGreaterThan(0);
      expect(obj!.en.trim().length).toBeGreaterThan(0);
      expect(obj!.fr.trim().length).toBeGreaterThan(0);
      expect(obj!.resultHe.trim().length).toBeGreaterThan(0);
    }

    const withEmptyFr = structuredClone(sinkFloatJson);
    withEmptyFr.objects[0].fr = '';
    expect(() => SinkOrFloatContentSchema.parse(withEmptyFr)).toThrow();

    const withBlankHe = structuredClone(sinkFloatJson);
    withBlankHe.objects[1].he = '   ';
    expect(() => SinkOrFloatContentSchema.parse(withBlankHe)).toThrow();

    const withEmptyEn = structuredClone(sinkFloatJson);
    withEmptyEn.objects[2].en = '';
    expect(() => SinkOrFloatContentSchema.parse(withEmptyEn)).toThrow();

    const withBadAudioOnly = {
      ...sinkFloatJson,
      adaptive: {
        tracks: { age2: { start: 1, min: 1, max: 1 }, age5: { start: 1, min: 1, max: 1 } },
        levels: [{ support: 'audio-only', extra: { mode: 'free', dropsPerStar: 3 } }],
      },
    };
    expect(() => SinkOrFloatContentSchema.parse(withBadAudioOnly)).toThrow();
  });
});
