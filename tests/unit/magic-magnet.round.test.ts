import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadMagicMagnet, loadWorlds } from '@/content/loadContent';
import { MagicMagnetContentSchema } from '@/content/schema';
import magnetJson from '@/content/games/magic-magnet.json';
import { ART_MANIFEST } from '@/assets/art/manifest';
import {
  createMagnetRound,
  predict,
  touch,
} from '@/games/magicMagnet/magnetMachine';
import {
  askLines,
  introLine,
  pickRoundObjects,
  planForLevel,
  reactionLines,
  rightLine,
  surpriseLine,
  testLine,
  trialForReveal,
  trialForTouch,
  wordLine,
} from '@/games/magicMagnet/magnetRound';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const content = loadMagicMagnet();
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

function playFreeTouch(session: SkillSession, lang: 'en' | 'fr', id: string): void {
  session.record(lang, trialForTouch(id));
}

function playPredictTrial(
  session: SkillSession,
  lang: 'en' | 'fr',
  obj: { id: string; metal: boolean },
  correct: boolean,
  hinted = false,
): void {
  const other = content.objects.find((o) => o.id !== obj.id && o.metal !== obj.metal)!;
  let state = createMagnetRound({ mode: 'predict', objects: [obj, other] });
  state = predict(state, correct ? obj.metal : !obj.metal).state;
  const { event } = touch(state, obj.id);
  if (event.kind !== 'revealed') throw new Error('Expected revealed event');
  session.record(lang, trialForReveal(event, hinted));
}

describe('Magic Magnet: levels, adaptive trials, voice lines and content', () => {
  it('[AC-04] every object produces Hebrew reaction, learning-language word and sticks/notSticks lines', () => {
    expect(introLine(content, 'free')).toEqual({
      lineId: 'magnet.intro.free.he',
      lang: 'he',
      text: content.linesHe.introFree,
    });
    expect(introLine(content, 'predict')).toEqual({
      lineId: 'magnet.intro.predict.he',
      lang: 'he',
      text: content.linesHe.introPredict,
    });
    expect(testLine(content)).toEqual({
      lineId: 'magnet.test.he',
      lang: 'he',
      text: content.linesHe.test,
    });
    expect(rightLine(content)).toEqual({
      lineId: 'magnet.right.he',
      lang: 'he',
      text: content.linesHe.right,
    });
    expect(surpriseLine(content)).toEqual({
      lineId: 'magnet.surprise.he',
      lang: 'he',
      text: content.linesHe.surprise,
    });

    for (const obj of content.objects) {
      for (const lang of ['en', 'fr'] as const) {
        const expectedResult = obj.metal
          ? { lineId: `magnet.sticks.${lang}`, lang, text: content.resultWords.sticks[lang] }
          : { lineId: `magnet.notSticks.${lang}`, lang, text: content.resultWords.notSticks[lang] };

        expect(reactionLines(content, obj.id, lang)).toEqual([
          { lineId: `magnet.react.${obj.id}.he`, lang: 'he', text: obj.reactHe },
          { lineId: `magnet.word.${obj.id}.${lang}`, lang, text: obj[lang] },
          expectedResult,
        ]);
        expect(askLines(content, obj.id, lang)).toEqual([
          { lineId: `magnet.ask.${obj.id}.he`, lang: 'he', text: obj.askHe },
          { lineId: `magnet.word.${obj.id}.${lang}`, lang, text: obj[lang] },
        ]);
        expect(wordLine(content, obj.id, lang)).toEqual({
          lineId: `magnet.word.${obj.id}.${lang}`,
          lang,
          text: obj[lang],
        });
      }
    }

    expect(() => reactionLines(content, 'unknown', 'en')).toThrow();
    expect(() => askLines(content, 'unknown', 'fr')).toThrow();
    expect(nextRoundLanguage(null, true, 'fr')).toBe('fr');
    expect(nextRoundLanguage(null, true, 'en')).toBe('en');
  });

  it('[AC-05] planForLevel matches L1..L4 difficulty curve', () => {
    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      mode: 'free',
      objectCount: 4,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      mode: 'predict',
      objectCount: 4,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      mode: 'predict',
      objectCount: 5,
      audioOnly: false,
      hintPulse: false,
    });
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      mode: 'predict',
      objectCount: 5,
      audioOnly: true,
      hintPulse: false,
    });
  });

  it('[AC-06] trialForTouch is always clean; trialForReveal is clean only when correct and unhinted', () => {
    expect(trialForTouch('nail')).toEqual({
      itemId: 'nail',
      firstTryCorrect: true,
      hinted: false,
    });

    expect(
      trialForReveal({ kind: 'revealed', id: 'nail', sticks: true, correct: true, roundComplete: false }, false),
    ).toEqual({
      itemId: 'nail',
      firstTryCorrect: true,
      hinted: false,
    });

    expect(
      trialForReveal({ kind: 'revealed', id: 'nail', sticks: true, correct: true, roundComplete: false }, true),
    ).toEqual({
      itemId: 'nail',
      firstTryCorrect: true,
      hinted: true,
    });

    expect(
      trialForReveal({ kind: 'revealed', id: 'ball', sticks: false, correct: false, roundComplete: false }, false),
    ).toEqual({
      itemId: 'ball',
      firstTryCorrect: false,
      hinted: false,
    });
  });

  it('[AC-06] adaptive steps: age 2 stays at L1; age 5 starts at L2, rises after clean trials, and drops after misses', () => {
    const age2 = makeSession('age2');
    expect(age2.level('fr')).toBe(1);
    for (const obj of content.objects.slice(0, 6)) {
      playFreeTouch(age2, 'fr', obj.id);
    }
    expect(age2.level('fr')).toBe(1);
    expect(planForLevel(content.adaptive.levels[age2.level('fr') - 1]).mode).toBe('free');

    const age5 = makeSession('age5');
    expect(age5.level('en')).toBe(2);

    // 3 clean unhinted predictions raise L2 -> L3
    playPredictTrial(age5, 'en', content.objects[0], true, false);
    playPredictTrial(age5, 'en', content.objects[1], true, false);
    playPredictTrial(age5, 'en', content.objects[4], true, false);
    expect(age5.level('en')).toBe(3);

    // Hinted correct prediction does not advance L3 -> L4 on its own; 3 unhinted clean trials do.
    playPredictTrial(age5, 'en', content.objects[2], true, true);
    expect(age5.level('en')).toBe(3);
    playPredictTrial(age5, 'en', content.objects[3], true, false);
    playPredictTrial(age5, 'en', content.objects[5], true, false);
    playPredictTrial(age5, 'en', content.objects[6], true, false);
    expect(age5.level('en')).toBe(4);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).audioOnly).toBe(true);

    // 2 wrong predictions drop L4 -> L3
    playPredictTrial(age5, 'en', content.objects[0], false, false);
    playPredictTrial(age5, 'en', content.objects[4], false, false);
    expect(age5.level('en')).toBe(3);

    // Further wrong predictions drop L3 -> L2 -> L1 (free)
    playPredictTrial(age5, 'en', content.objects[1], false, false);
    playPredictTrial(age5, 'en', content.objects[5], false, false);
    expect(age5.level('en')).toBe(2);
    playPredictTrial(age5, 'en', content.objects[2], false, false);
    playPredictTrial(age5, 'en', content.objects[6], false, false);
    expect(age5.level('en')).toBe(1);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).mode).toBe('free');
  });

  it('[AC-07] content validates; every object has non-empty he/en/fr/reactHe/askHe and valid art in ART_MANIFEST; rounds have metal + non-metal and never repeat the same set', () => {
    expect(() => MagicMagnetContentSchema.parse(magnetJson)).not.toThrow();
    expect(content.id).toBe('magic-magnet');
    expect(content.world).toBe('science-world');
    expect(content.earnsLeisure).toBe(true);
    expect(content.languages).toEqual(['en', 'fr']);
    expect(loadWorlds().worlds.find((w) => w.id === 'science-world')?.status).toBe('open');

    const manifestByKey = new Map(ART_MANIFEST.map((e) => [e.key, e]));
    expect(manifestByKey.has('magnet-magnet')).toBe(true);
    const magnetEntry = manifestByKey.get('magnet-magnet')!;
    expect(fs.existsSync(path.join('public', magnetEntry.url))).toBe(true);

    for (const obj of content.objects) {
      expect(obj.he.trim().length).toBeGreaterThan(0);
      expect(obj.en.trim().length).toBeGreaterThan(0);
      expect(obj.fr.trim().length).toBeGreaterThan(0);
      expect(obj.reactHe.trim().length).toBeGreaterThan(0);
      expect(obj.askHe.trim().length).toBeGreaterThan(0);
      const entry = manifestByKey.get(obj.art);
      expect(entry, `art manifest entry for ${obj.art}`).toBeDefined();
      expect(fs.existsSync(path.join('public', entry!.url)), `SVG file for ${obj.art}`).toBe(true);
    }

    // pickRoundObjects: always at least 1 metal & 1 non-metal, deterministic, never same id set twice in a row.
    for (const count of [4, 5]) {
      let prev: string[] | null = null;
      const rngA = createLcg(42);
      const rngB = createLcg(42);
      for (let round = 0; round < 10; round++) {
        const pickedA = pickRoundObjects(content.objects, count, prev, rngA);
        const pickedB = pickRoundObjects(content.objects, count, prev, rngB);
        expect(pickedA.map((o) => o.id)).toEqual(pickedB.map((o) => o.id));
        expect(pickedA).toHaveLength(count);
        expect(pickedA.some((o) => o.metal)).toBe(true);
        expect(pickedA.some((o) => !o.metal)).toBe(true);
        if (prev !== null) {
          const prevSorted = [...prev].sort();
          const curSorted = pickedA.map((o) => o.id).sort();
          expect(curSorted).not.toEqual(prevSorted);
        }
        prev = pickedA.map((o) => o.id);
      }
    }

    // Reject invalid content.
    const withBlankName = structuredClone(magnetJson);
    withBlankName.objects[0].fr = '   ';
    expect(() => MagicMagnetContentSchema.parse(withBlankName)).toThrow();

    const withBlankReact = structuredClone(magnetJson);
    withBlankReact.objects[1].reactHe = '';
    expect(() => MagicMagnetContentSchema.parse(withBlankReact)).toThrow();

    const withDupId = structuredClone(magnetJson);
    withDupId.objects[1].id = withDupId.objects[0].id;
    expect(() => MagicMagnetContentSchema.parse(withDupId)).toThrow();

    const withTooFewMetal = structuredClone(magnetJson);
    withTooFewMetal.objects[1].metal = false;
    withTooFewMetal.objects[2].metal = false;
    withTooFewMetal.objects[3].metal = false;
    expect(() => MagicMagnetContentSchema.parse(withTooFewMetal)).toThrow();

    const withBadAudioOnly = {
      ...magnetJson,
      adaptive: {
        tracks: { age2: { start: 1, min: 1, max: 1 }, age5: { start: 1, min: 1, max: 1 } },
        levels: [{ support: 'audio-only', extra: { mode: 'free', objectCount: 4 } }],
      },
    };
    expect(() => MagicMagnetContentSchema.parse(withBadAudioOnly)).toThrow();
  });
});
