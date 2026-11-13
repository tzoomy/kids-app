import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadWordTrain, loadWorlds } from '@/content/loadContent';
import { WordTrainContentSchema } from '@/content/schema';
import wordTrainJson from '@/content/games/word-train.json';
import { ART_MANIFEST } from '@/assets/art/manifest';
import {
  buildTiles,
  introLine,
  letterLine,
  loadLine,
  nameLine,
  otherLine,
  pickLoadRound,
  pickWord,
  planForLevel,
  spellLine,
  trialForLoad,
  trialForWord,
  wordLine,
} from '@/games/wordTrain/wordTrainRound';

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

const content = loadWordTrain();
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

describe('Word Train: levels, adaptive trials, voice lines and content', () => {
  it('[AC-06] planForLevel matches L1..L5 difficulty curve and trial builders check clean criteria', () => {
    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      mode: 'load',
      choiceCount: 2,
      loadsPerStar: 3,
      wordLength: 3,
      ghost: false,
      distractors: 0,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      mode: 'load',
      choiceCount: 3,
      loadsPerStar: 3,
      wordLength: 3,
      ghost: false,
      distractors: 0,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      mode: 'spell',
      choiceCount: 2,
      loadsPerStar: 3,
      wordLength: 3,
      ghost: true,
      distractors: 0,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      mode: 'spell',
      choiceCount: 2,
      loadsPerStar: 3,
      wordLength: 3,
      ghost: false,
      distractors: 1,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[4])).toEqual({
      mode: 'spell',
      choiceCount: 2,
      loadsPerStar: 3,
      wordLength: 4,
      ghost: false,
      distractors: 1,
      audioOnly: true,
      hintPulse: false,
    });

    expect(trialForLoad({ kind: 'loaded', id: 'apple', tries: 1 })).toEqual({
      itemId: 'apple',
      firstTryCorrect: true,
      hinted: false,
    });
    expect(trialForLoad({ kind: 'loaded', id: 'apple', tries: 2 })).toEqual({
      itemId: 'apple',
      firstTryCorrect: false,
      hinted: false,
    });
    expect(trialForWord({ kind: 'spelled', word: 'sun', bounces: 0 }, false)).toEqual({
      itemId: 'sun',
      firstTryCorrect: true,
      hinted: false,
    });
    expect(trialForWord({ kind: 'spelled', word: 'sun', bounces: 1 }, false)).toEqual({
      itemId: 'sun',
      firstTryCorrect: false,
      hinted: false,
    });
    expect(trialForWord({ kind: 'spelled', word: 'sun', bounces: 0 }, true)).toEqual({
      itemId: 'sun',
      firstTryCorrect: true,
      hinted: true,
    });
  });

  it('[AC-06] adaptive steps with real SkillSession: age 2 stays within L1-L2; age 5 starts at L3, rises on clean words and drops on bounces', () => {
    const age2 = makeSession('age2');
    expect(age2.level('en')).toBe(1);

    // 3 first-try clean loads raise L1 -> L2, and further clean loads stay capped at L2.
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'apple', tries: 1 }));
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'banana', tries: 1 }));
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'carrot', tries: 1 }));
    expect(age2.level('en')).toBe(2);
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'hat', tries: 1 }));
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'book', tries: 1 }));
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'egg', tries: 1 }));
    expect(age2.level('en')).toBe(2);

    // 2 missed loads in a 3-trial round drop L2 -> L1 at the round boundary (between-rounds policy for age2).
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'ball', tries: 2 }));
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'fish', tries: 3 }));
    age2.record('en', trialForLoad({ kind: 'loaded', id: 'apple', tries: 1 }));
    expect(age2.level('en')).toBe(1);

    const age5 = makeSession('age5');
    expect(age5.level('en')).toBe(3);

    // 3 clean unhinted words raise L3 -> L4.
    age5.record('en', trialForWord({ kind: 'spelled', word: 'hat', bounces: 0 }, false));
    age5.record('en', trialForWord({ kind: 'spelled', word: 'sun', bounces: 0 }, false));
    age5.record('en', trialForWord({ kind: 'spelled', word: 'cup', bounces: 0 }, false));
    expect(age5.level('en')).toBe(4);

    // A hinted word does not advance L4 -> L5 on its own; 3 clean unhinted words do.
    age5.record('en', trialForWord({ kind: 'spelled', word: 'egg', bounces: 0 }, true));
    expect(age5.level('en')).toBe(4);
    age5.record('en', trialForWord({ kind: 'spelled', word: 'hat', bounces: 0 }, false));
    age5.record('en', trialForWord({ kind: 'spelled', word: 'sun', bounces: 0 }, false));
    age5.record('en', trialForWord({ kind: 'spelled', word: 'cup', bounces: 0 }, false));
    expect(age5.level('en')).toBe(5);

    // 2 bounced words drop L5 -> L4.
    age5.record('en', trialForWord({ kind: 'spelled', word: 'ball', bounces: 1 }, false));
    age5.record('en', trialForWord({ kind: 'spelled', word: 'book', bounces: 2 }, false));
    expect(age5.level('en')).toBe(4);
  });

  it('[AC-07] all English lines use lang "en" and exact spec lineIds; intros use lang "he"', () => {
    expect(introLine(content, 'load')).toEqual({
      lineId: 'wordtrain.intro.load.he',
      lang: 'he',
      text: content.linesHe.introLoad,
    });
    expect(introLine(content, 'spell')).toEqual({
      lineId: 'wordtrain.intro.spell.he',
      lang: 'he',
      text: content.linesHe.introSpell,
    });

    for (const obj of content.objects) {
      const l = loadLine(content, obj.id);
      const n = nameLine(content, obj.id);
      const o = otherLine(content, obj.id);
      expect(l).toEqual({ lineId: `wordtrain.load.${obj.id}.en`, lang: 'en', text: `Load the ${obj.en}!` });
      expect(n).toEqual({
        lineId: `wordtrain.name.${obj.id}.en`,
        lang: 'en',
        text: `${obj.en.charAt(0).toUpperCase()}${obj.en.slice(1)}!`,
      });
      expect(o).toEqual({ lineId: `wordtrain.other.${obj.id}.en`, lang: 'en', text: `That's the ${obj.en}!` });
    }

    for (const w of content.words) {
      expect(spellLine(content, w.id)).toEqual({
        lineId: `wordtrain.spell.${w.id}.en`,
        lang: 'en',
        text: `Let's spell ${w.word}!`,
      });
      expect(wordLine(content, w.id)).toEqual({
        lineId: `wordtrain.word.${w.id}.en`,
        lang: 'en',
        text: `${w.word.split('').join(', ')}: ${w.word}!`,
      });
    }

    for (const ch of ['a', 's', 'u', 'n', 'z']) {
      expect(letterLine(ch)).toEqual({ lineId: `wordtrain.letter.${ch}.en`, lang: 'en', text: ch });
    }

    expect(() => loadLine(content, 'unknown')).toThrow();
    expect(() => spellLine(content, 'unknown')).toThrow();
    expect(() => letterLine('1')).toThrow();
  });

  it('[AC-08] content validates; words, objects, art keys and files exist; round selection never repeats and distractors are outside the word', () => {
    expect(() => WordTrainContentSchema.parse(wordTrainJson)).not.toThrow();
    expect(content.id).toBe('word-train');
    expect(content.world).toBe('language-house');
    expect(content.languages).toEqual(['en']);
    expect(content.earnsLeisure).toBe(true);
    expect(loadWorlds().worlds.find((w) => w.id === 'language-house')?.status).toBe('open');

    const manifestByKey = new Map(ART_MANIFEST.map((e) => [e.key, e]));
    for (const requiredKey of ['picnic-train-bg-landscape', 'picnic-train-bg-portrait', 'train-engine', 'word-train-wagon']) {
      const entry = manifestByKey.get(requiredKey);
      expect(entry, requiredKey).toBeDefined();
      expect(fs.existsSync(path.join('public', entry!.url)), entry!.url).toBe(true);
    }

    for (const obj of content.objects) {
      expect(obj.en.trim().length).toBeGreaterThan(0);
      expect(obj.he.trim().length).toBeGreaterThan(0);
      const entry = manifestByKey.get(obj.art);
      expect(entry, `object art ${obj.art}`).toBeDefined();
      expect(fs.existsSync(path.join('public', entry!.url)), entry!.url).toBe(true);
    }

    for (const w of content.words) {
      expect(w.word).toMatch(/^[a-z]{3,4}$/);
      expect(w.he.trim().length).toBeGreaterThan(0);
      const entry = manifestByKey.get(w.art);
      expect(entry, `word art ${w.art}`).toBeDefined();
      expect(fs.existsSync(path.join('public', entry!.url)), entry!.url).toBe(true);
    }

    // pickLoadRound never repeats previousTarget and is deterministic.
    let prevTarget: string | null = null;
    for (let i = 0; i < 8; i++) {
      const a = pickLoadRound(content.objects, 3, prevTarget, createLcg(i + 1));
      const b = pickLoadRound(content.objects, 3, prevTarget, createLcg(i + 1));
      expect(a.target.id).toBe(b.target.id);
      expect(a.choices.map((o) => o.id)).toEqual(b.choices.map((o) => o.id));
      expect(a.choices).toHaveLength(3);
      expect(a.choices.some((o) => o.id === a.target.id)).toBe(true);
      if (prevTarget) expect(a.target.id).not.toBe(prevTarget);
      prevTarget = a.target.id;
    }

    // pickWord never repeats previousId.
    for (const len of [3, 4] as const) {
      let prevWord: string | null = null;
      for (let i = 0; i < 6; i++) {
        const w = pickWord(content.words, len, prevWord, createLcg(i + 10));
        expect(w.word).toHaveLength(len);
        if (prevWord) expect(w.id).not.toBe(prevWord);
        prevWord = w.id;
      }
    }

    // buildTiles is deterministic and distractors are never in the word.
    for (const w of content.words) {
      const tilesA = buildTiles(w.word, 1, content.distractorLetters, createLcg(99));
      const tilesB = buildTiles(w.word, 1, content.distractorLetters, createLcg(99));
      expect(tilesA).toEqual(tilesB);
      expect(tilesA).toHaveLength(w.word.length + 1);
      const extras = [...tilesA];
      for (const ch of w.word) {
        const idx = extras.indexOf(ch);
        expect(idx).toBeGreaterThanOrEqual(0);
        extras.splice(idx, 1);
      }
      expect(extras).toHaveLength(1);
      expect(w.word.includes(extras[0])).toBe(false);
    }

    // Reject invalid content.
    const badUpper = structuredClone(wordTrainJson);
    badUpper.words[0].word = 'Sun';
    expect(() => WordTrainContentSchema.parse(badUpper)).toThrow();

    const badLength = structuredClone(wordTrainJson);
    badLength.words[0].word = 'go';
    expect(() => WordTrainContentSchema.parse(badLength)).toThrow();

    const badDupWord = structuredClone(wordTrainJson);
    badDupWord.words[1].word = badDupWord.words[0].word;
    expect(() => WordTrainContentSchema.parse(badDupWord)).toThrow();

    const badDupObj = structuredClone(wordTrainJson);
    badDupObj.objects[1].id = badDupObj.objects[0].id;
    expect(() => WordTrainContentSchema.parse(badDupObj)).toThrow();

    const badFrame = structuredClone(wordTrainJson);
    badFrame.linesEn.loadFrame = 'Load it!';
    expect(() => WordTrainContentSchema.parse(badFrame)).toThrow();

    const badLang = { ...structuredClone(wordTrainJson), languages: ['fr'] };
    expect(() => WordTrainContentSchema.parse(badLang)).toThrow();

    const badChoiceCount = structuredClone(wordTrainJson);
    badChoiceCount.adaptive.levels[0].extra.choiceCount = 99;
    expect(() => WordTrainContentSchema.parse(badChoiceCount)).toThrow();
  });
});
