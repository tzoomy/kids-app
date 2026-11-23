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
import { loadLetterMonster } from '../../src/content/loadContent';
import { buildRound } from '../../src/games/letterMonster/monsterMachine';
import {
  foodLine,
  introLine as monsterIntro,
  notThisLine,
  planForLevel as monsterPlan,
  requestLines,
} from '../../src/games/letterMonster/monsterRound';

describe('letter-monster voice catalogue', () => {
  it('[AC-16] every line Letter Monster can emit is catalogued (all levels, both languages, many seeded rounds)', () => {
    const content = loadLetterMonster();
    const emitted = new Set<string>([monsterIntro(content).lineId, notThisLine(content).lineId]);
    for (const level of content.adaptive.levels) {
      const plan = monsterPlan(level);
      for (const lang of ['en', 'fr'] as const) {
        const rng = lcg(31 + plan.choices);
        let prev = null as ReturnType<typeof buildRound>['request'] | null;
        for (let i = 0; i < 120; i++) {
          const round = buildRound(content.foods, plan.requestKind, lang, plan.choices, prev, rng);
          for (const l of requestLines(content, round.request, lang)) emitted.add(l.lineId);
          for (const id of round.offeredIds) emitted.add(foodLine(content, id, lang).lineId);
          prev = round.request;
        }
      }
    }
    for (const id of emitted) expect(byId.has(id), id).toBe(true);
    for (const id of ['monster.askEnding.he', 'monster.askWord.he', 'monster.ending.E.fr', 'monster.word.egg.fr']) {
      expect(emitted.has(id) || byId.has(id), id).toBe(true);
    }
  });
});
