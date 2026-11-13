import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadLetterMonster, loadWorlds } from '@/content/loadContent';
import { LetterMonsterContentSchema, normalizeInitialLetter } from '@/content/schema';
import letterMonsterJson from '@/content/games/letter-monster.json';
import { buildRound, createMonster, tapFood, type MonsterRequest } from '@/games/letterMonster/monsterMachine';
import {
  askColorLine,
  askLetterLine,
  colorWordLine,
  fedLines,
  foodLine,
  introLine,
  letterModelLine,
  modelWordForLetter,
  notThisLine,
  planForLevel,
  requestLines,
  trialForRequest,
} from '@/games/letterMonster/monsterRound';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const content = loadLetterMonster();
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
    random: () => 0.25,
  });
}

function playOneRound(
  session: SkillSession,
  kind: 'color' | 'letter',
  lang: 'en' | 'fr',
  missFirst: boolean,
  hinted = false,
  prev: MonsterRequest | null = null,
): MonsterRequest {
  const round = buildRound(content.foods, kind, lang, kind === 'color' ? 2 : 3, prev, () => 0.15);
  let state = createMonster(round);
  if (missFirst) {
    const wrongId = round.offeredIds.find((id) => id !== round.matchId)!;
    state = tapFood(state, wrongId).state;
  }
  const done = tapFood(state, round.matchId);
  if (done.event.kind !== 'fed') throw new Error('Expected fed event');
  session.record(lang, trialForRequest(done.event, hinted));
  return round.request;
}

describe('Letter Monster: levels, adaptive trials, voice lines and content', () => {
  it('[AC-04] age 2 color levels: request names the color in Hebrew and the learning language; feeding names the food in the learning language', () => {
    expect(introLine(content)).toEqual({
      lineId: 'monster.intro.he',
      lang: 'he',
      text: content.linesHe.intro,
    });

    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      requestKind: 'color',
      choices: 2,
      audioOnly: false,
      hintWiggle: true,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      requestKind: 'color',
      choices: 3,
      audioOnly: false,
      hintWiggle: true,
    });

    for (const color of ['red', 'yellow', 'orange', 'purple', 'green', 'brown', 'white', 'blue'] as const) {
      const heReq = askColorLine(content, color);
      expect(heReq.lineId).toBe(`monster.askColor.${color}.he`);
      expect(heReq.lang).toBe('he');
      expect(heReq.text).toContain(content.colors[color].he);

      for (const lang of ['en', 'fr'] as const) {
        const learnReq = colorWordLine(content, color, lang);
        expect(learnReq.lineId).toBe(`monster.color.${color}.${lang}`);
        expect(learnReq.lang).toBe(lang);
        expect(learnReq.text).toContain(content.colors[color][lang]);
        expect(requestLines(content, { kind: 'color', color }, lang)).toEqual([heReq, learnReq]);
      }
    }

    for (const food of content.foods) {
      for (const lang of ['en', 'fr'] as const) {
        const line = foodLine(content, food.id, lang);
        expect(line).toEqual({
          lineId: `monster.food.${food.id}.${lang}`,
          lang,
          text: food.phrase[lang],
        });
        expect(fedLines(content, food.id, lang)).toEqual([
          line,
          expect.objectContaining({ lineId: 'he.praise.0', lang: 'he' }),
        ]);
      }
    }
  });

  it('[AC-05] age 5 letter levels: plan sets 3 choices and audio-only at L4; request speaks Hebrew lead + letter model; wrong tap speaks notThis', () => {
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      requestKind: 'letter',
      choices: 3,
      audioOnly: false,
      hintWiggle: true,
    });
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      requestKind: 'letter',
      choices: 3,
      audioOnly: true,
      hintWiggle: false,
    });

    expect(askLetterLine(content)).toEqual({
      lineId: 'monster.askLetter.he',
      lang: 'he',
      text: content.linesHe.askLetter,
    });
    expect(notThisLine(content)).toEqual({
      lineId: 'monster.notThis.he',
      lang: 'he',
      text: content.linesHe.notThis,
    });

    for (const lang of ['en', 'fr'] as const) {
      const letters = new Set(content.foods.map((f) => f.initial[lang].toUpperCase()));
      for (const letter of letters) {
        const modelWord = modelWordForLetter(content, letter, lang);
        const line = letterModelLine(content, letter, lang);
        expect(line.lineId).toBe(`monster.letter.${letter}.${lang}`);
        expect(line.lang).toBe(lang);
        expect(line.text).toContain(letter);
        expect(line.text).toContain(modelWord);
        expect(requestLines(content, { kind: 'letter', letter }, lang)).toEqual([askLetterLine(content), line]);
      }
    }
  });

  it('[AC-06] adaptive steps: first-tap feeds are clean, retries and hints are not; age 2 stays within L1-L2; age 5 starts at L3', () => {
    expect(trialForRequest({ kind: 'fed', foodId: 'banana', request: { kind: 'color', color: 'yellow' }, tries: 1 }, false)).toEqual({
      itemId: 'color:yellow',
      firstTryCorrect: true,
      hinted: false,
    });
    expect(trialForRequest({ kind: 'fed', foodId: 'banana', request: { kind: 'letter', letter: 'B' }, tries: 2 }, false)).toEqual({
      itemId: 'letter:B',
      firstTryCorrect: false,
      hinted: false,
    });
    expect(trialForRequest({ kind: 'fed', foodId: 'banana', request: { kind: 'letter', letter: 'B' }, tries: 1 }, true)).toEqual({
      itemId: 'letter:B',
      firstTryCorrect: true,
      hinted: true,
    });

    // Age 2: starts at L1, can rise to L2, and stays clamped to max L2.
    const age2 = makeSession('age2');
    expect(age2.level('en')).toBe(1);
    let prev: MonsterRequest | null = null;
    for (let i = 0; i < 9; i++) {
      prev = playOneRound(age2, 'color', 'en', false, false, prev);
    }
    expect(age2.level('en')).toBe(2);
    expect(planForLevel(content.adaptive.levels[age2.level('en') - 1]).requestKind).toBe('color');

    // Hinted feeds are not clean and never raise level.
    const age5Hinted = makeSession('age5');
    expect(age5Hinted.level('en')).toBe(3);
    for (let i = 0; i < 4; i++) {
      prev = playOneRound(age5Hinted, 'letter', 'en', false, true, prev);
    }
    expect(age5Hinted.level('en')).toBe(3);

    // Age 5: starts at L3, 3 clean feeds raise L3 -> L4, misses drop L4 -> L3 -> L2.
    const age5 = makeSession('age5');
    expect(age5.level('fr')).toBe(3);
    for (let i = 0; i < 3; i++) {
      prev = playOneRound(age5, 'letter', 'fr', false, false, prev);
    }
    expect(age5.level('fr')).toBe(4);
    expect(planForLevel(content.adaptive.levels[age5.level('fr') - 1]).audioOnly).toBe(true);

    prev = playOneRound(age5, 'letter', 'fr', true, false, prev);
    prev = playOneRound(age5, 'letter', 'fr', true, false, prev);
    expect(age5.level('fr')).toBe(3);

    prev = playOneRound(age5, 'letter', 'fr', true, false, prev);
    prev = playOneRound(age5, 'letter', 'fr', true, false, prev);
    expect(age5.level('fr')).toBe(2);
    expect(planForLevel(content.adaptive.levels[age5.level('fr') - 1]).requestKind).toBe('color');
  });

  it('[AC-07] content validates; every food has non-empty en/fr words matching initial (including œuf -> O); rejects invalid content', () => {
    expect(() => LetterMonsterContentSchema.parse(letterMonsterJson)).not.toThrow();
    expect(content.id).toBe('letter-monster');
    expect(content.world).toBe('language-house');
    expect(content.earnsLeisure).toBe(true);
    expect(content.languages).toEqual(['en', 'fr']);
    expect(loadWorlds().worlds.find((w) => w.id === 'language-house')?.status).toBe('open');
    expect(content.foods).toHaveLength(12);

    expect(normalizeInitialLetter('œuf')).toBe('O');
    for (const food of content.foods) {
      expect(food.word.en.trim().length).toBeGreaterThan(0);
      expect(food.word.fr.trim().length).toBeGreaterThan(0);
      expect(normalizeInitialLetter(food.word.en)).toBe(food.initial.en.toUpperCase());
      expect(normalizeInitialLetter(food.word.fr)).toBe(food.initial.fr.toUpperCase());
    }

    const withMismatchedInitial = structuredClone(letterMonsterJson);
    withMismatchedInitial.foods[0].initial.en = 'Z';
    expect(() => LetterMonsterContentSchema.parse(withMismatchedInitial)).toThrow();

    const withEmptyFrenchWord = structuredClone(letterMonsterJson);
    withEmptyFrenchWord.foods[0].word.fr = '';
    expect(() => LetterMonsterContentSchema.parse(withEmptyFrenchWord)).toThrow();

    const withBadColorFrame = structuredClone(letterMonsterJson);
    withBadColorFrame.linesHe.askColorFrame = 'המפלצת רוצה אוכל';
    expect(() => LetterMonsterContentSchema.parse(withBadColorFrame)).toThrow();

  });
});
