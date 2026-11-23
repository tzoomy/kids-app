import { describe, expect, it } from 'vitest';
import { loadLetterMonster } from '@/content/loadContent';
import { LetterMonsterContentSchema, normalizeFinalLetter } from '@/content/schema';
import {
  MAX_READ_WORD_LENGTH,
  buildRound,
  createMonster,
  sameRequest,
  tapFood,
  type MonsterRequest,
} from '@/games/letterMonster/monsterMachine';
import {
  askEndingLine,
  askWordLine,
  endingModelLine,
  foodLine,
  modelWordForEnding,
  planForLevel,
  requestItemId,
  requestLines,
  wordLine,
} from '@/games/letterMonster/monsterRound';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const content = loadLetterMonster();
const levels = content.adaptive.levels;
const byId = new Map(content.foods.map((f) => [f.id, f]));
const LANGS = ['en', 'fr'] as const;

describe('letter-monster ceilings (L5-L8)', () => {
  it('[AC-10] tracks: age2 is pinned, age5 starts at L3 and now reaches L8; L1-L4 are unchanged', () => {
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 2 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 3, min: 2, max: 8 });
    expect(levels).toHaveLength(8);
    expect(levels.slice(0, 4).map((l) => [l.extra?.request, l.extra?.choices, l.support])).toEqual([
      ['color', 2, 'picture-audio'],
      ['color', 3, 'picture-audio'],
      ['letter', 3, 'picture-audio'],
      ['letter', 3, 'audio-only'],
    ]);
  });

  it('[AC-10] L5-L8 plans: initial 4, ending 4, ending 6 audio-only, word reading 6 with the sign visible', () => {
    expect(planForLevel(levels[4])).toEqual({ requestKind: 'letter', choices: 4, audioOnly: false, hintWiggle: true });
    expect(planForLevel(levels[5])).toEqual({ requestKind: 'ending', choices: 4, audioOnly: false, hintWiggle: true });
    expect(planForLevel(levels[6])).toEqual({ requestKind: 'ending', choices: 6, audioOnly: true, hintWiggle: false });
    expect(planForLevel(levels[7])).toEqual({ requestKind: 'word', choices: 6, audioOnly: false, hintWiggle: true });
  });

  it('[AC-10] schema accepts 2-6 choices and the new request kinds, and rejects the rest', () => {
    expect(LetterMonsterContentSchema.safeParse(structuredClone(content)).success).toBe(true);
    const bad = (mutate: (c: ReturnType<typeof structuredClone<typeof content>>) => void) => {
      const copy = structuredClone(content);
      mutate(copy);
      return LetterMonsterContentSchema.safeParse(copy).success;
    };
    expect(bad((c) => void (c.adaptive.levels[4].extra!.choices = 7))).toBe(false);
    expect(bad((c) => void (c.adaptive.levels[4].extra!.choices = 1))).toBe(false);
    expect(bad((c) => void (c.adaptive.levels[5].extra!.request = 'sound'))).toBe(false);
  });

  it('[AC-11] every food has a per-language ending letter equal to the last letter of its word (œuf -> F, initial O kept)', () => {
    for (const food of content.foods) {
      for (const lang of LANGS) {
        expect(food.ending[lang], `${food.id} ${lang}`).toBe(normalizeFinalLetter(food.word[lang]));
      }
    }
    const egg = byId.get('egg')!;
    expect(egg.initial.fr).toBe('O');
    expect(egg.ending.fr).toBe('F');
    expect(egg.ending.en).toBe('G');
    const wrong = structuredClone(content);
    wrong.foods[0].ending.en = 'Z';
    expect(LetterMonsterContentSchema.safeParse(wrong).success).toBe(false);
  });

  it('[AC-11] L5-L7 rounds are always satisfiable in both languages: one match, no distractor shares the initial/ending', () => {
    const cases: Array<['letter' | 'ending', number]> = [
      ['letter', 4],
      ['ending', 4],
      ['ending', 6],
    ];
    for (const [kind, choices] of cases) {
      for (const lang of LANGS) {
        const rng = lcg(kind.length * 1000 + choices * 10 + (lang === 'fr' ? 1 : 0));
        let prev: MonsterRequest | null = null;
        const letters = new Set<string>();
        for (let i = 0; i < 400; i++) {
          const round = buildRound(content.foods, kind, lang, choices, prev, rng);
          expect(round.offeredIds).toHaveLength(choices);
          expect(new Set(round.offeredIds).size).toBe(choices);
          const req = round.request as Extract<MonsterRequest, { letter: string }>;
          expect(req.kind).toBe(kind);
          const letterOf = (id: string) => (kind === 'letter' ? byId.get(id)!.initial[lang] : byId.get(id)!.ending[lang]);
          expect(round.offeredIds.filter((id) => letterOf(id) === req.letter)).toEqual([round.matchId]);
          if (prev) expect(sameRequest(round.request, prev)).toBe(false);
          letters.add(req.letter);
          prev = round.request;
        }
        expect(letters.size).toBeGreaterThan(3);
        if (kind === 'ending' && lang === 'fr') expect(letters.has('E')).toBe(true); // E-heavy endings still build 6-choice rounds
      }
    }
  });

  it('[AC-11] L8 word rounds: the sign word is a short readable word, exactly one offered food matches it', () => {
    for (const lang of LANGS) {
      const rng = lcg(77 + (lang === 'fr' ? 5 : 0));
      let prev: MonsterRequest | null = null;
      const seen = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const round = buildRound(content.foods, 'word', lang, 6, prev, rng);
        const req = round.request;
        expect(req.kind).toBe('word');
        if (req.kind !== 'word') throw new Error('unreachable');
        expect(req.word).toBe(byId.get(req.foodId)!.word[lang]);
        expect(req.word.length).toBeLessThanOrEqual(MAX_READ_WORD_LENGTH);
        expect(round.matchId).toBe(req.foodId);
        expect(round.offeredIds).toHaveLength(6);
        expect(round.offeredIds.filter((id) => byId.get(id)!.word[lang] === req.word)).toEqual([round.matchId]);
        if (prev) expect(sameRequest(round.request, prev)).toBe(false);
        seen.add(req.foodId);
        prev = round.request;
      }
      expect(seen.size).toBeGreaterThanOrEqual(6);
    }
  });

  it('[AC-11] the machine still feeds the match and keeps the request on a wrong tap for ending and word rounds', () => {
    for (const kind of ['ending', 'word'] as const) {
      const round = buildRound(content.foods, kind, 'fr', 6, null, lcg(3));
      let state = createMonster(round);
      const wrong = round.offeredIds.find((id) => id !== round.matchId)!;
      const miss = tapFood(state, wrong);
      expect(miss.event.kind).toBe('not-this-one');
      state = miss.state;
      expect(tapFood(state, round.matchId).event.kind).toBe('fed');
    }
  });

  it('[AC-12] voice: feminine Hebrew leads, ending and word learning lines, adaptive item ids', () => {
    const askEnding = askEndingLine(content);
    expect(askEnding).toEqual({ lineId: 'monster.askEnding.he', lang: 'he', text: content.linesHe.askEnding });
    const askWord = askWordLine(content);
    expect(askWord).toEqual({ lineId: 'monster.askWord.he', lang: 'he', text: content.linesHe.askWord });
    expect(askEnding.text).toContain('המפלצת רוצה משהו שמסתיים');
    expect(askWord.text).toContain('המפלצת רוצה את המילה');

    expect(endingModelLine(content, 'N', 'fr')).toEqual({
      lineId: 'monster.ending.N.fr',
      lang: 'fr',
      text: `N... à la fin de ${modelWordForEnding(content, 'N', 'fr')} !`,
    });
    expect(endingModelLine(content, 'T', 'en').text).toBe(`T... at the end of ${modelWordForEnding(content, 'T', 'en')}!`);
    expect(wordLine(content, 'apple', 'en')).toEqual({ lineId: 'monster.word.apple.en', lang: 'en', text: 'apple!' });
    expect(wordLine(content, 'egg', 'fr')).toEqual({ lineId: 'monster.word.egg.fr', lang: 'fr', text: 'œuf !' });

    const endReq: MonsterRequest = { kind: 'ending', letter: 'E' };
    expect(requestLines(content, endReq, 'en')).toEqual([askEnding, endingModelLine(content, 'E', 'en')]);
    const wordReq: MonsterRequest = { kind: 'word', foodId: 'pear', word: 'pear' };
    expect(requestLines(content, wordReq, 'en')).toEqual([askWord, wordLine(content, 'pear', 'en')]);
    expect(requestItemId(endReq)).toBe('ending:E');
    expect(requestItemId(wordReq)).toBe('word:pear');
    expect(foodLine(content, 'pear', 'en').lineId).toBe('monster.food.pear.en');
  });
});
