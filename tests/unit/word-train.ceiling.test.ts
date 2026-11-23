import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { loadWordTrain } from '../../src/content/loadContent';
import { WordTrainContentSchema, type WordTrainWord } from '../../src/content/schema';
import {
  FRENCH_LETTER_NAMES,
  buildTiles,
  introLine,
  letterLine,
  loadLine,
  pickWord,
  planForLevel,
  resolveRoundLanguages,
  spellLine,
  wordLine,
  wordsForLang,
} from '../../src/games/wordTrain/wordTrainRound';
import { createSpellRound, placeLetter } from '../../src/games/wordTrain/wordTrainMachine';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const content = loadWordTrain();
const levels = content.adaptive.levels;
const LANGS = ['en', 'fr'] as const;
const BLEND = /^(sh|tr|st|sp|fl|gr|pl|br|cl|fr|scr|ch)/;

describe('word-train ceilings (L6-L8, French spelling track)', () => {
  it('[AC-11] tracks: age2 pinned, age5 starts at L3 and reaches L8; L1-L5 untouched', () => {
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 2 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 3, min: 1, max: 8 });
    expect(levels).toHaveLength(8);
    expect(levels.slice(0, 5).map((l) => l.extra)).toEqual([
      { mode: 'load', choiceCount: 2, loadsPerStar: 3 },
      { mode: 'load', choiceCount: 3, loadsPerStar: 3 },
      { mode: 'spell', wordLength: 3, ghost: true, distractors: 0 },
      { mode: 'spell', wordLength: 3, ghost: false, distractors: 1 },
      { mode: 'spell', wordLength: 4, ghost: false, distractors: 1 },
    ]);
  });

  it('[AC-11] L6-L8 plans: 5-letter then 5-6-letter words, no ghost, 1 then 2 distractors, L8 audio-only', () => {
    expect(planForLevel(levels[5])).toMatchObject({
      mode: 'spell', wordLength: 5, wordLengthMax: 5, ghost: false, distractors: 1, audioOnly: false, hintPulse: true,
    });
    expect(planForLevel(levels[6])).toMatchObject({
      mode: 'spell', wordLength: 5, wordLengthMax: 5, ghost: false, distractors: 2, audioOnly: false, hintPulse: true,
    });
    expect(planForLevel(levels[7])).toMatchObject({
      mode: 'spell', wordLength: 5, wordLengthMax: 6, ghost: false, distractors: 2, audioOnly: true, hintPulse: false,
    });
  });

  it('[AC-12] bank: expanded English, curated French, ascii, art exists, every spell level satisfiable in both languages', () => {
    expect(content.languages).toEqual(['en', 'fr']);
    const en = wordsForLang(content.words, 'en');
    const fr = wordsForLang(content.words, 'fr');
    expect(en.length).toBeGreaterThanOrEqual(24);
    expect(fr.length).toBeGreaterThanOrEqual(14);
    for (const original of ['hat', 'egg', 'sun', 'cup', 'ball', 'book', 'fish', 'pear']) {
      expect(en.some((w) => w.id === original && w.word === original)).toBe(true);
    }
    const manifest = new Map(ART_MANIFEST.map((e) => [e.key, e]));
    const ids = new Set<string>();
    for (const w of content.words) {
      expect(w.word).toMatch(/^[a-z]{3,6}$/);
      expect(ids.has(w.id), `duplicate id ${w.id}`).toBe(false);
      ids.add(w.id);
      const entry = manifest.get(w.art);
      expect(entry, `${w.id} art ${w.art}`).toBeDefined();
      expect(fs.existsSync(path.join('public', entry!.url))).toBe(true);
    }
    expect(new Set(en.map((w) => w.word)).size).toBe(en.length);
    expect(new Set(fr.map((w) => w.word)).size).toBe(fr.length);
    for (const set of [en, fr]) {
      const lengths = new Set(set.map((w) => w.word.length));
      for (const len of [3, 4, 5, 6]) expect(lengths.has(len), `length ${len}`).toBe(true);
      expect(set.filter((w) => BLEND.test(w.word)).length).toBeGreaterThanOrEqual(3);
    }
    expect(fr.some((w) => w.word === 'oeuf')).toBe(true);

    for (const lang of LANGS) {
      const pool = wordsForLang(content.words, lang);
      for (let i = 2; i < levels.length; i++) {
        const plan = planForLevel(levels[i]);
        const fit = pool.filter((w) => w.word.length >= plan.wordLength && w.word.length <= plan.wordLengthMax);
        expect(fit.length, `L${i + 1} ${lang}`).toBeGreaterThanOrEqual(2);
        for (const w of fit) {
          expect(() => buildTiles(w.word, plan.distractors, content.distractorLetters, lcg(5))).not.toThrow();
        }
      }
    }
  });

  it('[AC-12] schema: word needs a lang, 7+ letters are rejected, a spell level with too few words in a language is rejected', () => {
    expect(WordTrainContentSchema.safeParse(structuredClone(content)).success).toBe(true);
    const noLang = structuredClone(content) as unknown as { words: Array<Partial<WordTrainWord>> };
    delete noLang.words[0].lang;
    expect(WordTrainContentSchema.safeParse(noLang).success).toBe(false);
    const tooLong = structuredClone(content);
    tooLong.words[0].word = 'abcdefg';
    expect(WordTrainContentSchema.safeParse(tooLong).success).toBe(false);
    const accent = structuredClone(content);
    accent.words[0].word = 'œuf';
    expect(WordTrainContentSchema.safeParse(accent).success).toBe(false);
    const noFiveFr = structuredClone(content);
    noFiveFr.words = noFiveFr.words.filter((w) => !(w.lang === 'fr' && w.word.length === 5));
    expect(WordTrainContentSchema.safeParse(noFiveFr).success).toBe(false);
    const dupFr = structuredClone(content);
    const fr0 = dupFr.words.find((w) => w.lang === 'fr')!;
    dupFr.words.push({ ...fr0, id: `${fr0.id}-copy` });
    expect(WordTrainContentSchema.safeParse(dupFr).success).toBe(false);
  });

  it('[AC-12] pickWord honours the language pool and the length range and never repeats', () => {
    for (const lang of LANGS) {
      const pool = wordsForLang(content.words, lang);
      let prev: string | null = null;
      const seen = new Set<number>();
      for (let i = 0; i < 80; i++) {
        const w = pickWord(pool, 5, prev, lcg(i + 1), 6);
        expect(w.lang).toBe(lang);
        expect(w.word.length).toBeGreaterThanOrEqual(5);
        expect(w.word.length).toBeLessThanOrEqual(6);
        if (prev) expect(w.id).not.toBe(prev);
        seen.add(w.word.length);
        prev = w.id;
      }
      expect(seen).toEqual(new Set([5, 6]));
    }
  });

  it('[AC-11] L6-L8 tiles: word letters plus 1 or 2 distractors that are not in the word; a 6-letter word is spellable', () => {
    for (const lang of LANGS) {
      for (const w of wordsForLang(content.words, lang).filter((x) => x.word.length >= 5)) {
        for (const d of [1, 2]) {
          const tiles = buildTiles(w.word, d, content.distractorLetters, lcg(9));
          expect(tiles).toHaveLength(w.word.length + d);
        }
      }
    }
    const six = content.words.find((w) => w.lang === 'fr' && w.word.length === 6)!;
    let state = createSpellRound({ word: six.word, letters: buildTiles(six.word, 2, content.distractorLetters, lcg(3)) });
    for (let s = 0; s < six.word.length; s++) {
      const tile = state.tiles.find((t) => t.placedAt === null && t.letter === six.word[s])!;
      const res = placeLetter(state, tile.index, s);
      expect(res.event.kind).toBe(s === six.word.length - 1 ? 'spelled' : 'placed');
      state = res.state as typeof state;
    }
  });

  it('[AC-13] French voice: spell/word frames, standard French letter names, Hebrew feminine French intro', () => {
    const pomme = content.words.find((w) => w.lang === 'fr' && w.word === 'pomme')!;
    expect(spellLine(content, pomme.id)).toEqual({
      lineId: `wordtrain.spell.${pomme.id}.fr`,
      lang: 'fr',
      text: 'Épelons pomme !',
    });
    expect(wordLine(content, pomme.id)).toEqual({
      lineId: `wordtrain.word.${pomme.id}.fr`,
      lang: 'fr',
      text: 'p, o, m, m, e : pomme !',
    });
    expect(Object.keys(FRENCH_LETTER_NAMES)).toHaveLength(26);
    expect(letterLine('b', 'fr')).toEqual({ lineId: 'wordtrain.letter.b.fr', lang: 'fr', text: 'bé' });
    expect(letterLine('w', 'fr').text).toBe('double vé');
    expect(letterLine('y', 'fr').text).toBe('i grec');
    expect(letterLine('z', 'fr').text).toBe('zède');
    expect(letterLine('b')).toEqual({ lineId: 'wordtrain.letter.b.en', lang: 'en', text: 'b' });
    expect(introLine(content, 'spell', 'fr')).toEqual({
      lineId: 'wordtrain.intro.spell.fr.he',
      lang: 'he',
      text: 'בואי נבנה מילה בצרפתית!',
    });
    expect(introLine(content, 'spell').text).toBe('בואי נבנה מילה באנגלית!');
    expect(introLine(content, 'spell', 'en').lineId).toBe('wordtrain.intro.spell.he');
    // Load mode is English only: the load frame has no French line.
    expect(loadLine(content, 'apple')).toEqual({ lineId: 'wordtrain.load.apple.en', lang: 'en', text: 'Load the apple!' });
    for (const text of [content.helpTextHe, content.linesHe.introSpellFr]) {
      expect(text).not.toMatch(/\b(בואו|הקשיבו|לחצו|נסו)\b/);
    }
  });

  it('[AC-13] round language: load mode stays English whatever the setting; spell mode follows the setting and keys by that language', () => {
    const loadPlan = planForLevel(levels[0]);
    const spellPlan = planForLevel(levels[2]);
    expect(resolveRoundLanguages({ settingLang: 'fr', planEn: loadPlan, planSetting: loadPlan })).toEqual({
      roundLang: 'en', skillLang: 'en', plan: loadPlan,
    });
    expect(resolveRoundLanguages({ settingLang: 'en', planEn: loadPlan, planSetting: loadPlan })).toMatchObject({
      roundLang: 'en', skillLang: 'en',
    });
    expect(resolveRoundLanguages({ settingLang: 'fr', planEn: spellPlan, planSetting: spellPlan })).toEqual({
      roundLang: 'fr', skillLang: 'fr', plan: spellPlan,
    });
    // A French level that dropped to a load level still plays English load, recorded on the French key.
    expect(resolveRoundLanguages({ settingLang: 'fr', planEn: spellPlan, planSetting: loadPlan })).toEqual({
      roundLang: 'en', skillLang: 'fr', plan: loadPlan,
    });
  });
});
