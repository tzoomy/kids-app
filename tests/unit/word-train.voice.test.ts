import { describe, expect, it } from 'vitest';
import { gameVoiceCatalog } from '../../src/content/voiceCatalog';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const byId = new Map(gameVoiceCatalog().map((l) => [l.id, l]));
import { loadWordTrain } from '../../src/content/loadContent';
import {
  buildTiles,
  introLine as trainIntro,
  letterLine,
  loadLine,
  nameLine as trainName,
  otherLine as trainOther,
  pickLoadRound,
  pickWord,
  planForLevel as trainPlan,
  spellLine,
  wordLine,
  wordsForLang,
} from '../../src/games/wordTrain/wordTrainRound';

describe('word-train voice catalogue', () => {
  it('[AC-15] every line Word Train can emit is catalogued (load objects, English and French spelling, letter names)', () => {
    const content = loadWordTrain();
    const emitted = new Set<string>();
    for (const mode of ['load', 'spell'] as const) emitted.add(trainIntro(content, mode).lineId);
    emitted.add(trainIntro(content, 'spell', 'fr').lineId);
    for (const obj of content.objects) {
      emitted.add(loadLine(content, obj.id).lineId);
      emitted.add(trainName(content, obj.id).lineId);
      emitted.add(trainOther(content, obj.id).lineId);
    }
    expect(pickLoadRound(content.objects, 2, null, lcg(1)).choices).toHaveLength(2);
    for (const level of content.adaptive.levels) {
      const plan = trainPlan(level);
      if (plan.mode !== 'spell') continue;
      for (const lang of ['en', 'fr'] as const) {
        const rng = lcg(5 + plan.wordLength);
        for (let i = 0; i < 30; i++) {
          const w = pickWord(wordsForLang(content.words, lang), plan.wordLength, null, rng, plan.wordLengthMax);
          emitted.add(spellLine(content, w.id).lineId);
          emitted.add(wordLine(content, w.id).lineId);
          for (const ch of buildTiles(w.word, plan.distractors, content.distractorLetters, rng)) {
            emitted.add(letterLine(ch, lang).lineId);
          }
        }
      }
    }
    for (const id of emitted) expect(byId.has(id), id).toBe(true);
    expect(emitted.size).toBeGreaterThan(60);
  });
});
